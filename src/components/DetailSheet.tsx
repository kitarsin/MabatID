"use client";

import { useEffect, useRef } from "react";
import {
  Building2,
  Check,
  ExternalLink,
  Globe,
  Star,
  Target,
  Wallet,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
  TIER_META,
  type IdCard,
} from "@/data/cards";
import { DETAILS } from "@/data/details";
import { conditionFacts, type FactId, type ProfileFacts } from "@/data/facts";
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
  type Mode,
  type PrepRow,
} from "@/lib/prepare";
import { leadsTo } from "@/lib/tree";
import { FactQuestions } from "./FactQuestions";
import { CardIcon } from "./icons";
import { Rich } from "./Rich";
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
  modes: savedModes,
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
  modes: Record<string, Mode>;
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
}) {
  const bodyRef = useRef<HTMLDivElement>(null);
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
      const items =
        "either" in entry ? entry.either.flatMap((r) => r.items) : [entry];
      for (const item of items) {
        if (item.route && d.procedure !== "hybrid" && item.route !== mode)
          continue;
        if (item.when) questions.push(...conditionFacts(item.when, age));
      }
    }
  const status = obtained
    ? `✓ You have this ${itemNoun}`
    : state?.ready
      ? "Requirements ready — confirm acceptance with the issuing office"
      : "Needs preparation — you can still choose this as your goal";
  return (
    <Sheet open={!!card} onOpenChange={(open) => !open && onClose()}>
      <SheetContent
        side="bottom"
        initialFocus={bodyRef}
        className="[&_[data-slot=sheet-close]]:text-white mx-auto flex max-h-[90dvh] w-full max-w-2xl flex-col gap-0 rounded-t-3xl border-0 bg-card p-0 text-card-foreground"
      >
        {card && d && state && (
          <>
            <SheetHeader className="gap-1 bg-navy p-5 pr-14 text-white">
              <div className="flex items-center gap-3">
                <span
                  className={`grid size-14 shrink-0 place-items-center rounded-full border-[3px] ${obtained ? "border-amber bg-amber text-navy" : "border-sky bg-civic text-white"}`}
                >
                  <CardIcon name={card.icon} className="size-7" />
                </span>
                <SheetTitle className="text-lg font-extrabold leading-snug text-white">
                  {card.name}
                </SheetTitle>
              </div>
              <SheetDescription className="mt-1 text-sm font-semibold text-mist">
                {status}
              </SheetDescription>
            </SheetHeader>
            <div
              ref={bodyRef}
              tabIndex={-1}
              className="flex-1 space-y-6 overflow-y-auto px-5 py-5 outline-none"
            >
              <Section n={1} title="About this ID">
                <dl className="space-y-3 text-[15px]">
                  <Info label="Purpose">
                    <Rich text={d.purpose} />
                  </Info>
                  <Info label="Tier">{TIER_META[card.tier].label}</Info>
                  <Info label="Type">{CARD_KIND_META[card.kind].singular}</Info>
                  <Info label="Issued by">{d.issuedBy}</Info>
                  {d.processingTime && (
                    <Info label="Processing time">{d.processingTime}</Info>
                  )}
                  {d.validity && <Info label="Validity">{d.validity}</Info>}
                </dl>
                {signedIn && (
                  <div className="mt-3 flex flex-wrap gap-2">
                    <Tag>
                      <Wallet className="size-3.5" />
                      {fitsBudget(card.id, budget, mode, facts)
                        ? "Modeled fees fit budget"
                        : "Fee estimate may exceed budget"}
                    </Tag>
                    <Tag>
                      {d.onlineRequiresVisit ? (
                        <Building2 className="size-3.5" />
                      ) : (
                        <Globe className="size-3.5" />
                      )}
                      {fitsSetup(card.id, setup ?? DEFAULT_SETUP)
                        ? "Matches application preference"
                        : "Different setup required"}
                    </Tag>
                  </div>
                )}
                {d.onlineRequiresVisit && (
                  <p className="mt-3 text-sm font-semibold">
                    {d.channelNote ??
                      "An in-person visit is required, including when you begin online."}
                  </p>
                )}
              </Section>
              <AcquisitionPlan
                key={card.id}
                targetId={card.id}
                owned={owned}
                age={age}
                facts={facts}
                documents={documents}
                prep={prep}
                modes={savedModes}
                budget={budget}
                setup={setup}
                signedIn={signedIn}
                onOpen={onJump}
                onSetFact={onSetFact}
                onFollow={(plan) => {
                  for (const step of plan.steps)
                    onSetMode(step.id, step.mode === "hybrid" ? "online" : step.mode);
                  if (signedIn && !obtained && !tracking.includes(card.id))
                    onToggleTrack(card.id);
                  if (plan.steps[0]) onJump(plan.steps[0].id);
                }}
              />
              {d.acceptance && (
                <details className="rounded-2xl bg-muted p-4">
                  <summary className="cursor-pointer text-sm font-extrabold">
                    Where you can use this ID
                  </summary>
                  <ul className="mt-3 list-disc space-y-2 pl-5 text-sm">
                    {d.acceptance.accepted.map((text) => (
                      <li key={text}>{text}</li>
                    ))}
                  </ul>
                  <p className="mt-3 text-sm font-bold">Acceptance limits</p>
                  <ul className="mt-2 list-disc space-y-2 pl-5 text-sm">
                    {d.acceptance.limits.map((text) => (
                      <li key={text}>{text}</li>
                    ))}
                  </ul>
                </details>
              )}
              {d.localNotes && (
                <details className="rounded-2xl bg-muted p-4">
                  <summary className="cursor-pointer text-sm font-extrabold">
                    Local fees, waivers and residency rules
                  </summary>
                  <ul className="mt-3 list-disc space-y-2 pl-5 text-sm">
                    {d.localNotes.map((text) => (
                      <li key={text}>{text}</li>
                    ))}
                  </ul>
                </details>
              )}
              {card.id === "barangay-id" && obtained && signedIn && (
                <BarangayIdFields
                  prefix="detail-barangay"
                  value={documents[card.id] ?? {}}
                  onChange={(value) => onSetDocument(card.id, value)}
                />
              )}
              <section
                className="space-y-3 rounded-2xl bg-muted p-4"
                aria-label="Eligibility"
              >
                <h3 className="font-extrabold">Check eligibility</h3>
                <p className="text-sm" role="status">
                  {obtained
                    ? "Ownership is recorded independently of the application checklist."
                    : state.eligibility.status === "eligible"
                      ? "Your answers meet the modeled eligibility checks. The issuing office makes the final decision."
                      : state.eligibility.status === "ineligible"
                        ? "Some eligibility conditions are not met. You can keep this goal and review the guide."
                        : "Some eligibility details are unknown. Review the questions before marking application steps done."}
                </p>
                {!signedIn ? (
                  <div className="space-y-1">
                    <label htmlFor="preview-age" className="text-sm font-bold">
                      Applicant age for this preview
                    </label>
                    <Input
                      id="preview-age"
                      type="number"
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
                  <p className="text-sm">
                    Applicant age: {age}. Update under Progress → Edit.
                  </p>
                )}
                <p className="text-sm">
                  <Rich text={d.req.age} />
                </p>
                {!obtained && (
                  <FactQuestions
                    ids={questions}
                    facts={facts}
                    onChange={onSetFact}
                  />
                )}
              </section>
              {leadsTo(card.id).length > 0 && (
                <div className="rounded-2xl bg-muted p-4">
                  <p className="mb-2 text-sm font-extrabold">
                    Accepted in other document routes
                  </p>
                  <p className="mb-2 text-xs text-muted-foreground">
                    Each application may need additional documents or
                    conditions.
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {leadsTo(card.id).map(({ card: c }) => (
                      <button
                        key={c.id}
                        type="button"
                        onClick={() => onJump(c.id)}
                        className="rounded-full bg-white px-3 py-1.5 text-sm font-semibold ring-1 ring-border"
                      >
                        {c.short}
                      </button>
                    ))}
                  </div>
                </div>
              )}
              <Section n={2} title="Requirements">
                {obtained && (
                  <p className="mb-3 rounded-xl bg-mist p-3 text-sm font-bold">
                    You already have this {itemNoun}. You can update ownership
                    below.
                  </p>
                )}
                <p
                  className="mb-3 text-xs font-semibold text-muted-foreground"
                  aria-live="polite"
                >
                  {state.prep.done}/{state.prep.total} ready · Checks are based
                  on your selections and answers. Confirm document validity,
                  format and acceptance with the office.
                </p>
                <ul className="space-y-2">
                  {state.prep.nodes.map((node) =>
                    node.kind === "row" ? (
                      <li key={node.row.key}>
                        <PrepButton
                          row={node.row}
                          onToggle={() => onTogglePrep(card.id, node.row.key)}
                        />
                      </li>
                    ) : (
                      <li
                        key={node.key}
                        className={`rounded-2xl border-2 border-dashed p-3 ${node.complete ? "border-civic" : "border-input"}`}
                      >
                        <p className="mb-2 text-xs font-extrabold uppercase text-civic">
                          Complete one entire route {node.complete && "· ✓ met"}
                        </p>
                        {node.routes.map((route, index) => (
                          <div key={route.id}>
                            {index > 0 && (
                              <p className="my-2 text-center text-xs font-bold">
                                OR
                              </p>
                            )}
                            <p className="mb-2 text-sm font-bold">
                              {route.label}
                              {route.complete && " ✓"}
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
                <p className="mt-3 text-sm">
                  <strong>Under 18: </strong>
                  <Rich text={d.req.minors} />
                </p>
              </Section>
              <Section n={3} title="Step-by-step guide">
                <p
                  className="mb-3 rounded-xl bg-mist p-3 text-sm"
                  role="status"
                >
                  {obtained
                    ? "Already obtained — no need to apply again."
                    : d.procedure === "hybrid"
                      ? "Complete online preparation, then the in-person phase. Both count toward this application."
                      : "Follow one application route. The guide stays visible while you prepare."}
                </p>
                {!fitsSetup(card.id, setup ?? DEFAULT_SETUP) && (
                  <p className="mb-3 text-sm font-semibold">
                    This process differs from your application preference. You
                    can still review it and track the goal.
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
                  <TabsList
                    className="grid min-h-11 w-full"
                    style={{
                      gridTemplateColumns: `repeat(${modes.length}, 1fr)`,
                    }}
                  >
                    {modes.map((m) => (
                      <TabsTrigger key={m} value={m}>
                        {m === "onsite" ? (
                          <Building2 className="size-4" />
                        ) : (
                          <Globe className="size-4" />
                        )}
                        {d.procedure === "hybrid"
                          ? m === "online"
                            ? "1 · Online"
                            : "2 · In person"
                          : m === "online" && d.onlineRequiresVisit
                            ? "Online + visit"
                            : m === "online"
                              ? "Online"
                              : "On-site"}
                      </TabsTrigger>
                    ))}
                  </TabsList>
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
                <p className="mt-3 text-xs text-muted-foreground">
                  Booking and preparation steps can start before the checklist
                  is complete. Submission steps require the checklist; later
                  steps require the preceding step.
                </p>
              </Section>
              <Section n={4} title="References">
                <ul className="space-y-2">
                  {d.refs.map((ref) => (
                    <li key={ref.label}>
                      {ref.url ? (
                        <a
                          href={ref.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center justify-between gap-2 rounded-xl bg-mist px-3 py-2.5 text-sm font-bold"
                        >
                          {ref.label}
                          <ExternalLink className="size-4 shrink-0" />
                          <span className="sr-only">(opens in a new tab)</span>
                        </a>
                      ) : (
                        <p className="rounded-xl bg-muted px-3 py-2 text-sm">
                          {ref.label}
                        </p>
                      )}
                    </li>
                  ))}
                </ul>
              </Section>
              <p className="text-xs text-muted-foreground">
                This catalog is being reviewed. Fees, document acceptance and
                local procedures need confirmation with the issuing office.
                Selecting a document does not verify it.
              </p>
            </div>
            <div className="border-t border-border bg-card p-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
              {!signedIn ? (
                <Button
                  onClick={onSignUp}
                  className="h-12 w-full bg-amber font-bold text-navy"
                >
                  Save a device profile to track this {itemNoun}
                </Button>
              ) : (
                <div className="space-y-2">
                  {!obtained && (
                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        aria-pressed={tracking.includes(card.id)}
                        onClick={() => onToggleTrack(card.id)}
                        className="h-11 flex-1 border-2 border-civic font-bold"
                      >
                        <Target className="size-4" />
                        {tracking.includes(card.id)
                          ? "Tracking"
                          : `Track this ${itemNoun}`}
                      </Button>
                      {tracking.includes(card.id) && (
                        <Button
                          variant="outline"
                          disabled={priority === card.id}
                          onClick={() => onSetPriority(card.id)}
                          className="h-11 flex-1 border-2 border-amber font-bold disabled:bg-amber disabled:opacity-100"
                        >
                          <Star className="size-4" />
                          {priority === card.id ? "Priority" : "Make priority"}
                        </Button>
                      )}
                    </div>
                  )}
                  {tracking.includes(card.id) &&
                    priority &&
                    priority !== card.id &&
                    CARD_BY_ID[priority] && (
                      <p className="text-xs text-muted-foreground">
                        Current priority: {CARD_BY_ID[priority].short}. Making
                        this the priority replaces it.
                      </p>
                    )}
                  <Button
                    onClick={() => onToggle(card.id)}
                    className={`h-12 w-full text-base font-bold ${obtained ? "bg-muted text-navy" : "bg-amber text-navy"}`}
                  >
                    {obtained ? (
                      `Undo — I don’t have this ${itemNoun}`
                    ) : (
                      <>
                        <Check className="size-5" /> I have this {itemNoun}
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

function Steps({
  steps,
  onToggle,
  obtained,
}: {
  steps: ReturnType<typeof evaluateApplication>["steps"];
  onToggle: (key: string) => void;
  obtained: boolean;
}) {
  return (
    <ol className="mt-4 space-y-4">
      {steps.map(({ step, checked, enabled, reason }, index) => (
        <li key={step.id} className="flex gap-3">
          <button
            type="button"
            role="checkbox"
            aria-checked={checked}
            aria-label={`Step ${index + 1}: ${step.t.replaceAll("**", "")}`}
            disabled={obtained || (!checked && !enabled)}
            onClick={() => onToggle(stepKey(step))}
            className={`mt-0.5 grid size-7 shrink-0 place-items-center rounded-full font-bold ${checked ? "bg-amber text-navy" : "bg-civic text-white"} disabled:opacity-50`}
          >
            {checked ? <Check className="size-4" /> : index + 1}
          </button>
          <div className="min-w-0 text-[15px]">
            <Rich text={step.t} />
            {!checked && reason && (
              <p className="mt-1 text-xs text-muted-foreground">{reason}</p>
            )}
            {step.link && (
              <a
                href={step.link.url}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-2 flex w-fit items-center gap-1 rounded-lg bg-mist px-2.5 py-1.5 text-sm font-bold"
              >
                {step.link.label}
                <ExternalLink className="size-3.5" />
                <span className="sr-only">(opens in a new tab)</span>
              </a>
            )}
          </div>
        </li>
      ))}
    </ol>
  );
}
function PrepButton({ row, onToggle }: { row: PrepRow; onToggle: () => void }) {
  return (
    <button
      type="button"
      role="checkbox"
      aria-checked={row.checked}
      disabled={row.auto || row.unknown || row.blocked}
      onClick={onToggle}
      className={`flex w-full items-start gap-3 rounded-xl border-2 px-3 py-2.5 text-left ${row.checked ? "border-civic bg-mist" : "border-border bg-card"}`}
    >
      <span
        aria-hidden="true"
        className={`mt-0.5 grid size-5 shrink-0 place-items-center rounded border-2 ${row.checked ? "border-civic bg-civic text-white" : "border-input"}`}
      >
        {row.checked && <Check className="size-3.5" />}
      </span>
      <span className="min-w-0 text-sm leading-snug">
        <Rich text={row.text} />
        {row.source === "profile" && (
          <small className="ml-2 font-bold"> From your documents</small>
        )}
        {row.source === "step" && (
          <small className="ml-2 font-bold"> From completed step</small>
        )}
        {row.unknown && (
          <small className="mt-1 block font-bold">
            Answer the eligibility question above to check whether this applies.
          </small>
        )}
        {row.note && (
          <small className="mt-1 block font-semibold">{row.note}</small>
        )}
        {row.opt && <small className="ml-2">Optional</small>}
      </span>
    </button>
  );
}
function Section({
  n,
  title,
  children,
}: {
  n: number;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section>
      <h3 className="mb-3 flex items-center gap-2 font-extrabold">
        <span className="grid size-6 place-items-center rounded-full bg-navy text-xs text-white">
          {n}
        </span>
        {title}
      </h3>
      {children}
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
      <dt className="text-xs font-bold uppercase tracking-wide text-civic">
        {label}
      </dt>
      <dd className="mt-0.5">{children}</dd>
    </div>
  );
}
function Tag({ children }: { children: React.ReactNode }) {
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-mist px-2.5 py-1 text-xs font-bold">
      {children}
    </span>
  );
}
