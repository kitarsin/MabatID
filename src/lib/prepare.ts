import { DETAILS, type PrepItem, type Step } from "@/data/details";
import { conditionValue, type ProfileFacts } from "@/data/facts";
import { evaluateEligibility } from "./eligibility";
import { estimateFee, type Budget, type Setup } from "./prefs";
import {
  documentUsable,
  documentValidity,
  type DocumentEvidenceMap,
} from "./documents";

export type Mode = "onsite" | "online";
export interface ApplicationContext {
  age?: number | null;
  facts?: ProfileFacts;
  mode?: Mode;
  setup?: Setup;
  budget?: Budget;
  documents?: DocumentEvidenceMap;
  asOf?: string;
}
export interface PrepRow {
  key: string;
  text: string;
  checked: boolean;
  auto: boolean;
  opt: boolean;
  unknown: boolean;
  source: "owned" | "profile" | "step" | null;
  blocked?: boolean;
  note?: string;
  /** Case-by-case requirement label, e.g. "If your barangay asks". */
  onlyIf?: string;
}
export interface PrepRoute {
  id: string;
  label: string;
  rows: PrepRow[];
  complete: boolean;
}
export type PrepNode =
  | { kind: "row"; row: PrepRow }
  | { kind: "either"; key: string; routes: PrepRoute[]; complete: boolean };
export interface PrepState {
  nodes: PrepNode[];
  done: number;
  total: number;
  complete: boolean;
}

export function defaultMode(cardId: string, setup?: Setup): Mode {
  const d = DETAILS[cardId];
  if (d.procedure === "hybrid") return "online";
  return d.online && (setup === "online" || !d.onsite) ? "online" : "onsite";
}

export function applicationMode(
  cardId: string,
  context: ApplicationContext = {},
): Mode {
  const d = DETAILS[cardId];
  return context.mode && d[context.mode]
    ? context.mode
    : defaultMode(cardId, context.setup);
}

/** IDs are authored in the catalog, never inferred from array position or wording. */
export const stepKey = (step: Pick<Step, "id">) => `step:${step.id}`;

export function evaluatePrepare(
  cardId: string,
  owned: ReadonlySet<string> | null,
  manual: ReadonlySet<string>,
  context: ApplicationContext = {},
): PrepState {
  const d = DETAILS[cardId];
  const obtained = !!owned?.has(cardId);
  const mode = applicationMode(cardId, context);
  const rowOf = (item: PrepItem): PrepRow | null => {
    if (item.route && d.procedure !== "hybrid" && item.route !== mode)
      return null;
    const condition = item.when
      ? conditionValue(item.when, context.facts ?? {}, context.age)
      : true;
    if (condition === false) return null;
    const count = new Set(
      item.ids?.filter((id) =>
        documentUsable(
          item.subject && item.subject !== "self" && !id.includes(":")
            ? `${item.subject}:${id}`
            : id,
          owned,
          context.documents,
          item.documentChecks?.[id],
          context.asOf,
        ),
      ),
    ).size;
    const byProfile =
      !item.confirm && !!item.ids?.length && count >= (item.min ?? 1);
    const byStep = !!item.completedBy && manual.has(`step:${item.completedBy}`);
    const barangayOnly =
      item.ids?.length === 1 && item.ids[0] === "barangay-id";
    const blocked =
      barangayOnly &&
      !documentUsable(
        "barangay-id",
        owned,
        context.documents,
        item.documentChecks?.["barangay-id"],
        context.asOf,
      );
    const validity = documentValidity(
      context.documents?.["barangay-id"],
      context.asOf,
    );
    const auto = obtained || byProfile || byStep;
    return {
      key: item.id,
      text: item.t,
      checked:
        obtained ||
        (condition === true && !blocked && (auto || manual.has(item.id))),
      auto,
      opt: !!item.opt,
      onlyIf: item.onlyIf,
      unknown: !obtained && condition === undefined,
      blocked: !obtained && !!blocked,
      note: blocked
        ? !owned?.has("barangay-id")
          ? "Select your Barangay ID under Settings → Your collection and record its dates and required card details."
          : validity.status !== "valid"
            ? validity.reason
            : "Confirm the required details on your Barangay ID under Settings → Your collection."
        : undefined,
      source: obtained
        ? "owned"
        : byProfile
          ? "profile"
          : byStep
            ? "step"
            : null,
    };
  };
  const nodes: PrepNode[] = [];
  // Affordability is not payment. Only a zero standard fee is automatic.
  const free = estimateFee(cardId, mode, context.facts).max === 0;
  nodes.push({
    kind: "row",
    row: {
      key: "funds",
      text: free
        ? `**Fee:** ${d.req.fee}`
        : `**Payment arranged:** ${d.req.fee}. Confirm your applicable fee with the office.`,
      checked: obtained || free || manual.has("funds"),
      auto: obtained || free,
      opt: false,
      unknown: false,
      source: obtained ? "owned" : null,
    },
  });
  for (const entry of d.req.prepare) {
    if ("either" in entry) {
      const routes = entry.either
        .filter(
          (r) =>
            !r.when ||
            conditionValue(r.when, context.facts ?? {}, context.age) !== false,
        )
        .map((r) => {
          const rows = r.items
            .map(rowOf)
            .filter((r): r is PrepRow => r !== null);
          if (
            r.when &&
            conditionValue(r.when, context.facts ?? {}, context.age) ===
              undefined &&
            !obtained
          )
            rows.unshift({
              key: `condition:${r.id}`,
              text: "Confirm eligibility for this document route in the questions above.",
              checked: false,
              auto: false,
              opt: false,
              unknown: true,
              blocked: true,
              source: null,
            });
          return {
            id: r.id,
            label: r.label,
            rows,
            complete: rows.filter((r) => !r.opt).every((r) => r.checked),
          };
        });
      nodes.push({
        kind: "either",
        key: entry.id,
        routes,
        complete: routes.some((r) => r.complete),
      });
    } else {
      const row = rowOf(entry);
      if (row) nodes.push({ kind: "row", row });
    }
  }
  const required = nodes.filter((n) => n.kind === "either" || !n.row.opt);
  const done = required.filter((n) =>
    n.kind === "either" ? n.complete : n.row.checked,
  ).length;
  return {
    nodes,
    done,
    total: required.length,
    complete: done === required.length,
  };
}

