"use client";

import { useState } from "react";
import { ListFilter, X } from "lucide-react";
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

export function FilterBar({ filters, onChange }: { filters: Filters; onChange: (f: Filters) => void }) {
  const [open, setOpen] = useState(false);
  const n = active(filters);
  const shown = matchSet(filters)?.size ?? CARDS.length;

  return (
    <div className="absolute right-3 top-3 z-20 flex w-[min(20rem,calc(100%-1.5rem))] flex-col items-end gap-2">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        className="inline-flex items-center gap-1.5 rounded-full bg-navy px-4 py-2.5 text-sm font-bold text-white shadow-md hover:bg-civic"
      >
        <ListFilter className="size-4" aria-hidden="true" />
        Filter{n > 0 && <span className="grid size-5 place-items-center rounded-full bg-amber text-xs font-extrabold text-navy">{n}</span>}
      </button>

      {open && (
        <div className="w-full space-y-4 rounded-2xl bg-white p-4 shadow-xl ring-1 ring-border">
          <Group label="Tier (pick one or more)">
            {([0, 1, 2, 3] as Tier[]).map((t) => (
              <Chip key={t} on={filters.tiers.includes(t)} onClick={() => onChange({ ...filters, tiers: filters.tiers.includes(t) ? filters.tiers.filter((x) => x !== t) : [...filters.tiers, t].sort() })}>
                Tier {t}
              </Chip>
            ))}
          </Group>

          <Group label="Significance">
            {(Object.keys(CATEGORY_META) as Category[]).map((c) => (
              <Chip key={c} on={filters.category === c} onClick={() => onChange({ ...filters, category: filters.category === c ? null : c })}>
                {CATEGORY_META[c].label}
              </Chip>
            ))}
          </Group>
          {filters.category && <p className="-mt-2 text-xs text-muted-foreground">{CATEGORY_META[filters.category].blurb}</p>}

          <Group label="Budget">
            {BUDGETS.filter((b) => b.id !== "any").map((b) => (
              <Chip key={b.id} on={filters.budget === b.id} onClick={() => onChange({ ...filters, budget: filters.budget === b.id ? null : b.id })}>
                {b.label}
              </Chip>
            ))}
          </Group>

          <div className="flex items-center justify-between border-t border-border pt-3">
            <p className="text-sm font-semibold" aria-live="polite">{shown} of {CARDS.length} IDs match</p>
            {n > 0 && (
              <button type="button" onClick={() => onChange(NO_FILTERS)} className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-sm font-bold text-civic hover:bg-muted">
                <X className="size-4" aria-hidden="true" /> Clear
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function Group({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="mb-2 text-xs font-bold uppercase tracking-wider text-civic">{label}</p>
      <div className="flex flex-wrap gap-2">{children}</div>
    </div>
  );
}

function Chip({ on, onClick, children }: { on: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={on}
      className={`rounded-full border-2 px-3 py-1.5 text-sm font-bold transition-colors ${
        on ? "border-civic bg-civic text-white" : "border-border bg-white text-navy hover:bg-muted"
      }`}
    >
      {children}
    </button>
  );
}
