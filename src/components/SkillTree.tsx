"use client";

import { useEffect, useMemo, useRef } from "react";
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
import { Check, ClipboardList, HelpCircle, Star } from "lucide-react";
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
import { CardIcon } from "./icons";

const HANDLE =
  "!size-1 !min-h-0 !min-w-0 !border-0 !bg-transparent !opacity-0 !pointer-events-none";
type IdNodeData = {
  card: TreeCard;
  status: TreeNodeStatus;
  selected: boolean;
  dim: boolean;
  recommended: boolean;
  path: boolean;
  onSelect: (id: string) => void;
  onEdit: () => void;
};

function IdNode({ data }: NodeProps<Node<IdNodeData, "id">>) {
  const { card, status, selected, dim, recommended, path, onSelect, onEdit } =
    data;
  const circle =
    status === "owned"
      ? "bg-amber text-navy border-amber shadow-[0_2px_10px_rgba(255,165,0,0.45)]"
      : status === "available"
        ? "bg-white text-civic border-civic node-available"
        : status === "confirmation"
          ? "bg-white text-navy border-amber"
          : "bg-white text-slate-500 border-dashed border-slate-400";
  return (
    <div
      style={{ width: NODE_W }}
      className={`flex flex-col items-center transition-opacity ${dim ? "opacity-25" : ""}`}
    >
      <button
        type="button"
        onClick={() => (card.inventoryOnly ? onEdit() : onSelect(card.id))}
        aria-label={`${card.name}. ${TREE_STATUS_LABELS[status]}.${recommended ? " Recommended next." : ""}${path ? " In selected route." : ""} ${card.inventoryOnly ? "Edit inventory." : "Open guide."}`}
        className="group flex w-full flex-col items-center gap-1.5 rounded-2xl p-1 outline-offset-2 focus-visible:outline-civic"
      >
        <span
          className={`relative grid size-[72px] place-items-center rounded-full border-[3px] transition-transform group-hover:scale-105 group-active:scale-95 ${circle} ${selected ? "ring-4 ring-navy ring-offset-2 ring-offset-background" : path ? "ring-2 ring-civic ring-offset-2 ring-offset-background" : recommended ? "ring-2 ring-amber ring-offset-2 ring-offset-background" : ""}`}
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
          <CardIcon name={card.icon} className="size-8" />
          <span
            className={`absolute -right-1 -top-1 grid size-6 place-items-center rounded-full text-white shadow ${status === "owned" ? "bg-navy" : status === "confirmation" ? "bg-civic" : "bg-slate-500"}`}
          >
            {status === "owned" ? (
              <Check className="size-4" aria-hidden="true" />
            ) : status === "confirmation" ? (
              <HelpCircle className="size-4" aria-hidden="true" />
            ) : (
              <ClipboardList className="size-3.5" aria-hidden="true" />
            )}
          </span>
        </span>
        <span className="max-w-[132px] rounded-md bg-background px-1.5 py-0.5 text-center text-[13px] font-bold leading-tight text-navy">
          {card.short}
        </span>
        <span className="rounded-md bg-background px-1 text-[10px] font-semibold text-slate-600">
          {TREE_STATUS_LABELS[status]}
        </span>
        {recommended && (
          <span className="inline-flex items-center gap-1 rounded-full bg-amber px-2 py-1 text-[10px] font-extrabold text-navy">
            <Star className="size-3" aria-hidden="true" />
            Suggested next
          </span>
        )}
        {selected && (
          <span className="rounded-full bg-navy px-2 py-1 text-[10px] font-bold text-white">
            Selected goal
          </span>
        )}
        {card.inventoryOnly && (
          <span className="text-[10px] font-semibold">Inventory evidence</span>
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
  liftControls = false,
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
  liftControls?: boolean;
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
          ? "#b77900"
          : "#005A9C"
        : "#94A3B8";
      return {
        id: edge.id,
        source: edge.source,
        target: edge.target,
        ...handles,
        type: "default",
        label,
        labelStyle: { fontSize: 10, fill: "#1b365d" },
        labelBgStyle: { fill: "#f5faff" },
        labelBgPadding: [5, 3],
        markerEnd: { type: MarkerType.ArrowClosed, color },
        style: {
          stroke: color,
          strokeWidth: inPath ? 3 : 1.5,
          strokeOpacity: inPath ? 1 : 0.55,
          strokeDasharray:
            !inPath || edge.kind === "optional" ? "5 5" : undefined,
        },
      };
    });
  }, [layout, selectedId, plan, owned]);
  const rf = useReactFlow();
  const initialized = useNodesInitialized();
  const lastFocus = useRef("");
  const focusKey = `${selectedId ?? "overview"}:${selectedId ? layout.pathEdges.map((e) => e.id).join() : (recommendedIds[0] ?? "starter")}`;
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
        const target = layout.placed.find(
          (p) => p.card.id === (recommendedIds[0] ?? "barangay-id"),
        )!;
        void rf.setCenter(target.x + NODE_W / 2, target.y + 80, {
          zoom: 0.85,
          duration: 250,
        });
      }
    });
    return () => cancelAnimationFrame(timer);
  }, [initialized, focusKey, rf, selectedId, pathIds, layout, recommendedIds]);
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
      aria-label="ID and document skill tree"
    >
      <Background
        variant={BackgroundVariant.Dots}
        gap={26}
        size={1.4}
        color="rgba(27,54,93,0.14)"
      />
      <Controls
        showInteractive={false}
        position="bottom-right"
        style={liftControls ? { marginBottom: 52 } : undefined}
      />
    </ReactFlow>
  );
}
