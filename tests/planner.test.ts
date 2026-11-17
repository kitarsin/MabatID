import assert from "node:assert/strict";
import test from "node:test";
import { CARDS } from "../src/data/cards";
import {
  buildPlannerCatalog,
  type PlanningInput,
} from "../src/lib/planner/catalog";
import { planAcquisition, topologicalOrder } from "../src/lib/planner/engine";
import type {
  DocumentRule,
  PlannerCatalog,
  PlannerRoute,
  Rule,
} from "../src/lib/planner/types";

const all = (id: string, ...children: Rule[]): Rule => ({
  kind: "all",
  id,
  children,
});
const any = (id: string, ...options: Rule[]): Rule => ({
  kind: "any",
  id,
  options,
});
const doc = (owner: string, id: string): DocumentRule => ({
  kind: "document",
  id: `${owner}:${id}`,
  forId: owner,
  documentId: id,
  label: id,
  state: "missing",
});
function route(
  id: string,
  requirements = all(`${id}:requirements`),
  fee = 0,
): PlannerRoute {
  return {
    id,
    mode: "onsite",
    label: "On-site",
    requirements,
    fee: { min: fee, max: fee },
    eligibility: [],
    preferenceMismatch: false,
    overBudget: false,
    canStart: true,
    procedure: [],
  };
}
function catalog(nodes: Record<string, PlannerRoute[]>): PlannerCatalog {
  return {
    version: "test-v1",
    asOf: "2026-11-17",
    acquisitions: Object.fromEntries(
      Object.entries(nodes).map(([id, routes]) => [
        id,
        { id, name: id, kind: "id", owned: false, routes, refs: [] },
      ]),
    ),
    documents: Object.fromEntries(
      Object.keys(nodes).map((id) => [id, { name: id, acquisitionId: id }]),
    ),
  };
}
function actual(input: PlanningInput) {
  return planAcquisition(
    buildPlannerCatalog(input, "2026-11-17"),
    input.targetId,
    { objective: input.objective },
  );
}

test("backward chaining orders a prerequisite chain and counts shared acquisitions once", () => {
  const c = catalog({
    root: [
      route("root:r", all("root:req", doc("root", "a"), doc("root", "b")), 10),
    ],
    a: [route("a:r", doc("a", "shared"), 2)],
    b: [route("b:r", doc("b", "shared"), 3)],
    shared: [route("shared:r", undefined, 5)],
  });
  const plan = planAcquisition(c, "root").plans[0];
  assert.deepEqual(
    plan.steps.map((s) => s.id),
    ["shared", "a", "b", "root"],
  );
  assert.deepEqual(plan.fees, { min: 20, max: 20 });
  assert.deepEqual(plan.steps.at(-1)?.prerequisites, ["a", "b"]);
  assert.deepEqual(plan.missingDocuments, ["a", "b", "shared"]);
});

test("branch evaluation considers combinations globally rather than choosing each local minimum", () => {
  // Locally a and b each prefer a different free prerequisite. Globally shared is one acquisition.
  const c = catalog({
    root: [
      route("root:r", all("root:req", doc("root", "a"), doc("root", "b"))),
    ],
    a: [route("a:r", any("a:choice", doc("a", "x"), doc("a", "shared")))],
    b: [route("b:r", any("b:choice", doc("b", "y"), doc("b", "shared")))],
    x: [route("x:r")],
    y: [route("y:r")],
    shared: [route("shared:r", undefined, 10)],
  });
  const result = planAcquisition(c, "root");
  assert.equal(result.search.complete, true);
  assert.deepEqual(
    result.plans[0].steps.map((s) => s.id),
    ["shared", "a", "b", "root"],
  );
  const cheaper = planAcquisition(c, "root", { objective: "lowest-fees" })
    .plans[0];
  assert.deepEqual(
    cheaper.steps.map((s) => s.id),
    ["x", "a", "y", "b", "root"],
  );
});

test("already held documents satisfy alternatives without adding acquisition steps", () => {
  const held = { ...doc("root", "held"), state: "satisfied" as const };
  const c = catalog({
    root: [route("root:r", any("root:choice", doc("root", "new"), held))],
    new: [route("new:r")],
  });
  const result = planAcquisition(c, "root");
  assert.deepEqual(
    result.plans[0].steps.map((s) => s.id),
    ["root"],
  );
  assert.equal(result.plans[0].satisfied[0].documentId, "held");
  c.acquisitions.root.owned = true;
  assert.equal(planAcquisition(c, "root").status, "owned");
});

