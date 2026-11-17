import { conditionValue, type ProfileFacts } from "@/data/facts";
import { DETAILS } from "@/data/details";

export type Budget = "free" | "low" | "mid" | "any";
export type Setup = "onsite" | "online" | "both";

export const BUDGETS: {
  id: Budget;
  label: string;
  hint: string;
  max: number;
}[] = [
  {
    id: "free",
    label: "Free only",
    hint: "₱0 standard fee; conditional waivers excluded",
    max: 0,
  },
  { id: "low", label: "Up to ₱200", hint: "Low-cost IDs", max: 200 },
  {
    id: "mid",
    label: "Up to ₱1,000",
    hint: "Includes Postal ID, passport",
    max: 1000,
  },
  { id: "any", label: "No limit", hint: "Show everything", max: Infinity },
];

export const SETUPS: { id: Setup; label: string; hint: string }[] = [
  {
    id: "onsite",
    label: "On-site only",
    hint: "I’ll go to the office in person",
  },
  {
    id: "online",
    label: "Online only",
    hint: "Fully remote, with no required office visit",
  },
  { id: "both", label: "Both", hint: "Either works for me" },
];

export const DEFAULT_BUDGET: Budget = "any";
export const DEFAULT_SETUP: Setup = "both";

/** Unknown fee conditions retain the full range; exemptions never silently imply zero. */
export function estimateFee(
  cardId: string,
  mode?: "onsite" | "online",
  facts: ProfileFacts = {},
) {
  const fee = DETAILS[cardId].fee;
  let { min, max } = mode ? (fee.byMode?.[mode] ?? fee) : fee;
  for (const condition of fee.conditions ?? []) {
    const value = conditionValue(condition.when, facts);
    if (value === true) {
      min = condition.min;
      max = condition.max;
    } else if (value === undefined) {
      min = Math.min(min, condition.min);
      max = Math.max(max, condition.max);
    }
  }
  return { min, max };
}

export function fitsBudget(
  cardId: string,
  budget: Budget = DEFAULT_BUDGET,
  mode?: "onsite" | "online",
  facts?: ProfileFacts,
) {
  const limit = BUDGETS.find((b) => b.id === budget)?.max ?? Infinity;
  return estimateFee(cardId, mode, facts).max <= limit;
}

export function fitsSetup(cardId: string, setup: Setup = DEFAULT_SETUP) {
  const d = DETAILS[cardId];
  return setup === "both"
    ? d.onsite || d.online
    : setup === "onsite"
      ? d.onsite && d.procedure !== "hybrid"
      : d.online && !d.onlineRequiresVisit;
}
