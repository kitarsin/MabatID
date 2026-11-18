"use client";

import { ArrowUpRight, LoaderCircle } from "lucide-react";
import { Chip } from "@/components/ui/chip";
import { Disclosure } from "@/components/ui/disclosure";
import { Pill } from "@/components/ui/pill";
import { CARD_BY_ID } from "@/data/cards";
import type { TreePlanningResult } from "@/lib/planner/recommendations";
import type { PlanObjective } from "@/lib/planner/types";
import { TREE_STATUS_LABELS } from "@/lib/tree-status";
import { CardIcon } from "./icons";

/**
 * The suggestion engine's home (Progress tab). Kept off the skill tree so picking an ID never shifts the canvas.
 * Tapping a suggestion opens that ID on the tree with its route lit.
 */
export function SuggestedNext({
  data,
  loading,
  error,
  onRetry,
  objective,
  onObjectiveChange,
  onEdit,
  onPick,
}: {
  data?: TreePlanningResult;
  loading: boolean;
  error?: string | null;
  onRetry: () => void;
  objective: PlanObjective;
  onObjectiveChange: (o: PlanObjective) => void;
  onEdit: () => void;
  onPick: (id: string) => void;
}) {
  const items = data?.recommendations ?? [];
  return (
    <section aria-labelledby="suggested-next">
      <div className="flex items-center gap-2">
        <h2
          id="suggested-next"
          className="flex-1 text-lg font-semibold tracking-tight text-navy"
        >
          Suggested next
        </h2>
        {loading && (
          <LoaderCircle
            className="size-4 animate-spin text-muted-foreground"
            aria-label="Updating suggestions"
          />
        )}
      </div>
      <p className="mt-1.5 text-[15px] leading-relaxed text-muted-foreground">
        IDs that are easiest to get with what you have now.
      </p>

      <div role="group" aria-label="Sort by" className="mt-5 flex flex-wrap gap-2">
        {(
          [
            { id: "fewest-documents", label: "Fewest steps" },
            { id: "lowest-fees", label: "Lowest fees" },
          ] as const
        ).map((o) => (
          <Chip
            key={o.id}
            pressed={objective === o.id}
            onClick={() => onObjectiveChange(o.id)}
          >
            {o.label}
          </Chip>
        ))}
      </div>

      {error ? (
        <p role="alert" className="mt-5 text-sm">
          {error}{" "}
          <button
            type="button"
            onClick={onRetry}
            className="min-h-11 font-semibold text-civic underline"
          >
            Try again
          </button>
        </p>
      ) : data && !items.length ? (
        <p className="mt-5 rounded-2xl bg-muted p-4 text-sm">
          No suggestions with your current answers. Try updating what you have.
        </p>
      ) : (
        <ol className="mt-5 space-y-3">
          {items.map((item, index) => {
            const card = CARD_BY_ID[item.id];
            return (
              <li key={item.id}>
                <button
                  type="button"
                  onClick={() => onPick(item.id)}
                  data-card-id={item.id}
                  className="group flex w-full items-start gap-4 rounded-[20px] bg-card p-4 text-left ring-1 ring-navy/[0.08] transition-[background-color,scale] duration-[var(--dur-fast)] ease-[var(--ease-out)] hover:bg-navy/[0.02] active:scale-[0.985]"
                >
                  <span className="relative grid size-11 shrink-0 place-items-center rounded-full bg-mist/60 text-civic">
                    <CardIcon name={card.icon} className="size-5" />
                    <span className="absolute -top-1 -left-1 grid size-5 place-items-center rounded-full bg-navy text-[11px] font-semibold text-white tabular-nums">
                      {index + 1}
                    </span>
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="flex items-start justify-between gap-2">
                      <span className="text-[15px] font-semibold text-navy">
                        {card.name}
                      </span>
                      <ArrowUpRight
                        className="mt-0.5 size-4 shrink-0 text-muted-foreground transition-transform duration-[var(--dur-base)] group-hover:rotate-45"
                        aria-hidden="true"
                      />
                    </span>
                    <Pill tone="mist" className="mt-2">
                      {TREE_STATUS_LABELS[item.status]}
                    </Pill>
                    <span className="mt-2 line-clamp-2 block text-sm leading-relaxed text-muted-foreground">
                      {item.reason}
                    </span>
                  </span>
                </button>
              </li>
            );
          })}
        </ol>
      )}

      <div className="mt-4 flex flex-wrap items-center justify-between gap-2">
        <button
          type="button"
          onClick={onEdit}
          className="min-h-10 rounded-full px-1 text-sm font-semibold text-civic underline-offset-4 hover:underline"
        >
          Update what I have
        </button>
        <Disclosure variant="inline" summary="How we pick these">
          <p className="max-w-sm text-xs leading-relaxed text-muted-foreground">
            We compare routes using your documents, answers and fee estimates.
            {items.some((i) => i.limited)
              ? " We checked the most likely routes; others may exist."
              : ""}{" "}
            This doesn’t guarantee speed or that an office will accept it.
          </p>
        </Disclosure>
      </div>
    </section>
  );
}
