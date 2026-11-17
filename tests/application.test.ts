import assert from "node:assert/strict";
import test from "node:test";
import { CARDS, CARD_BY_ID } from "../src/data/cards";
import { DETAILS } from "../src/data/details";
import { EXTRA_DOCUMENTS } from "../src/data/documents";
import { FACTS, type ProfileFacts } from "../src/data/facts";
import {
  evaluateApplication,
  evaluatePrepare,
  procedureSteps,
  preparationKeys,
  stepKey,
  trackProgress,
} from "../src/lib/prepare";
import { evaluateEligibility } from "../src/lib/eligibility";
import { normalizeProfile, parseProfiles } from "../src/lib/profile";
import { buildEdges, statusOf } from "../src/lib/tree";
import { matchSet, NO_FILTERS } from "../src/lib/filters";
import { fitsBudget, fitsSetup } from "../src/lib/prefs";

const noDocuments = new Set<string>();
const context = { age: 30, facts: { waiverRequested: false } };
function row(
  cardId: string,
  key: string,
  owned = noDocuments,
  facts: ProfileFacts = {},
) {
  return evaluatePrepare(cardId, owned, new Set(), { age: 30, facts })
    .nodes.flatMap((n) =>
      n.kind === "row" ? [n.row] : n.routes.flatMap((r) => r.rows),
    )
    .find((r) => r.key === key);
}
function allKeys(cardId: string) {
  return [...preparationKeys(cardId)];
}

test("tree readiness uses the same evaluation as requirements for every target", () => {
  for (const card of CARDS)
    for (const held of [[], ["psa"], ["school"], ["passport", "psa"]]) {
      const owned = new Set(held);
      const facts: ProfileFacts = { enrolled: true, waiverRequested: false };
      const prep = { [card.id]: ["funds"] };
      const state = evaluateApplication(card.id, owned, prep[card.id], {
        age: 30,
        facts,
      });
      assert.equal(
        statusOf(card, owned, { age: 30, facts, prep }),
        owned.has(card.id) ? "owned" : state.ready ? "available" : "locked",
      );
    }
});

test("a single PSA or School ID cannot satisfy the modeled two-document routes", () => {
  for (const [id, held] of [
    ["nbi", "psa"],
    ["npc", "school"],
    ["philsys", "psa"],
  ]) {
    const state = evaluatePrepare(
      id,
      new Set([held]),
      new Set(["funds"]),
      context,
    );
    assert.equal(
      state.nodes.find((n) => n.kind === "either" || n.row.key === "valid-ids")
        ?.kind === "either"
        ? (
            state.nodes.find((n) => n.kind === "either") as {
              complete: boolean;
            }
          ).complete
        : row(id, "valid-ids", new Set([held]))?.checked,
      false,
    );
  }
});

test("two distinct modeled valid IDs satisfy the NBI identity route", () => {
  const node = evaluatePrepare(
    "nbi",
    new Set(["passport", "lto"]),
    new Set(),
    context,
  ).nodes.find((n) => n.kind === "either");
  assert.equal(node?.kind === "either" && node.complete, true);
});

test("a parent's own certificate cannot satisfy the child's certificate", () => {
  assert.equal(
    row("soloparent", "child-birth-certificate", new Set(["psa"]))?.checked,
    false,
  );
  assert.equal(
    row("soloparent", "child-birth-certificate", new Set(["child:psa"]))
      ?.checked,
    true,
  );
});

test("UMID is distinct from MySSS Card in the National ID primary route", () => {
  const primary = (owned: string) =>
    evaluatePrepare("philsys", new Set([owned]), new Set(), context).nodes.find(
      (n) => n.kind === "either",
    );
  const umid = primary("umid");
  const mysss = primary("mysss");
  assert.equal(umid?.kind === "either" && umid.routes[0].complete, true);
  assert.equal(mysss?.kind === "either" && mysss.routes[0].complete, false);
});

