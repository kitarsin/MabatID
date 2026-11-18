import assert from "node:assert/strict";
import test from "node:test";
import { planningRateLimiter, PLANNING_LIMITS } from "../src/lib/planner/rate-limit";
import { trustedIpHeader } from "../src/lib/server/client-ip";
import { engagementConfig, type EngagementDatabase } from "../src/lib/engagement/server";
import { relayConfig } from "../src/lib/transfers/server";
import { POST as treePost } from "../src/app/api/plans/tree/route";
import { POST as previewPost } from "../src/app/api/plans/preview/route";

const env = {
  NODE_ENV: "production", VERCEL: "1", VERCEL_ENV: "production",
  SUPABASE_URL: "https://example.supabase.co", SUPABASE_SECRET_KEY: "sb_secret_test",
  TRANSFER_CODE_SECRET: "a".repeat(64),
};
class Database implements EngagementDatabase {
  buckets = new Map<string, number>();
  fail = false;
  response: unknown = undefined;
  async rpc(name: string, args: Record<string, unknown>) {
    assert.equal(name, "mabatid_engagement_rate");
    assert.equal(args.p_seconds, 60);
    if (this.fail) throw new Error("PRIVATE DATABASE DETAILS");
    if (this.response !== undefined) return this.response;
    const key = String(args.p_bucket), count = (this.buckets.get(key) ?? 0) + 1;
    this.buckets.set(key, count);
    return count <= Number(args.p_limit);
  }
}
function request(ip = "192.0.2.10", path = "tree", extra: Record<string, string> = {}) {
  return new Request(`https://mabatid.example/api/plans/${path}`, {
    method: "POST", headers: { "x-vercel-forwarded-for": ip, ...extra },
  });
}

test("Vercel's trusted IP selection applies consistently to planning, transfers and engagement", () => {
  assert.equal(trustedIpHeader({}), undefined);
  assert.equal(trustedIpHeader({ VERCEL: "0" }), undefined);
  assert.equal(trustedIpHeader(env), "x-vercel-forwarded-for");
  assert.equal(trustedIpHeader(env, " X-Proxy-IP "), "x-proxy-ip");
  assert.equal(engagementConfig(env)?.trustedIpHeader, "x-vercel-forwarded-for");
  assert.equal(relayConfig(env)?.trustedIpHeader, "x-vercel-forwarded-for");
});

test("planner quotas are shared across paths and independent server instances without storing raw IPs", async () => {
  const db = new Database();
  for (let i = 0; i < PLANNING_LIMITS.client; i++) {
    const limit = planningRateLimiter(env, db);
    assert.equal(await limit(request("192.0.2.10", i % 2 ? "tree" : "preview", { "x-forwarded-for": `198.51.100.${i}` })), null);
  }
  const response = await planningRateLimiter(env, db)(request());
  assert.equal(response?.status, 429);
  assert.equal(response?.headers.get("Retry-After"), "60");
  assert.equal(response?.headers.get("Cache-Control"), "no-store");
  assert.equal((await response?.json()).error.code, "RATE_LIMITED");
  assert.equal(db.buckets.get("planning:production:global"), PLANNING_LIMITS.client);
  assert.equal(db.buckets.size, 2);
  assert.ok([...db.buckets.keys()].every((key) => !key.includes("192.0.2.10") && !key.includes("198.51.100")));
  assert.equal(await planningRateLimiter(env, db)(request("2001:db8::1")), null);
});

test("the overall quota bounds requests from rotating IPs", async () => {
  const db = new Database();
  db.buckets.set("planning:production:global", PLANNING_LIMITS.global);
  assert.equal((await planningRateLimiter(env, db)(request("192.0.2.11")))?.status, 429);
  assert.equal((await planningRateLimiter(env, db)(request("192.0.2.12")))?.status, 429);
});

test("production fails closed for missing secrets, failed counters and missing Vercel metadata", async () => {
  const db = new Database();
  for (const invalid of ["", "not-an-ip", "192.0.2.1, 198.51.100.2"]) {
    assert.equal((await planningRateLimiter(env, db)(request(invalid)))?.status, 503);
  }
  assert.equal((await planningRateLimiter({ ...env, SUPABASE_SECRET_KEY: undefined }, db)(request()))?.status, 503);
  assert.equal(db.buckets.size, 0);
  db.fail = true;
  const failed = await planningRateLimiter(env, db)(request());
  assert.equal(failed?.status, 503);
  assert.ok(!(await failed!.text()).includes("PRIVATE"));
  db.fail = false;
  db.response = null;
  assert.equal((await planningRateLimiter(env, db)(request()))?.status, 503);
});

test("preview quotas do not drain production quotas and local tests do not use the database", async () => {
  const db = new Database();
  db.buckets.set("planning:production:global", PLANNING_LIMITS.global);
  assert.equal(await planningRateLimiter({ ...env, VERCEL_ENV: "preview" }, db)(request()), null);
  assert.equal(db.buckets.get("planning:preview:global"), 1);
  const previous = db.buckets.size;
  db.fail = true;
  assert.equal(await planningRateLimiter({ NODE_ENV: "test" }, db)(request()), null);
  assert.equal(await planningRateLimiter({ NODE_ENV: "development" }, db)(request()), null);
  assert.equal(db.buckets.size, previous);
  // A hosted preview remains protected even with a non-production NODE_ENV.
  assert.equal((await planningRateLimiter({ ...env, NODE_ENV: "development" }, db)(request()))?.status, 503);
});

test("self-hosted production trusts only an explicitly configured proxy header", async () => {
  const db = new Database();
  assert.equal(await planningRateLimiter({ ...env, VERCEL: "0" }, db)(request()), null);
  assert.equal(db.buckets.size, 1);
  assert.equal(await planningRateLimiter({ ...env, VERCEL: "0", PLANNING_TRUSTED_IP_HEADER: "x-proxy-ip" }, db)(request("", "tree", { "x-proxy-ip": "192.0.2.1" })), null);
  assert.equal(db.buckets.size, 2);
});

test("both deployed route entrypoints enforce the guard before parsing or running the planner", async () => {
  const previous = Object.fromEntries(Object.keys(env).map((key) => [key, process.env[key]]));
  try {
    Object.assign(process.env, env);
    for (const [path, post] of [["tree", treePost], ["preview", previewPost]] as const) {
      const res = await post(new Request(`https://mabatid.example/api/plans/${path}`, {
        method: "POST", headers: { "Content-Type": "application/json" }, body: "{",
      }));
      assert.equal(res.status, 503);
      assert.equal((await res.json()).error.code, "PLANNING_UNAVAILABLE");
    }
  } finally {
    for (const [key, value] of Object.entries(previous)) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  }
});
