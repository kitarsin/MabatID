"use client";

import { useMemo, useState } from "react";
import { Building2, Check, Globe, Search } from "lucide-react";
import { CARDS, CATEGORY_META, TIER_META, type Category, type Tier } from "@/data/cards";
import { DETAILS } from "@/data/details";
import { CardIcon } from "./icons";
import { Rich } from "./Rich";

const TIERS: Tier[] = [0, 1, 2, 3];

/** Every ID in the app, open to everyone (signed in or not). Tapping one opens its full details. */
export function BrowseScreen({ owned, onOpen }: { owned: ReadonlySet<string>; onOpen: (id: string) => void }) {
  const [q, setQ] = useState("");
  const [cat, setCat] = useState<Category | null>(null);

  const list = useMemo(() => {
    const term = q.trim().toLowerCase();
    return CARDS.filter((c) => {
      if (cat && c.category !== cat) return false;
      if (!term) return true;
      const d = DETAILS[c.id];
      return [c.name, c.short, d.issuedBy, d.purpose].join(" ").toLowerCase().includes(term);
    });
  }, [q, cat]);

  return (
    <div className="mx-auto w-full max-w-md space-y-4 px-5 pb-10 pt-5">
      <div>
        <h1 className="text-2xl font-extrabold tracking-tight">All IDs</h1>
        <p className="text-sm text-muted-foreground">
          Browse every ID and document — requirements, steps and official references.
        </p>
      </div>

      <div className="relative">
        <Search
          className="pointer-events-none absolute left-3.5 top-1/2 size-5 -translate-y-1/2 text-muted-foreground"
          aria-hidden="true"
        />
        <input
          type="search"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search by name or agency"
          aria-label="Search IDs"
          className="h-12 w-full rounded-2xl border-2 border-input bg-card pl-11 pr-4 text-base outline-none focus:border-civic"
        />
      </div>

      <div className="-mx-5 flex gap-2 overflow-x-auto px-5 pb-1" role="group" aria-label="Filter by significance">
        <Chip on={cat === null} onClick={() => setCat(null)}>
          All
        </Chip>
        {(Object.keys(CATEGORY_META) as Category[]).map((c) => (
          <Chip key={c} on={cat === c} onClick={() => setCat(cat === c ? null : c)}>
            {CATEGORY_META[c].label}
          </Chip>
        ))}
      </div>

      <p className="text-sm font-semibold text-muted-foreground" aria-live="polite">
        {list.length} of {CARDS.length} IDs
      </p>

      {list.length === 0 && (
        <p className="rounded-2xl bg-muted p-4 text-sm">No IDs match “{q}”. Try another name or agency.</p>
      )}

      {TIERS.map((t) => {
        const items = list.filter((c) => c.tier === t);
        if (!items.length) return null;
        return (
          <section key={t} aria-labelledby={`browse-tier-${t}`}>
            <h2 id={`browse-tier-${t}`} className="mb-2 text-xs font-bold uppercase tracking-wider text-civic">
              {TIER_META[t].label}
            </h2>
            <ul className="space-y-2">
              {items.map((c) => {
                const d = DETAILS[c.id];
                return (
                  <li key={c.id}>
                    <button
                      type="button"
                      onClick={() => onOpen(c.id)}
                      className="flex w-full gap-3 rounded-2xl bg-card p-3.5 text-left shadow-sm ring-1 ring-border transition-colors hover:bg-muted"
                    >
                      <span className="grid size-12 shrink-0 place-items-center rounded-full border-2 border-civic bg-white text-civic">
                        <CardIcon name={c.icon} className="size-6" />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="flex items-start justify-between gap-2">
                          <span className="text-[15px] font-extrabold leading-snug">{c.name}</span>
                          {owned.has(c.id) && (
                            <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-amber px-2 py-0.5 text-[11px] font-extrabold text-navy">
                              <Check className="size-3" strokeWidth={3} aria-hidden="true" /> Have
                            </span>
                          )}
                        </span>
                        <span className="mt-0.5 block text-xs font-semibold text-muted-foreground">{d.issuedBy}</span>
                        <span className="mt-1.5 block text-sm leading-snug">
                          <Rich text={d.req.fee} />
                        </span>
                        <span className="mt-2 flex flex-wrap gap-1.5">
                          <Tag>{CATEGORY_META[c.category].label}</Tag>
                          {d.onsite && (
                            <Tag>
                              <Building2 className="size-3" aria-hidden="true" /> On-site
                            </Tag>
                          )}
                          {d.online && (
                            <Tag>
                              <Globe className="size-3" aria-hidden="true" /> Online
                            </Tag>
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

function Chip({ on, onClick, children }: { on: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={on}
      className={`shrink-0 rounded-full border-2 px-3.5 py-1.5 text-sm font-bold ${
        on ? "border-civic bg-civic text-white" : "border-border bg-white text-navy hover:bg-muted"
      }`}
    >
      {children}
    </button>
  );
}

function Tag({ children }: { children: React.ReactNode }) {
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-mist px-2 py-0.5 text-[11px] font-bold text-navy">
      {children}
    </span>
  );
}
