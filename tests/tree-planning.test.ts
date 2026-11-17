import assert from "node:assert/strict";
import test from "node:test";
import { CARDS, CARD_BY_ID, type CredentialGroup } from "../src/data/cards";
import { buildPlannerCatalog } from "../src/lib/planner/catalog";
import { planAcquisition } from "../src/lib/planner/engine";
import { recommendAcquisitions } from "../src/lib/planner/recommendations";
import { evaluatePrepare } from "../src/lib/prepare";
import { layoutTree, NODE_H, NODE_W, planEdges } from "../src/lib/tree";
import { POST } from "../src/app/api/plans/tree/route";

const profile = { owned: ["psa", "school"], age: 20, facts: { enrolled: true, waiverRequested: false, sssEligible: true } };

test("recommendations compare personal paths, exclude held/ineligible IDs and retain selected-goal evidence", () => {
  const result = recommendAcquisitions({ ...profile, targetId: "mysss" }, "2026-11-18");
  assert.equal(result.recommendations[0].id, "philsys");
  assert.equal(result.recommendations[0].additionalAcquisitions, 0);
  assert.equal(result.nodes.school.status, "owned");
  assert.equal(result.nodes.senior.status, "ineligible");
  assert.ok(result.recommendations.every((r) => !profile.owned.includes(r.id) && CARD_BY_ID[r.id].kind === "id" && result.nodes[r.id].status !== "ineligible"));
  const plan = result.goal!.plans[0];
  assert.deepEqual(plan.steps.map((s) => s.id), ["philsys", "mysss"]);
  const evidence = planEdges(plan).map((e) => `${e.source}->${e.target}`);
  assert.ok(evidence.includes("psa->philsys"));
  assert.ok(evidence.includes("school->philsys"));
  assert.ok(evidence.includes("philsys->mysss"));
  assert.ok(!evidence.includes("passport->philsys"));
});

test("changing inventory and eligibility recomputes suggestions without assuming unanswered facts", () => {
  const changed = recommendAcquisitions({ ...profile, owned: [...profile.owned, "philsys"], facts: { ...profile.facts, sssEligible: false }, targetId: "mysss" }, "2026-11-18");
  assert.ok(!changed.recommendations.some((r) => ["philsys", "mysss"].includes(r.id)));
  assert.equal(changed.nodes.mysss.status, "ineligible");
  assert.equal(changed.goal?.status, "blocked");
  const unknown = recommendAcquisitions({ owned: ["psa", "school"], facts: { enrolled: true }, targetId: "philsys" }, "2026-11-18");
  assert.equal(unknown.nodes.philsys.status, "confirmation");
  assert.ok(unknown.goal!.plans[0].questions.some((q) => q.factId === "age"));
});

test("group names have no effect on graph positions or selected dependency ordering", () => {
  const input = { ...profile, targetId: "mysss" };
  const plan = planAcquisition(buildPlannerCatalog(input, "2026-11-18"), input.targetId).plans[0];
  const baseline = layoutTree(plan);
  const previous = CARDS.map((card) => card.group);
  try {
    CARDS.forEach((card) => { card.group = "specialized" as CredentialGroup; });
    assert.deepEqual(layoutTree(plan).placed.map((p) => [p.card.id, p.x, p.y]), baseline.placed.map((p) => [p.card.id, p.x, p.y]));
  } finally { CARDS.forEach((card, index) => { card.group = previous[index]; }); }
  const positions = new Map(baseline.placed.map((p) => [p.card.id, p]));
  for (const edge of baseline.pathEdges) assert.ok(positions.get(edge.source)!.y > positions.get(edge.target)!.y, `${edge.source} precedes ${edge.target}`);
  for (const p of baseline.placed) {
    assert.ok(p.x >= 0 && p.y >= 0 && p.x + NODE_W <= baseline.width && p.y + NODE_H <= baseline.height);
    for (const q of baseline.placed) if (p !== q) assert.ok(p.x + NODE_W <= q.x || q.x + NODE_W <= p.x || p.y + NODE_H <= q.y || q.y + NODE_H <= p.y, `${p.card.id} overlaps ${q.card.id}`);
  }
});

test("student passport route is conditional, cannot bypass enrollment, and preserves the adult registration requirement", () => {
  const input = { ...profile, targetId: "passport" };
  const student = planAcquisition(buildPlannerCatalog(input, "2026-11-18"), "passport");
  assert.deepEqual(student.plans[0].steps.map((s) => s.id), ["passport"]);
  const notStudent = planAcquisition(buildPlannerCatalog({ ...input, facts: { enrolled: false } }, "2026-11-18"), "passport");
  assert.ok(notStudent.plans.every((p) => !Object.values(p.choices).flat().some((id) => id.endsWith("student-identity"))));
  const rows = evaluatePrepare("passport", new Set(input.owned), new Set(["funds", "student-id"]), { age: 20, facts: { enrolled: true } });
  assert.equal(rows.complete, false);
  const identity = rows.nodes.find((n) => n.kind === "either");
  assert.ok(identity?.kind === "either" && identity.routes.find((r) => r.id === "student-identity")?.rows.some((r) => r.key === "student-registration" && !r.checked));
  const unknown = planAcquisition(buildPlannerCatalog({ ...input, facts: {} }, "2026-11-18"), "passport");
  for (const plan of unknown.plans.filter((p) => Object.values(p.choices).flat().some((id) => id.endsWith("student-identity")))) assert.ok(plan.questions.some((q) => q.factId === "enrolled"));
});

test("tree endpoint accepts an optional goal, validates the same private profile fields and disables caching", async () => {
  const request = (body: unknown) => new Request("http://localhost/api/plans/tree", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  const response = await POST(request({ ...profile, targetId: "mysss" }));
  assert.equal(response.status, 200);
  assert.equal(response.headers.get("Cache-Control"), "no-store");
  const result = await response.json();
  assert.equal(result.goal.targetId, "mysss");
  assert.equal(result.recommendations[0].id, "philsys");
  for (const bad of [null, [], { ...profile, targetId: "__proto__" }, { ...profile, groups: ["identity"] }, { ...profile, name: "Not collected" }, { ...profile, maxOperations: 999999 }]) assert.equal((await POST(request(bad))).status, 400);
});