test("conditional requirements are unknown, excluded, or mandatory according to the answer", () => {
  assert.equal(row("barangay", "cedula")?.unknown, true);
  assert.equal(
    row("barangay", "cedula", noDocuments, { needsCedula: false }),
    undefined,
  );
  const needed = row("barangay", "cedula", noDocuments, { needsCedula: true });
  assert.equal(needed?.checked, false);
  assert.equal(needed?.opt, false);
});

test("budget preferences never attest payment or assume a fee waiver", () => {
  assert.equal(row("nbi", "funds")?.checked, false);
  assert.equal(fitsBudget("nbi", "free"), false);
  assert.equal(fitsBudget("npc", "free"), false);
  assert.equal(fitsBudget("barangay", "free"), false);
  assert.equal(fitsBudget("philsys", "free"), true);
  assert.equal(fitsBudget("psa", "low", "onsite"), true);
  assert.equal(fitsBudget("psa", "low", "online"), false);
});

test("possession does not attest photocopies or a passport's remaining validity", () => {
  assert.equal(
    row("passport", "accepted-id", new Set(["philsys"]))?.checked,
    false,
  );
  assert.equal(row("owwa", "passport", new Set(["passport"]))?.checked, false);
});

test("requirement and step keys survive reordered checklist content and edited wording", () => {
  const original = DETAILS.psa.req.prepare;
  try {
    DETAILS.psa.req.prepare = [...original].reverse();
    const state = evaluatePrepare(
      "psa",
      noDocuments,
      new Set(["birth-details"]),
      { age: 30 },
    );
    const found = state.nodes.find(
      (n) => n.kind === "row" && n.row.key === "birth-details",
    );
    assert.equal(found?.kind === "row" && found.row.checked, true);
    const step = DETAILS.psa.steps.online[0];
    const edited = { ...step, t: "Different display wording" };
    assert.equal(stepKey(edited), stepKey(step));
  } finally {
    DETAILS.psa.req.prepare = original;
  }
});

test("eligibility handles unknown, false and age restrictions without blocking recorded ownership", () => {
  assert.equal(evaluateEligibility("school", 20).status, "unknown");
  assert.equal(
    evaluateEligibility("school", 20, { enrolled: false }).status,
    "ineligible",
  );
  assert.equal(evaluateEligibility("senior", 20).status, "ineligible");
  const state = evaluateApplication("senior", noDocuments, allKeys("senior"), {
    age: 20,
  });
  assert.equal(state.ready, false);
  assert.equal(
    state.steps.some((s) => s.enabled),
    false,
  );
  assert.equal(
    statusOf(CARD_BY_ID.senior, new Set(["senior"]), { age: 20 }),
    "owned",
  );
});

test("online booking can begin before obtaining the appointment packet", () => {
  const state = evaluateApplication("passport", noDocuments, [], { age: 30 });
  assert.equal(state.prep.complete, false);
  assert.equal(state.steps[0].enabled, true);
  const firstVisit = state.steps.find((s) => s.mode === "onsite");
  assert.equal(firstVisit?.enabled, false);
});

test("PSA booking produces the appointment requirement without a checklist deadlock", () => {
  const state = evaluateApplication(
    "psa",
    noDocuments,
    ["step:onsite:book-appointment"],
    { age: 30, mode: "onsite" },
  );
  assert.equal(state.steps[0].checked, true);
  const appointment = state.prep.nodes.find(
    (n) => n.kind === "row" && n.row.key === "appointment",
  );
  assert.equal(appointment?.kind === "row" && appointment.row.checked, true);
  const online = evaluatePrepare("psa", noDocuments, new Set(), {
    age: 30,
    mode: "online",
  });
  assert.equal(
    online.nodes.some((n) => n.kind === "row" && n.row.key === "appointment"),
    false,
  );
});

