"use client";

import { Star, SlidersHorizontal, Target } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Pill } from "@/components/ui/pill";
import { CARDS, TIER_META, type Tier } from "@/data/cards";
import { trackProgress } from "@/lib/prepare";
import { levelTitle, statusOf, TIER_COUNTS } from "@/lib/tree";
import { BUDGETS, SETUPS, fitsBudget, fitsSetup } from "@/lib/prefs";
import type { User } from "@/lib/store";

const TIERS: Tier[] = [0, 1, 2, 3];

/** Bars scale on the compositor (transform) instead of animating width. */
const BAR = "h-full origin-left rounded-full bg-amber transition-transform duration-300 ease-[var(--ease-out)]";

export function ProgressScreen({
  me,
  onPickCard,
  onEdit,
  onSetPriority,
  onStopTracking,
}: {
  me: User;
  onPickCard: (id: string) => void;
  onEdit: () => void;
  onSetPriority: (id: string) => void;
  onStopTracking: (id: string) => void;
}) {
  const owned = new Set(me.owned);
  const total = CARDS.length;
  const tracked = (me.tracking ?? []).map((id) => CARDS.find((c) => c.id === id)).filter((c): c is (typeof CARDS)[number] => !!c);
  const pct = Math.round((owned.size / total) * 100);
  const ready = CARDS.filter((c) => statusOf(c, owned) === "available");
  const fits = (id: string) => fitsBudget(id, me.budget) && fitsSetup(id, me.setup);
  const next = [...ready].sort((a, b) => Number(fits(b.id)) - Number(fits(a.id))).slice(0, 5);
  const budgetLabel = BUDGETS.find((b) => b.id === me.budget)?.label ?? "No limit";
  const setupLabel = SETUPS.find((x) => x.id === me.setup)?.label ?? "Both";

  return (
    <div className="mx-auto w-full max-w-md space-y-6 px-5 pb-10 pt-5">
      <h1 className="sr-only">Your progress</h1>

      <section className="surface-navy rounded-3xl bg-navy p-5 text-white">
        <div className="flex items-center gap-4">
          <Ring pct={pct} />
          <div>
            <p className="text-xl font-bold leading-tight">{levelTitle(owned)}</p>
            <p className="text-sm tabular-nums text-mist">
              {owned.size} of {total} IDs collected
            </p>
          </div>
        </div>
        <Button
          type="button"
          variant="ghost"
          onClick={onEdit}
          className="mt-4 h-auto min-h-11 w-full justify-between gap-2 whitespace-normal rounded-xl bg-white/10 px-3 py-2.5 text-left text-sm font-semibold text-white hover:bg-white/15 hover:text-white"
        >
          <span><span className="text-mist">Budget</span> {budgetLabel} · <span className="text-mist">Setup</span> {setupLabel}</span>
          <span className="flex shrink-0 items-center gap-1 font-bold text-amber"><SlidersHorizontal className="size-4" aria-hidden="true" /> Edit</span>
        </Button>
      </section>

      <section aria-labelledby="tracking">
        <h2 id="tracking" className="mb-1 text-lg font-bold">Tracking</h2>
        <p className="mb-3 text-sm text-muted-foreground">Track as many as you like. The ★ priority shows on your ID path.</p>
        {tracked.length === 0 ? (
          <p className="rounded-2xl bg-muted p-4 text-sm">
            <Target className="mr-1.5 inline size-4 text-civic" aria-hidden="true" />
            Nothing tracked yet — open an ID on the path and tap <strong>Track this ID</strong>.
          </p>
        ) : (
          <ul className="space-y-2">
            {tracked.map((c) => {
              const p = trackProgress(c.id, owned, me.budget, me.setup, me.prep?.[c.id] ?? []);
              const isPriority = me.priority === c.id;
              return (
                <li key={c.id} className={`rounded-2xl p-3 ring-1 ${isPriority ? "bg-mist ring-sky" : "bg-card ring-border"}`}>
                  <div className="flex items-start justify-between gap-2">
                    <button type="button" onClick={() => onPickCard(c.id)} data-card-id={c.id} className="min-h-11 min-w-0 text-left">
                      <span className="block truncate text-[15px] font-semibold">{c.name}</span>
                      <span className="text-xs font-semibold tabular-nums text-muted-foreground">{p.stage} · {p.done}/{p.total}</span>
                    </button>
                    <span className="shrink-0 text-sm font-bold tabular-nums">{p.pct}%</span>
                  </div>
                  <div
                    role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={p.pct} aria-label={`${c.name} progress`}
                    className="my-2 h-2.5 overflow-hidden rounded-full bg-white/70 ring-1 ring-border"
                  >
                    <div className={BAR} style={{ transform: `scaleX(${p.pct / 100})` }} />
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      size="md"
                      aria-pressed={isPriority}
                      onClick={() => { if (!isPriority) onSetPriority(c.id); }}
                      className="border-border aria-pressed:border-amber aria-pressed:bg-amber aria-pressed:text-navy"
                    >
                      <Star className="size-4" fill={isPriority ? "currentColor" : "none"} aria-hidden="true" />
                      {isPriority ? "Priority" : "Make priority"}
                    </Button>
                    <Button type="button" variant="ghost" size="md" onClick={() => onStopTracking(c.id)} className="text-civic hover:bg-white/60">
                      Stop tracking
                    </Button>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <section aria-labelledby="by-tier">
        <h2 id="by-tier" className="mb-3 text-lg font-bold">By tier</h2>
        <ul className="space-y-3">
          {TIERS.map((t) => {
            const have = CARDS.filter((c) => c.tier === t && owned.has(c.id)).length;
            const of = TIER_COUNTS[t];
            return (
              <li key={t} className="rounded-2xl bg-card p-4 shadow-sm ring-1 ring-border">
                <div className="mb-2 flex items-baseline justify-between gap-2">
                  <span className="text-sm font-semibold">{TIER_META[t].label}</span>
                  <span className="text-sm font-semibold tabular-nums text-muted-foreground">{have}/{of}</span>
                </div>
                <div
                  role="progressbar" aria-valuemin={0} aria-valuemax={of} aria-valuenow={have}
                  aria-label={`${TIER_META[t].label} progress`}
                  className="h-3 overflow-hidden rounded-full bg-muted"
                >
                  <div className={BAR} style={{ transform: `scaleX(${have / of})` }} />
                </div>
              </li>
            );
          })}
        </ul>
      </section>

      <section aria-labelledby="next-up">
        <h2 id="next-up" className="mb-3 text-lg font-bold">Ready to get next</h2>
        {next.length === 0 ? (
          <p className="rounded-2xl bg-muted p-4 text-sm">Nothing unlocked yet — mark the IDs you already have on the path.</p>
        ) : (
          <ul className="space-y-2">
            {next.map((c) => (
              <li key={c.id}>
                <button
                  type="button" onClick={() => onPickCard(c.id)} data-card-id={c.id}
                  className="flex min-h-11 w-full items-center justify-between gap-3 rounded-2xl bg-card p-4 text-left shadow-sm ring-1 ring-border transition-[background-color,scale] duration-[var(--dur-fast)] ease-[var(--ease-out)] hover:bg-muted active:scale-[0.985] active:duration-[var(--dur-press)]"
                >
                  <span className="font-semibold">{c.name}</span>
                  <Pill tone={fits(c.id) ? "mist" : "muted"} className="shrink-0">
                    {fits(c.id) ? "Fits you" : "Check fit"}
                  </Pill>
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

function Ring({ pct }: { pct: number }) {
  const r = 34, c = 2 * Math.PI * r;
  return (
    <svg viewBox="0 0 80 80" className="size-20 shrink-0 -rotate-90" role="img" aria-label={`${pct}% complete`}>
      <circle cx="40" cy="40" r={r} fill="none" className="stroke-mist/25" strokeWidth="9" />
      <circle
        cx="40" cy="40" r={r} fill="none" className="stroke-amber transition-[stroke-dashoffset] duration-[400ms] ease-[var(--ease-out)]" strokeWidth="9" strokeLinecap="round"
        strokeDasharray={c} strokeDashoffset={c * (1 - pct / 100)}
      />
      <text x="40" y="40" transform="rotate(90 40 40)" textAnchor="middle" dominantBaseline="central" className="fill-white tabular-nums" fontSize="18" fontWeight="800">
        {pct}%
      </text>
    </svg>
  );
}
