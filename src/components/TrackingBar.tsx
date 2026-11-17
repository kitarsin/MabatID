"use client";

import { ChevronRight, Star } from "lucide-react";
import { CARD_BY_ID } from "@/data/cards";
import { trackProgress } from "@/lib/prepare";
import type { User } from "@/lib/store";

/** Slim strip along the bottom of the tree: progress toward the ONE priority ID. */
export function TrackingBar({ me, onOpen }: { me: User; onOpen: (id: string) => void }) {
  const id = me.priority;
  if (!id || !CARD_BY_ID[id]) return null;
  const card = CARD_BY_ID[id];
  const p = trackProgress(id, new Set(me.owned), me.budget, me.setup, me.prep?.[id] ?? []);

  return (
    <button
      type="button"
      onClick={() => onOpen(id)}
      aria-label={`Priority: ${card.name}, ${p.pct} percent done. ${p.stage}. Open details.`}
      className="surface-navy relative z-10 w-full shrink-0 bg-navy text-left text-white shadow-[0_-2px_10px_color-mix(in_srgb,var(--color-navy)_25%,transparent)]"
    >
      {/* The button's label already announces the percentage; the bar is decoration. */}
      <span aria-hidden="true" className="block h-1 bg-white/20">
        <span
          className="block h-full origin-left bg-amber transition-transform duration-300 ease-[var(--ease-out)]"
          style={{ transform: `scaleX(${p.pct / 100})` }}
        />
      </span>
      <span className="flex min-h-11 items-center gap-2 px-4 py-2.5">
        <Star className="size-4 shrink-0 text-amber" fill="currentColor" aria-hidden="true" />
        <span className="min-w-0 flex-1 truncate text-sm font-bold">{card.name}</span>
        <span className="shrink-0 text-xs font-semibold tabular-nums text-mist">{p.done}/{p.total}</span>
        <span className="shrink-0 text-sm font-bold tabular-nums">{p.pct}%</span>
        <ChevronRight className="size-4 shrink-0 text-mist" aria-hidden="true" />
      </span>
    </button>
  );
}
