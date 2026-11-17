import dagre from "@dagrejs/dagre";
import { DETAILS } from "@/data/details";
import { evaluateApplication, type ApplicationContext } from "./prepare";
import { CARDS, CARD_BY_ID, type IdCard, type Tier } from "@/data/cards";

export type NodeStatus = "owned" | "available" | "locked";

export const NODE_W = 112;
export const NODE_H = 124;
export const ROW_GAP = 190;

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
  /** parent and child share a tier row, so the line runs sideways */
  side?: boolean;
}

/**
 * Hand-planned columns (1 unit = one node width) so every ID sits directly above,
 * or right beside, its main parent. That keeps straight lines short and tidy.
 * Cards missing from this map fall back to Dagre's computed order.
 */
const GRID: Record<string, number> = {
  // Tier 0 (bottom)
  cedula: 2.25,
  psa: 3.5,
  barangay: 7.5,
  // Tier 1
  "barangay-id": 0,
  school: 1,
  nbi: 2,
  npc: 3,
  comelec: 4,
  philhealth: 5,
  tin: 6,
  postal: 7,
  // Tier 2 — philsys → lto → pagibig and philsys → mysss run sideways
  pagibig: 1.5,
  lto: 2.5,
  philsys: 3.5,
  mysss: 4.5,
  passport: 5.5,
  // Tier 3 (top)
  prc: 2.5,
  owwa: 5.5,
  soloparent: 6.5,
  pwd: 7.5,
  senior: 8.5,
};

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
  side: CARD_BY_ID[source].tier === CARD_BY_ID[target].tier,
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

export interface Placed {
  card: IdCard;
  x: number;
  y: number;
}

const TOP = 60;
const COL = 116;
export const rowY = (t: Tier) => TOP + (3 - t) * ROW_GAP; // Tier 0 sits at the BOTTOM

export function layoutTree(): {
  placed: Placed[];
  width: number;
  height: number;
  edges: TreeEdge[];
} {
  const edges = buildEdges();
  const g = new dagre.graphlib.Graph();
  g.setGraph({
    rankdir: "BT",
    nodesep: 24,
    ranksep: 90,
    marginx: 0,
    marginy: 0,
  });
  g.setDefaultEdgeLabel(() => ({}));
  CARDS.forEach((c) => g.setNode(c.id, { width: NODE_W, height: NODE_H }));
  edges.forEach((e) => g.setEdge(e.source, e.target));
  dagre.layout(g);

  // Fallback for any future card without a hand-planned column: use Dagre's x.
  const gridMax = Math.max(...Object.values(GRID));
  const dagreXs = CARDS.map((c) => g.node(c.id).x as number);
  const dMin = Math.min(...dagreXs);
  const colOf = (c: IdCard) =>
    GRID[c.id] ?? ((g.node(c.id).x as number) - dMin) / COL;

  const placed: Placed[] = CARDS.map((c) => ({
    card: c,
    x: colOf(c) * COL,
    y: rowY(c.tier),
  }));
  const width = (Math.max(gridMax, ...placed.map((p) => p.x / COL)) + 1) * COL;
  return { placed, width, height: rowY(0) + NODE_H + 30, edges };
}

export const TIER_COUNTS: Record<Tier, number> = {
  0: CARDS.filter((c) => c.tier === 0).length,
  1: CARDS.filter((c) => c.tier === 1).length,
  2: CARDS.filter((c) => c.tier === 2).length,
  3: CARDS.filter((c) => c.tier === 3).length,
};

export function levelTitle(owned: ReadonlySet<string>): string {
  const top = Math.max(
    -1,
    ...CARDS.filter((c) => owned.has(c.id)).map((c) => c.tier),
  );
  return (
    [
      "Foundation Builder",
      "First-ID Holder",
      "Primary-ID Holder",
      "Specialist",
    ][top] ?? "Just starting"
  );
}
