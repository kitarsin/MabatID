"use client";

import { useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import {
  Background,
  BackgroundVariant,
  Controls,
  Handle,
  MarkerType,
  Position,
  ReactFlow,
  useNodesInitialized,
  useReactFlow,
  type Edge,
  type Node,
  type NodeProps,
} from "@xyflow/react";
import { Star } from "lucide-react";
import { Pill } from "@/components/ui/pill";
import {
  layoutTree,
  NODE_W,
  statusOf,
  type ReadinessContext,
  type TreeCard,
} from "@/lib/tree";
import type { AcquisitionPlan } from "@/lib/planner/types";
import type {
  NodeAssessment,
  TreeNodeStatus,
} from "@/lib/planner/recommendations";
import { TREE_STATUS_LABELS } from "@/lib/tree-status";
import { NodeCircle } from "./NodeCircle";

const HANDLE =
  "!size-1 !min-h-0 !min-w-0 !border-0 !bg-transparent !opacity-0 !pointer-events-none";

/** Darker amber for lines that carry an owned document (plain amber is under 3:1 on the light canvas). */
const FLOW_VARS = {
  "--edge-owned":
    "color-mix(in srgb, var(--color-amber) 70%, var(--color-navy))",
} as CSSProperties;

type IdNodeData = {
  card: TreeCard;
  status: TreeNodeStatus;
  selected: boolean;
  dim: boolean;
  recommended: boolean;
  path: boolean;
  /** The one node that pulses: the priority ID, else the first suggested ID. */
  pulse: boolean;
  /** Nothing owned yet: marks where to begin (replaces the "Suggested next" pill on that node). */
  startHere: boolean;
  onSelect: (id: string) => void;
  onEdit: () => void;
};

function IdNode({ data }: NodeProps<Node<IdNodeData, "id">>) {
  const {
    card,
    status,
    selected,
    dim,
    recommended,
    path,
    pulse,
    startHere,
    onSelect,
    onEdit,
  } = data;

  // One-shot feedback when you mark this ID as owned while the tree is on screen.
  // Compared during render (no effect). Only "got" is animated: other statuses can change when the
  // planner's assessment arrives, which must not look like something the user did.
  const [prevStatus, setPrevStatus] = useState(status);
  const [got, setGot] = useState(false);
  if (prevStatus !== status) {
    setPrevStatus(status);
    setGot(status === "owned");
  }

  const ring = selected
    ? "ring-4 ring-navy ring-offset-2 ring-offset-background"
    : path
      ? "ring-2 ring-civic ring-offset-2 ring-offset-background"
      : recommended
        ? "ring-2 ring-amber ring-offset-2 ring-offset-background"
        : "";

  return (
    <div
      style={{ width: NODE_W }}
      className={`flex flex-col items-center transition-opacity duration-[var(--dur-base)] ${dim ? "opacity-25" : ""}`}
    >
      <button
        type="button"
        onClick={() => (card.inventoryOnly ? onEdit() : onSelect(card.id))}
        data-card-id={card.id}
        aria-label={`${card.name}. ${TREE_STATUS_LABELS[status]}.${recommended ? " Recommended next." : ""}${startHere ? " Start here." : ""}${path ? " In selected route." : ""} ${card.inventoryOnly ? "Edit inventory." : "Open guide."}`}
        className="group flex w-full flex-col items-center gap-1.5 rounded-2xl p-1 outline-offset-2"
      >
        <NodeCircle
          status={status}
          icon={card.icon}
          onAnimationEnd={() => setGot(false)}
          className={`group-hover:scale-[1.04] group-active:scale-[0.96] ${pulse ? "pulse-ring" : ""} ${got ? "node-got" : ""} ${ring}`}
        >
          <Handle
            id="top-source"
            type="source"
            position={Position.Top}
            className={HANDLE}
          />
          <Handle
            id="bottom-target"
            type="target"
            position={Position.Bottom}
            className={HANDLE}
          />
          <Handle
            id="right-source"
            type="source"
            position={Position.Right}
            className={HANDLE}
          />
          <Handle
            id="left-target"
            type="target"
            position={Position.Left}
            className={HANDLE}
          />
          <Handle
            id="left-source"
            type="source"
            position={Position.Left}
            className={HANDLE}
          />
          <Handle
            id="right-target"
            type="target"
            position={Position.Right}
            className={HANDLE}
          />
          <Handle
            id="bottom-source"
            type="source"
            position={Position.Bottom}
            className={HANDLE}
          />
          <Handle
            id="top-target"
            type="target"
            position={Position.Top}
            className={HANDLE}
          />
        </NodeCircle>
        <span className="max-w-[132px] rounded-md bg-background px-1.5 py-0.5 text-center text-[13px] font-semibold leading-tight text-navy">
          {card.short}
        </span>
        <span className="rounded-md bg-background px-1 text-xs font-semibold text-muted-foreground">
          {TREE_STATUS_LABELS[status]}
        </span>
        {startHere ? (
          <Pill tone="navy">Start here</Pill>
        ) : (
          recommended && (
            <Pill tone="amber">
              <Star className="size-3" aria-hidden="true" />
              Suggested next
            </Pill>
          )
        )}
        {selected && <Pill tone="navy">Selected goal</Pill>}
        {card.inventoryOnly && (
          <span className="text-xs font-semibold">Inventory evidence</span>
        )}
      </button>
    </div>
  );
}
const nodeTypes = { id: IdNode };

export function SkillTree({
  owned,
  context,
  selectedId,
  onSelect,
  onClear,
  onEdit,
  matchIds,
  assessments,
  recommendedIds,
  plan,
  priorityId = null,
}: {
  owned: ReadonlySet<string>;
  context: ReadinessContext;
  selectedId: string | null;
  onSelect: (id: string) => void;
  onClear: () => void;
  onEdit: () => void;
  matchIds: ReadonlySet<string> | null;
  assessments?: Record<string, NodeAssessment>;
  recommendedIds: string[];
  plan?: AcquisitionPlan;
  /** The user's priority ID: the view opens on it and it is the node that pulses (while it is ready). */
  priorityId?: string | null;
}) {
  const layout = useMemo(() => layoutTree(plan), [plan]);
  const pathIds = useMemo(
    () =>
      new Set([
        ...layout.pathEdges.flatMap((e) => [e.source, e.target]),
        ...(plan?.steps.map((s) => s.id) ?? []),
      ]),
    [layout, plan],
  );
  const recommendations = useMemo(
    () => new Set(recommendedIds),
    [recommendedIds],
  );
  // Only one node pulses: the priority ID while its requirements are ready, else the first suggestion.
  const priorityReady =
    !!priorityId && assessments?.[priorityId]?.status === "available";
  const pulseId = selectedId
    ? null
    : priorityReady
      ? priorityId
      : (recommendedIds[0] ?? null);
  const startHereId = owned.size === 0 && !selectedId ? pulseId : null;
  const nodes = useMemo<Node[]>(
    () =>
      layout.placed.map((p) => {
        const fallback = p.card.inventoryOnly
          ? owned.has(p.card.id)
            ? "owned"
            : "confirmation"
          : statusOf(p.card, owned, context);
        return {
          id: p.card.id,
          type: "id",
          position: { x: p.x, y: p.y },
          draggable: false,
          data: {
            card: p.card,
            status:
              assessments?.[p.card.id]?.status ??
              (fallback === "locked" ? "preparation" : fallback),
            selected: selectedId === p.card.id,
            dim:
              (!!selectedId &&
                selectedId !== p.card.id &&
                !pathIds.has(p.card.id)) ||
              (!!matchIds &&
                !matchIds.has(p.card.id) &&
                !pathIds.has(p.card.id)),
            recommended: !selectedId && recommendations.has(p.card.id),
            path: pathIds.has(p.card.id),
            pulse: pulseId === p.card.id,
            startHere: startHereId === p.card.id,
            onSelect,
            onEdit,
          },
        };
      }),
    [
      layout,
      owned,
      context,
      assessments,
      selectedId,
      pathIds,
      recommendations,
      matchIds,
      pulseId,
      startHereId,
      onSelect,
      onEdit,
    ],
  );
  const edges = useMemo<Edge[]>(() => {
    const positions = new Map(layout.placed.map((p) => [p.card.id, p]));
    const chosen =
      selectedId && plan ? layout.pathEdges : selectedId ? [] : layout.edges;
    return chosen.map((edge) => {
      const source = positions.get(edge.source)!;
      const target = positions.get(edge.target)!;
      const sideways = Math.abs(source.y - target.y) < 30;
      const handles = sideways
        ? source.x < target.x
          ? { sourceHandle: "right-source", targetHandle: "left-target" }
          : { sourceHandle: "left-source", targetHandle: "right-target" }
        : source.y > target.y
          ? { sourceHandle: "top-source", targetHandle: "bottom-target" }
          : { sourceHandle: "bottom-source", targetHandle: "top-target" };
      const inPath = !!selectedId && !!plan;
      const inputCount = chosen.filter((e) => e.target === edge.target).length;
      const label = inPath
        ? edge.kind === "optional"
          ? "Needs confirmation"
          : inputCount > 1
            ? "AND"
            : "Selected route"
        : undefined;
      const color = inPath
        ? owned.has(edge.source)
          ? "var(--edge-owned)"
          : "var(--color-civic)"
        : "var(--locked-line)";
      // Overview only: the line into the pulsing node marches for 3 loops, then rests.
      const flows = !selectedId && edge.target === pulseId;
      return {
        id: edge.id,
        source: edge.source,
        target: edge.target,
        ...handles,
        type: "default",
        label,
        className: flows ? "edge-flow-active" : undefined,
        labelStyle: { fontSize: 12, fill: "var(--color-navy)" },
        labelBgStyle: { fill: "var(--background)" },
        labelBgPadding: [5, 3],
        markerEnd: { type: MarkerType.ArrowClosed, color },
        style: {
          stroke: color,
          strokeWidth: inPath ? 3 : 1.5,
          strokeOpacity: inPath ? 1 : 0.85,
          strokeDasharray: flows
            ? "8 6"
            : !inPath || edge.kind === "optional"
              ? "5 5"
              : undefined,
        },
      };
    });
  }, [layout, selectedId, plan, owned, pulseId]);
  const rf = useReactFlow();
  const initialized = useNodesInitialized();
  const lastFocus = useRef("");
  const overviewTarget = priorityId ?? recommendedIds[0] ?? "starter";
  const focusKey = `${selectedId ?? "overview"}:${selectedId ? layout.pathEdges.map((e) => e.id).join() : overviewTarget}`;
  useEffect(() => {
    if (!initialized || lastFocus.current === focusKey) return;
    const timer = requestAnimationFrame(() => {
      lastFocus.current = focusKey;
      if (selectedId)
        void rf.fitView({
          nodes: [...new Set([selectedId, ...pathIds])].map((id) => ({ id })),
          padding: { top: "64px", bottom: "48px", left: "12%", right: "12%" },
          maxZoom: 0.9,
          minZoom: 0.2,
          duration: 250,
        });
      else {
        // Open where the next step is: priority ID, else the first suggestion, else the default starter.
        const target =
          layout.placed.find((p) => p.card.id === priorityId) ??
          layout.placed.find((p) => p.card.id === recommendedIds[0]) ??
          layout.placed.find((p) => p.card.id === "barangay-id")!;
        void rf.setCenter(target.x + NODE_W / 2, target.y + 80, {
          zoom: 0.85,
          duration: 250,
        });
      }
    });
    return () => cancelAnimationFrame(timer);
  }, [
    initialized,
    focusKey,
    rf,
    selectedId,
    pathIds,
    layout,
    recommendedIds,
    priorityId,
  ]);
  return (
    <ReactFlow
      nodes={nodes}
      edges={edges}
      nodeTypes={nodeTypes}
      minZoom={0.18}
      maxZoom={1.5}
      onPaneClick={onClear}
      nodesDraggable={false}
      nodesConnectable={false}
      elementsSelectable
      zoomOnDoubleClick={false}
      style={FLOW_VARS}
      aria-label="ID and document skill tree"
    >
      <Background
        variant={BackgroundVariant.Dots}
        gap={26}
        size={1.4}
        color="color-mix(in srgb, var(--color-navy) 14%, transparent)"
      />
      <Controls showInteractive={false} position="bottom-right" />
    </ReactFlow>
  );
}
