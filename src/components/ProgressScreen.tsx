"use client";

import { Star, Target } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Pill } from "@/components/ui/pill";
import { CARDS, CREDENTIAL_GROUPS, GROUP_META } from "@/data/cards";
import { EXTRA_DOCUMENTS } from "@/data/documents";
import { applicationMode, trackProgress } from "@/lib/prepare";
import { statusOf } from "@/lib/tree";
import { fitsBudget, fitsSetup } from "@/lib/prefs";
import type { User } from "@/lib/store";
import { GroupGuide } from "./GroupGuide";
import { ProfileBackupRestore } from "./BackupRestorePanel";

const INVENTORY = [...CARDS, ...EXTRA_DOCUMENTS];

/** Bars scale on the compositor (transform) instead of animating width. */
const BAR = "h-full origin-left rounded-full bg-amber transition-transform duration-300 ease-[var(--ease-out)]";

export function ProgressScreen({
  me,
  onPickCard,
  onSetPriority,
  onStopTracking,
  suggestions,
}: {
  suggestions?: React.ReactNode;
  me: User;
  onPickCard: (id: string) => void;
  onSetPriority: (id: string) => void;
  onStopTracking: (id: string) => void;
}) {
  const owned = new Set(me.owned);
  const tracked = (me.tracking ?? [])
    .map((id) => CARDS.find((c) => c.id === id))
    .filter((c): c is (typeof CARDS)[number] => !!c);
  const ready = CARDS.filter(
    (c) =>
      statusOf(c, owned, {
        age: me.age,
        facts: me.facts,
        documents: me.documents,
        prep: me.prep,
        modes: me.modes,
        setup: me.setup,
      }) === "available",
  );
  const fits = (id: string) =>
    fitsBudget(
      id,
      me.budget,
      applicationMode(id, { setup: me.setup, mode: me.modes?.[id] }),
      me.facts,
    ) && fitsSetup(id, me.setup);
  const next = [...ready]
    .sort((a, b) => Number(fits(b.id)) - Number(fits(a.id)))
    .slice(0, 5);

  return (
    <div className="mx-auto w-full max-w-md space-y-10 px-5 pb-12 pt-6">
      <h1 className="text-2xl font-semibold tracking-tight text-navy">Your progress</h1>

      {me.needsChecklistReview && (
        <p role="status" className="rounded-xl bg-mist p-4 text-sm">
          Some requirements changed. Your documents and goals are safe —
          please re-check your ticked items.
        </p>
      )}
      {suggestions}
      <ProfileBackupRestore />

      <section aria-labelledby="tracking">
        <h2 id="tracking" className="text-lg font-semibold tracking-tight text-navy">
          Tracking
        </h2>
        <p className="mt-1.5 mb-5 text-[15px] leading-relaxed text-muted-foreground">
          Your ★ priority shows on the ID path.
        </p>
        {tracked.length === 0 ? (
          <p className="rounded-2xl bg-muted p-4 text-sm">
            <Target
              className="mr-1.5 inline size-4 text-civic"
              aria-hidden="true"
            />
            Nothing yet. Open any ID and tap “Track”.
          </p>
        ) : (
          <ul className="space-y-3">
            {tracked.map((c) => {
              const p = trackProgress(c.id, owned, me.prep?.[c.id] ?? [], {
                age: me.age,
                facts: me.facts,
                documents: me.documents,
                setup: me.setup,
                mode: me.modes?.[c.id],
              });
              const isPriority = me.priority === c.id;
              return (
                <li
                  key={c.id}
                  className={`rounded-[20px] p-4 ring-1 ${isPriority ? "bg-mist/60 ring-sky/50" : "bg-card ring-navy/[0.08]"}`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <button
                      type="button"
                      onClick={() => onPickCard(c.id)}
                      data-card-id={c.id}
                      className="min-h-11 min-w-0 text-left"
                    >
                      <span className="block truncate text-[15px] font-semibold">
                        {c.name}
                      </span>
                      <span className="text-xs font-semibold tabular-nums text-muted-foreground">
                        {p.stage} · {p.done}/{p.total}
                      </span>
                    </button>
                    <span className="shrink-0 text-sm font-bold tabular-nums">
                      {p.pct}%
                    </span>
                  </div>
                  <div
                    role="progressbar"
                    aria-valuemin={0}
                    aria-valuemax={100}
                    aria-valuenow={p.pct}
                    aria-label={`${c.name} progress`}
                    className="my-3 h-2 overflow-hidden rounded-full bg-navy/[0.07]"
                  >
                    <div className={BAR} style={{ transform: `scaleX(${p.pct / 100})` }} />
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      size="md"
                      aria-pressed={isPriority}
                      onClick={() => {
                        if (!isPriority) onSetPriority(c.id);
                      }}
                      className="border-border aria-pressed:border-amber aria-pressed:bg-amber aria-pressed:text-navy"
                    >
                      <Star
                        className="size-4"
                        fill={isPriority ? "currentColor" : "none"}
                        aria-hidden="true"
                      />
                      {isPriority ? "Priority" : "Make priority"}
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="md"
                      onClick={() => onStopTracking(c.id)}
                      className="text-civic hover:bg-white/60"
                    >
                      Stop tracking
                    </Button>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <section aria-labelledby="by-group">
        <h2 id="by-group" className="mb-5 text-lg font-semibold tracking-tight text-navy">
          By group
        </h2>
        <ul className="space-y-3">
          {CREDENTIAL_GROUPS.map((g) => {
            const have = INVENTORY.filter(
              (c) => c.group === g && owned.has(c.id),
            ).length;
            const of = INVENTORY.filter((c) => c.group === g).length;
            return (
              <li
                key={g}
                className="rounded-[20px] bg-card p-4 ring-1 ring-navy/[0.08]"
              >
                <div className="mb-3 flex items-baseline justify-between gap-2">
                  <span className="text-sm font-semibold">
                    {GROUP_META[g].label}
                  </span>
                  <span className="text-sm font-semibold tabular-nums text-muted-foreground">
                    {have}/{of}
                  </span>
                </div>
                <div
                  role="progressbar"
                  aria-valuemin={0}
                  aria-valuemax={of}
                  aria-valuenow={have}
                  aria-label={`${GROUP_META[g].label} progress`}
                  className="h-2 overflow-hidden rounded-full bg-navy/[0.07]"
                >
                  <div className={BAR} style={{ transform: `scaleX(${of ? have / of : 0})` }} />
                </div>
              </li>
            );
          })}
        </ul>
        <div className="mt-4">
          <GroupGuide />
        </div>
      </section>

      <section aria-labelledby="next-up">
        <h2 id="next-up" className="text-lg font-semibold tracking-tight text-navy">
          Ready to apply
        </h2>
        <p className="mt-1.5 mb-5 text-[15px] leading-relaxed text-muted-foreground">
          You have what these need.
        </p>
        {next.length === 0 ? (
          <p className="rounded-2xl bg-muted p-4 text-sm">
            None yet. You can still pick any ID as a goal.
          </p>
        ) : (
          <ul className="space-y-2.5">
            {next.map((c) => (
              <li key={c.id}>
                <button
                  type="button"
                  onClick={() => onPickCard(c.id)}
                  data-card-id={c.id}
                  className="flex min-h-14 w-full items-center justify-between gap-3 rounded-[20px] bg-card p-4 text-left ring-1 ring-navy/[0.08] transition-[background-color,scale] duration-[var(--dur-fast)] ease-[var(--ease-out)] hover:bg-muted active:scale-[0.985] active:duration-[var(--dur-press)]"
                >
                  <span className="font-semibold">{c.name}</span>
                  <Pill tone={fits(c.id) ? "mist" : "muted"} className="shrink-0">
                    {fits(c.id) ? "Fits you" : "Check budget"}
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

