"use client";

import { useMemo } from "react";
import {
  Background,
  BackgroundVariant,
  Controls,
  Handle,
  Position,
  ReactFlow,
  type Edge,
  type Node,
  type NodeProps,
} from "@xyflow/react";
import { Check, Lock } from "lucide-react";
import { CARD_BY_ID, TIER_META, type IdCard, type Tier } from "@/data/cards";
import { layoutTree, leadsTo, NODE_W, rowY, statusOf, type NodeStatus } from "@/lib/tree";
import { CardIcon } from "./icons";

const HANDLE = "!size-1 !min-h-0 !min-w-0 !border-0 !bg-transparent !opacity-0 !pointer-events-none";

/** How a node relates to the selected ID: what it needs from it / gives to it. */
type Rel = { needs?: "all" | "any" | "optional"; leads?: "main" | "optional" };

type IdNodeData = { card: IdCard; status: NodeStatus; selected: boolean; dim: boolean; rel: Rel | null; onSelect: (id: string) => void };

function relPills(rel: Rel | null) {
  const out: { label: string; cls: string }[] = [];
  if (rel?.needs === "all") out.push({ label: "Required", cls: "bg-navy text-white" });
  if (rel?.needs === "any") out.push({ label: "Pick one", cls: "bg-navy text-white" });
  if (rel?.needs === "optional") out.push({ label: "Optional", cls: "bg-mist text-navy ring-1 ring-navy/30" });
  if (rel?.leads === "main") out.push({ label: "Leads to", cls: "bg-civic text-white" });
  if (rel?.leads === "optional") out.push({ label: "May ask for it", cls: "bg-mist text-navy ring-1 ring-civic/40" });
  return out;
}
type TierNodeData = { tier: Tier };

const STATUS_LABEL: Record<NodeStatus, string> = {
  owned: "You have this",
  available: "Ready to get",
  locked: "Locked",
};

function IdNode({ data }: NodeProps<Node<IdNodeData, "id">>) {
  const { card, status, selected, dim, rel, onSelect } = data;
  const pills = relPills(rel);
  const circle =
    status === "owned"
      ? "bg-amber text-navy border-amber shadow-[0_2px_10px_rgba(255,165,0,0.45)]"
      : status === "available"
        ? "bg-white text-civic border-civic shadow-[0_2px_8px_rgba(0,90,156,0.25)] node-available"
        : "bg-white text-slate-500 border-dashed border-slate-400";
  return (
    <div style={{ width: NODE_W }} className={`flex flex-col items-center transition-opacity ${dim ? "opacity-20 grayscale" : ""}`}>
      <button
        type="button"
        onClick={() => onSelect(card.id)}
        aria-label={`${card.name}. ${STATUS_LABEL[status]}. Open details.`}
        className="group flex flex-col items-center gap-1.5 rounded-2xl p-1 outline-offset-2 focus-visible:outline-civic"
      >
        <span
          className={`relative grid size-[72px] place-items-center rounded-full border-[3px] transition-transform group-hover:scale-105 group-active:scale-95 ${circle} ${
            selected ? "ring-4 ring-navy ring-offset-2 ring-offset-background" : ""
          }`}
        >
          <Handle type="source" position={Position.Top} className={HANDLE} />
          <Handle type="target" position={Position.Bottom} className={HANDLE} />
          <Handle id="r" type="source" position={Position.Right} className={HANDLE} />
          <Handle id="ls" type="source" position={Position.Left} className={HANDLE} />
          <Handle id="l" type="target" position={Position.Left} className={HANDLE} />
          <Handle id="rt" type="target" position={Position.Right} className={HANDLE} />
          <CardIcon name={card.icon} className="size-8" />
          {status === "owned" && (
            <span className="absolute -right-1 -top-1 grid size-6 place-items-center rounded-full bg-navy text-white shadow">
              <Check className="size-4" strokeWidth={3} aria-hidden="true" />
            </span>
          )}
          {status === "locked" && (
            <span className="absolute -right-1 -top-1 grid size-6 place-items-center rounded-full bg-slate-500 text-white">
              <Lock className="size-3.5" aria-hidden="true" />
            </span>
          )}
        </span>
        <span
          className={`max-w-[104px] text-balance rounded-md bg-background px-1.5 py-0.5 text-center text-[13px] font-bold leading-tight ${
            status === "locked" ? "text-slate-600" : "text-navy"
          }`}
        >
          {card.short}
        </span>
        {pills.map((p) => (
          <span key={p.label} className={`rounded-full px-2 py-0.5 text-[11px] font-extrabold leading-none ${p.cls}`}>
            {p.label}
          </span>
        ))}
      </button>
    </div>
  );
}

function TierNode({ data }: NodeProps<Node<TierNodeData, "tier">>) {
  const meta = TIER_META[data.tier];
  return (
    <div className="pointer-events-none flex w-[260px] flex-col items-start">
      <span className="rounded-full bg-mist px-3 py-1 text-[11px] font-bold uppercase tracking-wider text-navy">
        {meta.label}
      </span>
    </div>
  );
}

