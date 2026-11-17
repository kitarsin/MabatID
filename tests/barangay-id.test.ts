import assert from "node:assert/strict";
import test from "node:test";
import { CARDS, CARD_BY_ID } from "../src/data/cards";
import { DETAILS } from "../src/data/details";
import { conditionFacts, type ProfileFacts } from "../src/data/facts";
import {
  documentValidity,
  documentUsable,
  isCalendarDate,
  type DocumentEvidenceMap,
} from "../src/lib/documents";
import { evaluatePrepare, evaluateApplication } from "../src/lib/prepare";
import { evaluateEligibility } from "../src/lib/eligibility";
import { estimateFee, fitsBudget } from "../src/lib/prefs";
import { normalizeProfile } from "../src/lib/profile";
import { buildEdges } from "../src/lib/tree";

const asOf = "2026-11-17";
const owned = new Set(["barangay-id"]);
const valid: DocumentEvidenceMap = {
  "barangay-id": {
    issuedOn: "2026-01-01",
    expiresOn: "2028-01-01",
    photoSignature: true,
    philsysFields: true,
    addressCurrent: true,
  },
};
function prepRow(
  card: string,
  key: string,
  documents: DocumentEvidenceMap = {},
  mode: "onsite" | "online" = "onsite",
  manual: string[] = [],
) {
  return evaluatePrepare(card, owned, new Set(manual), {
    age: 20,
    mode,
    documents,
    asOf,
  })
    .nodes.flatMap((n) =>
      n.kind === "row" ? [n.row] : n.routes.flatMap((r) => r.rows),
    )
    .find((r) => r.key === key);
}
function barangayPrep(age: number, facts: ProfileFacts) {
  return evaluatePrepare("barangay-id", new Set(), new Set(), {
    age,
    facts,
  }).nodes.flatMap((n) =>
    n.kind === "row" ? [n.row] : n.routes.flatMap((r) => r.rows),
  );
}

test("Barangay ID is a distinct starter credential; School ID and civil records have separate groups", () => {
  assert.equal(
    CARDS.filter((c) => c.group === "supporting")[0].id,
    "barangay-id",
  );
  assert.equal(CARD_BY_ID["barangay-id"].starter, true);
  assert.equal(CARD_BY_ID.barangay.group, "foundation");
  assert.equal(CARD_BY_ID.school.group, "supporting");
  assert.notEqual(DETAILS["barangay-id"], DETAILS.barangay);
});

test("starter route accepts LCRO evidence without a prior photo ID or enrollment", () => {
  const state = evaluatePrepare(
    "barangay-id",
    new Set(["lcro-birth"]),
    new Set(),
    { age: 20, facts: { enrolled: false, barangayIdEligible: true } },
  );
  const identity = state.nodes.find(
    (n) => n.kind === "row" && n.row.key === "identity",
  );
  assert.equal(identity?.kind === "row" && identity.row.checked, true);
  assert.equal(
    evaluateEligibility("barangay-id", 20, {
      enrolled: false,
      barangayIdEligible: true,
    }).status,
    "eligible",
  );
});

test("local age/residency eligibility is unknown until confirmed; minors also need guardian assistance", () => {
  assert.equal(evaluateEligibility("barangay-id", 20).status, "unknown");
  assert.equal(
    evaluateEligibility("barangay-id", 20, { barangayIdEligible: false })
      .status,
    "ineligible",
  );
  assert.equal(
    evaluateEligibility("barangay-id", 16, { barangayIdEligible: true }).status,
    "unknown",
  );
  assert.equal(
    evaluateEligibility("barangay-id", 16, {
      barangayIdEligible: true,
      guardian: true,
    }).status,
    "eligible",
  );
});

