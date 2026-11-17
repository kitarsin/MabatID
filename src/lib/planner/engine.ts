import type {
  AcquisitionPlan,
  DocumentRule,
  PlanObjective,
  PlannerCatalog,
  PlannerRoute,
  PlanTask,
  PlanningResult,
  Rule,
} from "./types";

interface Candidate {
  routes: Record<string, string>;
  edges: Record<string, [string, string]>;
  tasks: Record<string, PlanTask>;
  choices: Record<string, string[]>;
}
const empty = (): Candidate => ({
  routes: {},
  edges: {},
  tasks: {},
  choices: {},
});
const taskCandidate = (task: PlanTask): Candidate => ({
  ...empty(),
  tasks: { [task.id]: task },
});

/** Kahn's algorithm runs on the selected acquisitions, never on all alternative catalog edges. */
export function topologicalOrder(
  ids: string[],
  edges: [string, string][],
): string[] | null {
  const members = new Set(ids);
  const adjacency = new Map(ids.map((id) => [id, new Set<string>()]));
  const degree = new Map(ids.map((id) => [id, 0]));
  for (const [before, after] of edges) {
    if (!members.has(before) || !members.has(after)) return null;
    if (adjacency.get(before)!.has(after)) continue;
    adjacency.get(before)!.add(after);
    degree.set(after, degree.get(after)! + 1);
  }
  const ready = ids.filter((id) => degree.get(id) === 0).sort();
  const result: string[] = [];
  while (ready.length) {
    const id = ready.shift()!;
    result.push(id);
    for (const child of adjacency.get(id)!) {
      degree.set(child, degree.get(child)! - 1);
      if (!degree.get(child)) {
        ready.push(child);
        ready.sort();
      }
    }
  }
  return result.length === ids.length ? result : null;
}