test("threshold requirements count distinct document types and preserve their choices", () => {
  const a = { ...doc("root", "a"), state: "satisfied" as const };
  const b = { ...doc("root", "b"), state: "satisfied" as const };
  const c = catalog({
    root: [
      route("root:r", {
        kind: "at-least",
        id: "two",
        count: 2,
        options: [a, a, b],
      }),
    ],
  });
  assert.deepEqual(planAcquisition(c, "root").plans[0].choices.two, ["a", "b"]);
  c.acquisitions.root.routes[0].requirements = {
    kind: "at-least",
    id: "two",
    count: 2,
    options: [a, a],
  };
  assert.equal(planAcquisition(c, "root").status, "blocked");
});

test("cycles invalidate only the circular branch and leave an acyclic alternative usable", () => {
  const c = catalog({
    root: [
      route("root:r", any("choice", doc("root", "loop"), doc("root", "safe"))),
    ],
    loop: [route("loop:r", doc("loop", "root"))],
    safe: [route("safe:r")],
  });
  const result = planAcquisition(c, "root");
  assert.deepEqual(
    result.plans[0].steps.map((s) => s.id),
    ["safe", "root"],
  );
  assert.ok(
    result.diagnostics.cycles.some(
      (cycle) => cycle.join() === "root,loop,root",
    ),
  );
  delete c.acquisitions.safe;
  delete c.documents.safe;
  assert.equal(planAcquisition(c, "root").status, "blocked");
  assert.equal(
    topologicalOrder(
      ["a", "b"],
      [
        ["a", "b"],
        ["b", "a"],
      ],
    ),
    null,
  );
  assert.equal(topologicalOrder(["a"], [["missing", "a"]]), null);
  assert.deepEqual(
    topologicalOrder(
      ["a", "b"],
      [
        ["a", "b"],
        ["a", "b"],
      ],
    ),
    ["a", "b"],
  );
});

test("shared prerequisites must use one compatible application route", () => {
  const c = catalog({
    root: [
      route("root:r", all("root:req", doc("root", "a"), doc("root", "b"))),
    ],
    a: [route("a:r", doc("a", "shared"))],
    b: [route("b:r", doc("b", "shared"))],
    shared: [route("shared:1"), route("shared:2")],
  });
  const result = planAcquisition(c, "root");
  for (const plan of result.plans)
    assert.equal(plan.steps.filter((s) => s.id === "shared").length, 1);
  assert.equal(result.plans[0].steps.length, 4);
});

test("unknown eligibility remains a question, false eligibility excludes a route", () => {
  const r = route("root:r");
  r.eligibility = [
    {
      id: "eligible",
      forId: "root",
      label: "Eligible?",
      kind: "eligibility",
      state: "unknown",
      factId: "eligible",
    },
  ];
  const c = catalog({ root: [r] });
  assert.equal(planAcquisition(c, "root").status, "needs-input");
  r.eligibility[0].state = "missing";
  assert.equal(planAcquisition(c, "root").status, "blocked");
});

test("confirmed route eligibility ranks ahead of an unconfirmed service with less preparation", () => {
  const onsite = route("root:onsite", {
    kind: "task",
    task: {
      id: "photo",
      forId: "root",
      label: "Confirm photo capture",
      kind: "preparation",
      state: "unknown",
    },
  });
  const online = route("root:online");
  online.eligibility = [
    {
      id: "online-available",
      forId: "root",
      label: "Online service available?",
      kind: "eligibility",
      state: "unknown",
    },
  ];
  const result = planAcquisition(catalog({ root: [online, onsite] }), "root");
  assert.equal(result.plans[0].steps[0].routeId, "root:onsite");
});

test("external documents stay explicit questions and existing-only IDs cannot be invented", () => {
  const c = catalog({ root: [route("root:r", doc("root", "external"))] });
  c.documents.external = { name: "External certificate" };
  const result = planAcquisition(c, "root");
  assert.equal(result.status, "needs-input");
  assert.deepEqual(
    result.plans[0].steps.map((s) => s.id),
    ["root"],
  );
  assert.match(result.plans[0].questions[0].label, /no acquisition guide/);
  c.documents.external.existingOnly = true;
  assert.equal(planAcquisition(c, "root").status, "blocked");
});

test("bounded exploration reports incompleteness instead of declaring an impossible path", () => {
  const c = catalog({
    root: [route("root:r", doc("root", "a"))],
    a: [route("a:r")],
  });
  const result = planAcquisition(c, "root", { maxOperations: 1 });
  assert.equal(result.status, "incomplete");
  assert.equal(result.search.complete, false);
  assert.equal(result.search.operations, 1);
});

test("a threshold combination found at the budget boundary is retained", () => {
  const c = catalog({
    root: [
      route("root:r", {
        kind: "at-least",
        id: "two",
        count: 2,
        options: [doc("root", "a"), doc("root", "b")],
      }),
    ],
    a: [route("a:r")],
    b: [route("b:r")],
  });
  assert.deepEqual(
    planAcquisition(c, "root", { maxOperations: 7 }).plans[0].steps.map(
      (s) => s.id,
    ),
    ["a", "b", "root"],
  );
});

