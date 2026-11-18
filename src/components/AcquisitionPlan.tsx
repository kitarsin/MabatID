"use client";

import { ArrowRight, Check, Info, LoaderCircle, Route } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Chip } from "@/components/ui/chip";
import { Disclosure } from "@/components/ui/disclosure";
import { FACTS, type FactId, type ProfileFacts } from "@/data/facts";
import type { AcquisitionPlan as GeneratedPlan } from "@/lib/planner/types";
import type { PlanningView } from "@/lib/use-tree-planning";
import { FactQuestions } from "./FactQuestions";
import { Rich } from "./Rich";

export function AcquisitionPlan({
  facts,
  signedIn,
  onOpen,
  onSetFact,
  onFollow,
  view,
  showHeading = true,
  starter,
}: {
  /**
   * Set for Foundational and Starter & supporting items. When their route is just the item itself, a note
   * explains that the plan is the same as applying directly.
   */
  starter?: { id: string; noun: string };
  /** False when a parent control already titles this section. */
  showHeading?: boolean;
  facts: ProfileFacts;
  signedIn: boolean;
  onOpen: (id: string) => void;
  onSetFact: (id: FactId, value: boolean | undefined) => void;
  onFollow: (plan: GeneratedPlan) => void;
  view: PlanningView;
}) {
  const { result, plan, objective, onObjectiveChange, onSelectPlan } = view;
  const factIds =
    plan?.questions.flatMap((q) =>
      q.factId && Object.hasOwn(FACTS, q.factId) ? [q.factId as FactId] : [],
    ) ?? [];
  const outsideQuestions = plan?.questions.filter((q) => !q.factId) ?? [];
  return (
    <section
      aria-label="Your acquisition plan"
      className="space-y-5 rounded-[24px] bg-mist/35 p-5 ring-1 ring-sky/25"
    >
      {showHeading && (
        <div>
          <h3 className="flex items-center gap-2 text-lg font-semibold tracking-tight text-navy">
            <Route className="size-5 text-civic" aria-hidden="true" />
            How to get it
          </h3>
          <p className="mt-1.5 text-[15px] leading-relaxed text-muted-foreground">
            The quickest route from what you already have.
          </p>
        </div>
      )}
      <div
        role="group"
        aria-label="Plan preference"
        className="flex flex-wrap gap-2"
      >
        {(
          [
            { id: "fewest-documents", label: "Fewer documents" },
            { id: "lowest-fees", label: "Lower fees" },
          ] as const
        ).map((option) => (
          <Chip
            key={option.id}
            pressed={objective === option.id}
            onClick={() => onObjectiveChange(option.id)}
          >
            {option.label}
          </Chip>
        ))}
      </div>
      {view.loading && (
        <p role="status" className="flex items-center gap-2 text-sm">
          <LoaderCircle className="size-4 animate-spin" aria-hidden="true" />
          Finding a route…
        </p>
      )}
      {view.error && (
        <div role="alert" className="space-y-2 text-sm">
          <p>{view.error}</p>
          <button
            type="button"
            className="inline-flex min-h-11 items-center font-semibold text-civic underline"
            onClick={view.onRetry}
          >
            Try again
          </button>
        </div>
      )}
      {result?.status === "owned" && (
        <p role="status" className="text-sm font-semibold">
          You already have this. Keep it valid before using it elsewhere.
        </p>
      )}
      {result && !plan && result.status !== "owned" && (
        <p role="status" className="text-sm">
          {result.status === "incomplete"
            ? "We couldn’t finish finding a route. Add documents you have or answer the questions below, then try again."
            : "No route found with what you have now. Check the questions below or ask the office about other options."}
        </p>
      )}
      {plan && (
        <>
          {starter &&
            plan.steps.length === 1 &&
            plan.steps[0].id === starter.id && (
              <p
                role="note"
                className="flex gap-3 rounded-2xl bg-white px-4 py-3 text-sm leading-relaxed text-navy ring-1 ring-sky/30"
              >
                <Info
                  className="mt-0.5 size-4 shrink-0 text-civic"
                  aria-hidden="true"
                />
                <span>
                  <strong className="font-semibold">
                    This is a starting {starter.noun}.
                  </strong>{" "}
                  Its route is the same as applying for it directly — just
                  follow “What you need” and “How to apply” below.
                </span>
              </p>
            )}
          {plan.questions.length > 0 && (
            <p
              role="status"
              className="rounded-2xl bg-white px-4 py-3 text-sm leading-relaxed"
            >
              This route depends on a few answers. Check them below.
            </p>
          )}
          {result!.plans.length > 1 && (
            <div
              role="group"
              aria-label="Alternative plans"
              className="flex flex-wrap gap-2"
            >
              {result!.plans.map((p, i) => (
                <Chip
                  key={p.id}
                  pressed={p.id === plan.id}
                  onClick={() => onSelectPlan(p.id)}
                >
                  Route {i + 1} · {p.steps.length} step
                  {p.steps.length === 1 ? "" : "s"}
                </Chip>
              ))}
            </div>
          )}
          <p className="text-[15px] text-navy">
            <strong className="font-semibold">
              {plan.steps.length} step
              {plan.steps.length === 1 ? "" : "s"}
            </strong>{" "}
            <span className="text-muted-foreground">· about</span>{" "}
            <strong className="font-semibold">
              ₱{plan.fees.min.toLocaleString()}
              {plan.fees.max !== plan.fees.min
                ? `–₱${plan.fees.max.toLocaleString()}`
                : ""}
            </strong>
          </p>
          <ol className="space-y-2.5">
            {plan.steps.map((step, index) => (
              <li
                key={step.id}
                className="rounded-2xl bg-card px-4 py-1 ring-1 ring-navy/[0.07]"
              >
                <button
                  type="button"
                  onClick={() => onOpen(step.id)}
                  className="flex min-h-12 w-full items-center justify-between gap-3 py-2 text-left"
                >
                  <span className="flex items-center gap-3">
                    <span className="grid size-7 shrink-0 place-items-center rounded-full bg-navy text-xs font-semibold text-white tabular-nums">
                      {index + 1}
                    </span>
                    <span>
                      <span className="block text-[15px] font-semibold text-navy">
                        {step.name}
                      </span>
                      <span className="mt-0.5 block text-xs text-muted-foreground">
                        {step.routeLabel}
                        {step.canStart ? " · You can start now" : ""}
                      </span>
                    </span>
                  </span>
                  <ArrowRight
                    className="mt-0.5 size-4 shrink-0"
                    aria-hidden="true"
                  />
                </button>
                {step.prerequisites.length > 0 && (
                  <p className="pb-2 pl-10 text-xs text-muted-foreground">
                    Get first:{" "}
                    {step.prerequisites
                      .map(
                        (id) => plan.steps.find((s) => s.id === id)?.name ?? id,
                      )
                      .join(", ")}
                    .
                  </p>
                )}
                {(step.preferenceMismatch || step.overBudget) && (
                  <p className="pb-2 pl-10 text-xs font-semibold text-navy">
                    {step.preferenceMismatch &&
                      "Different from how you prefer to apply. "}
                    {step.overBudget && "May cost more than your budget."}
                  </p>
                )}
                <Disclosure
                  variant="inline"
                  summary="What it needs"
                  className="pb-2 pl-10"
                >
                  <ul className="mt-2 space-y-2 text-sm leading-relaxed">
                    {step.requirements
                      .filter((r) => r.kind !== "procedure")
                      .map((requirement) => (
                        <li key={requirement.id} className="flex gap-2">
                          {requirement.state === "satisfied" ? (
                            <Check
                              className="mt-0.5 size-4 shrink-0 text-civic"
                              aria-label="Satisfied"
                            />
                          ) : (
                            <span aria-hidden="true">•</span>
                          )}
                          <span>
                            <Rich text={requirement.label} />
                            {requirement.state === "unknown" && (
                              <small className="block text-xs font-semibold">
                                Check this
                              </small>
                            )}
                          </span>
                        </li>
                      ))}
                  </ul>
                  <ol className="mt-4 list-decimal space-y-2 pl-5 text-sm leading-relaxed">
                    {step.procedure.map((s) => (
                      <li key={s.id}>
                        <span className="text-xs font-bold text-civic">
                          {s.channel === "online" ? "Online" : "In person"}{" "}
                          ·{" "}
                        </span>
                        <Rich text={s.text} />
                        {s.completed && (
                          <>
                            {" "}
                            <Check
                              className="inline size-3.5 text-civic"
                              strokeWidth={3}
                              aria-hidden="true"
                            />
                            <span className="sr-only"> (done)</span>
                          </>
                        )}
                        {s.link && (
                          <a
                            href={s.link.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="ml-1 font-semibold text-civic underline"
                          >
                            {s.link.label}
                            <span className="sr-only">
                              {" "}
                              (opens in a new tab)
                            </span>
                          </a>
                        )}
                      </li>
                    ))}
                  </ol>
                  <button
                    type="button"
                    onClick={() => onOpen(step.id)}
                    className="mt-1 inline-flex min-h-11 items-center text-xs font-semibold text-civic underline"
                  >
                    Open its guide
                  </button>
                </Disclosure>
              </li>
            ))}
          </ol>
          {plan.questions.length > 0 && (
            <Disclosure
              summary="Answer to confirm this route"
              hint={`${plan.questions.length} question${plan.questions.length === 1 ? "" : "s"}`}
              className="bg-white"
            >
              <div className="mt-2 space-y-4">
                <FactQuestions
                  ids={factIds}
                  facts={facts}
                  onChange={onSetFact}
                />
                {plan.questions.some((q) => q.factId === "age") && (
                  <p className="text-sm">
                    Set your age under “Can I apply?” below.
                  </p>
                )}
                <ul className="list-disc space-y-2 pl-5 text-sm">
                  {outsideQuestions.map((q) => (
                    <li key={q.id}>
                      <Rich text={q.label} />
                    </li>
                  ))}
                </ul>
              </div>
            </Disclosure>
          )}
          <Button
            type="button"
            variant="brand"
            size="md"
            onClick={() => onFollow(plan)}
            className="h-auto min-h-11 w-full whitespace-normal py-2"
          >
            Start with {plan.steps[0]?.name}
          </Button>
          <p className="-mt-2 text-center text-xs text-muted-foreground">
            Opens the first guide.
            {signedIn ? " To track this goal, use the Track button below." : ""}
          </p>
        </>
      )}
      {result && (
        <Disclosure variant="inline" summary="How this route was chosen">
          <div className="space-y-2 text-xs leading-relaxed text-muted-foreground">
            {plan && <p>{plan.explanation}</p>}
            <p>
              Fees are estimates and leave out extra costs. Steps in this route
              aren’t marked as done until you tick them.
            </p>
            {!result.search.complete && (
              <p>We checked the most likely options. Other routes may exist.</p>
            )}
            <p>
              Based on our catalog as of {result.asOf}. Confirm with the office.
            </p>
          </div>
        </Disclosure>
      )}
    </section>
  );
}