test("NBI online completion still requires the entire in-person phase", () => {
  const onlineKeys = DETAILS.nbi.steps.online.map(stepKey);
  const keys = [
    "funds",
    "identity-routes-supporting-identity",
    "identity-routes-supporting-support",
    ...onlineKeys,
  ];
  const state = evaluateApplication(
    "nbi",
    new Set(["psa", "school"]),
    keys,
    context,
  );
  assert.equal(
    state.steps.filter((s) => s.mode === "online").every((s) => s.checked),
    true,
  );
  assert.equal(
    state.steps.filter((s) => s.mode === "onsite").every((s) => !s.checked),
    true,
  );
  assert.equal(state.steps.find((s) => s.mode === "onsite")?.enabled, true);
  const progress = trackProgress(
    "nbi",
    new Set(["psa", "school"]),
    keys,
    context,
  );
  assert.ok(progress.pct < 100);
  assert.notEqual(progress.stage, "Ready to collect");
});

test("hybrid phases count together regardless of preference; route preference never bypasses a visit", () => {
  assert.equal(
    procedureSteps("nbi", { setup: "online" }).length,
    DETAILS.nbi.steps.online.length + DETAILS.nbi.steps.onsite.length,
  );
  assert.equal(
    procedureSteps("nbi", { setup: "onsite" }).length,
    procedureSteps("nbi", { setup: "online" }).length,
  );
  assert.equal(fitsSetup("passport", "online"), false);
  assert.equal(fitsSetup("postal", "online"), false);
  assert.equal(fitsSetup("psa", "online"), true);
});

test("explicit alternative routes control progress rather than whichever has more ticks", () => {
  const online = DETAILS.psa.steps.online.map(stepKey);
  const state = evaluateApplication("psa", noDocuments, online, {
    age: 30,
    mode: "onsite",
  });
  assert.equal(
    state.steps.every((s) => s.mode === "onsite" && !s.checked),
    true,
  );
});

test("removing an upstream step invalidates downstream completion", () => {
  const keys = DETAILS.passport.steps.online.slice(1).map(stepKey);
  const state = evaluateApplication("passport", noDocuments, keys, { age: 30 });
  assert.equal(
    state.steps.some((s) => s.checked),
    false,
  );
});

test("finishing an application requires a separate receipt confirmation for 100 percent", () => {
  const progress = trackProgress(
    "nbi",
    new Set(["psa", "school"]),
    allKeys("nbi"),
    context,
  );
  assert.ok(progress.pct < 100);
  assert.equal(progress.stage, "Confirm you received this ID");
  assert.equal(trackProgress("nbi", new Set(["nbi"]), [], {}).pct, 100);
});

test("every authored route can be completed without a preparation dependency cycle", () => {
  const facts = Object.fromEntries(
    Object.keys(FACTS).map((id) => [id, true]),
  ) as ProfileFacts;
  const owned = new Set([
    ...CARDS.map((c) => c.id),
    ...EXTRA_DOCUMENTS.map((d) => d.id),
  ]);
  for (const card of CARDS)
    for (const mode of ["online", "onsite"] as const) {
      if (!DETAILS[card.id][mode]) continue;
      const held = new Set(owned);
      held.delete(card.id);
      const state = evaluateApplication(card.id, held, allKeys(card.id), {
        age: 65,
        facts,
        mode,
      });
      assert.equal(state.prep.complete, true, `${card.id}:${mode} prep`);
      assert.equal(
        state.steps.every((s) => s.checked),
        true,
        `${card.id}:${mode} steps`,
      );
    }
});

