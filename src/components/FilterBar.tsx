"use client";

import { useEffect, useId, useState } from "react";
import { BookOpen, ListFilter, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Chip } from "@/components/ui/chip";
import {
  CARDS,
  CATEGORY_META,
  CREDENTIAL_GROUPS,
  GROUP_META,
  type Category,
} from "@/data/cards";
import { BUDGETS } from "@/lib/prefs";
import { CardKindFilter } from "./CardKindFilter";
import { GroupDefinitions } from "./GroupGuide";
import {
  matchSet,
  activeFilterCount,
  NO_FILTERS,
  type Filters,
  type FilterContext,
} from "@/lib/filters";

type PanelName = "filters" | "groups";

const PANEL_BASE =
  "absolute right-3 top-full z-30 mt-1 max-h-[min(70dvh,34rem)] w-[min(20rem,calc(100%-1.5rem))] origin-top-right overflow-y-auto overscroll-contain rounded-2xl bg-white p-4 shadow-xl ring-1 ring-border transition-[opacity,scale,visibility] ease-[var(--ease-out)]";
const PANEL_OPEN = "visible scale-100 opacity-100 duration-[var(--dur-pop-in)]";
const PANEL_CLOSED = "invisible scale-[0.98] opacity-0 duration-[var(--dur-pop-out)]";

/**
 * Groups + Filter buttons and their panels. Rendered inside the tree toolbar: the buttons sit in the bar and
 * each panel drops down from the bar's bottom edge (the toolbar is the positioned ancestor).
 * Panels stay mounted so they can animate; Esc and outside click close them and focus returns to the button.
 */
export function FilterBar({
  filters,
  onChange,
  context,
}: {
  filters: Filters;
  onChange: (f: Filters) => void;
  context: FilterContext;
}) {
  const [open, setOpen] = useState<PanelName | null>(null);
  const uid = useId();
  const id = (part: string, name: PanelName) => `${uid}-${name}-${part}`;
  const n = activeFilterCount(filters);
  const shown = matchSet(filters, context)?.size ?? CARDS.length;

  useEffect(() => {
    if (!open) return;
    const triggerId = `${uid}-${open}-trigger`;
    const panelId = `${uid}-${open}-panel`;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      setOpen(null);
      document.getElementById(triggerId)?.focus();
    };
    const onDown = (e: PointerEvent) => {
      const t = e.target as Node;
      // Clicking either trigger is handled by its own onClick (it toggles / switches panels).
      const inside = [panelId, `${uid}-filters-trigger`, `${uid}-groups-trigger`].some((x) =>
        document.getElementById(x)?.contains(t),
      );
      if (!inside) setOpen(null);
    };
    document.addEventListener("keydown", onKey);
    document.addEventListener("pointerdown", onDown);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("pointerdown", onDown);
    };
  }, [open, uid]);

  const toggle = (name: PanelName) => setOpen((current) => (current === name ? null : name));

  return (
    <>
      <div className="flex shrink-0 items-center gap-1.5">
        <Button
          id={id("trigger", "groups")}
          type="button"
          variant="outline"
          size="md"
          onClick={() => toggle("groups")}
          aria-expanded={open === "groups"}
          aria-controls={id("panel", "groups")}
          className="w-11 rounded-full px-0 text-civic sm:w-auto sm:px-3"
        >
          <BookOpen className="size-4" aria-hidden="true" />
          <span className="sr-only sm:not-sr-only">Groups</span>
        </Button>
        <Button
          id={id("trigger", "filters")}
          type="button"
          variant="brand"
          size="md"
          onClick={() => toggle("filters")}
          aria-expanded={open === "filters"}
          aria-controls={id("panel", "filters")}
          className="rounded-full px-3"
        >
          <ListFilter className="size-4" aria-hidden="true" />
          Filter
          {n > 0 && (
            <span className="grid size-5 place-items-center rounded-full bg-amber text-xs font-bold tabular-nums text-navy">
              {n}
            </span>
          )}
        </Button>
      </div>

      <section
        id={id("panel", "groups")}
        aria-label="Credential group definitions"
        className={`${PANEL_BASE} ${open === "groups" ? PANEL_OPEN : PANEL_CLOSED}`}
      >
        <h2 className="mb-3 text-base font-bold">What do the groups mean?</h2>
        <GroupDefinitions />
      </section>

      <section
        id={id("panel", "filters")}
        aria-label="Filters"
        className={`${PANEL_BASE} space-y-4 ${open === "filters" ? PANEL_OPEN : PANEL_CLOSED}`}
      >
        <CardKindFilter value={filters.kind} onChange={(kind) => onChange({ ...filters, kind })} />

        <Group label="Credential group (pick one or more)">
          {CREDENTIAL_GROUPS.map((g) => (
            <Chip
              key={g}
              pressed={filters.groups.includes(g)}
              onClick={() =>
                onChange({
                  ...filters,
                  groups: filters.groups.includes(g)
                    ? filters.groups.filter((x) => x !== g)
                    : [...filters.groups, g].sort(),
                })
              }
            >
              {GROUP_META[g].label}
            </Chip>
          ))}
        </Group>

        <Group label="Significance">
          {(Object.keys(CATEGORY_META) as Category[]).map((c) => (
            <Chip
              key={c}
              pressed={filters.category === c}
              onClick={() => onChange({ ...filters, category: filters.category === c ? null : c })}
            >
              {CATEGORY_META[c].label}
            </Chip>
          ))}
        </Group>
        {filters.category && <p className="-mt-2 text-xs text-muted-foreground">{CATEGORY_META[filters.category].blurb}</p>}

        <Group label="Budget">
          {BUDGETS.filter((b) => b.id !== "any").map((b) => (
            <Chip
              key={b.id}
              pressed={filters.budget === b.id}
              onClick={() => onChange({ ...filters, budget: filters.budget === b.id ? null : b.id })}
            >
              {b.label}
            </Chip>
          ))}
        </Group>

        <div className="flex items-center justify-between gap-2 border-t border-border pt-3">
          <p className="text-sm font-semibold tabular-nums" aria-live="polite">
            {shown} of {CARDS.length} items match
          </p>
          {n > 0 && (
            <Button type="button" variant="ghost" size="md" onClick={() => onChange(NO_FILTERS)} className="px-3 text-civic">
              <X className="size-4" aria-hidden="true" /> Clear
            </Button>
          )}
        </div>
      </section>
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