test("Cedula is never required from minors, even if the local adult requirement is true", () => {
  const condition = DETAILS["barangay-id"].req.prepare.find(
    (e) => e.id === "cedula",
  );
  assert.ok(condition && !("either" in condition) && condition.when);
  if (!condition || "either" in condition || !condition.when) return;
  assert.deepEqual(conditionFacts(condition.when, 16), []);
  assert.equal(
    barangayPrep(16, { barangayIdNeedsCedula: true }).some(
      (r) => r.key === "cedula",
    ),
    false,
  );
  assert.equal(
    barangayPrep(18, { barangayIdNeedsCedula: false }).some(
      (r) => r.key === "cedula",
    ),
    false,
  );
  const adult = barangayPrep(18, { barangayIdNeedsCedula: true }).find(
    (r) => r.key === "cedula",
  );
  assert.equal(adult?.opt, false);
  assert.equal(adult?.checked, false);
});

test("photo and replacement requirements follow local answers instead of being universally mandatory", () => {
  assert.equal(
    barangayPrep(20, {}).find((r) => r.key === "printed-photos")?.unknown,
    true,
  );
  assert.equal(
    barangayPrep(20, { barangayIdLiveCapture: true }).some(
      (r) => r.key === "printed-photos",
    ),
    false,
  );
  assert.equal(
    barangayPrep(20, { barangayIdLiveCapture: false }).find(
      (r) => r.key === "printed-photos",
    )?.checked,
    false,
  );
  assert.equal(
    barangayPrep(20, { barangayIdReplacement: false }).some(
      (r) => r.key === "loss-evidence",
    ),
    false,
  );
  assert.equal(
    barangayPrep(20, { barangayIdReplacement: true }).find(
      (r) => r.key === "loss-evidence",
    )?.checked,
    false,
  );
});

test("online application requires an explicitly confirmed local service", () => {
  const state = evaluateApplication("barangay-id", new Set(), [], {
    age: 20,
    mode: "online",
    facts: { barangayIdEligible: true },
  });
  assert.equal(state.eligibility.status, "unknown");
  assert.equal(state.steps[0].enabled, false);
  assert.equal(
    evaluateEligibility(
      "barangay-id",
      20,
      { barangayIdEligible: true, barangayIdOnlineAvailable: false },
      "online",
    ).status,
    "ineligible",
  );
  assert.equal(
    evaluateEligibility(
      "barangay-id",
      20,
      { barangayIdEligible: true, barangayIdOnlineAvailable: true },
      "online",
    ).status,
    "eligible",
  );
  assert.equal(
    evaluateEligibility(
      "barangay-id",
      20,
      { barangayIdEligible: true, barangayIdOnlineAvailable: false },
      "onsite",
    ).status,
    "eligible",
  );
});

test("a jobseeker request alone never grants a free physical card", () => {
  assert.equal(
    fitsBudget("barangay-id", "free", undefined, { waiverRequested: true }),
    false,
  );
  assert.equal(
    fitsBudget("barangay-id", "free", undefined, { barangayIdFeeWaived: true }),
    true,
  );
  assert.deepEqual(
    estimateFee("barangay-id", undefined, {
      barangayIdReplacement: true,
      barangayIdFeeWaived: false,
    }),
    { min: 50, max: 150 },
  );
  assert.equal(
    barangayPrep(20, { barangayIdFeeWaived: true }).find(
      (r) => r.key === "waiver-evidence",
    )?.checked,
    false,
  );
});

test("no printed expiry requires an issue date and local confirmation, without inventing a term", () => {
  assert.equal(documentValidity({}, asOf).status, "needs-confirmation");
  assert.equal(
    documentValidity({ noPrintedExpiry: true, validityConfirmed: true }, asOf)
      .status,
    "needs-confirmation",
  );
  assert.equal(
    documentValidity({ noPrintedExpiry: true, issuedOn: "2026-01-01" }, asOf)
      .status,
    "needs-confirmation",
  );
  assert.equal(
    documentValidity(
      {
        noPrintedExpiry: true,
        issuedOn: "2000-01-01",
        validityConfirmed: true,
      },
      asOf,
    ).status,
    "valid",
  );
});