/** Bounded backward chaining. Truncation is explicit; candidates are never called optimal. */
export function planAcquisition(
  catalog: PlannerCatalog,
  targetId: string,
  options: {
    objective?: PlanObjective;
    maxOperations?: number;
    maxFrontier?: number;
    maxPlans?: number;
  } = {},
): PlanningResult {
  if (!Object.hasOwn(catalog.acquisitions, targetId))
    throw new Error("Unknown acquisition target");
  const objective = options.objective ?? "fewest-documents";
  const limit = Math.max(1, options.maxOperations ?? 18000);
  const frontier = Math.max(1, options.maxFrontier ?? 48);
  let operations = 0;
  let complete = true;
  let seeding = false;
  let ceiling = limit;
  const cycles = new Map<string, string[]>();
  const unavailable = new Set<string>();
  const ineligible = new Set<string>();
  const routeById = new Map<string, PlannerRoute>();
  for (const node of Object.values(catalog.acquisitions))
    for (const route of node.routes) routeById.set(route.id, route);
  const tick = () => {
    if (operations >= ceiling) {
      if (!seeding) complete = false;
      return false;
    }
    operations++;
    if (!seeding && operations === limit) complete = false;
    return true;
  };
  const signature = (c: Candidate) =>
    JSON.stringify([
      Object.entries(c.routes).sort(),
      Object.entries(c.choices).sort(),
      Object.keys(c.tasks).sort(),
    ]);
  const score = (c: Candidate) => {
    const routes = Object.values(c.routes).map((id) => routeById.get(id)!);
    const unknownEligibility = new Set(
      Object.values(c.tasks)
        .filter((t) => t.kind === "eligibility" && t.state === "unknown")
        .map((t) => t.factId ?? t.id),
    ).size;
    const unknown = new Set(
      Object.values(c.tasks)
        .filter((t) => t.state === "unknown")
        .map((t) =>
          t.factId
            ? `fact:${t.factId}`
            : t.documentId
              ? `document:${t.documentId}`
              : t.id,
        ),
    ).size;
    const external = new Set(
      Object.values(c.tasks)
        .filter((t) => t.kind === "document" && t.state !== "satisfied")
        .map((t) => t.documentId),
    ).size;
    const count = routes.length;
    const fees = routes.reduce((n, r) => n + r.fee.max, 0);
    const mismatch = routes.filter((r) => r.preferenceMismatch).length;
    const overBudget = routes.filter((r) => r.overBudget).length;
    return objective === "lowest-fees"
      ? [
          unknownEligibility,
          unknown,
          overBudget,
          fees,
          count,
          external,
          mismatch,
        ]
      : [
          unknownEligibility,
          unknown,
          overBudget,
          count,
          fees,
          external,
          mismatch,
        ];
  };
  const compare = (a: Candidate, b: Candidate) => {
    const sa = score(a),
      sb = score(b);
    for (let i = 0; i < sa.length; i++)
      if (sa[i] !== sb[i]) return sa[i] - sb[i];
    return signature(a).localeCompare(signature(b));
  };
  const trim = (values: Candidate[]) => {
    const unique = new Map<string, Candidate>();
    for (const value of values) unique.set(signature(value), value);
    const ranked = [...unique.values()].sort(compare);
    if (!seeding && ranked.length > frontier) complete = false;
    return ranked.slice(0, seeding ? 1 : frontier);
  };
  const merge = (a: Candidate, b: Candidate): Candidate | null => {
    tick(); // Preserve assembly of already-proven candidates after the exploration budget is spent.
    for (const [id, route] of Object.entries(b.routes))
      if (a.routes[id] && a.routes[id] !== route) return null;
    for (const [id, choice] of Object.entries(b.choices))
      if (
        a.choices[id] &&
        JSON.stringify(a.choices[id]) !== JSON.stringify(choice)
      )
        return null;
    return {
      routes: { ...a.routes, ...b.routes },
      edges: { ...a.edges, ...b.edges },
      tasks: { ...a.tasks, ...b.tasks },
      choices: { ...a.choices, ...b.choices },
    };
  };
  // Fixed-point effort estimates only order exploration. They never prove feasibility or optimality.
  const hints = new Map(
    Object.keys(catalog.acquisitions).map((id) => [id, Infinity]),
  );
  function effort(rule: Rule): number {
    if (rule.kind === "task") return 0;
    if (rule.kind === "document") {
      if (rule.state !== "missing") return 0;
      const doc = catalog.documents[rule.documentId];
      return doc?.acquisitionId
        ? (hints.get(doc.acquisitionId) ?? Infinity)
        : doc?.existingOnly
          ? Infinity
          : 0;
    }
    if (rule.kind === "all")
      return rule.children.reduce((n, r) => n + effort(r), 0);
    if (rule.kind === "any") return Math.min(...rule.options.map(effort));
    const costs = rule.options.map(effort).sort((a, b) => a - b);
    return costs.length < rule.count
      ? Infinity
      : costs.slice(0, rule.count).reduce((n, c) => n + c, 0);
  }
  for (let pass = 0; pass < Object.keys(catalog.acquisitions).length; pass++)
    for (const node of Object.values(catalog.acquisitions)) {
      const cost = node.owned
        ? 0
        : Math.min(
            ...node.routes
              .filter((r) => !r.eligibility.some((t) => t.state === "missing"))
              .map((r) => 1 + effort(r.requirements)),
          );
      if (cost < hints.get(node.id)!) hints.set(node.id, cost);
    }
  const ordered = <T extends Rule>(rules: T[]) =>
    [...rules].sort(
      (a, b) =>
        effort(a) - effort(b) ||
        (a.kind === "document" && b.kind === "document"
          ? minFee(a.documentId) - minFee(b.documentId)
          : 0),
    );
  function minFee(id: string) {
    const node = catalog.acquisitions[id];
    return node ? Math.min(...node.routes.map((r) => r.fee.max)) : 0;
  }
  function solveDocument(rule: DocumentRule, stack: string[]): Candidate[] {
    const task: PlanTask = {
      id: rule.id,
      forId: rule.forId,
      label: rule.label,
      state: "satisfied",
      kind: "document",
      documentId: rule.documentId,
    };
    if (rule.state === "satisfied") return [taskCandidate(task)];
    if (rule.state === "needs-confirmation")
      return [
        taskCandidate({
          ...task,
          state: "unknown",
          kind: "confirmation",
          label:
            rule.confirmation ??
            `Confirm ${rule.label} is valid and accepted before using it.`,
        }),
      ];
    const doc = catalog.documents[rule.documentId];
    if (!doc || doc.existingOnly) {
      unavailable.add(rule.documentId);
      return [];
    }
    if (!doc.acquisitionId)
      return [
        taskCandidate({
          ...task,
          state: "unknown",
          label: `Obtain or confirm availability of ${doc.name}. This document has no acquisition guide in the app.`,
        }),
      ];
    const acquisitionId = doc.acquisitionId;
    return solveCard(acquisitionId, stack).map((c) => ({
      ...c,
      edges: {
        ...c.edges,
        [`${acquisitionId}->${rule.forId}`]: [acquisitionId, rule.forId],
      },
      tasks: {
        ...c.tasks,
        [task.id]: {
          ...task,
          state: "missing",
          kind: "confirmation",
          label:
            rule.confirmation ??
            `Get ${doc.name} first; confirm its acceptance before applying.`,
        },
      },
    }));
  }
  function combine(left: Candidate[], right: Candidate[]): Candidate[] {
    const out: Candidate[] = [];
    for (const a of left)
      for (const b of right) {
        const c = merge(a, b);
        if (c) out.push(c);
        if (operations >= ceiling && out.length) return trim(out);
      }
    return trim(out);
  }
  function solveRule(rule: Rule, stack: string[]): Candidate[] {
    if (rule.kind === "task") return [taskCandidate(rule.task)];
    if (rule.kind === "document") return solveDocument(rule, stack);
    if (rule.kind === "all") {
      let values = [empty()];
      for (const child of rule.children) {
        values = combine(values, solveRule(child, stack));
        if (!values.length) break;
      }
      return values;
    }
    if (rule.kind === "any") {
      const values: Candidate[] = [];
      for (const child of ordered(rule.options)) {
        if (!tick() && effort(child) > 0) break;
        const childId = child.kind === "task" ? child.task.id : child.id;
        for (const c of solveRule(child, stack))
          values.push({
            ...c,
            choices: { ...c.choices, [rule.id]: [childId] },
          });
        if (operations >= ceiling || (seeding && values.length)) break;
      }
      return trim(values);
    }
    // Pick distinct document types; permutations never count as two documents.
    const docs = [
      ...new Map(rule.options.map((r) => [r.documentId, r])).values(),
    ];
    if (rule.count < 1 || docs.length < rule.count) return [];
    const sorted = ordered(docs);
    const values: Candidate[] = [];
    const thresholdId = rule.id;
    function choose(
      index: number,
      remaining: number,
      current: Candidate[],
      selected: string[],
    ) {
      if (!remaining) {
        for (const c of current)
          values.push({
            ...c,
            choices: { ...c.choices, [thresholdId]: [...selected] },
          });
        return;
      }
      if (!tick()) return;
      for (let i = index; i <= sorted.length - remaining; i++) {
        const next = combine(current, solveRule(sorted[i], stack));
        if (next.length)
          choose(i + 1, remaining - 1, next, [
            ...selected,
            sorted[i].documentId,
          ]);
        if (operations >= ceiling || (seeding && values.length)) break;
      }
    }
    choose(0, rule.count, [empty()], []);
    return trim(values);
  }
  function solveCard(id: string, stack: string[]): Candidate[] {
    if (!tick()) return [];
    const node = catalog.acquisitions[id];
    if (!node) {
      unavailable.add(id);
      return [];
    }
    if (node.owned) return [empty()];
    if (stack.includes(id)) {
      const cycle = [...stack.slice(stack.indexOf(id)), id];
      if (cycles.size < 30) cycles.set(cycle.join("->"), cycle);
      return [];
    }
    const values: Candidate[] = [];
    const routes = [...node.routes].sort(
      (a, b) =>
        effort(a.requirements) - effort(b.requirements) ||
        a.fee.max - b.fee.max,
    );
    for (const route of routes) {
      if (route.eligibility.some((t) => t.state === "missing")) {
        ineligible.add(`${id}:${route.id}`);
        continue;
      }
      for (const c of solveRule(route.requirements, [...stack, id])) {
        const next: Candidate = {
          ...c,
          routes: { ...c.routes, [id]: route.id },
          tasks: {
            ...c.tasks,
            ...Object.fromEntries(route.eligibility.map((t) => [t.id, t])),
          },
        };
        if (
          topologicalOrder(Object.keys(next.routes), Object.values(next.edges))
        )
          values.push(next);
      }
      if (operations >= ceiling || (seeding && values.length)) break;
    }
    return trim(values);
  }
  // Obtain a small valid witness first, so an expensive early OR group cannot starve a later mandatory prerequisite.
  // The normal branch search still runs afterwards; the seed is not assumed optimal.
  let seed: Candidate[] = [];
  if (!catalog.acquisitions[targetId].owned && limit >= 2000) {
    seeding = true; ceiling = Math.min(1000, Math.floor(limit / 5));
    seed = solveCard(targetId, []);
    seeding = false; ceiling = limit;
  }
  const candidates = catalog.acquisitions[targetId].owned ? [] : [...seed, ...solveCard(targetId, [])];
  // Remove redundant supersets before presenting alternatives. Different prerequisite sets remain comparable.
  const canonicalQuestion = (task: PlanTask) =>
    task.factId
      ? `fact:${task.factId}`
      : task.documentId
        ? `document:${task.documentId}`
        : task.id;
  const ranked = trim(candidates);
  const concise = ranked.filter(
    (candidate, index) =>
      !ranked.slice(0, index).some((better) => {
        const entries = Object.entries(better.routes);
        if (
          entries.length > Object.keys(candidate.routes).length ||
          entries.some(([id, route]) => candidate.routes[id] !== route)
        )
          return false;
        const questions = new Set(
          Object.values(candidate.tasks)
            .filter((t) => t.state === "unknown")
            .map(canonicalQuestion),
        );
        if (
          Object.values(better.tasks).some(
            (t) =>
              t.state === "unknown" && !questions.has(canonicalQuestion(t)),
          )
        )
          return false;
        return score(better).every((n, i) => n <= score(candidate)[i]);
      }),
  );
  const plans: AcquisitionPlan[] = concise
    .slice(0, options.maxPlans ?? 3)
    .map((candidate, index) => {
      const order = topologicalOrder(
        Object.keys(candidate.routes),
        Object.values(candidate.edges),
      )!;
      const tasks = Object.values(candidate.tasks);
      const steps = order.map((id) => {
        const node = catalog.acquisitions[id];
        const route = routeById.get(candidate.routes[id])!;
        const prerequisites = Object.values(candidate.edges)
          .filter(([, after]) => after === id)
          .map(([before]) => before)
          .sort();
        return {
          id,
          name: node.name,
          kind: node.kind,
          routeId: route.id,
          mode: route.mode,
          routeLabel: route.label,
          prerequisites,
          canStart: !prerequisites.length && route.canStart,
          eligibility: route.eligibility,
          requirements: tasks.filter(
            (t) => t.forId === id && t.kind !== "eligibility",
          ),
          fee: route.fee,
          preferenceMismatch: route.preferenceMismatch,
          overBudget: route.overBudget,
          procedure: route.procedure,
          refs: node.refs,
        };
      });
      const fees = steps.reduce(
        (total, s) => ({
          min: total.min + s.fee.min,
          max: total.max + s.fee.max,
        }),
        { min: 0, max: 0 },
      );
      return {
        id: `plan-${index + 1}`,
        steps,
        choices: candidate.choices,
        fees,
        missingDocuments: [
          ...new Set([
            ...order.filter((id) => id !== targetId),
            ...tasks
              .filter((t) => t.kind === "document" && t.state !== "satisfied")
              .map((t) => t.documentId!),
          ]),
        ].sort(),
        questions: tasks.filter((t) => t.state === "unknown"),
        satisfied: tasks.filter((t) => t.state === "satisfied"),
        explanation:
          objective === "lowest-fees"
            ? "Prioritizes confirmed eligibility, fewer unanswered conditions and budget fit, then lower modeled fees across the complete plan."
            : "Prioritizes confirmed eligibility, fewer unanswered conditions and budget fit, then fewer acquisitions across the complete plan. Shared prerequisites count once.",
      };
    });
  const status = catalog.acquisitions[targetId].owned
    ? "owned"
    : plans.length
      ? plans[0].questions.length
        ? "needs-input"
        : "planned"
      : complete
        ? "blocked"
        : "incomplete";
  return {
    targetId,
    catalogVersion: catalog.version,
    asOf: catalog.asOf,
    objective,
    status,
    plans,
    search: { complete, operations, limit },
    diagnostics: {
      cycles: [...cycles.values()],
      unavailable: [...unavailable].sort(),
      ineligible: [...ineligible].sort(),
    },
  };
}
