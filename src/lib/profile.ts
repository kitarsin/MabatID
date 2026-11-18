import { CARDS } from "@/data/cards";
import { DETAILS } from "@/data/details";
import { EXTRA_DOCUMENTS } from "@/data/documents";
import { FACTS, type ProfileFacts } from "@/data/facts";
import { BUDGETS, SETUPS, type Budget, type Setup } from "./prefs";
import { preparationKeys, type Mode } from "./prepare";
import { normalizeEvidence, type DocumentEvidenceMap } from "./documents";

/** Device profiles are not accounts or proof of identity. Never store credentials here. */
export interface User {
  id: string;
  name: string;
  age: number;
  owned: string[];
  createdAt: number;
  onboarded?: boolean;
  budget?: Budget;
  setup?: Setup;
  tracking?: string[];
  priority?: string | null;
  prep?: Record<string, string[]>;
  facts?: ProfileFacts;
  modes?: Record<string, Mode>;
  needsChecklistReview?: boolean;
  documents?: DocumentEvidenceMap;
}
const cardIds = new Set(CARDS.map((c) => c.id));
const documentIds = new Set([...cardIds, ...EXTRA_DOCUMENTS.map((d) => d.id)]);
const record = (v: unknown): Record<string, unknown> =>
  v && typeof v === "object" && !Array.isArray(v)
    ? (v as Record<string, unknown>)
    : {};
const strings = (v: unknown) =>
  Array.isArray(v)
    ? [...new Set(v.filter((s): s is string => typeof s === "string"))]
    : [];

/** Whitelist fields on every load/write, including legacy imports. */
export function normalizeProfile(value: unknown, legacy = false): User | null {
  const v = record(value);
  if (
    typeof v.id !== "string" ||
    !v.id ||
    typeof v.name !== "string" ||
    !v.name.trim()
  )
    return null;
  if (
    typeof v.age !== "number" ||
    !Number.isInteger(v.age) ||
    v.age < 0 ||
    v.age > 120
  )
    return null;
  const owned = strings(v.owned).filter((id) => documentIds.has(id));
  const tracking = strings(v.tracking).filter(
    (id) => cardIds.has(id) && !owned.includes(id),
  );
  const facts: ProfileFacts = {};
  for (const key of Object.keys(FACTS) as (keyof ProfileFacts)[]) {
    const answer = record(v.facts)[key];
    if (typeof answer === "boolean") facts[key] = answer;
  }
  const prep: Record<string, string[]> = {};
  const modes: Record<string, Mode> = {};
  const documents: DocumentEvidenceMap = {};
  for (const [id, evidence] of Object.entries(record(v.documents)))
    if (documentIds.has(id)) documents[id] = normalizeEvidence(evidence);
  for (const card of CARDS) {
    // Positional v1 ticks no longer safely describe the corrected rules. Ownership and goals survive.
    if (!legacy)
      prep[card.id] = strings(record(v.prep)[card.id]).filter((key) =>
        preparationKeys(card.id).has(key),
      );
    const mode = record(v.modes)[card.id];
    if ((mode === "onsite" || mode === "online") && DETAILS[card.id][mode])
      modes[card.id] = mode;
  }
  return {
    id: v.id,
    name: v.name.trim().slice(0, 40),
    age: v.age,
    owned,
    createdAt:
      typeof v.createdAt === "number" && Number.isFinite(v.createdAt)
        ? v.createdAt
        : 0,
    onboarded: v.onboarded === true,
    budget: BUDGETS.some((b) => b.id === v.budget)
      ? (v.budget as Budget)
      : "any",
    setup: SETUPS.some((s) => s.id === v.setup) ? (v.setup as Setup) : "both",
    tracking,
    priority:
      typeof v.priority === "string" && tracking.includes(v.priority)
        ? v.priority
        : (tracking[0] ?? null),
    facts,
    prep,
    modes,
    documents,
    needsChecklistReview: legacy || v.needsChecklistReview === true,
  };
}

export function parseProfiles(value: unknown, legacy = false): User[] {
  if (!Array.isArray(value)) return [];
  const seen = new Set<string>();
  return value
    .map((v) => normalizeProfile(v, legacy))
    .filter((v): v is User => {
      if (!v || seen.has(v.id)) return false;
      seen.add(v.id);
      return true;
    });
}