test("expired cards and invalid dates cannot be made usable with a confirmation checkbox", () => {
  assert.equal(isCalendarDate("2025-02-29"), false);
  assert.equal(isCalendarDate("2024-02-29"), true);
  assert.equal(
    documentValidity(
      {
        issuedOn: "2027-01-01",
        noPrintedExpiry: true,
        validityConfirmed: true,
      },
      asOf,
    ).status,
    "needs-confirmation",
  );
  assert.equal(
    documentValidity({ expiresOn: "2025-01-01", validityConfirmed: true }, asOf)
      .status,
    "expired",
  );
  assert.equal(
    documentValidity({ issuedOn: "2026-03-01", expiresOn: "2026-02-01" }, asOf)
      .status,
    "needs-confirmation",
  );
  assert.equal(
    documentUsable(
      "barangay-id",
      owned,
      { "barangay-id": { expiresOn: "2025-01-01", validityConfirmed: true } },
      [],
      asOf,
    ),
    false,
  );
});

test("PSAHelpline accepts a current Barangay ID with photo and signature only on the online route", () => {
  assert.equal(
    prepRow("psa", "online-photo-id", valid, "online")?.checked,
    true,
  );
  assert.equal(prepRow("psa", "photo-id", valid, "onsite")?.checked, false);
  assert.equal(prepRow("psa", "online-photo-id", {}, "online")?.checked, false);
  assert.equal(
    prepRow(
      "psa",
      "online-photo-id",
      { "barangay-id": { ...valid["barangay-id"], photoSignature: false } },
      "online",
    )?.checked,
    false,
  );
});

test("PhilSys has a Barangay ID alternative route, gated on validity and all required card fields", () => {
  assert.equal(
    prepRow("philsys", "barangay-id-supporting", valid)?.checked,
    true,
  );
  const missing = prepRow("philsys", "barangay-id-supporting", {}, "onsite", [
    "barangay-id-supporting",
  ]);
  assert.equal(missing?.checked, false);
  assert.equal(missing?.blocked, true);
  assert.equal(
    prepRow("philsys", "barangay-id-supporting", {
      "barangay-id": { ...valid["barangay-id"], philsysFields: false },
    })?.checked,
    false,
  );
});

test("Postal ID treats the card as address evidence and still requires identity and copies", () => {
  assert.equal(prepRow("postal", "address", valid)?.checked, true);
  assert.equal(prepRow("postal", "identity", valid)?.checked, false);
  assert.equal(prepRow("postal", "address-copy", valid)?.checked, false);
  assert.equal(
    prepRow("postal", "address", {
      "barangay-id": { ...valid["barangay-id"], addressCurrent: false },
    })?.checked,
    false,
  );
});

test("adding the card never unlocks a passport ID requirement or invents a passport edge", () => {
  assert.equal(prepRow("passport", "accepted-id", valid)?.checked, false);
  const edges = buildEdges().filter((e) => e.source === "barangay-id");
  for (const target of ["psa", "philsys", "postal"])
    assert.ok(edges.some((e) => e.target === target));
  assert.equal(
    edges.some((e) => e.target === "passport"),
    false,
  );
});

test("date/format evidence survives profile saves while raw identifiers and unknown keys are discarded", () => {
  const profile = normalizeProfile({
    id: "test",
    name: "Test",
    age: 20,
    owned: ["barangay", "barangay-id"],
    documents: {
      "barangay-id": {
        ...valid["barangay-id"],
        noPrintedExpiry: true,
        validityConfirmed: true,
        idNumber: "private",
        unexpected: true,
      },
      unknown: { expiresOn: "2028-01-01" },
    },
  })!;
  assert.deepEqual(profile.owned, ["barangay", "barangay-id"]);
  assert.equal(profile.documents?.["barangay-id"].issuedOn, "2026-01-01");
  assert.equal(profile.documents?.["barangay-id"].expiresOn, undefined);
  assert.equal(profile.documents?.["barangay-id"].validityConfirmed, true);
  assert.equal("idNumber" in (profile.documents?.["barangay-id"] ?? {}), false);
  assert.equal(profile.documents?.unknown, undefined);
});
