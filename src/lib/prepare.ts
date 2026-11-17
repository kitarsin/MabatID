import { DETAILS, type PrepItem } from "@/data/details";
import { fitsBudget, type Budget, type Setup } from "./prefs";

export interface PrepRow {
  key: string;
  text: string;
  checked: boolean;
  /** ticked for you because of your profile (owned IDs / budget) */
  auto: boolean;
  /** only needed in some cases — never blocks the guide */
  opt: boolean;
  /** why it is ticked for you: you already hold this ID, or your profile covers it */
  source: "owned" | "profile" | null;
}
export interface PrepRoute { label: string; rows: PrepRow[]; complete: boolean }
export type PrepNode =
  | { kind: "row"; row: PrepRow }
  | { kind: "either"; key: string; routes: PrepRoute[]; complete: boolean };

export interface PrepState {
  nodes: PrepNode[];
  done: number;
  total: number;
  complete: boolean;
}

/**
 * Builds the "Prepare" checklist for one card.
 * - A row is ticked if you ticked it, or your profile covers it (you own a matching ID,
 *   or the card fits your budget).
 * - An "either" group is satisfied as soon as ONE route has every row ticked.
 * - The whole checklist is complete when every required row / group is satisfied.
 */
export function evaluatePrepare(
  cardId: string,
  owned: ReadonlySet<string> | null, // null = not signed in → nothing is auto-ticked
  budget: Budget | undefined,
  manual: ReadonlySet<string>,
  obtained = false, // you already hold this ID → everything counts as done
): PrepState {
  const d = DETAILS[cardId];

  const rowOf = (key: string, item: PrepItem): PrepRow => {
    const o = typeof item === "string" ? { t: item } : item;
    const ownedCount = owned && "ids" in o && o.ids ? o.ids.filter((id) => owned.has(id)).length : 0;
    const byProfile = !!owned && ownedCount >= (("min" in o && o.min) || 1) && "ids" in o && !!o.ids;
    const auto = obtained || byProfile;
    return {
      key, text: o.t, checked: auto || manual.has(key), auto, opt: "opt" in o && !!o.opt,
      source: obtained ? "owned" : byProfile ? "profile" : null,
    };
  };

  const budgetAuto = !!owned && fitsBudget(cardId, budget);
  const budgetRow: PrepRow = {
    key: "b",
    text: `**Budget:** ${d.req.fee}`,
    checked: obtained || budgetAuto || manual.has("b"),
    auto: obtained || budgetAuto,
    opt: false,
    source: obtained ? "owned" : budgetAuto ? "profile" : null,
  };

  const nodes: PrepNode[] = [{ kind: "row", row: budgetRow }];
  d.req.prepare.forEach((entry, i) => {
    if (typeof entry === "object" && "either" in entry) {
      const routes = entry.either.map((r, ri) => {
        const rows = r.items.map((it, ji) => rowOf(`${i}.${ri}.${ji}`, it));
        return { label: r.label, rows, complete: rows.filter((x) => !x.opt).every((x) => x.checked) };
      });
      nodes.push({ kind: "either", key: String(i), routes, complete: routes.some((r) => r.complete) });
    } else {
      nodes.push({ kind: "row", row: rowOf(String(i), entry) });
    }
  });

  const required = nodes.filter((n) => n.kind === "either" || !n.row.opt);
  const done = required.filter((n) => (n.kind === "either" ? n.complete : n.row.checked)).length;
  return { nodes, done, total: required.length, complete: required.length > 0 && done === required.length };
}

export type Mode = "onsite" | "online";

/** The guide tab that opens first: your preferred setup if the ID supports it. */
export function defaultMode(cardId: string, setup: Setup | undefined): Mode | null {
  const d = DETAILS[cardId];
  const modes: Mode[] = [d.onsite && "onsite", d.online && "online"].filter(Boolean) as Mode[];
  if (!modes.length) return null;
  return setup === "online" && modes.includes("online") ? "online" : (setup === "onsite" && modes.includes("onsite") ? "onsite" : modes[0]);
}

/** Key used to remember that a guide step was done. */
export const stepKey = (mode: Mode, i: number) => `s:${mode}:${i}`;

export interface TrackProgress {
  done: number;
  total: number;
  pct: number;
  stage: string;
}

/**
 * Overall progress toward one ID = checklist items met + guide steps done.
 * Steps count for the route you are actually following (the one with the most steps ticked,
 * otherwise your preferred setup).
 */
export function trackProgress(
  cardId: string,
  owned: ReadonlySet<string>,
  budget: Budget | undefined,
  setup: Setup | undefined,
  manualKeys: readonly string[],
): TrackProgress {
  const manual = new Set(manualKeys);
  const prep = evaluatePrepare(cardId, owned, budget, manual);
  const d = DETAILS[cardId];
  const count = (m: Mode) => d.steps[m].filter((_, i) => manual.has(stepKey(m, i))).length;
  let mode = defaultMode(cardId, setup);
  if (d.onsite && d.online && count("online") > count("onsite")) mode = "online";
  const steps = mode ? d.steps[mode].length : 0;
  const stepsDone = mode ? count(mode) : 0;
  const total = prep.total + steps;
  const done = prep.done + stepsDone;
  const stage = !prep.complete ? "Preparing requirements" : stepsDone < steps ? "Following the guide" : "Ready to collect";
  return { done, total, pct: total ? Math.round((done / total) * 100) : 0, stage };
}
