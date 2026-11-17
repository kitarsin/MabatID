"use client";

import { useState } from "react";
import { BookOpen, ListFilter, X } from "lucide-react";
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

export function FilterBar({
  filters,
  onChange,
  context,
}: {
  filters: Filters;
  onChange: (f: Filters) => void;
  context: FilterContext;
}) {
  const [panel, setPanel] = useState<"filters" | "groups" | null>(null);
  const n = activeFilterCount(filters);
  const shown = matchSet(filters, context)?.size ?? CARDS.length;

  return (
    <div
      className={`absolute right-3 top-3 flex w-[min(20rem,calc(100%-1.5rem))] flex-col items-end gap-2 ${panel ? "z-40" : "z-20"}`}
    >
      <div className="flex gap-2">
        <button
          type="button"
          onClick={() =>
            setPanel((current) => (current === "groups" ? null : "groups"))
          }
          aria-expanded={panel === "groups"}
          className="inline-flex items-center gap-1.5 rounded-full bg-white px-3 py-2.5 text-sm font-bold text-civic shadow-md ring-1 ring-border"
        >
          <BookOpen className="size-4" aria-hidden="true" /> Groups
        </button>
        <button
          type="button"
          onClick={() =>
            setPanel((current) => (current === "filters" ? null : "filters"))
          }
          aria-expanded={panel === "filters"}
          className="inline-flex items-center gap-1.5 rounded-full bg-navy px-4 py-2.5 text-sm font-bold text-white shadow-md hover:bg-civic"
        >
          <ListFilter className="size-4" aria-hidden="true" />
          Filter
          {n > 0 && (
            <span className="grid size-5 place-items-center rounded-full bg-amber text-xs font-extrabold text-navy">
              {n}
            </span>
          )}
        </button>
      </div>

      {panel === "groups" && (
        <section
          aria-label="Credential group definitions"
          className="max-h-[calc(100dvh-10rem)] w-full overflow-y-auto rounded-2xl bg-white p-4 shadow-xl ring-1 ring-border"
        >
          <h2 className="mb-3 text-base font-extrabold">
            What do the groups mean?
          </h2>
          <GroupDefinitions />
        </section>
      )}
      {panel === "filters" && (
        <div className="max-h-[calc(100dvh-10rem)] w-full space-y-4 overflow-y-auto rounded-2xl bg-white p-4 shadow-xl ring-1 ring-border">
          <CardKindFilter
            value={filters.kind}
            onChange={(kind) => onChange({ ...filters, kind })}
          />
          <Group label="Credential group (pick one or more)">
            {CREDENTIAL_GROUPS.map((t) => (
              <Chip
                key={t}
                on={filters.groups.includes(t)}
                onClick={() =>
                  onChange({
                    ...filters,
                    groups: filters.groups.includes(t)
                      ? filters.groups.filter((x) => x !== t)
                      : [...filters.groups, t].sort(),
                  })
                }
              >
                {GROUP_META[t].label}
              </Chip>
            ))}
          </Group>

          <Group label="Significance">
            {(Object.keys(CATEGORY_META) as Category[]).map((c) => (
              <Chip
                key={c}
                on={filters.category === c}
                onClick={() =>
                  onChange({
                    ...filters,
                    category: filters.category === c ? null : c,
                  })
                }
              >
                {CATEGORY_META[c].label}
              </Chip>
            ))}
          </Group>
          {filters.category && (
            <p className="-mt-2 text-xs text-muted-foreground">
              {CATEGORY_META[filters.category].blurb}
            </p>
          )}

          <Group label="Budget">
            {BUDGETS.filter((b) => b.id !== "any").map((b) => (
              <Chip
                key={b.id}
                on={filters.budget === b.id}
                onClick={() =>
                  onChange({
                    ...filters,
                    budget: filters.budget === b.id ? null : b.id,
                  })
                }
              >
                {b.label}
              </Chip>
            ))}
          </Group>

          <div className="flex items-center justify-between border-t border-border pt-3">
            <p className="text-sm font-semibold" aria-live="polite">
              {shown} of {CARDS.length} items match
            </p>
            {n > 0 && (
              <button
                type="button"
                onClick={() => onChange(NO_FILTERS)}
                className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-sm font-bold text-civic hover:bg-muted"
              >
                <X className="size-4" aria-hidden="true" /> Clear
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function Group({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <p className="mb-2 text-xs font-bold uppercase tracking-wider text-civic">
        {label}
      </p>
      <div className="flex flex-wrap gap-2">{children}</div>
    </div>
  );
}

function Chip({
  on,
  onClick,
  children,
}: {
  on: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={on}
      className={`rounded-full border-2 px-3 py-1.5 text-sm font-bold transition-colors ${
        on
          ? "border-civic bg-civic text-white"
          : "border-border bg-white text-navy hover:bg-muted"
      }`}
    >
      {children}
    </button>
  );
}
