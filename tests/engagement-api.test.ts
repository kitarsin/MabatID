import assert from "node:assert/strict";
import test from "node:test";
import { randomUUID } from "node:crypto";
import { engagementConfig, engagementHandler, type EngagementDatabase } from "../src/lib/engagement/server";
import { FEEDBACK_MAX_LENGTH, parseFeedback } from "../src/lib/engagement/protocol";

const config = { url: "https://example.supabase.co", secretKey: "sb_secret_test", signingSecret: "a".repeat(64) };
class Database implements EngagementDatabase {
  liked = new Set<string>();
  feedback = new Map<string, string>();
  counters = new Map<string, number>();
  fail = false;
  async rpc(name: string, p: Record<string, unknown>) {
    if (this.fail) throw new Error("PRIVATE DATABASE DETAILS");
    if (name === "mabatid_engagement_rate") {
      const count = (this.counters.get(String(p.p_bucket)) ?? 0) + 1;
      this.counters.set(String(p.p_bucket), count);
      return count <= Number(p.p_limit);
    }
    if (name === "mabatid_feedback_submit") {
      const key = `${p.p_browser_hash}:${p.p_submission_id}`, value = JSON.stringify([p.p_message, p.p_rating]);
      if (!this.feedback.has(key)) this.feedback.set(key, value);
      return this.feedback.get(key) === value;
    }
    const hash = String(p.p_browser_hash), already = this.liked.has(hash);
    if (name === "mabatid_like_add") this.liked.add(hash);
    return { week: "2026-11-16", nextResetAt: "2026-11-22T16:00:00Z", count: this.liked.size, liked: this.liked.has(hash), already };
  }
}
function request(action = "likes", cookie?: string, body?: unknown, headers: Record<string, string> = {}) {
  return new Request(`http://localhost/api/${action}`, { method: "POST", headers: {
    Origin: "http://localhost", ...(cookie ? { Cookie: cookie } : {}), ...(body ? { "Content-Type": "application/json" } : {}), ...headers,
  }, ...(body ? { body: JSON.stringify(body) } : {}) });
}
async function setup() {
  const db = new Database(), handle = engagementHandler(config, db);
  const res = await handle(new Request("http://localhost/api/likes"), "likes");
  return { db, handle, res, cookie: res.headers.get("set-cookie")!.split(";")[0] };
}
const feedback = () => ({ submissionId: randomUUID(), message: "The document checklist was helpful.", rating: 5 });

test("engagement configuration validates secrets and keeps forwarded IPs opt-in", () => {
  assert.equal(engagementConfig({}), null);
  assert.equal(engagementConfig({ SUPABASE_URL: "http://example.com", SUPABASE_SECRET_KEY: "key", ENGAGEMENT_SECRET: config.signingSecret }), null);
  assert.equal(engagementConfig({ SUPABASE_URL: config.url, SUPABASE_SECRET_KEY: "key", ENGAGEMENT_SECRET: "short" }), null);
  const result = engagementConfig({ SUPABASE_URL: config.url, SUPABASE_SECRET_KEY: "key", TRANSFER_CODE_SECRET: config.signingSecret });
  assert.equal(result?.signingSecret, config.signingSecret);
  assert.equal(result?.trustedIpHeader, undefined);
});

test("signed browser cookies persist weekly likes across reloads and reject tampering", async () => {
  const { db, handle, res, cookie } = await setup();
  assert.equal(res.status, 200);
  assert.match(res.headers.get("set-cookie")!, /HttpOnly; SameSite=Lax/);
  assert.match(res.headers.get("cache-control")!, /no-store/);
  assert.equal((await res.json()).count, 0);
  const first = await handle(request("likes", cookie), "likes");
  assert.equal(first.status, 200); assert.equal((await first.json()).liked, true);
  assert.equal((await handle(request("likes", cookie), "likes")).status, 409);
  const reload = await handle(new Request("http://localhost/api/likes", { headers: { Cookie: cookie } }), "likes");
  assert.equal((await reload.json()).liked, true);
  assert.equal(reload.headers.get("set-cookie"), null);
  const tampered = cookie.slice(0, -1) + (cookie.endsWith("0") ? "1" : "0");
  assert.equal((await handle(request("likes", tampered), "likes")).status, 428);
  assert.equal((await handle(request(), "likes")).status, 428);
  assert.equal(db.liked.size, 1);
  const secure = await handle(new Request("https://mabatid.example/api/likes"), "likes");
  assert.match(secure.headers.get("set-cookie")!, /; Secure/);
});

