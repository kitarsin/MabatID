"use client";

import { useRef } from "react";
import { Building2, Check, ExternalLink, Globe, Lock, Star, Target, Wallet } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { CARD_BY_ID, TIER_META, type IdCard } from "@/data/cards";
import { DETAILS, type Step } from "@/data/details";
import { DEFAULT_BUDGET, DEFAULT_SETUP, fitsBudget, fitsSetup, type Budget, type Setup } from "@/lib/prefs";
import { evaluatePrepare, stepKey, type Mode, type PrepRow } from "@/lib/prepare";
import { leadsTo, statusOf, unlockHint } from "@/lib/tree";
import { CardIcon } from "./icons";
import { Rich } from "./Rich";

export function DetailSheet({
  card,
  owned,
  signedIn,
  age,
  budget,
  setup,
  prep,
  onTogglePrep,
  tracking,
  priority,
  onToggleTrack,
  onSetPriority,
  onClose,
  onToggle,
  onJump,
  onSignUp,
}: {
  card: IdCard | null;
  owned: ReadonlySet<string>;
  signedIn: boolean;
  age: number | null;
  budget?: Budget;
  setup?: Setup;
  prep: Record<string, string[]>;
  onTogglePrep: (cardId: string, key: string) => void;
  tracking: string[];
  priority: string | null;
  onToggleTrack: (cardId: string) => void;
  onSetPriority: (cardId: string) => void;
  onClose: () => void;
  onToggle: (id: string) => void;
  onJump: (id: string) => void;
  onSignUp: () => void;
}) {
  const bodyRef = useRef<HTMLDivElement>(null); // focus lands here, not on a control mid-scroll
  const status = card ? statusOf(card, owned) : "locked";
  const hint = card ? unlockHint(card) : { all: [], any: [] };
  const d = card ? DETAILS[card.id] : null;
  const tooYoung = card && age !== null && age < card.minAge;

  // Checklist: ticks come from you AND from your profile (owned IDs, budget).
  // "Either" groups (e.g. 1 primary ID OR 2 secondary docs) are met by completing any one route.
  const ticked = new Set(card ? (prep[card.id] ?? []) : []);
  const prepState = card ? evaluatePrepare(card.id, signedIn ? owned : null, budget, ticked, signedIn && status === "owned") : null;
  const doneCount = prepState?.done ?? 0;
  const totalCount = prepState?.total ?? 0;
  const ready = prepState?.complete ?? false;
  const obtained = signedIn && status === "owned";
  // The guide only unlocks if the ID can be done the way you prefer (on-site / online).
  const setupOk = !signedIn || !d || fitsSetup(card!.id, setup ?? DEFAULT_SETUP);
  const unlocked = ready && setupOk && !obtained;
  const onlyWay = d ? (d.onsite && !d.online ? "on-site" : d.online && !d.onsite ? "online" : "") : "";

  const autoCount = prepState ? prepState.nodes.flatMap((n) => (n.kind === "row" ? [n.row] : n.routes.flatMap((r) => r.rows))).filter((r) => r.auto).length : 0;

  const modes = d ? ([d.onsite && "onsite", d.online && "online"].filter(Boolean) as ("onsite" | "online")[]) : [];
  const pref = setup ?? DEFAULT_SETUP;
  const defaultMode = pref === "online" && modes.includes("online") ? "online" : modes[0];

  return (
    <Sheet open={!!card} onOpenChange={(o) => !o && onClose()}>
      <SheetContent
        side="bottom"
        initialFocus={bodyRef}
        className="mx-auto flex max-h-[90dvh] w-full max-w-2xl flex-col gap-0 rounded-t-3xl border-0 bg-card p-0 text-card-foreground"
      >
        {card && d && (
          <>
            <SheetHeader className="gap-1 bg-navy p-5 pr-14 text-white">
              <div className="flex items-center gap-3">
                <span
                  className={`grid size-14 shrink-0 place-items-center rounded-full border-[3px] ${
                    status === "owned"
                      ? "border-amber bg-amber text-navy"
                      : status === "available"
                        ? "border-sky bg-civic text-white"
                        : "border-dashed border-mist/50 bg-navy text-mist"
                  }`}
                >
                  <CardIcon name={card.icon} className="size-7" />
                </span>
                <SheetTitle className="text-lg font-extrabold leading-snug text-white">{card.name}</SheetTitle>
              </div>
              <SheetDescription className="mt-1 text-sm font-semibold text-mist">
                {status === "owned" ? "✓ You have this" : status === "available" ? "Ready to get" : "Locked — see what unlocks it"}
              </SheetDescription>
            </SheetHeader>

            <div ref={bodyRef} tabIndex={-1} className="flex-1 space-y-6 overflow-y-auto px-5 py-5 outline-none">
              {/* 1 · About */}
              <Section n={1} title="About this ID">
                <dl className="space-y-3 text-[15px]">
                  <Info label="Purpose"><Rich text={d.purpose} /></Info>
                  <Info label="Tier level">
                    <strong className="font-extrabold text-navy">{TIER_META[card.tier].label}</strong>
                  </Info>
                  <Info label="Issued by"><strong className="font-extrabold text-navy">{d.issuedBy}</strong></Info>
                </dl>
                <div className="mt-3 flex flex-wrap gap-2">
                  {signedIn && (
                    <>
                      <Tag ok={fitsBudget(card.id, budget ?? DEFAULT_BUDGET)} icon={<Wallet className="size-3.5" />}
                        yes="Fits your budget" no="Over your budget" />
                      <Tag ok={fitsSetup(card.id, pref)} icon={d.online && pref !== "onsite" ? <Globe className="size-3.5" /> : <Building2 className="size-3.5" />}
                        yes="Matches your setup" no="Setup not available" />
                    </>
                  )}
                  {tooYoung && <Tag ok={false} yes="" no={`Usually opens at ${card.minAge}+`} />}
                </div>
              </Section>

              {/* Where this ID can take you */}
              {(() => {
                const next = leadsTo(card.id);
                if (!next.length) return null;
                const required = next.filter((n) => n.kind !== "optional");
                const extra = next.filter((n) => n.kind === "optional");
                return (
                  <div className="rounded-2xl bg-muted p-4">
                    <p className="mb-2 text-sm font-extrabold">Helps you get</p>
                    <div className="flex flex-wrap gap-2">
                      {required.map(({ card: c }) => <JumpChip key={c.id} card={c} owned={owned} onJump={onJump} />)}
                    </div>
                    {extra.length > 0 && (
                      <>
                        <p className="mb-1.5 mt-3 text-xs font-semibold text-muted-foreground">Sometimes asked for by</p>
                        <div className="flex flex-wrap gap-2">
                          {extra.map(({ card: c }) => <JumpChip key={c.id} card={c} owned={owned} onJump={onJump} />)}
                        </div>
                      </>
                    )}
                  </div>
                );
              })()}

              {status === "locked" && (hint.all.length > 0 || hint.any.length > 0) && (
                <div className="rounded-2xl border-2 border-dashed border-input p-4">
                  <p className="mb-2 flex items-center gap-1.5 text-sm font-extrabold">
                    <Lock className="size-4" aria-hidden="true" /> Unlock by getting
                  </p>
                  {hint.all.length > 0 && <Chips label="All of" ids={hint.all.map((c) => c.id)} owned={owned} onJump={onJump} />}
                  {hint.any.length > 0 && (
                    <Chips label={hint.all.length ? "Plus any one of" : "Any one of"} ids={hint.any.map((c) => c.id)} owned={owned} onJump={onJump} />
                  )}
                </div>
              )}

              {/* 2 · Requirements */}
              <Section n={2} title="Requirements">
                {obtained && (
                  <p className="mb-3 rounded-xl bg-mist px-3 py-2 text-sm font-bold text-navy" role="status">
                    ✓ You already have this ID — nothing left to prepare.
                  </p>
                )}
                <div className={`transition-opacity duration-300 ${obtained ? "opacity-50" : "opacity-100"}`}>
                <dl className="space-y-3 text-[15px]">
                  <Info label="Age"><Rich text={d.req.age} /></Info>
                  <Info label="Prepare">
                    <p className="mb-2 text-xs font-semibold text-muted-foreground" aria-live="polite">
                      Tick each one as you get it · {doneCount}/{totalCount} ready
                      {autoCount > 0 && !obtained && " · some ticked from your profile"}
                    </p>
                    <ul className="space-y-2">
                      {prepState?.nodes.map((n) =>
                        n.kind === "row" ? (
                          <li key={n.row.key}>
                            <PrepButton row={n.row} budget={n.row.key === "b"} onToggle={() => onTogglePrep(card.id, n.row.key)} />
                          </li>
                        ) : (
                          <li key={n.key} className={`rounded-2xl border-2 border-dashed p-2.5 ${n.complete ? "border-civic" : "border-input"}`}>
                            <p className="mb-2 px-1 text-xs font-extrabold uppercase tracking-wide text-civic">
                              Choose one route {n.complete && "· ✓ met"}
                            </p>
                            {n.routes.map((r, ri) => (
                              <div key={ri}>
                                {ri > 0 && <p className="my-1.5 text-center text-xs font-extrabold text-muted-foreground">— OR —</p>}
                                <p className="mb-1.5 px-1 text-sm font-bold">{r.label}{r.complete && " ✓"}</p>
                                <ul className="space-y-1.5">
                                  {r.rows.map((row) => (
                                    <li key={row.key}><PrepButton row={row} onToggle={() => onTogglePrep(card.id, row.key)} /></li>
                                  ))}
                                </ul>
                              </div>
                            ))}
                          </li>
                        ),
                      )}
                    </ul>
                  </Info>
                  <Info label="Under 18"><Rich text={d.req.minors} /></Info>
                </dl>
                </div>
              </Section>

              {/* 3 · Guide */}
              <Section n={3} title="Step-by-step guide">
                <p
                  className={`mb-3 rounded-xl px-3 py-2 text-sm font-bold ${unlocked ? "bg-mist text-navy" : "bg-muted text-navy"}`}
                  role="status"
                >
                  {obtained
                    ? "✓ Already obtained — no need to apply again."
                    : !setupOk
                      ? `Locked — this ID is ${onlyWay || "not available"} only, which doesn’t match your setup. Change it under Progress → Edit to unlock.`
                      : ready
                        ? "✓ Requirements ready — you can start applying."
                        : `Not yet advisable — finish section 2 first (${doneCount}/${totalCount}).`}
                </p>
                <div className={`transition-opacity duration-300 ${unlocked ? "opacity-100" : "opacity-40"}`}>
                <Tabs defaultValue={defaultMode} key={card.id}>
                  <TabsList className="grid h-11 w-full" style={{ gridTemplateColumns: `repeat(${modes.length}, 1fr)` }}>
                    {modes.includes("onsite") && <TabsTrigger value="onsite"><Building2 className="size-4" /> On-site</TabsTrigger>}
                    {modes.includes("online") && <TabsTrigger value="online"><Globe className="size-4" /> Online</TabsTrigger>}
                  </TabsList>
                  {modes.includes("onsite") && <TabsContent value="onsite"><Steps steps={d.steps.onsite} mode="onsite" done={ticked} enabled={unlocked} onToggle={(k) => onTogglePrep(card.id, k)} /></TabsContent>}
                  {modes.includes("online") && <TabsContent value="online"><Steps steps={d.steps.online} mode="online" done={ticked} enabled={unlocked} onToggle={(k) => onTogglePrep(card.id, k)} /></TabsContent>}
                </Tabs>
                {modes.length === 1 && (
                  <p className="mt-2 text-xs font-semibold text-muted-foreground">
                    {modes[0] === "onsite" ? "On-site only — no full online option." : "Online only — no in-person step."}
                  </p>
                )}
                </div>
              </Section>

              {/* 4 · References */}
              <Section n={4} title="References">
                <ul className="space-y-2">
                  {d.refs.map((r) =>
                    r.url ? (
                      <li key={r.label}>
                        <a
                          href={r.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center justify-between gap-2 rounded-xl bg-mist px-3 py-2.5 text-sm font-bold text-navy hover:bg-sky"
                        >
                          <span>{r.label}</span>
                          <ExternalLink className="size-4 shrink-0" aria-hidden="true" />
                          <span className="sr-only">(opens in a new tab)</span>
                        </a>
                      </li>
                    ) : (
                      <li key={r.label} className="rounded-xl bg-muted px-3 py-2.5 text-sm font-semibold text-navy">
                        {r.label}
                      </li>
                    ),
                  )}
                </ul>
              </Section>

              <p className="text-xs text-muted-foreground">Fees and local rules vary. Confirm with the issuing office.</p>
            </div>

            <div className="border-t border-border bg-card p-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
              {!signedIn ? (
                <Button onClick={onSignUp} className="h-12 w-full bg-amber text-base font-bold text-navy hover:bg-amber/85">
                  Create a free account to track this
                </Button>
              ) : status === "locked" ? (
                <Button disabled className="h-12 w-full text-base">
                  <Lock className="size-4" aria-hidden="true" /> Locked — get the prerequisites first
                </Button>
              ) : (
                <div className="space-y-2">
                  {status === "available" && (
                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        onClick={() => onToggleTrack(card.id)}
                        aria-pressed={tracking.includes(card.id)}
                        className={`h-11 flex-1 border-2 text-sm font-bold ${tracking.includes(card.id) ? "border-civic bg-mist text-navy" : "border-civic text-civic"}`}
                      >
                        <Target className="size-4" aria-hidden="true" />
                        {tracking.includes(card.id) ? "Tracking" : "Track this ID"}
                      </Button>
                      {tracking.includes(card.id) && (
                        <Button
                          variant="outline"
                          disabled={priority === card.id}
                          onClick={() => onSetPriority(card.id)}
                          className="h-11 flex-1 border-2 border-amber text-sm font-bold text-navy disabled:opacity-100 disabled:bg-amber"
                        >
                          <Star className="size-4" aria-hidden="true" fill={priority === card.id ? "currentColor" : "none"} />
                          {priority === card.id ? "Priority" : "Make priority"}
                        </Button>
                      )}
                    </div>
                  )}
                  {tracking.includes(card.id) && priority && priority !== card.id && (
                    <p className="px-1 text-xs font-semibold text-muted-foreground">
                      Only one ID can be the priority — now <strong className="text-navy">{CARD_BY_ID[priority].short}</strong>. Making this one the priority replaces it.
                    </p>
                  )}
                  <Button
                    onClick={() => onToggle(card.id)}
                    className={`h-12 w-full text-base font-bold ${status === "owned" ? "bg-muted text-navy hover:bg-mist" : "bg-amber text-navy hover:bg-amber/85"}`}
                  >
                    {status === "owned" ? "Undo — I don’t have this yet" : (<><Check className="size-5" aria-hidden="true" /> I have this ID</>)}
                  </Button>
                </div>
              )}
            </div>
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}

function Section({ n, title, children }: { n: number; title: string; children: React.ReactNode }) {
  return (
    <section>
      <h3 className="mb-3 flex items-center gap-2 text-base font-extrabold">
        <span className="grid size-6 place-items-center rounded-full bg-navy text-xs font-bold text-white">{n}</span>
        {title}
      </h3>
      {children}
    </section>
  );
}

function Info({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <dt className="text-xs font-bold uppercase tracking-wide text-civic">{label}</dt>
      <dd className="mt-0.5 leading-snug">{children}</dd>
    </div>
  );
}

function Tag({ ok, yes, no, icon }: { ok: boolean; yes: string; no: string; icon?: React.ReactNode }) {
  return (
    <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-bold ${ok ? "bg-mist text-navy" : "bg-muted text-muted-foreground"}`}>
      {icon}
      {ok ? yes : no}
    </span>
  );
}

function Steps({
  steps,
  mode,
  done,
  enabled,
  onToggle,
}: {
  steps: Step[];
  mode: Mode;
  done: ReadonlySet<string>;
  enabled: boolean;
  onToggle: (key: string) => void;
}) {
  return (
    <ol className="mt-4 space-y-3">
      {steps.map((s, i) => {
        const key = stepKey(mode, i);
        const on = done.has(key);
        return (
          <li key={i} className="flex gap-3">
            <button
              type="button"
              role="checkbox"
              aria-checked={on}
              aria-label={`Step ${i + 1}${on ? " done" : ""}`}
              disabled={!enabled}
              onClick={() => onToggle(key)}
              className={`mt-0.5 grid size-7 shrink-0 place-items-center rounded-full text-sm font-bold ${
                on ? "bg-amber text-navy" : "bg-civic text-white"
              } disabled:cursor-not-allowed`}
            >
              {on ? <Check className="size-4" strokeWidth={3} aria-hidden="true" /> : i + 1}
            </button>
            <div className={`min-w-0 pt-0.5 text-[15px] leading-snug ${on ? "text-muted-foreground" : ""}`}>
              <Rich text={s.t} />
              {s.link && (
                <a
                  href={s.link.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-1.5 flex w-fit items-center gap-1 rounded-lg bg-mist px-2.5 py-1.5 text-sm font-bold text-navy hover:bg-sky"
                >
                  {s.link.label} <ExternalLink className="size-3.5" aria-hidden="true" />
                  <span className="sr-only">(opens in a new tab)</span>
                </a>
              )}
            </div>
          </li>
        );
      })}
    </ol>
  );
}

function PrepButton({ row, budget = false, onToggle }: { row: PrepRow; budget?: boolean; onToggle: () => void }) {
  return (
    <button
      type="button"
      role="checkbox"
      aria-checked={row.checked}
      aria-disabled={row.auto}
      onClick={() => !row.auto && onToggle()}
      className={`flex w-full items-start gap-3 rounded-xl border-2 px-3 py-2.5 text-left transition-colors ${
        row.checked ? "border-civic bg-mist" : "border-border bg-card hover:bg-muted"
      } ${row.auto ? "cursor-default" : ""}`}
    >
      <span
        aria-hidden="true"
        className={`mt-0.5 grid size-5 shrink-0 place-items-center rounded-md border-2 ${
          row.checked ? "border-civic bg-civic text-white" : "border-input bg-card"
        }`}
      >
        {row.checked && <Check className="size-3.5" strokeWidth={3} />}
      </span>
      <span className="min-w-0 leading-snug">
        {budget && <Wallet className="mr-1.5 -mt-0.5 inline size-4 text-navy" aria-hidden="true" />}
        <Rich text={row.text} />
        {row.source === "profile" && <Pill>From your profile</Pill>}
        {row.opt && <Pill>Only if needed</Pill>}
      </span>
    </button>
  );
}

function Pill({ children }: { children: React.ReactNode }) {
  return <span className="ml-2 inline-block whitespace-nowrap rounded-full bg-navy px-2 py-0.5 align-middle text-[11px] font-bold text-white">{children}</span>;
}

function JumpChip({ card, owned, onJump }: { card: IdCard; owned: ReadonlySet<string>; onJump: (id: string) => void }) {
  const has = owned.has(card.id);
  return (
    <button
      type="button"
      onClick={() => onJump(card.id)}
      className={`inline-flex items-center gap-1 rounded-full px-3 py-1.5 text-sm font-semibold ${has ? "bg-amber text-navy" : "bg-white text-navy ring-1 ring-border hover:bg-mist"}`}
    >
      {has && <Check className="size-3.5" strokeWidth={3} aria-hidden="true" />}
      {card.short}
    </button>
  );
}

function Chips({ label, ids, owned, onJump }: { label: string; ids: string[]; owned: ReadonlySet<string>; onJump: (id: string) => void }) {
  return (
    <div className="mt-2">
      <p className="mb-1.5 text-xs font-semibold text-muted-foreground">{label}</p>
      <div className="flex flex-wrap gap-2">
        {ids.map((id) => {
          const has = owned.has(id);
          return (
            <button
              key={id}
              type="button"
              onClick={() => onJump(id)}
              className={`inline-flex items-center gap-1 rounded-full px-3 py-1.5 text-sm font-semibold ${has ? "bg-amber text-navy" : "bg-mist text-navy hover:bg-sky"}`}
            >
              {has && <Check className="size-3.5" strokeWidth={3} aria-hidden="true" />}
              {CARD_BY_ID[id].short}
            </button>
          );
        })}
      </div>
    </div>
  );
}
