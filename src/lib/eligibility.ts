import { CARD_BY_ID } from "@/data/cards";
import { FACTS, type FactId, type ProfileFacts } from "@/data/facts";

export type CheckStatus = "satisfied" | "missing" | "unknown";
export interface EligibilityCheck {
  id: string;
  label: string;
  status: CheckStatus;
  fact?: FactId;
}

const REQUIRED_FACTS: Record<string, FactId[]> = {
  school: ["enrolled"],
  philhealth: ["philhealthEligible"],
  comelec: ["activeVoter"],
  mysss: ["sssEligible"],
  pagibig: ["pagibigEligible"],
  prc: ["prcEligible"],
  pwd: ["pwdEligible"],
  soloparent: ["soloParentEligible"],
  owwa: ["owwaEligible"],
  "barangay-id": ["barangayIdEligible"],
};

/** Eligibility is separate from possession and paperwork. Unknown never implies eligible. */
export function evaluateEligibility(
  cardId: string,
  age?: number | null,
  facts: ProfileFacts = {},
  mode?: "onsite" | "online",
) {
  const card = CARD_BY_ID[cardId];
  const checks: EligibilityCheck[] = [];
  if (!card) return { status: "ineligible" as const, checks };
  checks.push({
    id: "age",
    label: card.minAge
      ? `Minimum age: ${card.minAge}`
      : "Applicant age recorded",
    status:
      age == null ? "unknown" : age >= card.minAge ? "satisfied" : "missing",
  });
  const requireFact = (fact: FactId) =>
    checks.push({
      id: fact,
      fact,
      label: FACTS[fact],
      status:
        facts[fact] === undefined
          ? "unknown"
          : facts[fact]
            ? "satisfied"
            : "missing",
    });
  for (const fact of REQUIRED_FACTS[cardId] ?? []) requireFact(fact);
  if (cardId === "barangay-id" && mode === "online")
    requireFact("barangayIdOnlineAvailable");
  if (
    age != null &&
    age < 18 &&
    card.minAge < 18 &&
    !["school", "cedula"].includes(cardId)
  )
    requireFact("guardian");
  if (age != null && age < 18 && ["nbi", "npc"].includes(cardId))
    requireFact("minorPurpose");
  if (age != null && age < 18 && cardId === "tin") requireFact("employed");
  if (cardId === "owwa")
    checks.push({
      id: "domesticWorker",
      fact: "domesticWorker",
      label: FACTS.domesticWorker,
      status:
        facts.domesticWorker === undefined || age == null
          ? "unknown"
          : facts.domesticWorker && age < 23
            ? "missing"
            : "satisfied",
    });
  const status = checks.some((c) => c.status === "missing")
    ? "ineligible"
    : checks.some((c) => c.status === "unknown")
      ? "unknown"
      : "eligible";
  return { status, checks };
}
