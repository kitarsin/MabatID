import { DETAILS } from "@/data/details";

export type Budget = "free" | "low" | "mid" | "any";
export type Setup = "onsite" | "online" | "both";

export const BUDGETS: { id: Budget; label: string; hint: string; max: number }[] = [
  { id: "free", label: "Free only", hint: "₱0 — fee waivers and free IDs", max: 0 },
  { id: "low", label: "Up to ₱200", hint: "Low-cost IDs", max: 200 },
  { id: "mid", label: "Up to ₱1,000", hint: "Includes Postal ID, passport", max: 1000 },
  { id: "any", label: "No limit", hint: "Show everything", max: Infinity },
];

export const SETUPS: { id: Setup; label: string; hint: string }[] = [
  { id: "onsite", label: "On-site only", hint: "I’ll go to the office in person" },
  { id: "online", label: "Online only", hint: "I prefer to do it digitally" },
  { id: "both", label: "Both", hint: "Either works for me" },
];

export const DEFAULT_BUDGET: Budget = "any";
export const DEFAULT_SETUP: Setup = "both";

export function fitsBudget(cardId: string, budget: Budget = DEFAULT_BUDGET) {
  const max = BUDGETS.find((b) => b.id === budget)!.max;
  return DETAILS[cardId].minFee <= max;
}

export function fitsSetup(cardId: string, setup: Setup = DEFAULT_SETUP) {
  const d = DETAILS[cardId];
  return setup === "both" ? d.onsite || d.online : setup === "onsite" ? d.onsite : d.online;
}
