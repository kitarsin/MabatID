"use client";

import { useMemo, useState } from "react";
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
import { CARDS, CARD_BY_ID, TIER_META, type IdCard, type Tier } from "@/data/cards";
import { layoutTree, leadsTo, NODE_H, NODE_W, ROW_GAP, rowY, statusOf, type NodeStatus } from "@/lib/tree";
import { Pill, type PillTone } from "@/components/ui/pill";
import { NodeCircle } from "./NodeCircle";

const HANDLE = "!size-1 !min-h-0 !min-w-0 !border-0 !bg-transparent !opacity-0 !pointer-events-none";

/** How a node relates to the selected ID: what it needs from it / gives to it. */
type Rel = { needs?: "all" | "any" | "optional"; leads?: "main" | "optional" };

type IdNodeData = {
  card: IdCard;
  status: NodeStatus;
  selected: boolean;
  dim: boolean;
  rel: Rel | null;
  /** The one node that pulses: the priority ID, else the lowest-tier ID that is ready. */
  pulse: boolean;
  /** Fresh start (nothing owned yet): marks where to begin. */
  startHere: boolean;
  onSelect: (id: string) => void;
};

function relPills(rel: Rel | null) {
  const out: { label: string; tone: PillTone; cls?: string }[] = [];
  if (rel?.needs === "all") out.push({ label: "Required", tone: "navy" });
  if (rel?.needs === "any") out.push({ label: "Pick one", tone: "navy" });
  if (rel?.needs === "optional") out.push({ label: "Optional", tone: "mist", cls: "ring-1 ring-navy/30" });
  if (rel?.leads === "main") out.push({ label: "Leads to", tone: "civic" });
  if (rel?.leads === "optional") out.push({ label: "May ask for it", tone: "mist", cls: "ring-1 ring-civic/40" });
  return out;
}
type TierNodeData = { tier: Tier };

export const STATUS_LABEL: Record<NodeStatus, string> = {
  owned: "You have this",
  available: "Ready to get",
  locked: "Locked",
};

function IdNode({ data }: NodeProps<Node<IdNodeData, "id">>) {
  const { card, status, selected, dim, rel, pulse, startHere, onSelect } = data;
  const pills = relPills(rel);

  // One-shot feedback when this ID's status changes while it is on screen.
  // Compared during render (no effect): "got" = you just marked it, "unlock" = it just became ready.
  const [prevStatus, setPrevStatus] = useState(status);
  const [anim, setAnim] = useState<"got" | "unlock" | null>(null);
  if (prevStatus !== status) {
    setPrevStatus(status);
    setAnim(status === "owned" ? "got" : prevStatus === "locked" && status === "available" ? "unlock" : null);
  }

  const motion = [
    pulse || anim === "unlock" ? "pulse-ring" : "",
    anim === "unlock" && !pulse ? "pulse-once" : "",
    anim === "got" ? "node-got" : "",
  ].join(" ");

  return (
    <div style={{ width: NODE_W }} className={`flex flex-col items-center transition-opacity duration-[var(--dur-base)] ${dim ? "opacity-20 grayscale" : ""}`}>
      <button
        type="button"
        onClick={() => onSelect(card.id)}
        aria-label={`${card.name}. ${STATUS_LABEL[status]}.${startHere ? " Start here." : ""} Open details.`}
        data-card-id={card.id}
        className="group flex flex-col items-center gap-1.5 rounded-2xl p-1 outline-offset-2"
      >
        <NodeCircle
          status={status}
          icon={card.icon}
          onAnimationEnd={() => setAnim(null)}
          className={`group-hover:scale-[1.04] group-active:scale-[0.96] ${motion} ${
            selected ? "ring-4 ring-navy ring-offset-2 ring-offset-background" : ""
          }`}
        >
          <Handle type="source" position={Position.Top} className={HANDLE} />
          <Handle type="target" position={Position.Bottom} className={HANDLE} />
          <Handle id="r" type="source" position={Position.Right} className={HANDLE} />
          <Handle id="ls" type="source" position={Position.Left} className={HANDLE} />
          <Handle id="l" type="target" position={Position.Left} className={HANDLE} />
          <Handle id="rt" type="target" position={Position.Right} className={HANDLE} />
        </NodeCircle>
        <span
          className={`max-w-[104px] text-balance rounded-md bg-background px-1.5 py-0.5 text-center text-[13px] font-semibold leading-tight ${
            status === "locked" ? "text-locked" : "text-navy"
          }`}
        >
          {card.short}
        </span>
        {startHere && <Pill tone="navy">Start here</Pill>}
        {pills.map((p) => (
          <Pill key={p.label} tone={p.tone} className={p.cls}>
            {p.label}
          </Pill>
        ))}
      </button>
    </div>
  );
}

