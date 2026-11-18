"use client";

import {
  useEffect,
  useId,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";
import {
  Building2,
  Check,
  ExternalLink,
  Route,
  Globe,
  Star,
  Target,
  Wallet,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Chip } from "@/components/ui/chip";
import { Disclosure } from "@/components/ui/disclosure";
import { Input } from "@/components/ui/input";
import { Pill } from "@/components/ui/pill";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  CARD_BY_ID,
  CARD_KIND_META,
  GROUP_META,
  type IdCard,
} from "@/data/cards";
import { DETAILS, type PrepItem } from "@/data/details";
import {
  conditionFacts,
  conditionQuestion,
  conditionValue,
  type FactId,
  type ProfileFacts,
} from "@/data/facts";
import type { DocumentEvidence, DocumentEvidenceMap } from "@/lib/documents";
import { BarangayIdFields } from "./BarangayIdFields";
import {
  DEFAULT_SETUP,
  fitsBudget,
  fitsSetup,
  type Budget,
  type Setup,
} from "@/lib/prefs";
import {
  applicationMode,
  evaluateApplication,
  stepKey,
  trackProgress,
  type Mode,
  type PrepRow,
} from "@/lib/prepare";
import { leadsTo } from "@/lib/tree";
import { FactQuestions } from "./FactQuestions";
import { RenderStage } from "./RenderStage";
import { Rich } from "./Rich";
import type { PlanningView } from "@/lib/use-tree-planning";
import { AcquisitionPlan } from "./AcquisitionPlan";

