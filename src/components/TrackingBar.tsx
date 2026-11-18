"use client";

import { ChevronRight, Star } from "lucide-react";
import { CARD_BY_ID } from "@/data/cards";
import { trackProgress } from "@/lib/prepare";
import type { User } from "@/lib/store";

/** Slim strip along the bottom of the tree: progress toward the ONE priority ID. */
export function TrackingBar({
  me,
  onOpen,
}: {
  me: User;
  onOpen: (id: string) => void;
}) {
  const id = me.priority;
  if (!id || !CARD_BY_ID[id]) return null;
  const card = CARD_BY_ID[id];
  const p = trackProgress(id, new Set(me.owned), me.prep?.[id] ?? [], {
    age: me.age,
    facts: me.facts,
    documents: me.documents,
    setup: me.setup,
    mode: me.modes?.[id],
  });

  return (
    <button
      type="button"
      onClick={() => onOpen(id)}
      aria-label={`Priority: ${card.name}, ${p.pct} percent done. ${p.stage}. Open details.`}
      className="absolute inset-x-0 bottom-0 z-20 bg-navy pb-[env(safe-area-inset-bottom)] text-left text-white shadow-[0_-2px_10px_rgba(27,54,93,0.25)]"
    >
      <span
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={p.pct}
        aria-label="Progress toward the priority ID"
        className="block h-1 bg-white/20"
      >
        <span
          className="block h-full bg-amber transition-all"
          style={{ width: `${p.pct}%` }}
        />
      </span>
      <span className="flex items-center gap-2 px-4 py-2.5">
        <Star
          className="size-4 shrink-0 text-amber"
          fill="currentColor"
          aria-hidden="true"
        />
        <span className="min-w-0 flex-1 truncate text-sm font-bold">
          {card.name}
        </span>
        <span className="shrink-0 text-xs font-semibold text-mist">
          {p.done}/{p.total}
        </span>
        <span className="shrink-0 text-sm font-extrabold">{p.pct}%</span>
        <ChevronRight
          className="size-4 shrink-0 text-mist"
          aria-hidden="true"
        />
      </span>
    </button>
  );
}