test("origin checks reject cross-site writes and never trust forwarded host headers", async () => {
  const { handle, cookie, db } = await setup();
  const attempts: Record<string, string>[] = [{ Origin: "https://evil.example" }, { Origin: "http://localhost", "Sec-Fetch-Site": "cross-site" }, { Origin: "https://evil.example", "X-Forwarded-Host": "evil.example" }, { Origin: "null" }];
  for (const headers of attempts) {
    assert.equal((await handle(request("likes", cookie, undefined, headers), "likes")).status, 403);
  }
  const missing = new Request("http://localhost/api/likes", { method: "POST", headers: { Cookie: cookie } });
  assert.equal((await handle(missing, "likes")).status, 403);
  assert.equal(db.liked.size, 0);
});

test("feedback validates input, keeps plain text private, and makes retries idempotent", async () => {
  const { handle, cookie, db } = await setup();
  const input = feedback();
  input.message = "  <script>alert('literal text')</script>  ";
  assert.equal((await handle(request("feedback", cookie, input), "feedback")).status, 200);
  assert.equal((await handle(request("feedback", cookie, input), "feedback")).status, 200);
  assert.equal(db.feedback.size, 1);
  assert.equal((await handle(request("feedback", cookie, { ...input, message: "A different feedback message" }), "feedback")).status, 409);
  assert.equal((await handle(new Request("http://localhost/api/feedback"), "feedback")).status, 405);
  for (const invalid of [{ ...feedback(), message: "         " }, { ...feedback(), message: "x".repeat(FEEDBACK_MAX_LENGTH + 1) }, { ...feedback(), rating: 6 }, { ...feedback(), rating: 1.5 }, { ...feedback(), profile: { name: "Do not upload" } }, { ...feedback(), submissionId: "invalid" }]) {
    assert.equal((await handle(request("feedback", cookie, invalid), "feedback")).status, 400);
  }
  assert.equal(parseFeedback({ ...feedback(), rating: undefined })?.rating, null);
  assert.equal(parseFeedback({ ...feedback(), message: "embedded\0null character" }), null);
});

test("feedback bodies are bounded even when content-length is absent or misleading", async () => {
  const { handle, cookie } = await setup();
  const headers = { Cookie: cookie, Origin: "http://localhost", "Content-Type": "application/json" };
  const lengths: Record<string, string>[] = [{}, { "Content-Length": "1" }];
  for (const extra of lengths) {
    const req = new Request("http://localhost/api/feedback", { method: "POST", headers: { ...headers, ...extra }, body: JSON.stringify({ message: "x".repeat(18000) }) });
    assert.equal((await handle(req, "feedback")).status, 413);
  }
  const invalid = new Request("http://localhost/api/feedback", { method: "POST", headers, body: "{" });
  assert.equal((await handle(invalid, "feedback")).status, 400);
  assert.equal((await handle(request("feedback", cookie, feedback(), { "Content-Type": "text/plain" }), "feedback")).status, 415);
});

test("shared browser limits span handler instances and report retry advice", async () => {
  const { handle, cookie, db } = await setup();
  for (let i = 0; i < 3; i++) assert.equal((await handle(request("feedback", cookie, feedback(), { "X-Forwarded-For": String(i) }), "feedback")).status, 200);
  const res = await engagementHandler(config, db)(request("feedback", cookie, feedback()), "feedback");
  assert.equal(res.status, 429); assert.equal(res.headers.get("retry-after"), "3600");
  assert.equal(db.feedback.size, 3);
  assert.equal([...db.counters.keys()].some((key) => key.startsWith("ip:")), false);
  const { cookie: other } = await setup();
  const ipConfig = { ...config, trustedIpHeader: "x-real-ip" };
  await engagementHandler(ipConfig, db)(request("likes", other, undefined, { "X-Real-IP": "192.0.2.20" }), "likes");
  assert.equal([...db.counters.keys()].some((key) => key.startsWith("ip:likes:") && !key.includes("192.0.2.20")), true);
});

test("unavailable configuration and database failures fail closed without leaking details", async () => {
  const { handle, cookie, db } = await setup();
  assert.equal((await engagementHandler(null)(request(), "likes")).status, 503);
  db.fail = true;
  const response = await handle(request("feedback", cookie, feedback()), "feedback");
  assert.equal(response.status, 503);
  assert.equal(await response.text(), '{"error":"unavailable"}');
});