test("catalog keys and references are valid, unique, and independent of text or ordering", () => {
  const documents = new Set([
    ...CARDS.map((c) => c.id),
    ...EXTRA_DOCUMENTS.map((d) => d.id),
  ]);
  for (const card of CARDS) {
    const d = DETAILS[card.id];
    const rows = d.req.prepare.flatMap((e) =>
      "either" in e ? e.either.flatMap((r) => r.items) : [e],
    );
    assert.equal(
      new Set(rows.map((r) => r.id)).size,
      rows.length,
      `${card.id} requirements`,
    );
    const steps = [...d.steps.onsite, ...d.steps.online];
    assert.equal(
      new Set(steps.map((s) => s.id)).size,
      steps.length,
      `${card.id} steps`,
    );
    for (const r of rows) {
      for (const id of r.ids ?? [])
        assert.ok(documents.has(id), `${card.id}: unknown document ${id}`);
      if (r.completedBy)
        assert.ok(
          steps.some((s) => s.id === r.completedBy),
          `${card.id}: missing producer`,
        );
      assert.ok(!/^\d/.test(r.id));
    }
  }
  const acceptedAddress = buildEdges().some(
    (e) => e.source === "barangay" && e.target === "postal",
  );
  assert.equal(acceptedAddress, true);
  assert.equal(
    buildEdges().some((e) => e.source === "psa" && e.target === "soloparent"),
    false,
  );
});

test("migration preserves documents/goals but drops credentials and positional checklist claims", () => {
  const legacy = {
    id: "a",
    name: " Applicant ",
    email: "private@example.test",
    passHash: "secret",
    age: 20,
    owned: ["psa"],
    tracking: ["passport"],
    priority: "passport",
    prep: { passport: ["0", "s:online:0"] },
  };
  const profile = normalizeProfile(legacy, true)!;
  assert.deepEqual(profile.owned, ["psa"]);
  assert.deepEqual(profile.tracking, ["passport"]);
  assert.equal(profile.needsChecklistReview, true);
  assert.equal("email" in profile, false);
  assert.equal("passHash" in profile, false);
  assert.deepEqual(profile.prep, {});
});

test("profile normalization reconciles ownership edits, tracking and priority", () => {
  const profile = normalizeProfile({
    id: "a",
    name: "A",
    age: 30,
    owned: ["passport", "passport", "unknown", "child:psa"],
    tracking: ["passport", "nbi", "nbi", "unknown"],
    priority: "passport",
    facts: { enrolled: "yes", employed: true },
    prep: { nbi: ["funds", "0", "funds"] },
  })!;
  assert.deepEqual(profile.owned, ["passport", "child:psa"]);
  assert.deepEqual(profile.tracking, ["nbi"]);
  assert.equal(profile.priority, "nbi");
  assert.deepEqual(profile.facts, { employed: true });
  assert.deepEqual(profile.prep?.nbi, ["funds"]);
  assert.deepEqual(parseProfiles([null, {}, { ...profile, age: -1 }]), []);
});

test("fee ranges retain unknown conditions and account for selected replacement/income cases", () => {
  assert.equal(fitsBudget("school", "free", "onsite"), false);
  assert.equal(
    fitsBudget("school", "free", "onsite", { replacement: false }),
    true,
  );
  assert.equal(
    fitsBudget("school", "free", "onsite", { replacement: true }),
    false,
  );
  assert.equal(fitsBudget("cedula", "low", "onsite"), false);
  assert.equal(
    fitsBudget("cedula", "low", "onsite", { employed: false }),
    true,
  );
  assert.equal(fitsBudget("prc", "mid"), false);
  assert.equal(fitsBudget("lto", "mid"), false);
  assert.equal(fitsBudget("soloparent", "free"), false);
});

test("budget filters use the same chosen route and facts as the detail view", () => {
  const filter = { ...NO_FILTERS, budget: "low" as const };
  assert.equal(matchSet(filter, { setup: "online" })?.has("psa"), false);
  assert.equal(matchSet(filter, { setup: "onsite" })?.has("psa"), true);
  const free = { ...filter, budget: "free" as const };
  assert.equal(
    matchSet(free, { facts: { replacement: true } })?.has("school"),
    false,
  );
  assert.equal(
    matchSet(free, { facts: { replacement: false } })?.has("school"),
    true,
  );
});