export function DetailSheet({
  card,
  owned,
  signedIn,
  age,
  budget,
  setup,
  prep,
  facts,
  documents,
  onSetDocument,
  mode: savedMode,
  planning,
  tracking,
  priority,
  onToggleTrack,
  onSetPriority,
  onTogglePrep,
  onSetFact,
  onSetMode,
  onSetAge,
  onClose,
  onToggle,
  onJump,
  onSignUp,
  finalFocus,
}: {
  card: IdCard | null;
  owned: ReadonlySet<string>;
  signedIn: boolean;
  age: number | null;
  budget?: Budget;
  setup?: Setup;
  prep: Record<string, string[]>;
  facts: ProfileFacts;
  documents: DocumentEvidenceMap;
  onSetDocument: (id: string, value: DocumentEvidence) => void;
  mode?: Mode;
  planning: PlanningView;
  tracking: string[];
  priority: string | null;
  onToggleTrack: (id: string) => void;
  onSetPriority: (id: string) => void;
  onTogglePrep: (id: string, key: string) => void;
  onSetFact: (id: FactId, value: boolean | undefined) => void;
  onSetMode: (id: string, mode: Mode) => void;
  onSetAge: (age: number | null) => void;
  onClose: () => void;
  onToggle: (id: string) => void;
  onJump: (id: string) => void;
  onSignUp: () => void;
  /** Element to focus when the sheet closes (the control that opened it). Falls back to Base UI's default. */
  finalFocus?: () => HTMLElement | null;
}) {
  const wide = useWide();
  const [showPlan, setShowPlan] = useState(false);
  const bodyRef = useRef<HTMLDivElement>(null); // focus lands here, not on a control mid-scroll
  const targetId = card?.id;
  useEffect(() => {
    if (!targetId) return;
    bodyRef.current?.scrollTo({ top: 0 });
    bodyRef.current?.focus({ preventScroll: true });
  }, [targetId]);
  const context = { age, facts, documents, setup, mode: savedMode };
  const d = card ? DETAILS[card.id] : null;
  const state = card
    ? evaluateApplication(card.id, owned, prep[card.id], context)
    : null;
  const obtained = !!card && owned.has(card.id);
  const itemNoun = card?.kind === "document" ? "document" : "ID";
  const mode = card ? applicationMode(card.id, context) : "onsite";
  const modes: Mode[] = d
    ? ([d.online && "online", d.onsite && "onsite"].filter(Boolean) as Mode[])
    : [];
  const questions: FactId[] =
    state?.eligibility.checks.flatMap((c) => (c.fact ? [c.fact] : [])) ?? [];
  if (d)
    for (const entry of d.req.prepare) {
      if ("either" in entry)
        for (const route of entry.either)
          if (route.when) questions.push(...conditionFacts(route.when, age));
      const items =
        "either" in entry ? entry.either.flatMap((r) => r.items) : [entry];
      for (const item of items) {
        if (item.route && d.procedure !== "hybrid" && item.route !== mode)
          continue;
        // Case-by-case items ask their own question inline, under "Only in some cases".
        if (item.when && !item.onlyIf)
          questions.push(...conditionFacts(item.when, age));
      }
    }
  const caseItems: PrepItem[] = d
    ? d.req.prepare.filter(
        (e): e is PrepItem =>
          !("either" in e) &&
          !!e.onlyIf &&
          (!e.route || d.procedure === "hybrid" || e.route === mode),
      )
    : [];
  const ready = !!state?.ready;
  const tracked = signedIn && !!card && !obtained && tracking.includes(card.id);
  const next = card ? leadsTo(card.id) : [];

  return (
    <Sheet open={!!card} onOpenChange={(open) => !open && onClose()}>
      <SheetContent
        side={wide ? "panel" : "bottom"}
        initialFocus={bodyRef}
        finalFocus={finalFocus}
        overlayClassName={wide ? "bg-navy/10" : undefined}
        closeClassName="top-5 right-5 rounded-full bg-white/75 text-navy shadow-sm ring-1 ring-navy/10 backdrop-blur-md hover:bg-white hover:text-navy"
        className="mx-auto flex max-h-[92dvh] w-full max-w-2xl flex-col gap-0 overflow-hidden rounded-t-[28px] border-0 bg-card p-0 text-card-foreground shadow-[0_-12px_40px_-12px_color-mix(in_srgb,var(--color-navy)_30%,transparent)] data-[side=panel]:shadow-[0_24px_60px_-20px_color-mix(in_srgb,var(--color-navy)_45%,transparent)] data-[side=panel]:ring-1 data-[side=panel]:ring-navy/5"
      >
        {card && d && state && (
          <>
            <div
              ref={bodyRef}
              tabIndex={-1}
              className="flex-1 overflow-y-auto overscroll-contain outline-none"
            >
              <SheetHeader className="gap-0 p-3 pb-0">
                <RenderStage id={card.id} name={card.name} icon={card.icon} />
                <div className="space-y-3 px-2 pt-5">
                  <p className="text-xs font-semibold tracking-[0.08em] text-civic uppercase">
                    {card.kind === "document" ? "Document" : "ID card"} ·{" "}
                    {GROUP_META[card.group].label}
                  </p>
                  <SheetTitle className="text-[22px] leading-tight font-semibold tracking-tight text-navy">
                    {card.name}
                  </SheetTitle>
                  <div>
                    {obtained ? (
                      <Pill tone="amber">
                        <Check
                          className="size-3.5"
                          strokeWidth={3}
                          aria-hidden="true"
                        />{" "}
                        You have this {itemNoun}
                      </Pill>
                    ) : ready ? (
                      <Pill
                        tone="mist"
                        className="whitespace-normal leading-snug"
                      >
                        You have what you need
                      </Pill>
                    ) : (
                      <Pill
                        tone="muted"
                        className="whitespace-normal leading-snug"
                      >
                        Still preparing
                      </Pill>
                    )}
                  </div>
                  {/* The purpose is the lede: one plain sentence under the title. */}
                  <SheetDescription className="text-sm leading-relaxed text-muted-foreground">
                    {d.purpose.replace(/\*\*/g, "")}
                  </SheetDescription>
                </div>
              </SheetHeader>

              <div className="space-y-10 px-5 pt-6 pb-10">
                {/* While an ID is tracked, its plan is already in motion: show progress instead of the planner. */}
                {tracked ? (
                  <TrackedBanner
                    progress={trackProgress(
                      card.id,
                      owned,
                      prep[card.id] ?? [],
                      context,
                    )}
                    noun={itemNoun}
                  />
                ) : (
                  <section aria-label="How to get it" className="space-y-3">
                    {/* Off by default to save space; the choice is kept while the app is open. */}
                    <button
                      type="button"
                      role="switch"
                      aria-checked={showPlan}
                      onClick={() => setShowPlan((v) => !v)}
                      className="flex min-h-16 w-full items-center gap-3 rounded-[20px] bg-mist/35 px-4 py-3 text-left ring-1 ring-sky/25 transition-colors duration-[var(--dur-fast)] hover:bg-mist/50"
                    >
                      <Route
                        className="size-5 shrink-0 text-civic"
                        aria-hidden="true"
                      />
                      <span className="min-w-0 flex-1">
                        <span className="block text-[15px] font-semibold text-navy">
                          How to get it
                        </span>
                        <span className="block text-sm text-muted-foreground">
                          The quickest route from what you already have
                        </span>
                      </span>
                      <span
                        aria-hidden="true"
                        className={`relative h-7 w-12 shrink-0 rounded-full transition-colors duration-[var(--dur-base)] ease-[var(--ease-out)] ${showPlan ? "bg-civic" : "bg-navy/15"}`}
                      >
                        <span
                          className={`absolute top-1 left-1 size-5 rounded-full bg-white shadow-sm transition-transform duration-[var(--dur-base)] ease-[var(--ease-out)] ${showPlan ? "translate-x-5" : ""}`}
                        />
                      </span>
                    </button>
                    {showPlan && (
                      <div className="disclosure-in">
                        <AcquisitionPlan
                          key={card.id}
                          showHeading={false}
                          starter={
                            card.group === "foundation" ||
                            card.group === "supporting"
                              ? { id: card.id, noun: itemNoun }
                              : undefined
                          }
                          facts={facts}
                          view={planning}
                          signedIn={signedIn}
                          onOpen={onJump}
                          onSetFact={onSetFact}
                          onFollow={(plan) => {
                            for (const step of plan.steps)
                              onSetMode(
                                step.id,
                                step.mode === "hybrid" ? "online" : step.mode,
                              );
                            if (plan.steps[0]) onJump(plan.steps[0].id);
                          }}
                        />
                      </div>
                    )}
                  </section>
                )}

                {card.id === "barangay-id" && obtained && signedIn && (
                  <BarangayIdFields
                    prefix="detail-barangay"
                    value={documents[card.id] ?? {}}
                    onChange={(value) => onSetDocument(card.id, value)}
                  />
                )}

                {/* Eligibility comes before the checklist: its answers decide which rows apply. */}
                <Section
                  title="Can I apply?"
                  lede={
                    obtained
                      ? `You already have this ${itemNoun}.`
                      : state.eligibility.status === "eligible"
                        ? "Yes, based on your answers. The office makes the final call."
                        : state.eligibility.status === "ineligible"
                          ? "Not yet — some conditions aren’t met. You can still keep it as a goal."
                          : "Maybe. Answer the questions below to find out."
                  }
                  ledeRole="status"
                >
                  <div className="space-y-5">
                    {!signedIn ? (
                      <div className="max-w-48 space-y-1.5">
                        <label
                          htmlFor="preview-age"
                          className="text-sm font-semibold"
                        >
                          Your age
                        </label>
                        <Input
                          id="preview-age"
                          type="number"
                          inputMode="numeric"
                          min={0}
                          max={120}
                          value={age ?? ""}
                          onChange={(e) => {
                            const n = Number(e.target.value);
                            onSetAge(
                              e.target.value !== "" &&
                                Number.isInteger(n) &&
                                n >= 0 &&
                                n <= 120
                                ? n
                                : null,
                            );
                          }}
                        />
                      </div>
                    ) : (
                      <p className="text-sm text-muted-foreground">
                        Your age: <strong className="text-navy">{age}</strong>.
                        Change it in Settings.
                      </p>
                    )}
                    {!obtained && questions.length > 0 && (
                      <FactQuestions
                        ids={questions}
                        facts={facts}
                        onChange={onSetFact}
                      />
                    )}
                    <Disclosure variant="inline" summary="Age rules">
                      <p className="text-sm leading-relaxed text-muted-foreground">
                        <Rich text={d.req.age} />
                      </p>
                    </Disclosure>
                  </div>
                </Section>

                <Section
                  title="What you need"
                  lede={
                    obtained
                      ? "You already have this. Nothing else to gather."
                      : `${state.prep.done} of ${state.prep.total} ready. Tick items as you get them.`
                  }
                  ledeLive
                >
                  <ul className="space-y-2.5">
                    {state.prep.nodes
                      .filter((node) => node.kind !== "row" || !node.row.onlyIf)
                      .map((node) =>
                        node.kind === "row" ? (
                          <li key={node.row.key}>
                            <PrepButton
                              row={node.row}
                              onToggle={() =>
                                onTogglePrep(card.id, node.row.key)
                              }
                            />
                          </li>
                        ) : (
                          <li
                            key={node.key}
                            className={`rounded-[20px] border-2 border-dashed p-3 ${node.complete ? "border-civic" : "border-locked-line/60"}`}
                          >
                            <p className="mb-2.5 flex items-center gap-1 px-1 text-[13px] font-semibold text-civic">
                              Pick one option and complete it
                              {node.complete && (
                                <>
                                  <span aria-hidden="true">·</span>
                                  <Check
                                    className="size-3.5"
                                    strokeWidth={3}
                                    aria-hidden="true"
                                  />{" "}
                                  done
                                </>
                              )}
                            </p>
                            {node.routes.map((route, index) => (
                              <div key={route.id}>
                                {index > 0 && (
                                  <div
                                    role="separator"
                                    className="my-3 flex items-center gap-2 text-xs font-semibold text-muted-foreground"
                                  >
                                    <span className="h-px flex-1 bg-border" />
                                    or
                                    <span className="h-px flex-1 bg-border" />
                                  </div>
                                )}
                                <p className="mb-2 flex items-center gap-1 px-1 text-sm font-semibold">
                                  {route.label}
                                  {route.complete && (
                                    <>
                                      <Check
                                        className="size-4 text-civic"
                                        strokeWidth={3}
                                        aria-hidden="true"
                                      />
                                      <span className="sr-only">(done)</span>
                                    </>
                                  )}
                                </p>
                                <ul className="space-y-2">
                                  {route.rows.map((row) => (
                                    <li key={row.key}>
                                      <PrepButton
                                        row={row}
                                        onToggle={() =>
                                          onTogglePrep(card.id, row.key)
                                        }
                                      />
                                    </li>
                                  ))}
                                </ul>
                              </div>
                            ))}
                          </li>
                        ),
                      )}
                  </ul>
                  {caseItems.length > 0 && (
                    <div className="mt-8">
                      <h4 className="text-[15px] font-semibold text-navy">
                        Only in some cases
                      </h4>
                      <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
                        Most people don’t need these. Each one says when it
                        applies.
                      </p>
                      <ul className="mt-4 space-y-2.5">
                        {caseItems.map((item) => (
                          <li key={item.id}>
                            <CaseItem
                              item={item}
                              value={
                                item.when
                                  ? conditionValue(item.when, facts, age)
                                  : true
                              }
                              question={
                                item.when
                                  ? conditionQuestion(item.when)
                                  : undefined
                              }
                              row={state.prep.nodes.find(
                                (n) =>
                                  n.kind === "row" && n.row.key === item.id,
                              )}
                              obtained={obtained}
                              onSetFact={onSetFact}
                              onToggle={() => onTogglePrep(card.id, item.id)}
                            />
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                  <div className="mt-4 space-y-1">
                    <Disclosure variant="inline" summary="If you’re under 18">
                      <p className="text-sm leading-relaxed text-muted-foreground">
                        <Rich text={d.req.minors} />
                      </p>
                    </Disclosure>
                    <p className="text-xs leading-relaxed text-muted-foreground">
                      Ticks are your own notes. The office checks if your
                      documents are valid.
                    </p>
                  </div>
                </Section>

                <Section
                  title="How to apply"
                  lede={
                    obtained
                      ? "You already have it — no need to apply again."
                      : d.procedure === "hybrid"
                        ? "Start online, then finish in person."
                        : modes.length > 1
                          ? "Choose online or in person, then follow the steps."
                          : "Follow these steps in order."
                  }
                >
                  {!fitsSetup(card.id, setup ?? DEFAULT_SETUP) && (
                    <p className="mb-4 rounded-2xl bg-amber/15 px-4 py-3 text-sm text-navy">
                      This works differently from how you prefer to apply. You
                      can still follow it.
                    </p>
                  )}
                  <Tabs
                    key={card.id}
                    value={d.procedure === "alternative" ? mode : undefined}
                    defaultValue={d.procedure === "hybrid" ? "online" : mode}
                    onValueChange={(value) => {
                      if (d.procedure === "alternative")
                        onSetMode(card.id, value as Mode);
                    }}
                  >
                    {modes.length > 1 && (
                      <TabsList
                        className="grid w-full"
                        style={{
                          gridTemplateColumns: `repeat(${modes.length}, 1fr)`,
                        }}
                      >
                        {modes.map((m) => (
                          <TabsTrigger key={m} value={m}>
                            {m === "onsite" ? (
                              <Building2
                                className="size-4"
                                aria-hidden="true"
                              />
                            ) : (
                              <Globe className="size-4" aria-hidden="true" />
                            )}
                            {d.procedure === "hybrid"
                              ? m === "online"
                                ? "1 · Online"
                                : "2 · In person"
                              : m === "online" && d.onlineRequiresVisit
                                ? "Online + visit"
                                : m === "online"
                                  ? "Online"
                                  : "In person"}
                          </TabsTrigger>
                        ))}
                      </TabsList>
                    )}
                    {modes.map((m) => (
                      <TabsContent key={m} value={m}>
                        <Steps
                          steps={state.steps.filter((s) => s.mode === m)}
                          onToggle={(key) => onTogglePrep(card.id, key)}
                          obtained={obtained}
                        />
                      </TabsContent>
                    ))}
                  </Tabs>
                  <Disclosure
                    variant="inline"
                    summary="Which steps can I do early?"
                    className="mt-4"
                  >
                    <p className="text-sm leading-relaxed text-muted-foreground">
                      You can book and prepare before your checklist is
                      complete. Submitting needs the full checklist, and each
                      later step needs the one before it.
                    </p>
                  </Disclosure>
                </Section>

                {next.length > 0 && (
                  <Section
                    title="This also helps you get"
                    lede="You can use it as a requirement for these. Each may ask for more."
                  >
                    <div className="flex flex-wrap gap-2">
                      {next.map(({ card: c }) => (
                        <JumpChip
                          key={c.id}
                          card={c}
                          owned={owned}
                          onJump={onJump}
                        />
                      ))}
                    </div>
                  </Section>
                )}

                <Section title="Quick facts">
                  <dl className="grid grid-cols-1 gap-x-6 gap-y-5 text-[15px] sm:grid-cols-2">
                    <Info label="Issued by">{d.issuedBy}</Info>
                    <Info label="Type">
                      {CARD_KIND_META[card.kind].singular}
                    </Info>
                    {d.processingTime && (
                      <Info label="How long it takes">{d.processingTime}</Info>
                    )}
                    {d.validity && <Info label="Valid for">{d.validity}</Info>}
                  </dl>
                  {signedIn && (
                    <div className="mt-5 flex flex-wrap gap-2">
                      <FitTag
                        ok={fitsBudget(card.id, budget, mode, facts)}
                        icon={
                          <Wallet className="size-3.5" aria-hidden="true" />
                        }
                        yes="Fits your budget"
                        no="May be over budget"
                      />
                      <FitTag
                        ok={fitsSetup(card.id, setup ?? DEFAULT_SETUP)}
                        icon={
                          d.onlineRequiresVisit ? (
                            <Building2
                              className="size-3.5"
                              aria-hidden="true"
                            />
                          ) : (
                            <Globe className="size-3.5" aria-hidden="true" />
                          )
                        }
                        yes="Matches how you apply"
                        no="Different way to apply"
                      />
                    </div>
                  )}
                  {d.onlineRequiresVisit && (
                    <p className="mt-5 text-sm leading-relaxed">
                      {d.channelNote ??
                        "You’ll need to visit in person, even if you start online."}
                    </p>
                  )}
                </Section>

                <div className="space-y-3">
                  <Disclosure
                    summary={`About its group`}
                    hint={GROUP_META[card.group].label}
                  >
                    <div className="space-y-4 text-sm leading-relaxed text-muted-foreground">
                      <p>{GROUP_META[card.group].blurb}</p>
                      <p>
                        <strong className="text-navy">Why it’s here: </strong>
                        {card.groupReason}
                      </p>
                      <p>{GROUP_META[card.group].significance}</p>
                    </div>
                  </Disclosure>
                  {d.acceptance && (
                    <Disclosure
                      summary={`Where you can use it`}
                      hint={`${d.acceptance.accepted.length} places · ${d.acceptance.limits.length} limits`}
                    >
                      <ul className="list-disc space-y-2 pl-5 text-sm leading-relaxed">
                        {d.acceptance.accepted.map((text) => (
                          <li key={text}>{text}</li>
                        ))}
                      </ul>
                      <p className="mt-5 text-sm font-semibold">Limits</p>
                      <ul className="mt-2 list-disc space-y-2 pl-5 text-sm leading-relaxed text-muted-foreground">
                        {d.acceptance.limits.map((text) => (
                          <li key={text}>{text}</li>
                        ))}
                      </ul>
                    </Disclosure>
                  )}
                  {d.localNotes && (
                    <Disclosure
                      summary="Local fees and rules"
                      hint="Can differ by city or barangay"
                    >
                      <ul className="list-disc space-y-2 pl-5 text-sm leading-relaxed">
                        {d.localNotes.map((text) => (
                          <li key={text}>{text}</li>
                        ))}
                      </ul>
                    </Disclosure>
                  )}
                  <Disclosure
                    summary="Official sources"
                    hint={`${d.refs.length} link${d.refs.length === 1 ? "" : "s"}`}
                  >
                    <ul className="space-y-2">
                      {d.refs.map((ref) => (
                        <li key={ref.label}>
                          {ref.url ? (
                            <a
                              href={ref.url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="flex min-h-11 items-center justify-between gap-2 rounded-2xl bg-white px-4 py-3 text-sm font-semibold text-navy ring-1 ring-navy/8 transition-colors duration-[var(--dur-fast)] hover:bg-mist/50"
                            >
                              <span>{ref.label}</span>
                              <ExternalLink
                                className="size-4 shrink-0"
                                aria-hidden="true"
                              />
                              <span className="sr-only">
                                (opens in a new tab)
                              </span>
                            </a>
                          ) : (
                            <p className="rounded-2xl bg-white px-4 py-3 text-sm font-semibold text-navy ring-1 ring-navy/8">
                              {ref.label}
                            </p>
                          )}
                        </li>
                      ))}
                    </ul>
                  </Disclosure>
                </div>

                <p className="text-xs leading-relaxed text-muted-foreground">
                  Fees and rules can change. Always confirm with the office
                  before you go.
                </p>
              </div>
            </div>

            <div className="border-t border-border/70 bg-card/90 p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] backdrop-blur-md">
              {!signedIn ? (
                <Button
                  onClick={onSignUp}
                  variant="cta"
                  size="lg"
                  className="w-full"
                >
                  Save a profile to track this {itemNoun}
                </Button>
              ) : (
                <div className="space-y-2">
                  {!obtained && (
                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        size="md"
                        aria-pressed={tracking.includes(card.id)}
                        onClick={() => onToggleTrack(card.id)}
                        className={`flex-1 border-2 ${tracking.includes(card.id) ? "border-civic bg-mist text-navy" : "border-civic text-civic"}`}
                      >
                        <Target className="size-4" aria-hidden="true" />
                        {tracking.includes(card.id)
                          ? "Tracking · tap to stop"
                          : `Track this ${itemNoun}`}
                      </Button>
                      {tracking.includes(card.id) && (
                        <Button
                          variant="outline"
                          size="md"
                          aria-pressed={priority === card.id}
                          onClick={() => {
                            if (priority !== card.id) onSetPriority(card.id);
                          }}
                          className="flex-1 border-2 border-amber text-navy aria-pressed:bg-amber"
                        >
                          <Star
                            className="size-4"
                            aria-hidden="true"
                            fill={
                              priority === card.id ? "currentColor" : "none"
                            }
                          />
                          {priority === card.id ? "Priority" : "Make priority"}
                        </Button>
                      )}
                    </div>
                  )}
                  {tracking.includes(card.id) &&
                    priority &&
                    priority !== card.id &&
                    CARD_BY_ID[priority] && (
                      <p className="px-1 text-xs font-semibold text-muted-foreground">
                        Your priority now is{" "}
                        <strong className="text-navy">
                          {CARD_BY_ID[priority].short}
                        </strong>
                        . This would replace it.
                      </p>
                    )}
                  <Button
                    onClick={() => onToggle(card.id)}
                    variant={obtained ? "outline" : "cta"}
                    size="lg"
                    className="w-full"
                  >
                    {obtained ? (
                      `I don’t have this ${itemNoun}`
                    ) : (
                      <>
                        <Check className="size-5" aria-hidden="true" /> I have
                        this {itemNoun}
                      </>
                    )}
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

function Section({
  title,
  lede,
  ledeRole,
  ledeLive,
  children,
}: {
  title: string;
  /** One short sentence that answers the section's question. */
  lede?: React.ReactNode;
  ledeRole?: "status";
  ledeLive?: boolean;
  children: React.ReactNode;
}) {
  return (
    <section>
      <h3 className="text-lg font-semibold tracking-tight text-navy">
        {title}
      </h3>
      {lede && (
        <p
          role={ledeRole}
          aria-live={ledeLive ? "polite" : undefined}
          className="mt-1.5 text-[15px] leading-relaxed text-muted-foreground"
        >
          {lede}
        </p>
      )}
      <div className="mt-5">{children}</div>
    </section>
  );
}

/** Shown instead of the planner while the ID is tracked: the plan is already under way. */
function TrackedBanner({
  progress,
  noun,
}: {
  progress: ReturnType<typeof trackProgress>;
  noun: string;
}) {
  return (
    <section
      aria-label="Your progress"
      className="rounded-[24px] bg-navy p-5 text-white surface-navy"
    >
      <div className="flex items-center gap-3">
        <span className="grid size-10 shrink-0 place-items-center rounded-full bg-amber text-navy">
          <Target className="size-5" aria-hidden="true" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="font-semibold">You’re working on this {noun}</p>
          <p className="text-sm text-mist">{progress.stage}</p>
        </div>
        <span className="text-xl font-semibold tabular-nums">
          {progress.pct}%
        </span>
      </div>
      <div
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={progress.pct}
        aria-label="Progress"
        className="mt-4 h-2 overflow-hidden rounded-full bg-white/15"
      >
        <div
          className="h-full origin-left rounded-full bg-amber transition-transform duration-300 ease-[var(--ease-out)]"
          style={{ transform: `scaleX(${progress.pct / 100})` }}
        />
      </div>
      <p className="mt-4 text-sm leading-relaxed text-mist">
        Use the checklist and steps below. To see route options again, stop
        tracking.
      </p>
    </section>
  );
}

function Info({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <dt className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">
        {label}
      </dt>
      <dd className="mt-1 leading-snug text-navy">{children}</dd>
    </div>
  );
}

function FitTag({
  ok,
  yes,
  no,
  icon,
}: {
  ok: boolean;
  yes: string;
  no: string;
  icon?: React.ReactNode;
}) {
  return (
    <Pill tone={ok ? "mist" : "muted"} className="px-2.5">
      {icon}
      {ok ? yes : no}
    </Pill>
  );
}

function Steps({
  steps,
  onToggle,
  obtained,
}: {
  steps: ReturnType<typeof evaluateApplication>["steps"];
  onToggle: (key: string) => void;
  obtained: boolean;
}) {
  const uid = useId();
  return (
    <ol className="mt-5 space-y-4">
      {steps.map(({ step, checked, enabled, reason }, index) => {
        const interactive = !obtained && (checked || enabled);
        const textId = `${uid}-${step.id}`;
        return (
          <li key={step.id} className="flex gap-3">
            {/* 28px disc with a 44px hit area (before: pseudo); the real checkbox is visually hidden. */}
            <label
              className={`focus-ring-within relative mt-0.5 grid size-7 shrink-0 place-items-center rounded-full text-sm font-bold transition-colors duration-[var(--dur-fast)] before:absolute before:-inset-2 before:content-[''] ${
                checked
                  ? "bg-amber text-navy"
                  : interactive
                    ? "bg-civic text-white"
                    : "bg-locked text-white"
              } ${interactive ? "cursor-pointer" : "cursor-not-allowed"}`}
            >
              <input
                type="checkbox"
                className="sr-only"
                checked={checked}
                disabled={!interactive}
                aria-labelledby={textId}
                onChange={() => onToggle(stepKey(step))}
              />
              {checked ? (
                <Check className="size-4" strokeWidth={3} aria-hidden="true" />
              ) : (
                index + 1
              )}
            </label>
            <div
              className={`min-w-0 pt-0.5 text-[15px] leading-relaxed ${checked ? "text-muted-foreground" : ""}`}
            >
              <span id={textId}>
                <Rich text={step.t} />
              </span>
              {!checked && reason && (
                <p className="mt-1 text-xs text-muted-foreground">{reason}</p>
              )}
              {step.link && (
                <a
                  href={step.link.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-1.5 flex min-h-11 w-fit items-center gap-1 rounded-lg bg-mist px-2.5 py-1.5 text-sm font-bold text-navy transition-colors duration-[var(--dur-fast)] hover:bg-sky"
                >
                  {step.link.label}
                  <ExternalLink className="size-3.5" aria-hidden="true" />
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

function PrepButton({ row, onToggle }: { row: PrepRow; onToggle: () => void }) {
  // Rows ticked from your documents/steps, awaiting an answer, or blocked stay focusable but can't be changed here.
  const fixed = row.auto || row.unknown || !!row.blocked;
  return (
    <label
      className={`focus-ring-within flex min-h-12 w-full items-start gap-3 rounded-2xl border px-4 py-3 text-left transition-[background-color,border-color,scale] duration-[var(--dur-fast)] ease-[var(--ease-out)] active:scale-[0.985] active:duration-[var(--dur-press)] ${
        row.checked
          ? "border-civic/40 bg-mist/50"
          : "border-navy/10 bg-card hover:bg-navy/[0.03]"
      } ${fixed ? "cursor-default" : "cursor-pointer"}`}
    >
      <input
        type="checkbox"
        className="sr-only"
        checked={row.checked}
        aria-disabled={fixed || undefined}
        onChange={() => {
          if (!fixed) onToggle();
        }}
      />
      <span
        aria-hidden="true"
        className={`mt-0.5 grid size-5 shrink-0 place-items-center rounded-md border-2 ${
          row.checked
            ? "border-civic bg-civic text-white"
            : "border-input bg-card"
        }`}
      >
        {row.checked && <Check className="size-3.5" strokeWidth={3} />}
      </span>
      <span className="min-w-0 text-sm leading-relaxed">
        <Rich text={row.text} />
        {row.source === "profile" && (
          <Pill tone="navy" className="ml-2 align-middle">
            You have this
          </Pill>
        )}
        {row.source === "step" && (
          <Pill tone="navy" className="ml-2 align-middle">
            Done in a step
          </Pill>
        )}
        {row.opt && (
          <Pill tone="muted" className="ml-2 align-middle">
            Optional
          </Pill>
        )}
        {row.unknown && (
          <span className="mt-1 block text-xs font-semibold">
            Answer the questions above to see if you need this.
          </span>
        )}
        {row.note && (
          <span className="mt-1 block text-xs font-semibold">{row.note}</span>
        )}
      </span>
    </label>
  );
}

/** A case-by-case requirement: says when it applies and asks, inline, whether it applies to you. */
function CaseItem({
  item,
  value,
  question,
  row,
  obtained,
  onSetFact,
  onToggle,
}: {
  item: PrepItem;
  value: boolean | undefined;
  /** Which fact to set, and the answer that means "this applies to me". */
  question?: { fact: FactId; applies: boolean };
  row?: ReturnType<typeof evaluateApplication>["prep"]["nodes"][number];
  obtained: boolean;
  onSetFact: (id: FactId, value: boolean | undefined) => void;
  onToggle: () => void;
}) {
  const tag = (
    <Pill tone="muted" className="mb-2">
      {item.onlyIf}
    </Pill>
  );
  if (value === false)
    return (
      <div className="flex items-center gap-2 rounded-2xl px-4 py-2.5 text-sm text-muted-foreground ring-1 ring-navy/[0.06]">
        <span className="min-w-0 flex-1">
          <Rich text={item.t.replace(/\*\*/g, "")} /> — not needed for you
        </span>
        {question && (
          <button
            type="button"
            onClick={() => onSetFact(question.fact, undefined)}
            className="min-h-10 shrink-0 rounded-full px-3 font-semibold text-civic hover:bg-mist/50"
          >
            Change
          </button>
        )}
      </div>
    );
  if (value === undefined && !obtained)
    return (
      <div className="rounded-2xl border border-dashed border-navy/15 p-4">
        {tag}
        <p className="text-sm leading-relaxed text-navy">
          <Rich text={item.t} />
        </p>
        {question ? (
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <span className="text-sm text-muted-foreground">
              Does this apply to you?
            </span>
            <Chip
              onClick={() => onSetFact(question.fact, question.applies)}
              className="min-h-10"
            >
              Yes
            </Chip>
            <Chip
              onClick={() => onSetFact(question.fact, !question.applies)}
              className="min-h-10"
            >
              No
            </Chip>
          </div>
        ) : (
          <p className="mt-2 text-xs text-muted-foreground">
            Enter your age above to check.
          </p>
        )}
      </div>
    );
  return (
    <div>
      {tag}
      {row?.kind === "row" && <PrepButton row={row.row} onToggle={onToggle} />}
      {question && !obtained && (
        <button
          type="button"
          onClick={() => onSetFact(question.fact, !question.applies)}
          className="mt-1 min-h-10 rounded-full px-2 text-xs font-semibold text-civic hover:bg-mist/50"
        >
          This doesn’t apply to me
        </button>
      )}
    </div>
  );
}

function JumpChip({
  card,
  owned,
  onJump,
}: {
  card: IdCard;
  owned: ReadonlySet<string>;
  onJump: (id: string) => void;
}) {
  const has = owned.has(card.id);
  return (
    <Chip tone={has ? "have" : "outline"} onClick={() => onJump(card.id)}>
      {has && <Check className="size-3.5" strokeWidth={3} aria-hidden="true" />}
      {card.short}
    </Chip>
  );
}

const WIDE = "(min-width: 768px)";
/** From 768px the detail opens as a floating side panel, so the lit skill-tree route stays visible. */
function useWide() {
  return useSyncExternalStore(
    (cb) => {
      const mq = window.matchMedia(WIDE);
      mq.addEventListener("change", cb);
      return () => mq.removeEventListener("change", cb);
    },
    () => window.matchMedia(WIDE).matches,
    () => false,
  );
}
