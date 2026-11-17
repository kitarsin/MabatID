"use client";

import { useEffect, useId, useState } from "react";
import { ListFilter, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Chip } from "@/components/ui/chip";
import { CARDS, CATEGORY_META, type Category, type Tier } from "@/data/cards";
import { BUDGETS, fitsBudget, type Budget } from "@/lib/prefs";

export interface Filters {
  tiers: Tier[]; // empty = every tier
  category: Category | null;
  budget: Budget | null; // null = any budget
}

export const NO_FILTERS: Filters = { tiers: [], category: null, budget: null };

/** IDs that pass every active filter, or null when nothing is filtered. */
export function matchSet(f: Filters): Set<string> | null {
  if (!f.tiers.length && !f.category && !f.budget) return null;
  return new Set(
    CARDS.filter(
      (c) =>
        (!f.tiers.length || f.tiers.includes(c.tier)) &&
        (f.category === null || c.category === f.category) &&
        (f.budget === null || fitsBudget(c.id, f.budget)),
    ).map((c) => c.id),
  );
}

const active = (f: Filters) => Number(f.tiers.length > 0) + Number(f.category !== null) + Number(f.budget !== null);

/**
 * Filter button + its panel. Rendered inside the tree toolbar: the button sits in the bar and the panel
 * drops down from the bar's bottom edge (the toolbar is the positioned ancestor).
 * The panel stays mounted so it can animate; Esc and outside click close it.
 */
export function FilterBar({ filters, onChange }: { filters: Filters; onChange: (f: Filters) => void }) {
  const [open, setOpen] = useState(false);
  const uid = useId();
  const triggerId = `${uid}-trigger`;
  const panelId = `${uid}-panel`;
  const n = active(filters);
  const shown = matchSet(filters)?.size ?? CARDS.length;

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      setOpen(false);
      document.getElementById(triggerId)?.focus();
    };
    const onDown = (e: PointerEvent) => {
      const t = e.target as Node;
      if (document.getElementById(panelId)?.contains(t) || document.getElementById(triggerId)?.contains(t)) return;
      setOpen(false);
    };
    document.addEventListener("keydown", onKey);
    document.addEventListener("pointerdown", onDown);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("pointerdown", onDown);
    };
  }, [open, triggerId, panelId]);

  return (
    <>
      <Button
        id={triggerId}
        type="button"
        variant="brand"
        size="md"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        aria-controls={panelId}
        className="shrink-0 rounded-full px-3"
      >
        <ListFilter className="size-4" aria-hidden="true" />
        Filter
        {n > 0 && (
          <span className="grid size-5 place-items-center rounded-full bg-amber text-xs font-bold tabular-nums text-navy">{n}</span>
        )}
      </Button>

      <div
        id={panelId}
        className={`absolute right-3 top-full z-30 mt-1 max-h-[min(70dvh,34rem)] w-[min(20rem,calc(100%-1.5rem))] origin-top-right space-y-4 overflow-y-auto overscroll-contain rounded-2xl bg-white p-4 shadow-xl ring-1 ring-border transition-[opacity,scale,visibility] ease-[var(--ease-out)] ${
          open
            ? "visible scale-100 opacity-100 duration-[var(--dur-pop-in)]"
            : "invisible scale-[0.98] opacity-0 duration-[var(--dur-pop-out)]"
        }`}
      >
        <Group label="Tier (pick one or more)">
          {([0, 1, 2, 3] as Tier[]).map((t) => (
            <Chip
              key={t}
              pressed={filters.tiers.includes(t)}
              onClick={() => onChange({ ...filters, tiers: filters.tiers.includes(t) ? filters.tiers.filter((x) => x !== t) : [...filters.tiers, t].sort() })}
            >
              Tier {t}
            </Chip>
          ))}
        </Group>

        <Group label="Significance">
          {(Object.keys(CATEGORY_META) as Category[]).map((c) => (
            <Chip key={c} pressed={filters.category === c} onClick={() => onChange({ ...filters, category: filters.category === c ? null : c })}>
              {CATEGORY_META[c].label}
            </Chip>
          ))}
        </Group>
        {filters.category && <p className="-mt-2 text-xs text-muted-foreground">{CATEGORY_META[filters.category].blurb}</p>}

        <Group label="Budget">
          {BUDGETS.filter((b) => b.id !== "any").map((b) => (
            <Chip key={b.id} pressed={filters.budget === b.id} onClick={() => onChange({ ...filters, budget: filters.budget === b.id ? null : b.id })}>
              {b.label}
            </Chip>
          ))}
        </Group>

        <div className="flex items-center justify-between gap-2 border-t border-border pt-3">
          <p className="text-sm font-semibold tabular-nums" aria-live="polite">{shown} of {CARDS.length} IDs match</p>
          {n > 0 && (
            <Button type="button" variant="ghost" size="md" onClick={() => onChange(NO_FILTERS)} className="px-3 text-civic">
              <X className="size-4" aria-hidden="true" /> Clear
            </Button>
          )}
        </div>
      </div>
    </>
  );
}

function Group({ label, children }: { label: string; children: React.ReactNode }) {
  const id = useId();
  return (
    <div role="group" aria-labelledby={id}>
      <p id={id} className="mb-2 text-[13px] font-semibold text-civic">{label}</p>
      <div className="flex flex-wrap gap-2">{children}</div>
    </div>
  );
}