export function procedureSteps(
  cardId: string,
  context: ApplicationContext = {},
) {
  const d = DETAILS[cardId];
  const modes: Mode[] =
    d.procedure === "hybrid"
      ? ["online", "onsite"]
      : [applicationMode(cardId, context)];
  return modes.flatMap((mode) => d.steps[mode].map((step) => ({ mode, step })));
}

/** One evaluator feeds the tree, checklist, guide and progress display. */
export function evaluateApplication(
  cardId: string,
  owned: ReadonlySet<string>,
  manualKeys: readonly string[] = [],
  context: ApplicationContext = {},
) {
  const manual = new Set(manualKeys);
  const effective = new Set(manualKeys.filter((k) => !k.startsWith("step:")));
  const eligibility = evaluateEligibility(
    cardId,
    context.age,
    context.facts,
    applicationMode(cardId, context),
  );
  let previousDone = true;
  const steps = procedureSteps(cardId, context).map(({ mode, step }) => {
    const prepReady =
      !step.requiresPreparation ||
      evaluatePrepare(cardId, owned, effective, context).complete;
    const enabled =
      !owned.has(cardId) &&
      eligibility.status === "eligible" &&
      previousDone &&
      prepReady;
    const checked = owned.has(cardId) || (enabled && manual.has(stepKey(step)));
    const reason =
      eligibility.status !== "eligible"
        ? "Review eligibility above first."
        : !previousDone
          ? "Complete the preceding step first."
          : !prepReady
            ? "Prepare the requirements before this step."
            : "";
    if (checked) effective.add(stepKey(step));
    previousDone = checked;
    return { mode, step, checked, enabled, reason };
  });
  const prep = evaluatePrepare(cardId, owned, effective, context);
  return {
    prep,
    eligibility,
    steps,
    ready: prep.complete && eligibility.status === "eligible",
  };
}

export interface TrackProgress {
  done: number;
  total: number;
  pct: number;
  stage: string;
}
export function trackProgress(
  cardId: string,
  owned: ReadonlySet<string>,
  manualKeys: readonly string[],
  context: ApplicationContext = {},
): TrackProgress {
  const state = evaluateApplication(cardId, owned, manualKeys, context);
  const eligibilityDone = state.eligibility.checks.filter(
    (c) => c.status === "satisfied",
  ).length;
  // Receipt is a separate confirmation; completing steps does not assert issuance.
  const total =
    state.prep.total + state.eligibility.checks.length + state.steps.length + 1;
  if (owned.has(cardId))
    return { done: total, total, pct: 100, stage: "Obtained" };
  const stepsDone = state.steps.filter((s) => s.checked).length;
  const done = state.prep.done + eligibilityDone + stepsDone;
  const stage =
    state.eligibility.status === "ineligible"
      ? "Eligibility conditions not met"
      : state.eligibility.status === "unknown"
        ? "Review eligibility"
        : stepsDone === state.steps.length
          ? "Confirm you received this ID"
          : state.steps.some((s) => s.enabled)
            ? "Follow the application steps"
            : "Preparing requirements";
  return {
    done,
    total,
    pct: Math.min(99, Math.round((done / total) * 100)),
    stage,
  };
}

/**
 * Saved data can outlive the catalog (e.g. a route removed from an ID). Keep only application routes the ID
 * still offers and checklist ticks that still exist, so old profiles never break the planner.
 */
export function sanitizeSaved(
  modes: Record<string, Mode> = {},
  prep: Record<string, string[]> = {},
): { modes: Record<string, Mode>; prep: Record<string, string[]> } {
  const cleanModes: Record<string, Mode> = {};
  for (const [id, mode] of Object.entries(modes))
    if (DETAILS[id]?.[mode]) cleanModes[id] = mode;
  const cleanPrep: Record<string, string[]> = {};
  for (const [id, keys] of Object.entries(prep)) {
    if (!DETAILS[id]) continue;
    const valid = preparationKeys(id);
    cleanPrep[id] = keys.filter((k) => valid.has(k));
  }
  return { modes: cleanModes, prep: cleanPrep };
}

export function preparationKeys(cardId: string): Set<string> {
  const d = DETAILS[cardId];
  return new Set([
    "funds",
    ...d.req.prepare.flatMap((e) =>
      "either" in e
        ? e.either.flatMap((r) => r.items.map((i) => i.id))
        : [e.id],
    ),
    ...[...d.steps.onsite, ...d.steps.online].map(stepKey),
  ]);
}
