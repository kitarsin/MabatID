"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
} from "react";
import {
  Background,
  BackgroundVariant,
  getStraightPath,
  Handle,
  Panel,
  Position,
  ReactFlow,
  useNodesInitialized,
  useReactFlow,
  type Edge,
  type EdgeProps,
  type Node,
  type NodeProps,
} from "@xyflow/react";
import { Hand, LocateFixed, Scan, Spline, Star } from "lucide-react";
import { GROUP_META, type CredentialGroup } from "@/data/cards";
import { Pill } from "@/components/ui/pill";
import {
  buildEdges,
  layoutTree,
  NODE_W,
  planEdges,
  statusOf,
  type ReadinessContext,
  type TreeCard,
  type TreeEdge,
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

const ALL_EDGES = buildEdges();

/**
 * A lit line: dark amber outline + bright amber core + soft breathing halo. It draws itself in (from the end
 * nearest the selected ID, delayed by distance from it) and a spark travels toward the ID it leads to.
 */
/** `route`: the chosen way to get the selected ID. `next`: an ID the selection helps you get (quieter). */
type GlowData = {
  delay: number;
  reverse: boolean;
  optional: boolean;
  role: "route" | "next";
};
function GlowEdge({
  sourceX,
  sourceY,
  targetX,
  targetY,
  data,
}: EdgeProps<Edge<GlowData, "glow">>) {
  const [d] = getStraightPath({ sourceX, sourceY, targetX, targetY });
  const vars = {
    "--edge-delay": `${data?.delay ?? 0}ms`,
    "--draw-from": data?.reverse ? -1 : 1,
  } as CSSProperties;
  const optional = !!data?.optional;
  const next = data?.role === "next";
  return (
    <g className="glow-edge" style={vars}>
      <path
        d={d}
        pathLength={1}
        fill="none"
        className={`glow-draw glow-halo ${next ? "" : "glow-halo-pulse"}`}
        stroke="var(--color-amber)"
        strokeWidth={next ? 8 : 14}
        strokeLinecap="round"
        opacity={next ? 0.22 : optional ? 0.25 : 0.5}
      />
      <path
        d={d}
        pathLength={1}
        fill="none"
        className="glow-draw"
        stroke="color-mix(in srgb, var(--color-amber) 62%, var(--color-navy))"
        strokeWidth={next ? 3.5 : 5.5}
        strokeLinecap="round"
        opacity={next ? 0.45 : optional ? 0.55 : 1}
      />
      <path
        d={d}
        pathLength={1}
        fill="none"
        className="glow-draw"
        stroke={optional || next ? "#ffd27a" : "#ffc433"}
        strokeWidth={next ? 1.5 : 2.5}
        strokeLinecap="round"
        opacity={next ? 0.8 : 1}
      />
      {!next && (
        <circle
          r={4}
          className="glow-spark"
          fill="#fff6d8"
          stroke="var(--color-amber)"
          strokeWidth={2}
        >
          <animateMotion dur="1.9s" repeatCount="indefinite" path={d} />
        </circle>
      )}
    </g>
  );
}
/**
 * "All lines" colour code, by the credential group of the ID a line leads into. Colour is paired with a dash
 * pattern so groups stay distinguishable without colour. Amber is reserved for the selected route's glow.
 */
const GROUP_LINE: Record<CredentialGroup | "other", { color: string; dash?: string }> = {
  foundation: { color: "var(--color-navy)" },
  supporting: { color: "var(--color-civic)", dash: "10 5" },
  identity: { color: "#2b9fcf" },
  specialized: { color: "var(--locked-line)", dash: "2 5" },
  other: { color: "var(--locked-line)", dash: "2 5" },
};

type GroupData = { group: CredentialGroup | "other"; faded: boolean; delay: number };
function GroupEdge({
  sourceX,
  sourceY,
  targetX,
  targetY,
  data,
}: EdgeProps<Edge<GroupData, "group">>) {
  const [d] = getStraightPath({ sourceX, sourceY, targetX, targetY });
  const line = GROUP_LINE[data?.group ?? "other"];
  return (
    <path
      d={d}
      fill="none"
      className="group-edge"
      style={{ "--edge-delay": `${data?.delay ?? 0}ms` } as CSSProperties}
      stroke={line.color}
      strokeWidth={2}
      strokeDasharray={line.dash}
      strokeLinecap="round"
      opacity={data?.faded ? 0.14 : 0.7}
    />
  );
}
const edgeTypes = { glow: GlowEdge, group: GroupEdge };

/** Which handles a straight line uses: side to side for neighbours on one row, else bottom to top. */
function handlesFor(source: { x: number; y: number }, target: { x: number; y: number }) {
  const sideways = Math.abs(source.y - target.y) < 30;
  return sideways
    ? source.x < target.x
      ? { sourceHandle: "right-source", targetHandle: "left-target" }
      : { sourceHandle: "left-source", targetHandle: "right-target" }
    : source.y > target.y
      ? { sourceHandle: "top-source", targetHandle: "bottom-target" }
      : { sourceHandle: "bottom-source", targetHandle: "top-target" };
}

const EASE = (t: number) => 1 - Math.pow(1 - t, 4);

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
    ? "node-focus"
    : path
      ? "node-lit"
      : recommended
        ? "ring-2 ring-amber ring-offset-2 ring-offset-background"
        : "";

  return (
    <div
      style={{ width: NODE_W }}
      className={`flex flex-col items-center transition-[opacity,filter] duration-[420ms] ease-[var(--ease-out)] ${dim ? "opacity-25 saturate-50" : ""}`}
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
        <span className="max-w-[132px] rounded-full bg-white/85 px-2.5 py-1 text-center text-[13px] font-semibold leading-tight text-navy shadow-[0_2px_8px_-4px_color-mix(in_srgb,var(--color-navy)_30%,transparent)] ring-1 ring-navy/5 backdrop-blur-sm">
          {card.short}
        </span>
        <span className="px-1 text-xs font-medium text-muted-foreground">
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
  sheetOpen = false,
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
  /** The detail panel is open (on wide screens it covers the right side of the canvas). */
  sheetOpen?: boolean;
}) {
  // One fixed layout: choosing an ID never moves the other icons. The route is drawn on top of it.
  const layout = useMemo(() => layoutTree(), []);
  const pathEdges = useMemo(() => planEdges(plan), [plan]);
  // Lines exist only for the selected ID: the chosen route into it (or, before a route is ready, everything
  // it needs) plus every ID it leads to. Distance from the selection staggers the draw-in.
  const lit = useMemo(() => {
    if (!selectedId)
      return {
        edges: [] as (TreeEdge & {
          role: "route" | "next";
          delay: number;
          reverse: boolean;
        })[],
        ids: new Set<string>(),
      };
    const placed = new Set(layout.placed.map((p) => p.card.id));
    const chosen = new Map<string, TreeEdge & { role: "route" | "next" }>();
    const add = (role: "route" | "next") => (e: TreeEdge) => {
      const key = `${e.source}>${e.target}`;
      if (!chosen.has(key) && placed.has(e.source) && placed.has(e.target))
        chosen.set(key, { ...e, role });
    };
    if (plan) pathEdges.forEach(add("route"));
    else ALL_EDGES.filter((e) => e.target === selectedId).forEach(add("route"));
    ALL_EDGES.filter((e) => e.source === selectedId).forEach(add("next"));
    const list = [...chosen.values()];
    const depth = new Map<string, number>([[selectedId, 0]]);
    for (let queue = [selectedId]; queue.length; ) {
      const next: string[] = [];
      for (const id of queue)
        for (const e of list) {
          const other =
            e.source === id ? e.target : e.target === id ? e.source : null;
          if (other && !depth.has(other)) {
            depth.set(other, depth.get(id)! + 1);
            next.push(other);
          }
        }
      queue = next;
    }
    const far = (id: string) => depth.get(id) ?? 4;
    return {
      edges: list.map((e) => ({
        ...e,
        delay: 120 + Math.min(far(e.source), far(e.target)) * 160,
        reverse: far(e.target) < far(e.source),
      })),
      ids: new Set([selectedId, ...list.flatMap((e) => [e.source, e.target])]),
    };
  }, [selectedId, plan, layout, pathEdges]);
  const pathIds = lit.ids;
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
            // The filter always applies (also while a route is lit); only the selected ID itself stays bright.
            dim:
              (!!selectedId &&
                selectedId !== p.card.id &&
                !pathIds.has(p.card.id)) ||
              (!!matchIds &&
                !matchIds.has(p.card.id) &&
                selectedId !== p.card.id),
            recommended: false,
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
      matchIds,
      pulseId,
      startHereId,
      onSelect,
      onEdit,
    ],
  );
  const [showAll, setShowAll] = useState(false);
  const edges = useMemo<Edge[]>(() => {
    const positions = new Map(layout.placed.map((p) => [p.card.id, p]));
    const litKeys = new Set(lit.edges.map((e) => `${e.source}>${e.target}`));
    const all: Edge[] = showAll
      ? layout.edges
          .filter(
            (e) =>
              positions.has(e.source) &&
              positions.has(e.target) &&
              !litKeys.has(`${e.source}>${e.target}`),
          )
          .map((edge, index) => {
            const target = positions.get(edge.target)!;
            return {
              id: `all:${edge.id}`,
              source: edge.source,
              target: edge.target,
              ...handlesFor(positions.get(edge.source)!, target),
              type: "group",
              selectable: false,
              focusable: false,
              data: {
                group: target.card.inventoryOnly ? "other" : target.card.group,
                faded: !!selectedId,
                delay: Math.min(index * 18, 360),
              },
            };
          })
      : [];
    const visible = (id: string) =>
      !matchIds || matchIds.has(id) || id === selectedId;
    const glow: Edge[] = lit.edges
      .filter((edge) => visible(edge.source) && visible(edge.target))
      .map((edge) => ({
      // keyed by selection so choosing another ID replays the draw-in
      id: `${selectedId}:${edge.id}`,
      source: edge.source,
      target: edge.target,
      ...handlesFor(positions.get(edge.source)!, positions.get(edge.target)!),
      type: "glow",
      selectable: false,
      focusable: false,
      data: {
        delay: edge.delay,
        reverse: edge.reverse,
        optional: edge.kind === "optional",
        role: edge.role,
      },
    }));
    return [
      ...all.filter((e) => visible(e.source) && visible(e.target)),
      ...glow,
    ];
  }, [layout, lit, selectedId, showAll, matchIds]);
  const rf = useReactFlow();
  const initialized = useNodesInitialized();
  const lastFocus = useRef("");
  const overviewTarget = priorityId ?? recommendedIds[0] ?? "starter";
  const focusKey = `${selectedId ?? "overview"}:${selectedId ? pathEdges.map((e) => e.id).join() : overviewTarget}`;
  /** Frame the selection's route, or (overview) centre on where the next step is. */
  const focus = useCallback(() => {
    if (selectedId)
      void rf.fitView({
        nodes: [...new Set([selectedId, ...pathIds])].map((id) => ({ id })),
        padding: {
          top: "64px",
          bottom: "72px",
          left: "10%",
          right:
            sheetOpen && window.matchMedia("(min-width: 768px)").matches
              ? "500px"
              : "10%",
        },
        maxZoom: 0.9,
        minZoom: 0.2,
        duration: 650,
        ease: EASE,
      });
    else {
      // Priority ID, else the first suggestion, else the default starter.
      const target =
        layout.placed.find((p) => p.card.id === priorityId) ??
        layout.placed.find((p) => p.card.id === recommendedIds[0]) ??
        layout.placed.find((p) => p.card.id === "barangay-id")!;
      void rf.setCenter(target.x + NODE_W / 2, target.y + 80, {
        zoom: 0.85,
        duration: 650,
        ease: EASE,
      });
    }
  }, [rf, selectedId, pathIds, sheetOpen, layout, priorityId, recommendedIds]);
  const fitAll = useCallback(
    () =>
      void rf.fitView({
        padding: { top: "32px", bottom: "72px", left: "24px", right: "72px" },
        minZoom: 0.18,
        duration: 650,
        ease: EASE,
      }),
    [rf],
  );
  useEffect(() => {
    if (!initialized || lastFocus.current === focusKey) return;
    const timer = requestAnimationFrame(() => {
      lastFocus.current = focusKey;
      focus();
    });
    return () => cancelAnimationFrame(timer);
  }, [initialized, focusKey, focus]);
  // The gesture hint shows until the user moves the camera themselves.
  const [moved, setMoved] = useState(false);
  return (
    <ReactFlow
      nodes={nodes}
      edges={edges}
      nodeTypes={nodeTypes}
      edgeTypes={edgeTypes}
      minZoom={0.18}
      maxZoom={1.5}
      onPaneClick={onClear}
      nodesDraggable={false}
      nodesConnectable={false}
      elementsSelectable
      zoomOnDoubleClick={false}
      zoomOnPinch
      panOnDrag
      onMoveStart={(event) => {
        if (event && !moved) setMoved(true);
      }}
      aria-label="ID and document skill tree"
    >
      <Background
        variant={BackgroundVariant.Dots}
        gap={26}
        size={1.4}
        color="color-mix(in srgb, var(--color-navy) 14%, transparent)"
      />
      <Panel position="bottom-right" className="!m-3">
        <div
          role="toolbar"
          aria-label="Camera"
          aria-orientation="vertical"
          className="flex flex-col items-center gap-1 rounded-[22px] bg-white/85 p-1.5 shadow-[0_1px_2px_rgb(27_54_93/0.08),0_12px_28px_-14px_rgb(27_54_93/0.45)] ring-1 ring-navy/8 backdrop-blur-md"
        >
          <span aria-hidden="true" className="mb-0.5 h-1 w-5 rounded-full bg-navy/15" />
          <CameraButton label={selectedId ? "Recenter on selected ID" : "Recenter on your next step"} onClick={focus}>
            <LocateFixed className="size-5" />
          </CameraButton>
          <CameraButton label="Fit whole tree to screen" onClick={fitAll}>
            <Scan className="size-5" />
          </CameraButton>
          <span aria-hidden="true" className="my-0.5 h-px w-6 bg-navy/10" />
          <CameraButton
            label="Show all lines"
            pressed={showAll}
            onClick={() => setShowAll((v) => !v)}
          >
            <Spline className="size-5" />
          </CameraButton>
        </div>
      </Panel>
      <Panel position="bottom-left" className="!m-3">
        <ul
          aria-label="Line colours by credential group"
          className={`flex max-w-[calc(100vw-7rem)] flex-wrap gap-x-3 gap-y-1 rounded-2xl bg-white/85 px-3 py-2 text-[11px] font-medium text-navy shadow-[0_1px_2px_rgb(27_54_93/0.08)] ring-1 ring-navy/8 backdrop-blur-md transition-[opacity,translate] duration-[var(--dur-base)] ease-[var(--ease-out)] ${
            showAll ? "translate-y-0 opacity-100" : "pointer-events-none invisible translate-y-1 opacity-0"
          }`}
        >
          {(Object.keys(GROUP_META) as CredentialGroup[]).map((g) => (
            <li key={g} className="flex items-center gap-1.5 whitespace-nowrap">
              <svg aria-hidden="true" width="22" height="6" className="shrink-0">
                <line
                  x1="2"
                  y1="3"
                  x2="20"
                  y2="3"
                  stroke={GROUP_LINE[g].color}
                  strokeWidth="2.5"
                  strokeDasharray={GROUP_LINE[g].dash}
                  strokeLinecap="round"
                />
              </svg>
              {GROUP_META[g].label.replace(/ credentials| documents/i, "")}
            </li>
          ))}
        </ul>
      </Panel>
      <Panel position="bottom-center" className="!mb-3">
        <p
          aria-hidden={moved}
          className={`flex items-center gap-1.5 whitespace-nowrap rounded-full bg-navy/85 px-3 py-1.5 text-xs font-medium text-white shadow-lg backdrop-blur transition-[opacity,translate] duration-500 ease-[var(--ease-out)] ${
            moved || showAll ? "pointer-events-none translate-y-2 opacity-0" : "opacity-100"
          }`}
        >
          <Hand className="size-3.5" aria-hidden="true" />
          Drag to move · pinch to zoom
        </p>
      </Panel>
    </ReactFlow>
  );
}

function CameraButton({
  label,
  pressed,
  onClick,
  children,
}: {
  label: string;
  pressed?: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      aria-pressed={pressed}
      onClick={onClick}
      className={`grid size-11 place-items-center rounded-2xl transition-[background-color,color,scale] duration-[var(--dur-fast)] ease-[var(--ease-out)] active:scale-[0.92] active:duration-[var(--dur-press)] [&_svg]:pointer-events-none ${
        pressed
          ? "bg-navy text-white shadow-[0_6px_14px_-8px_rgb(27_54_93/0.8)]"
          : "text-navy hover:bg-navy/[0.06]"
      }`}
    >
      {children}
    </button>
  );
}
