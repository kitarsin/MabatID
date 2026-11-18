"use client";

import { useState } from "react";
import {
  ArrowLeft,
  ArrowUpRight,
  Briefcase,
  Check,
  ChevronRight,
  GraduationCap,
  Map,
  Plane,
  Sprout,
  Target,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Disclosure } from "@/components/ui/disclosure";
import { Pill } from "@/components/ui/pill";
import { CARD_BY_ID } from "@/data/cards";
import { GUIDES, GUIDE_BY_ID, type Guide } from "@/data/guides";
import { statusOf, type ReadinessContext } from "@/lib/tree";
import { CardIcon } from "./icons";

const ICONS = {
  sprout: Sprout,
  briefcase: Briefcase,
  plane: Plane,
  graduation: GraduationCap,
} as const;

type Props = {
  owned: ReadonlySet<string>;
  context: ReadinessContext;
  signedIn: boolean;
  tracking: string[];
  onToggleTrack: (id: string) => void;
  /** Open an ID's detail sheet. */
  onOpen: (id: string) => void;
  /** Go to the ID path with this ID's route lit. */
  onShowOnPath: (id: string) => void;
  onSignUp: () => void;
};

/** Scenario help: pick a situation, get an ordered list of IDs with reasons and your progress through it. */
export function GuideScreen(props: Props) {
  const [openId, setOpenId] = useState<string | null>(null);
  const guide = openId ? GUIDE_BY_ID[openId] : null;
  return (
    <div className="mx-auto w-full max-w-md px-5 pt-6 pb-12">
      {guide ? (
        <GuideDetail key={guide.id} guide={guide} onBack={() => setOpenId(null)} {...props} />
      ) : (
        <div className="rise space-y-8">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight text-navy">Guides</h1>
            <p className="mt-1.5 text-[15px] leading-relaxed text-muted-foreground">
              Pick what fits you. We’ll show which IDs to get, in what order, and why.
            </p>
          </div>
          <ul className="space-y-3">
            {GUIDES.map((g, i) => {
              const Icon = ICONS[g.icon];
              const needed = g.steps.filter((s) => !s.optional);
              const done = needed.filter((s) => props.owned.has(s.cardId)).length;
              return (
                <li key={g.id} className="rise" style={{ "--d": `${60 + i * 50}ms` } as React.CSSProperties}>
                  <button
                    type="button"
                    onClick={() => setOpenId(g.id)}
                    className="group flex w-full items-center gap-4 rounded-[24px] bg-card p-5 text-left ring-1 ring-navy/[0.08] transition-[background-color,scale,box-shadow] duration-[var(--dur-base)] ease-[var(--ease-out)] hover:shadow-[0_12px_28px_-18px_rgb(27_54_93/0.45)] active:scale-[0.985]"
                  >
                    <span className="grid size-12 shrink-0 place-items-center rounded-2xl bg-navy text-amber">
                      <Icon className="size-6" aria-hidden="true" />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block text-base font-semibold text-navy">{g.title}</span>
                      <span className="mt-0.5 block text-sm leading-relaxed text-muted-foreground">
                        {g.tagline}
                      </span>
                      <span className="mt-2 block text-xs font-medium text-muted-foreground tabular-nums">
                        {done === needed.length
                          ? "All done"
                          : `${done} of ${needed.length} done`}
                      </span>
                    </span>
                    <ChevronRight
                      className="size-5 shrink-0 text-muted-foreground transition-transform duration-[var(--dur-base)] group-hover:translate-x-0.5"
                      aria-hidden="true"
                    />
                  </button>
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </div>
  );
}

function GuideDetail({
  guide,
  onBack,
  owned,
  context,
  signedIn,
  tracking,
  onToggleTrack,
  onOpen,
  onShowOnPath,
  onSignUp,
}: Props & { guide: Guide; onBack: () => void }) {
  const Icon = ICONS[guide.icon];
  const needed = guide.steps.filter((s) => !s.optional);
  const done = needed.filter((s) => owned.has(s.cardId)).length;
  const pct = needed.length ? Math.round((done / needed.length) * 100) : 0;
  const next = guide.steps.find((s) => !s.optional && !owned.has(s.cardId));
  const toTrack = needed.filter(
    (s) => !owned.has(s.cardId) && !tracking.includes(s.cardId),
  );
  const allTracked = needed.every(
    (s) => owned.has(s.cardId) || tracking.includes(s.cardId),
  );

  return (
    <div className="rise space-y-8">
      <button
        type="button"
        onClick={onBack}
        className="-ml-2 inline-flex min-h-10 items-center gap-1.5 rounded-full px-2 text-sm font-semibold text-civic transition-colors duration-[var(--dur-fast)] hover:bg-mist/50"
      >
        <ArrowLeft className="size-4" aria-hidden="true" /> All guides
      </button>

      <header className="surface-navy rounded-[28px] bg-navy p-6 text-white">
        <span className="grid size-12 place-items-center rounded-2xl bg-amber text-navy">
          <Icon className="size-6" aria-hidden="true" />
        </span>
        <h1 className="mt-4 text-2xl font-semibold tracking-tight">{guide.title}</h1>
        <p className="mt-2 text-[15px] leading-relaxed text-mist">{guide.lede}</p>
        <div className="mt-5 flex items-center gap-3">
          <div
            role="progressbar"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={pct}
            aria-label={`${guide.title} progress`}
            className="h-2 flex-1 overflow-hidden rounded-full bg-white/15"
          >
            <div
              className="h-full origin-left rounded-full bg-amber transition-transform duration-500 ease-[var(--ease-out)]"
              style={{ transform: `scaleX(${pct / 100})` }}
            />
          </div>
          <span className="text-sm font-semibold tabular-nums">
            {done}/{needed.length}
          </span>
        </div>
        <div className="mt-5 flex flex-wrap gap-2">
          {signedIn ? (
            <Button
              type="button"
              variant="cta"
              size="md"
              disabled={allTracked}
              onClick={() => toTrack.forEach((s) => onToggleTrack(s.cardId))}
            >
              {allTracked ? (
                <>
                  <Check className="size-4" strokeWidth={3} aria-hidden="true" /> All tracked
                </>
              ) : (
                <>
                  <Target className="size-4" aria-hidden="true" /> Track {toTrack.length}{" "}
                  {toTrack.length === 1 ? "item" : "items"}
                </>
              )}
            </Button>
          ) : (
            <Button type="button" variant="cta" size="md" onClick={onSignUp}>
              Save a profile to track these
            </Button>
          )}
          {next && (
            <Button
              type="button"
              variant="onDark"
              size="md"
              onClick={() => onShowOnPath(next.cardId)}
            >
              <Map className="size-4" aria-hidden="true" /> Show on ID path
            </Button>
          )}
        </div>
      </header>

      <section aria-labelledby={`${guide.id}-steps`}>
        <h2 id={`${guide.id}-steps`} className="text-lg font-semibold tracking-tight text-navy">
          {next ? "Your steps" : "You’re all set"}
        </h2>
        <p className="mt-1.5 text-[15px] leading-relaxed text-muted-foreground">
          {next
            ? `Next up: ${CARD_BY_ID[next.cardId].name}. Tap any item for its full guide.`
            : "You have everything on this list. Keep your IDs valid and up to date."}
        </p>

        <ol className="relative mt-6 space-y-3">
          {/* the line that joins the numbered dots */}
          <span aria-hidden="true" className="absolute top-6 bottom-6 left-[27px] w-px bg-navy/10" />
          {guide.steps.map((step, index) => {
            const card = CARD_BY_ID[step.cardId];
            const have = owned.has(step.cardId);
            const isNext = next?.cardId === step.cardId;
            const ready = !have && statusOf(card, owned, context) === "available";
            const tracked = tracking.includes(step.cardId);
            return (
              <li key={step.cardId} className="relative">
                <button
                  type="button"
                  onClick={() => onOpen(step.cardId)}
                  data-card-id={step.cardId}
                  className={`group flex w-full items-start gap-4 rounded-[22px] p-3 text-left transition-[background-color,box-shadow,scale] duration-[var(--dur-base)] ease-[var(--ease-out)] active:scale-[0.99] ${
                    isNext
                      ? "bg-card shadow-[0_12px_28px_-18px_rgb(27_54_93/0.5)] ring-2 ring-amber"
                      : "hover:bg-card hover:ring-1 hover:ring-navy/[0.08]"
                  }`}
                >
                  <span
                    className={`relative z-10 grid size-8 shrink-0 place-items-center rounded-full text-sm font-semibold tabular-nums ${
                      have
                        ? "bg-amber text-navy"
                        : isNext
                          ? "bg-navy text-white"
                          : "bg-white text-navy ring-1 ring-navy/15"
                    }`}
                  >
                    {have ? <Check className="size-4" strokeWidth={3} aria-hidden="true" /> : index + 1}
                  </span>
                  <span className="min-w-0 flex-1 pt-0.5">
                    <span className="flex items-start gap-2">
                      <span className="flex-1">
                        <span className="flex items-center gap-2">
                          <CardIcon name={card.icon} className="size-4 shrink-0 text-civic" />
                          <span className={`text-[15px] font-semibold ${have ? "text-muted-foreground" : "text-navy"}`}>
                            {card.name}
                          </span>
                        </span>
                      </span>
                      <ArrowUpRight
                        className="mt-0.5 size-4 shrink-0 text-muted-foreground opacity-60 transition-[transform,opacity] duration-[var(--dur-base)] group-hover:rotate-45 group-hover:opacity-100"
                        aria-hidden="true"
                      />
                    </span>
                    <span className="mt-1.5 block text-sm leading-relaxed text-muted-foreground">
                      {step.why}
                    </span>
                    <span className="mt-2.5 flex flex-wrap gap-1.5">
                      {have ? (
                        <Pill tone="amber">You have it</Pill>
                      ) : ready ? (
                        <Pill tone="mist">Ready to apply</Pill>
                      ) : (
                        <Pill tone="muted">Still preparing</Pill>
                      )}
                      {isNext && <Pill tone="navy">Next</Pill>}
                      {step.optional && <Pill tone="muted">If asked</Pill>}
                      {tracked && !have && <Pill tone="muted">Tracking</Pill>}
                    </span>
                  </span>
                </button>
              </li>
            );
          })}
        </ol>
      </section>

      <Disclosure summary="Good to know" hint={`${guide.tips.length} tips`}>
        <ul className="list-disc space-y-2.5 pl-5 text-sm leading-relaxed text-muted-foreground">
          {guide.tips.map((tip) => (
            <li key={tip}>{tip}</li>
          ))}
        </ul>
      </Disclosure>
    </div>
  );
}