/** Same-tier links run sideways, leaving whichever side faces the target. */
function sideHandles(sourceX: number, targetX: number) {
  return targetX >= sourceX ? { sourceHandle: "r", targetHandle: "l" } : { sourceHandle: "ls", targetHandle: "rt" };
}

const nodeTypes = { id: IdNode, tier: TierNode };

export function SkillTree({
  owned,
  selectedId,
  onSelect,
  onClear,
  matchIds,
  liftControls = false,
}: {
  owned: ReadonlySet<string>;
  selectedId: string | null;
  onSelect: (id: string) => void;
  onClear: () => void;
  /** When set, IDs outside this set are dimmed (tree filter). */
  matchIds: ReadonlySet<string> | null;
  /** Raise the zoom controls so the floating progress bar doesn't cover them. */
  liftControls?: boolean;
}) {
  const layout = useMemo(() => layoutTree(), []);
  const xOf = useMemo(() => Object.fromEntries(layout.placed.map((p) => [p.card.id, p.x])), [layout]);

  // How every other ID relates to the selected one (drives the badges and the fade).
  const rels = useMemo(() => {
    const map: Record<string, Rel> = {};
    if (!selectedId) return map;
    const sel = CARD_BY_ID[selectedId];
    for (const id of sel.all ?? []) map[id] = { ...map[id], needs: "all" };
    for (const id of sel.any ?? []) if (!map[id]) map[id] = { needs: "any" };
    for (const id of sel.optional ?? []) if (!map[id]) map[id] = { needs: "optional" };
    for (const { card, kind } of leadsTo(selectedId))
      map[card.id] = { ...map[card.id], leads: kind === "optional" ? "optional" : "main" };
    return map;
  }, [selectedId]);

  const nodes = useMemo<Node[]>(() => {
    const idNodes: Node[] = layout.placed.map((p) => ({
      id: p.card.id,
      type: "id",
      position: { x: p.x, y: p.y },
      draggable: false,
      data: { card: p.card, status: statusOf(p.card, owned), selected: selectedId === p.card.id, dim: (!!matchIds && !matchIds.has(p.card.id)) || (!!selectedId && selectedId !== p.card.id && !rels[p.card.id]), rel: rels[p.card.id] ?? null, onSelect },
    }));
    const tierNodes: Node[] = ([0, 1, 2, 3] as Tier[]).map((t) => ({
      id: `tier-${t}`,
      type: "tier",
      position: { x: 6, y: rowY(t) - 46 },
      draggable: false,
      selectable: false,
      focusable: false,
      zIndex: -1,
      data: { tier: t },
    }));
    return [...tierNodes, ...idNodes];
  }, [layout, owned, selectedId, onSelect, matchIds, rels]);

  const edges = useMemo<Edge[]>(() => {
    const base: Edge[] = layout.edges.map((e) => {
      const src = owned.has(e.source);
      const tgtStatus = statusOf(CARD_BY_ID[e.target], owned);
      const lit = src && tgtStatus === "owned";
      const open = src && tgtStatus === "available";
      const inFocus = (id: string) => id === selectedId || !!rels[id];
      const faded =
        (!!matchIds && (!matchIds.has(e.source) || !matchIds.has(e.target))) ||
        (!!selectedId && !(inFocus(e.source) && inFocus(e.target)));
      return {
        id: e.id,
        source: e.source,
        target: e.target,
        type: "straight",
        ...(e.side ? sideHandles(xOf[e.source], xOf[e.target]) : {}),
        className: open ? "edge-available" : undefined,
        style: {
          stroke: lit ? "#FFA500" : open ? "#005A9C" : "#94A3B8",
          strokeOpacity: faded ? 0.12 : lit ? 1 : open ? 0.9 : 0.75,
          strokeWidth: lit ? 3 : 2,
          strokeDasharray: open ? "8 6" : undefined,
        },
      };
    });
    return base;
  }, [layout, owned, xOf, matchIds, selectedId, rels]);

  return (
    <ReactFlow
      nodes={nodes}
      edges={edges}
      nodeTypes={nodeTypes}
      onInit={(rf) => {
        // Start where the journey starts: Tier 0 at the bottom, centred on the PSA Birth Certificate.
        const start = layout.placed.find((p) => p.card.id === "psa");
        rf.setCenter((start?.x ?? layout.width / 2) + NODE_W / 2, rowY(1) + 40, { zoom: 0.8 });
      }}
      translateExtent={[[-80, -60], [layout.width + 80, layout.height + 60]]}
      fitViewOptions={{ padding: 0.04 }}
      minZoom={0.4}
      maxZoom={1.4}
      onPaneClick={onClear}
      nodesDraggable={false}
      nodesConnectable={false}
      // selectable keeps React Flow from setting pointer-events:none on the node (our nodes hold real buttons)
      elementsSelectable
      zoomOnDoubleClick={false}
      proOptions={{ hideAttribution: true }}
      aria-label="Government ID path"
    >
      <Background variant={BackgroundVariant.Dots} gap={26} size={1.4} color="rgba(27,54,93,0.14)" />
      <Controls showInteractive={false} position="bottom-right" style={liftControls ? { marginBottom: 52 } : undefined} />
    </ReactFlow>
  );
}