function TierNode({ data }: NodeProps<Node<TierNodeData, "tier">>) {
  const meta = TIER_META[data.tier];
  return (
    <div className="pointer-events-none flex w-[260px] flex-col items-start">
      <Pill tone="mist" className="px-3 py-1.5">
        {meta.label}
      </Pill>
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
  priorityId = null,
}: {
  owned: ReadonlySet<string>;
  selectedId: string | null;
  onSelect: (id: string) => void;
  onClear: () => void;
  /** When set, IDs outside this set are dimmed (tree filter). */
  matchIds: ReadonlySet<string> | null;
  /** The user's priority ID: the view opens on it and it is the node that pulses. */
  priorityId?: string | null;
}) {
  const layout = useMemo(() => layoutTree(), []);
  const xOf = useMemo(() => Object.fromEntries(layout.placed.map((p) => [p.card.id, p.x])), [layout]);

  // Lowest-tier ID that can be started right now (CARDS order breaks ties, so the PSA comes first).
  const firstReady = useMemo(
    () => CARDS.filter((c) => statusOf(c, owned) === "available").sort((a, b) => a.tier - b.tier)[0] ?? null,
    [owned],
  );
  const priority = priorityId ? (CARD_BY_ID[priorityId] ?? null) : null;
  // Only one node pulses: the priority ID while it is still ready, otherwise the first ready one.
  const pulseId = priority && statusOf(priority, owned) === "available" ? priority.id : (firstReady?.id ?? null);
  const startHereId = owned.size === 0 ? "psa" : null;

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
      data: {
        card: p.card,
        status: statusOf(p.card, owned),
        selected: selectedId === p.card.id,
        dim: (!!matchIds && !matchIds.has(p.card.id)) || (!!selectedId && selectedId !== p.card.id && !rels[p.card.id]),
        rel: rels[p.card.id] ?? null,
        pulse: pulseId === p.card.id,
        startHere: startHereId === p.card.id,
        onSelect,
      },
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
  }, [layout, owned, selectedId, onSelect, matchIds, rels, pulseId, startHereId]);

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
        // Only the line leading into the pulsing node marches (3 loops), not every open edge.
        className: open && e.target === pulseId ? "edge-flow-active" : undefined,
        style: {
          stroke: lit ? "var(--color-amber)" : open ? "var(--color-civic)" : "var(--locked-line)",
          strokeOpacity: faded ? 0.12 : 1,
          strokeWidth: lit ? 3 : 2,
          strokeDasharray: open ? "8 6" : undefined,
        },
      };
    });
    return base;
  }, [layout, owned, xOf, matchIds, selectedId, rels, pulseId]);

  return (
    <ReactFlow
      nodes={nodes}
      edges={edges}
      nodeTypes={nodeTypes}
      onInit={(rf) => {
        // Open where the user's next step is: priority ID, else the lowest-tier ready ID, else the PSA.
        const targetId = priority?.id ?? firstReady?.id ?? "psa";
        const target = layout.placed.find((p) => p.card.id === targetId);
        const x = target ? target.x + NODE_W / 2 : layout.width / 2;
        // Sit the node in the lower half so the IDs it unlocks are visible above it.
        const y = target ? target.y + NODE_H / 2 - ROW_GAP * 0.75 : rowY(1) + 40;
        rf.setCenter(x, y, { zoom: 0.8 });
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
      <Background variant={BackgroundVariant.Dots} gap={26} size={1.4} color="color-mix(in srgb, var(--color-navy) 14%, transparent)" />
      <Controls showInteractive={false} position="bottom-right" />
    </ReactFlow>
  );
}
