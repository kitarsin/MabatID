import dagre from "@dagrejs/dagre";
import { CARDS, CARD_BY_ID, type IdCard, type Tier } from "@/data/cards";

export type NodeStatus = "owned" | "available" | "locked";

export const NODE_W = 112;
export const NODE_H = 124;
export const ROW_GAP = 190;

export function statusOf(card: IdCard, owned: ReadonlySet<string>): NodeStatus {
  if (owned.has(card.id)) return "owned";
  const allOk = (card.all ?? []).every((id) => owned.has(id));
  const anyOk = !card.any?.length || card.any.some((id) => owned.has(id));
  return allOk && anyOk ? "available" : "locked";
}

/** Human-readable "what unlocks this" list for locked nodes. */
export function unlockHint(card: IdCard): { all: IdCard[]; any: IdCard[] } {
  return {
    all: (card.all ?? []).map((id) => CARD_BY_ID[id]),
    any: (card.any ?? []).map((id) => CARD_BY_ID[id]),
  };
}

export interface TreeEdge {
  id: string;
  source: string;
  target: string;
  /** all = required · any = one of several accepted · optional = helpful / sometimes asked for */
  kind: "all" | "any" | "optional";
  /** parent and child share a tier row, so the line runs sideways */
  side?: boolean;
}

/** Main-path parent per card (data lives on the card as `parent`). */
const PRIMARY_PARENT: Record<string, string> = Object.fromEntries(
  CARDS.filter((c) => c.parent).map((c) => [c.id, c.parent as string]),
);

/**
 * Hand-planned columns (1 unit = one node width) so every ID sits directly above,
 * or right beside, its main parent. That keeps straight lines short and tidy.
 * Cards missing from this map fall back to Dagre's computed order.
 */
const GRID: Record<string, number> = {
  // Tier 0 (bottom)
  school: 1, cedula: 2.25, psa: 3.5, barangay: 7.5,
  // Tier 1
  nbi: 0, npc: 1, comelec: 2, philhealth: 3, tin: 4, postal: 5,
  // Tier 2 — philsys → lto → pagibig and philsys → mysss run sideways
  pagibig: 1.5, lto: 2.5, philsys: 3.5, mysss: 4.5, passport: 5.5,
  // Tier 3 (top)
  prc: 2.5, owwa: 5.5, soloparent: 6.5, pwd: 7.5, senior: 8.5,
};

const edgeOf = (source: string, target: string, kind: TreeEdge["kind"], prefix = ""): TreeEdge => ({
  id: `${prefix}${source}->${target}`,
  source,
  target,
  kind,
  side: CARD_BY_ID[source].tier === CARD_BY_ID[target].tier,
});

export function buildEdges(): TreeEdge[] {
  return Object.entries(PRIMARY_PARENT).map(([child, parent]) =>
    edgeOf(parent, child, (CARD_BY_ID[child].all ?? []).includes(parent) ? "all" : "any"),
  );
}

/** Every ID that this one helps you get (or that sometimes asks for it). */
export function leadsTo(id: string): { card: IdCard; kind: TreeEdge["kind"] }[] {
  const out: { card: IdCard; kind: TreeEdge["kind"] }[] = [];
  for (const c of CARDS) {
    if (c.id === id) continue;
    if (c.all?.includes(id)) out.push({ card: c, kind: "all" });
    else if (c.any?.includes(id)) out.push({ card: c, kind: "any" });
    else if (c.optional?.includes(id)) out.push({ card: c, kind: "optional" });
  }
  return out;
}

export interface Placed {
  card: IdCard;
  x: number;
  y: number;
}

const TOP = 60;
const COL = 116;
export const rowY = (t: Tier) => TOP + (3 - t) * ROW_GAP; // Tier 0 sits at the BOTTOM

export function layoutTree(): { placed: Placed[]; width: number; height: number; edges: TreeEdge[] } {
  const edges = buildEdges();
  const g = new dagre.graphlib.Graph();
  g.setGraph({ rankdir: "BT", nodesep: 24, ranksep: 90, marginx: 0, marginy: 0 });
  g.setDefaultEdgeLabel(() => ({}));
  CARDS.forEach((c) => g.setNode(c.id, { width: NODE_W, height: NODE_H }));
  edges.forEach((e) => g.setEdge(e.source, e.target));
  dagre.layout(g);

  // Fallback for any future card without a hand-planned column: use Dagre's x.
  const gridMax = Math.max(...Object.values(GRID));
  const dagreXs = CARDS.map((c) => g.node(c.id).x as number);
  const dMin = Math.min(...dagreXs);
  const colOf = (c: IdCard) => GRID[c.id] ?? ((g.node(c.id).x as number) - dMin) / COL;

  const placed: Placed[] = CARDS.map((c) => ({ card: c, x: colOf(c) * COL, y: rowY(c.tier) }));
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
  const top = Math.max(-1, ...CARDS.filter((c) => owned.has(c.id)).map((c) => c.tier));
  return ["Foundation Builder", "First-ID Holder", "Primary-ID Holder", "Specialist"][top] ?? "Just starting";
}
