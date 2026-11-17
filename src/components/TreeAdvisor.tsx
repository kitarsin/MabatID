"use client";

import { ArrowRight, LoaderCircle, X } from "lucide-react";
import { CARD_BY_ID } from "@/data/cards";
import type { TreePlanningResult } from "@/lib/planner/recommendations";
import type { PlanningView } from "@/lib/use-tree-planning";
import { TREE_STATUS_LABELS } from "@/lib/tree-status";

export function TreeAdvisor({
  data,
  view,
  selectedId,
  onChooseGoal,
  onOpenGuide,
  onClear,
  onEdit,
}: {
  data?: TreePlanningResult;
  view: PlanningView;
  selectedId: string | null;
  onChooseGoal: (id: string) => void;
  onOpenGuide: (id: string) => void;
  onClear: () => void;
  onEdit: () => void;
}) {
  const selected = selectedId ? CARD_BY_ID[selectedId] : undefined;
  return (
    <section
      aria-label="Skill tree guidance"
      className={`relative shrink-0 border-b border-border bg-card px-3 py-3 sm:px-5 ${selected ? "pr-10" : ""}`}
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="text-sm font-extrabold">
          {selected ? `Your path to ${selected.short}` : "Suggested next IDs"}
        </h1>
        <div className="flex flex-wrap items-center gap-2 text-xs">
          <label className="flex items-center gap-1">
            Prioritize
            <select
              aria-label="Path preference"
              value={view.objective}
              onChange={(e) =>
                view.onObjectiveChange(
                  e.target.value as PlanningView["objective"],
                )
              }
              className="max-w-40 rounded-lg border border-border bg-card p-1.5 font-semibold"
            >
              <option value="fewest-documents">Fewer acquisitions</option>
              <option value="lowest-fees">Lower estimated fees</option>
            </select>
          </label>
          <button
            type="button"
            onClick={onEdit}
            className="rounded-lg px-2 py-1.5 font-bold text-civic underline"
          >
            Edit starting point
          </button>
          {selected && (
            <button
              type="button"
              onClick={onClear}
              aria-label="Clear selected goal"
              className="absolute right-2 top-2 rounded-lg p-1.5"
            >
              <X className="size-4" />
            </button>
          )}
        </div>
      </div>
      {view.loading ? (
        <p
          role="status"
          className="mt-2 flex items-center gap-2 text-xs text-muted-foreground"
        >
          <LoaderCircle className="size-3.5 animate-spin" />
          Updating your paths…
        </p>
      ) : view.error ? (
        <p role="alert" className="mt-2 text-xs">
          {view.error}{" "}
          <button
            type="button"
            onClick={view.onRetry}
            className="font-bold text-civic underline"
          >
            Try again
          </button>
        </p>
      ) : selected ? (
        <div className="mt-2 space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            {view.result?.plans.map((plan, index) => (
              <button
                type="button"
                key={plan.id}
                aria-pressed={view.plan?.id === plan.id}
                onClick={() => view.onSelectPlan(plan.id)}
                className={`rounded-full border px-2.5 py-1 text-xs font-bold ${view.plan?.id === plan.id ? "border-civic bg-mist text-civic" : "border-border"}`}
              >
                Route {index + 1} · {plan.steps.length} acquisition
                {plan.steps.length === 1 ? "" : "s"}
              </button>
            ))}
            <button
              type="button"
              onClick={() => onOpenGuide(selected.id)}
              className="inline-flex items-center gap-1 rounded-full bg-civic px-3 py-1.5 text-xs font-bold text-white"
            >
              Open guide <ArrowRight className="size-3.5" />
            </button>
          </div>
          <p className="text-xs text-muted-foreground">
            {view.plan
              ? `${view.plan.steps.length} acquisition${view.plan.steps.length === 1 ? "" : "s"} in this route.`
              : data?.nodes[selected.id]?.reason}{" "}
            {view.plan
              ? "Highlighted inputs belong to the selected route. Other paperwork may still be required."
              : "You can still inspect any goal."}
            {view.plan?.questions.length
              ? " Confirm unanswered conditions before relying on this path."
              : ""}
          </p>
        </div>
      ) : (
        <>
          <div
            className="mt-2 flex gap-2 overflow-x-auto pb-1"
            aria-label="Recommended IDs"
          >
            {data?.recommendations.map((item, index) => (
              <button
                type="button"
                key={item.id}
                onClick={() => onChooseGoal(item.id)}
                className="w-56 shrink-0 rounded-xl border border-border bg-background px-3 py-2 text-left hover:border-civic"
              >
                <span className="block text-xs font-extrabold text-civic">
                  {index + 1}. {CARD_BY_ID[item.id].short}
                </span>
                <span className="mt-0.5 block text-[11px] font-semibold">
                  {TREE_STATUS_LABELS[item.status]}
                </span>
                <span className="mt-1 line-clamp-2 text-[11px] text-muted-foreground">
                  {item.reason}
                </span>
              </button>
            ))}
            {data && !data.recommendations.length && (
              <p className="text-xs text-muted-foreground">
                No suggested ID path was found with your current answers. Edit
                your starting point or inspect any node.
              </p>
            )}
          </div>
          <p className="mt-1 text-[10px] text-muted-foreground">
            Suggestions compare explored paths using your documents, eligibility
            and fee estimates. They do not guarantee speed or agency acceptance.
          </p>
        </>
      )}
      {(selected
        ? view.result && !view.result.search.complete
        : data?.recommendations.some((item) => item.limited)) && (
        <p className="mt-1 text-[10px] text-muted-foreground">
          Limited search: other routes may exist.
        </p>
      )}
    </section>
  );
}
