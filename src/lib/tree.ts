import dagre from "@dagrejs/dagre";
import { DETAILS } from "@/data/details";
import { evaluateApplication, type ApplicationContext } from "./prepare";
import { CARDS, CARD_BY_ID, type IdCard } from "@/data/cards";
import { EXTRA_DOCUMENTS } from "@/data/documents";
import type { AcquisitionPlan } from "./planner/types";

export type NodeStatus = "owned" | "available" | "locked";

export const NODE_W = 140;
export const NODE_H = 204;

export interface ReadinessContext extends ApplicationContext {
  prep?: Record<string, string[]>;
  modes?: Record<string, "online" | "onsite">;
}

export function statusOf(
  card: IdCard,
  owned: ReadonlySet<string>,
  context: ReadinessContext = {},
): NodeStatus {
  if (owned.has(card.id)) return "owned";
  return evaluateApplication(card.id, owned, context.prep?.[card.id], {
    ...context,
    mode: context.modes?.[card.id] ?? context.mode,
  }).ready
    ? "available"
    : "locked";
}

export interface TreeEdge {
  id: string;
  source: string;
  target: string;
  /** Document relationship only; nested route rules and cardinality live in the checklist. */
  kind: "all" | "any" | "optional";
}

const edgeOf = (
  source: string,
  target: string,
  kind: TreeEdge["kind"],
  prefix = "",
): TreeEdge => ({
  id: `${prefix}${source}->${target}`,
  source,
  target,
  kind,
});

/** Derive document relationships from the same checklist evaluated by readiness. */
export function buildEdges(): TreeEdge[] {
  const edges = new Map<string, TreeEdge>();
  for (const card of CARDS) {
    for (const entry of DETAILS[card.id].req.prepare) {
      const alternative = "either" in entry;
      const items =
        "either" in entry ? entry.either.flatMap((r) => r.items) : [entry];
      for (const item of items)
        for (const source of item.subject && item.subject !== "self"
          ? []
          : (item.ids ?? [])) {
          if (!CARD_BY_ID[source] || source === card.id) continue;
          const kind =
            item.opt || item.when
              ? "optional"
              : alternative || (item.ids?.length ?? 0) > 1
                ? "any"
                : "all";
          const edge = edgeOf(source, card.id, kind);
          const previous = edges.get(edge.id);
          if (!previous || previous.kind === "optional" || kind === "all")
            edges.set(edge.id, edge);
        }
    }
  }
  return [...edges.values()];
}

export function leadsTo(
  id: string,
): { card: IdCard; kind: TreeEdge["kind"] }[] {
  return buildEdges()
    .filter((e) => e.source === id)
    .map((e) => ({ card: CARD_BY_ID[e.target], kind: e.kind }));
}

export interface TreeCard extends IdCard {
  inventoryOnly?: boolean;
}
export interface Placed {
  card: TreeCard;
  x: number;
  y: number;
}

/** Only selected evidence and prerequisites form a goal path. Catalog alternatives are not all mandatory. */
export function planEdges(plan?: AcquisitionPlan): TreeEdge[] {
  if (!plan) return [];
  const edges = new Map<string, TreeEdge>();
  for (const step of plan.steps) {
    const inputs = [
      ...step.prerequisites,
      ...step.requirements.flatMap((t) => (t.documentId ? [t.documentId] : [])),
    ];
    for (const source of new Set(inputs)) {
      if (
        source === step.id ||
        (!CARD_BY_ID[source] && !EXTRA_DOCUMENTS.some((d) => d.id === source))
      )
        continue;
      const edge = edgeOf(
        source,
        step.id,
        step.requirements.some(
          (t) => t.documentId === source && t.state === "unknown",
        )
          ? "optional"
          : "all",
        "plan:",
      );
      edges.set(edge.id, edge);
    }
  }
  return [...edges.values()];
}

/** Dependency layout. Credential-group metadata is deliberately never read for positioning. */
export function layoutTree(plan?: AcquisitionPlan): {
  placed: Placed[];
  width: number;
  height: number;
  edges: TreeEdge[];
  pathEdges: TreeEdge[];
} {
  const relationships = buildEdges();
  const path = planEdges(plan);
  const cards: TreeCard[] = [...CARDS];
  for (const doc of EXTRA_DOCUMENTS)
    if (path.some((e) => e.source === doc.id || e.target === doc.id))
      cards.push({
        ...doc,
        short: doc.name,
        icon: "receipt",
        category: doc.kind === "document" ? "foundation" : "supporting",
        minAge: 0,
        inventoryOnly: true,
      });
  const adjacency = new Map(cards.map((c) => [c.id, new Set<string>()]));
  const included: TreeEdge[] = [];
  function reaches(
    source: string,
    target: string,
    visited = new Set<string>(),
  ): boolean {
    if (source === target) return true;
    if (visited.has(source)) return false;
    visited.add(source);
    return [...(adjacency.get(source) ?? [])].some((next) =>
      reaches(next, target, visited),
    );
  }
  // Prefer real selected-plan constraints; add only compatible overview links afterwards.
  for (const edge of [
    ...path,
    ...relationships.filter((e) => CARD_BY_ID[e.target].parent === e.source),
  ]) {
    if (
      adjacency.get(edge.source)?.has(edge.target) ||
      reaches(edge.target, edge.source)
    )
      continue;
    adjacency.get(edge.source)?.add(edge.target);
    included.push(edge);
  }
  function place(subset: TreeCard[], constraints: TreeEdge[], offset = 0) {
    if (!subset.length) return { placed: [] as Placed[], width: 0, height: 0 };
    const members = new Set(subset.map((c) => c.id));
    const g = new dagre.graphlib.Graph();
    g.setGraph({
      rankdir: "BT",
      nodesep: 32,
      ranksep: 90,
      marginx: 36,
      marginy: 40,
    });
    g.setDefaultEdgeLabel(() => ({}));
    subset.forEach((c) => g.setNode(c.id, { width: NODE_W, height: NODE_H }));
    constraints
      .filter((e) => members.has(e.source) && members.has(e.target))
      .forEach((e) => g.setEdge(e.source, e.target));
    dagre.layout(g);
    return {
      placed: subset.map((card) => ({
        card,
        x: offset + g.node(card.id).x - NODE_W / 2,
        y: g.node(card.id).y - NODE_H / 2,
      })),
      width: g.graph().width,
      height: g.graph().height,
    };
  }
  if (plan) {
    const selected = new Set([
      ...path.flatMap((e) => [e.source, e.target]),
      ...plan.steps.map((s) => s.id),
    ]);
    const focus = place(
      cards.filter((c) => selected.has(c.id)),
      path,
    );
    const rest = place(
      cards.filter((c) => !selected.has(c.id)),
      included,
      focus.width + 160,
    );
    return {
      placed: [...focus.placed, ...rest.placed],
      width: focus.width + 160 + rest.width,
      height: Math.max(focus.height, rest.height),
      edges: included,
      pathEdges: path,
    };
  }
  return { ...place(cards, included), edges: included, pathEdges: path };
}