test("ranking is deterministic, reports frontier truncation, and does not mutate catalog", () => {
  const c = catalog({
    root: [route("root:1"), route("root:2"), route("root:3")],
  });
  const before = structuredClone(c);
  assert.deepEqual(planAcquisition(c, "root"), planAcquisition(c, "root"));
  assert.deepEqual(c, before);
  assert.equal(
    planAcquisition(c, "root", { maxFrontier: 1 }).search.complete,
    false,
  );
  assert.throws(() => planAcquisition(c, "toString"), /Unknown/);
});

test("real Passport catalog uses the existing PSA and School ID to obtain National ID first", () => {
  const result = actual({
    targetId: "passport",
    owned: ["psa", "school"],
    age: 20,
    facts: { enrolled: true, waiverRequested: false },
  });
  assert.equal(result.status, "planned");
  assert.deepEqual(
    result.plans[0].steps.map((s) => s.id),
    ["philsys", "passport"],
  );
  const ready = actual({
    targetId: "passport",
    owned: ["psa", "philsys"],
    age: 20,
  });
  assert.deepEqual(
    ready.plans[0].steps.map((s) => s.id),
    ["passport"],
  );
  assert.deepEqual(
    new Set(ready.plans[0].steps[0].procedure.map((s) => s.channel)),
    new Set(["online", "onsite"]),
  );
});

test("NBI retains a proven student route when complex alternatives exhaust search budget", () => {
  const result = actual({
    targetId: "nbi",
    owned: ["psa", "school"],
    age: 20,
    facts: { enrolled: true, waiverRequested: false },
  });
  assert.equal(result.status, "planned");
  assert.deepEqual(
    result.plans[0].steps.map((s) => s.id),
    ["nbi"],
  );
  assert.equal(result.search.complete, false);
});

test("unknown local Cedula requirement is conditional rather than a forced prerequisite", () => {
  const input: PlanningInput = {
    targetId: "barangay-id",
    owned: ["psa", "utility-bill"],
    age: 20,
    modes: { "barangay-id": "onsite" },
    facts: {
      barangayIdEligible: true,
      barangayIdLiveCapture: true,
      barangayIdReplacement: false,
      barangayIdFeeWaived: false,
    },
  };
  const result = actual(input);
  assert.equal(result.status, "needs-input");
  assert.ok(
    result.plans[0].questions.some((q) => q.factId === "barangayIdNeedsCedula"),
  );
  assert.ok(!result.plans[0].steps.some((s) => s.id === "cedula"));
  const required = actual({
    ...input,
    facts: { ...input.facts, barangayIdNeedsCedula: true },
  });
  assert.ok(required.plans[0].steps.some((s) => s.id === "cedula"));
});

test("expired and undated Barangay ID stay unconfirmed; valid evidence can satisfy acceptance", () => {
  const input: PlanningInput = {
    targetId: "philsys",
    owned: ["barangay-id"],
    age: 20,
  };
  for (const evidence of [
    { expiresOn: "2025-01-01", philsysFields: true },
    { noPrintedExpiry: true, philsysFields: true },
  ]) {
    const result = actual({ ...input, documents: { "barangay-id": evidence } });
    assert.ok(
      result.plans[0].questions.some((q) => q.documentId === "barangay-id"),
    );
    assert.equal(result.status, "needs-input");
  }
  const result = actual({
    ...input,
    documents: {
      "barangay-id": { expiresOn: "2027-01-01", philsysFields: true },
    },
  });
  assert.equal(result.status, "planned");
  assert.deepEqual(
    result.plans[0].steps.map((s) => s.id),
    ["philsys"],
  );
});

test("saved application route is respected and online preferences never erase required visits", () => {
  const c = buildPlannerCatalog({
    targetId: "passport",
    owned: ["psa", "philsys"],
    age: 20,
    setup: "online",
    budget: "free",
    modes: { psa: "onsite" },
  });
  assert.deepEqual(
    c.acquisitions.psa.routes.map((r) => r.mode),
    ["onsite"],
  );
  const result = planAcquisition(c, "passport");
  assert.equal(result.plans[0].steps[0].mode, "hybrid");
  assert.equal(result.plans[0].steps[0].preferenceMismatch, true);
  assert.equal(result.plans[0].steps[0].overBudget, true);
});

test("every catalog target can be planned without reading illustrative tree parents", () => {
  const c = buildPlannerCatalog({ targetId: "passport", owned: [], age: 25 });
  assert.deepEqual(
    Object.keys(c.acquisitions).sort(),
    CARDS.map((card) => card.id).sort(),
  );
  for (const node of Object.values(c.acquisitions)) {
    assert.ok(node.routes.length > 0);
    for (const route of node.routes) assert.ok(route.procedure.length > 0);
  }
});
