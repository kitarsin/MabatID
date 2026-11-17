import assert from "node:assert/strict";
import test from "node:test";
import { POST } from "../src/app/api/plans/preview/route";
import { parsePlanningInput } from "../src/lib/planner/request";
import type { PlanningResult } from "../src/lib/planner/types";

const body = { targetId: "passport", owned: ["psa", "philsys"], age: 20 };
const request = (data: unknown) =>
  new Request("http://localhost/api/plans/preview", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });

test("planning endpoint returns an uncached private preview without mutating the request", async () => {
  const before = structuredClone(body);
  const response = await POST(request(body));
  assert.equal(response.status, 200);
  assert.equal(response.headers.get("cache-control"), "no-store");
  const result = (await response.json()) as PlanningResult;
  assert.deepEqual(
    result.plans[0].steps.map((s) => s.id),
    ["passport"],
  );
  assert.equal(result.status, "planned");
  assert.deepEqual(body, before);
});

test("API recalculates from each request rather than retaining another profile's documents", async () => {
  const owned = (await (await POST(request(body))).json()) as PlanningResult;
  const missing = (await (
    await POST(
      request({
        ...body,
        owned: ["psa", "school"],
        facts: { enrolled: true, waiverRequested: false },
      }),
    )
  ).json()) as PlanningResult;
  assert.equal(owned.plans[0].steps.length, 1);
  assert.deepEqual(
    missing.plans[0].steps.map((s) => s.id),
    ["philsys", "passport"],
  );
});

test("transport validation rejects unknown IDs, fields, facts, checklists, and invalid scalar types", async () => {
  const invalid = [
    null,
    [],
    {},
    { ...body, targetId: "unknown" },
    { ...body, targetId: "__proto__" },
    { ...body, targetId: "constructor" },
    { ...body, owned: ["unknown"] },
    { ...body, owned: "psa" },
    { ...body, owned: Array(201).fill("psa") },
    { ...body, age: 20.5 },
    { ...body, age: -1 },
    { ...body, age: 121 },
    { ...body, age: "20" },
    { ...body, email: "not-collected@example.com" },
    { ...body, asOf: "1900-01-01" },
    { ...body, maxOperations: 999999999 },
    { ...body, facts: { enrolled: "yes" } },
    { ...body, facts: { unknown: true } },
    { ...body, prep: { passport: ["not-a-key"] } },
    { ...body, modes: { passport: "mail" } },
    { ...body, modes: { school: "online" } },
    { ...body, budget: "unlimited" },
    { ...body, setup: "remote" },
    { ...body, objective: "random" },
    { ...body, documents: { unknown: {} } },
    { ...body, documents: { "barangay-id": { number: "do-not-collect" } } },
    { ...body, documents: { "barangay-id": { expiresOn: "2026-02-30" } } },
    { ...body, documents: { "barangay-id": { photoSignature: "yes" } } },
    JSON.parse('{"targetId":"passport","facts":{"__proto__":true}}'),
  ];
  for (const value of invalid) {
    const response = await POST(request(value));
    assert.equal(response.status, 400, JSON.stringify(value));
    assert.equal(response.headers.get("cache-control"), "no-store");
    assert.equal((await response.json()).error.code, "INVALID_REQUEST");
  }
});

test("JSON parser enforces media type, size and well-formed bodies", async () => {
  for (const contentType of ["text/plain", "application/jsonjunk"]) {
    const response = await POST(
      new Request("http://localhost/api/plans/preview", {
        method: "POST",
        headers: { "Content-Type": contentType },
        body: JSON.stringify(body),
      }),
    );
    assert.equal(response.status, 415);
  }
  const malformed = await POST(
    new Request("http://localhost/api/plans/preview", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: "{",
    }),
  );
  assert.equal(malformed.status, 400);
  const noBody = await POST(
    new Request("http://localhost/api/plans/preview", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
    }),
  );
  assert.equal(noBody.status, 400);
  const oversized = await POST(
    new Request("http://localhost/api/plans/preview", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: " ".repeat(65537),
    }),
  );
  assert.equal(oversized.status, 413);
  const declaredOversized = await POST(
    new Request("http://localhost/api/plans/preview", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Content-Length": "65537",
      },
      body: "{}",
    }),
  );
  assert.equal(declaredOversized.status, 413);
});

test("normalization deduplicates inventory and keeps unknown facts absent", () => {
  const parsed = parsePlanningInput({
    ...body,
    owned: ["psa", "psa"],
    age: null,
    facts: { enrolled: false },
  });
  assert.deepEqual(parsed.owned, ["psa"]);
  assert.equal(parsed.age, null);
  assert.equal(parsed.facts?.enrolled, false);
  assert.equal(parsed.facts?.guardian, undefined);
});
