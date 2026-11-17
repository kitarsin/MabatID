"use client";

import { useMemo, useRef, useState } from "react";
import { Building2, Check, Globe, Search, X } from "lucide-react";
import { Chip } from "@/components/ui/chip";
import { Pill } from "@/components/ui/pill";
import {
  CARDS,
  CARD_KIND_META,
  CATEGORY_META,
  GROUP_META,
  CREDENTIAL_GROUPS,
  type Category,
  type CardKind,
} from "@/data/cards";
import { DETAILS } from "@/data/details";
import { matchSet, NO_FILTERS } from "@/lib/filters";
import { CardKindFilter } from "./CardKindFilter";
import { CardIcon } from "./icons";
import { Rich } from "./Rich";
import { GroupGuide } from "./GroupGuide";

/** Every ID in the app, open to everyone (signed in or not). Tapping one opens its full details. */
export function BrowseScreen({
  owned,
  onOpen,
  kind,
  onKindChange,
}: {
  owned: ReadonlySet<string>;
  onOpen: (id: string) => void;
  kind: CardKind | null;
  onKindChange: (kind: CardKind | null) => void;
}) {
  const [q, setQ] = useState("");
  const [cat, setCat] = useState<Category | null>(null);
  const searchRef = useRef<HTMLInputElement>(null);

  const list = useMemo(() => {
    const term = q.trim().toLowerCase();
    const matching = matchSet({ ...NO_FILTERS, kind, category: cat });
    return CARDS.filter((c) => {
      if (matching && !matching.has(c.id)) return false;
      if (!term) return true;
      const d = DETAILS[c.id];
      return [c.name, c.short, d.issuedBy, d.purpose]
        .join(" ")
        .toLowerCase()
        .includes(term);
    });
  }, [q, cat, kind]);

  return (
    <div className="mx-auto w-full max-w-md space-y-4 px-5 pb-10 pt-5">
      <div>
        <h1 className="text-2xl font-bold leading-tight tracking-tight">
          IDs &amp; documents
        </h1>
        <p className="text-sm text-muted-foreground">
          Browse every ID and document — requirements, steps and official
          references.
        </p>
      </div>

      <GroupGuide />

      <div className="relative">
        <Search
          className="pointer-events-none absolute left-3.5 top-1/2 size-5 -translate-y-1/2 text-muted-foreground"
          aria-hidden="true"
        />
        <input
          ref={searchRef}
          type="search"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search by name or agency…"
          aria-label="Search IDs and documents"
          autoComplete="off"
          enterKeyHint="search"
          spellCheck={false}
          className="h-12 w-full rounded-2xl border-2 border-input bg-card pl-11 pr-12 text-base transition-colors duration-[var(--dur-fast)] focus-visible:border-civic [&::-webkit-search-cancel-button]:appearance-none"
        />
        {q && (
          <button
            type="button"
            aria-label="Clear search"
            onClick={() => {
              setQ("");
              searchRef.current?.focus();
            }}
            className="absolute right-1 top-1/2 grid size-11 -translate-y-1/2 place-items-center rounded-xl text-muted-foreground hover:bg-muted"
          >
            <X className="size-5" aria-hidden="true" />
          </button>
        )}
      </div>

      <CardKindFilter value={kind} onChange={onKindChange} />

      <div
        className="-mx-5 flex gap-2 overflow-x-auto px-5 py-1.5"
        role="group"
        aria-label="Filter by significance"
      >
        <Chip pressed={cat === null} onClick={() => setCat(null)}>
          All
        </Chip>
        {(Object.keys(CATEGORY_META) as Category[]).map((c) => (
          <Chip key={c} pressed={cat === c} onClick={() => setCat(cat === c ? null : c)}>
            {CATEGORY_META[c].label}
          </Chip>
        ))}
      </div>

      <p
        className="text-sm font-semibold tabular-nums text-muted-foreground"
        aria-live="polite"
      >
        {list.length} of {CARDS.length} items
      </p>

      {list.length === 0 && (
        <p className="rounded-2xl bg-muted p-4 text-sm">
          {q.trim()
            ? `No items match “${q.trim()}” with these filters.`
            : "No items match these filters."}{" "}
          Try another type, category or search.
        </p>
      )}

      {CREDENTIAL_GROUPS.map((g) => {
        const items = list.filter((c) => c.group === g);
        if (!items.length) return null;
        return (
          <section key={g} aria-labelledby={`browse-group-${g}`}>
            <h2
              id={`browse-group-${g}`}
              className="text-[13px] font-semibold text-civic"
            >
              {GROUP_META[g].label}
            </h2>
            <p className="mb-3 mt-1 text-xs text-muted-foreground">
              {GROUP_META[g].blurb}
            </p>
            <ul className="space-y-2">
              {items.map((c) => {
                const d = DETAILS[c.id];
                return (
                  <li key={c.id}>
                    <button
                      type="button"
                      onClick={() => onOpen(c.id)}
                      data-card-id={c.id}
                      className="flex w-full gap-3 rounded-2xl bg-card p-3.5 text-left shadow-sm ring-1 ring-border transition-[background-color,scale] duration-[var(--dur-fast)] ease-[var(--ease-out)] hover:bg-muted active:scale-[0.985] active:duration-[var(--dur-press)]"
                    >
                      <span className="grid size-12 shrink-0 place-items-center rounded-full border-2 border-civic bg-white text-civic">
                        <CardIcon name={c.icon} className="size-6" />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="flex items-start justify-between gap-2">
                          <span className="text-[15px] font-semibold leading-snug">
                            {c.name}
                          </span>
                          {owned.has(c.id) && (
                            <Pill tone="amber" className="shrink-0">
                              <Check className="size-3" strokeWidth={3} aria-hidden="true" /> Have
                            </Pill>
                          )}
                        </span>
                        <span className="mt-0.5 block text-xs font-semibold text-muted-foreground">
                          {d.issuedBy}
                        </span>
                        <span className="mt-1.5 block text-sm leading-snug">
                          <Rich text={d.req.fee} />
                        </span>
                        <span className="mt-2 flex flex-wrap gap-1.5">
                          {c.starter && <Pill>Starter ID</Pill>}
                          <Pill>{CARD_KIND_META[c.kind].singular}</Pill>
                          <Pill>{CATEGORY_META[c.category].label}</Pill>
                          {d.onsite && (
                            <Pill>
                              <Building2 className="size-3" aria-hidden="true" /> On-site
                            </Pill>
                          )}
                          {d.online && (
                            <Pill>
                              <Globe className="size-3" aria-hidden="true" />{" "}
                              {d.onlineRequiresVisit ? "Online + visit" : "Online"}
                            </Pill>
                          )}
                        </span>
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          </section>
        );
      })}
    </div>
  );
}
