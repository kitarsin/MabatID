"use client";

import { Star, SlidersHorizontal, Target, Trophy } from "lucide-react";
import { CARDS, TIER_META, type Tier } from "@/data/cards";
import { trackProgress } from "@/lib/prepare";
import { levelTitle, statusOf, TIER_COUNTS } from "@/lib/tree";
import { BUDGETS, SETUPS, fitsBudget, fitsSetup } from "@/lib/prefs";
import type { User } from "@/lib/store";

const TIERS: Tier[] = [0, 1, 2, 3];

export function ProgressScreen({
  me,
  users,
  onPickCard,
  onEdit,
  onSetPriority,
  onStopTracking,
}: {
  me: User;
  users: User[];
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
  const board = [...users].sort((a, b) => b.owned.length - a.owned.length || a.createdAt - b.createdAt);

  return (
    <div className="mx-auto w-full max-w-md space-y-6 px-5 pb-10 pt-5">
      <section className="rounded-3xl bg-navy p-5 text-white">
        <div className="flex items-center gap-4">
          <Ring pct={pct} />
          <div>
            <p className="text-xs font-bold uppercase tracking-wider text-mist">Your level</p>
            <p className="text-xl font-extrabold">{levelTitle(owned)}</p>
            <p className="text-sm text-mist">
              {owned.size} of {total} IDs collected
            </p>
          </div>
        </div>
        <button
          type="button" onClick={onEdit}
          className="mt-4 flex w-full items-center justify-between gap-2 rounded-xl bg-white/10 px-3 py-2.5 text-left text-sm font-semibold hover:bg-white/15"
        >
          <span><span className="text-mist">Budget</span> {budgetLabel} · <span className="text-mist">Setup</span> {setupLabel}</span>
          <span className="flex shrink-0 items-center gap-1 font-bold text-amber"><SlidersHorizontal className="size-4" aria-hidden="true" /> Edit</span>
        </button>
      </section>

      <section aria-labelledby="tracking">
        <h2 id="tracking" className="mb-1 text-lg font-extrabold">Tracking</h2>
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
                    <button type="button" onClick={() => onPickCard(c.id)} className="min-w-0 text-left">
                      <span className="block truncate text-[15px] font-extrabold">{c.name}</span>
                      <span className="text-xs font-semibold text-muted-foreground">{p.stage} · {p.done}/{p.total}</span>
                    </button>
                    <span className="shrink-0 text-sm font-extrabold">{p.pct}%</span>
                  </div>
                  <div
                    role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={p.pct} aria-label={`${c.name} progress`}
                    className="my-2 h-2.5 overflow-hidden rounded-full bg-white/70 ring-1 ring-border"
                  >
                    <div className="h-full rounded-full bg-amber transition-all" style={{ width: `${p.pct}%` }} />
                  </div>
                  <div className="flex gap-2">
                    <button
                      type="button" disabled={isPriority} onClick={() => onSetPriority(c.id)} aria-pressed={isPriority}
                      className={`inline-flex items-center gap-1 rounded-lg px-3 py-1.5 text-sm font-bold ${isPriority ? "bg-amber text-navy" : "bg-white text-navy ring-1 ring-border hover:bg-muted"}`}
                    >
                      <Star className="size-4" fill={isPriority ? "currentColor" : "none"} aria-hidden="true" />
                      {isPriority ? "Priority" : "Make priority"}
                    </button>
                    <button type="button" onClick={() => onStopTracking(c.id)} className="rounded-lg px-3 py-1.5 text-sm font-bold text-civic hover:bg-white/60">
                      Stop tracking
                    </button>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <section aria-labelledby="by-tier">
        <h2 id="by-tier" className="mb-3 text-lg font-extrabold">By tier</h2>
        <ul className="space-y-3">
          {TIERS.map((t) => {
            const have = CARDS.filter((c) => c.tier === t && owned.has(c.id)).length;
            const of = TIER_COUNTS[t];
            return (
              <li key={t} className="rounded-2xl bg-card p-4 shadow-sm ring-1 ring-border">
                <div className="mb-2 flex items-baseline justify-between gap-2">
                  <span className="text-sm font-bold">{TIER_META[t].label}</span>
                  <span className="text-sm font-semibold text-muted-foreground">{have}/{of}</span>
                </div>
                <div
                  role="progressbar" aria-valuemin={0} aria-valuemax={of} aria-valuenow={have}
                  aria-label={`${TIER_META[t].label} progress`}
                  className="h-3 overflow-hidden rounded-full bg-muted"
                >
                  <div className="h-full rounded-full bg-amber transition-all" style={{ width: `${(have / of) * 100}%` }} />
                </div>
              </li>
            );
          })}
        </ul>
      </section>

      <section aria-labelledby="next-up">
        <h2 id="next-up" className="mb-3 text-lg font-extrabold">Ready to get next</h2>
        {next.length === 0 ? (
          <p className="rounded-2xl bg-muted p-4 text-sm">Nothing unlocked yet — mark the IDs you already have on the path.</p>
        ) : (
          <ul className="space-y-2">
            {next.map((c) => (
              <li key={c.id}>
                <button
                  type="button" onClick={() => onPickCard(c.id)}
                  className="flex w-full items-center justify-between gap-3 rounded-2xl bg-card p-4 text-left shadow-sm ring-1 ring-border hover:bg-muted"
                >
                  <span className="font-bold">{c.name}</span>
                  <span className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-bold ${fits(c.id) ? "bg-mist text-navy" : "bg-muted text-muted-foreground"}`}>
                    {fits(c.id) ? "Fits you" : "Check fit"}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section aria-labelledby="community">
        <h2 id="community" className="mb-1 text-lg font-extrabold">Everyone’s progress</h2>
        <p className="mb-3 text-sm text-muted-foreground">All registered members on this device.</p>
        <ol className="space-y-2">
          {board.map((u, i) => {
            const s = new Set(u.owned);
            const isMe = u.id === me.id;
            return (
              <li
                key={u.id}
                className={`flex items-center gap-3 rounded-2xl p-3 ring-1 ${isMe ? "bg-mist ring-sky" : "bg-card ring-border"}`}
              >
                <span className="grid size-8 shrink-0 place-items-center rounded-full bg-navy text-sm font-bold text-white">
                  {i === 0 ? <Trophy className="size-4" aria-label="Top member" /> : i + 1}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-bold">{u.name}{isMe && " (you)"}</p>
                  <div className="mt-1 h-2 overflow-hidden rounded-full bg-white/70 ring-1 ring-border">
                    <div className="h-full rounded-full bg-amber" style={{ width: `${(u.owned.length / total) * 100}%` }} />
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-sm font-extrabold">{u.owned.length}/{total}</p>
                  <p className="text-[11px] font-semibold text-muted-foreground">{levelTitle(s)}</p>
                </div>
              </li>
            );
          })}
        </ol>
      </section>
    </div>
  );
}

function Ring({ pct }: { pct: number }) {
  const r = 34, c = 2 * Math.PI * r;
  return (
    <svg viewBox="0 0 80 80" className="size-20 shrink-0 -rotate-90" role="img" aria-label={`${pct}% complete`}>
      <circle cx="40" cy="40" r={r} fill="none" stroke="#A0E0EF" strokeOpacity="0.25" strokeWidth="9" />
      <circle
        cx="40" cy="40" r={r} fill="none" stroke="#FFA500" strokeWidth="9" strokeLinecap="round"
        strokeDasharray={c} strokeDashoffset={c * (1 - pct / 100)} className="transition-all"
      />
      <text x="40" y="40" transform="rotate(90 40 40)" textAnchor="middle" dominantBaseline="central" fill="#fff" fontSize="18" fontWeight="800">
        {pct}%
      </text>
    </svg>
  );
}
