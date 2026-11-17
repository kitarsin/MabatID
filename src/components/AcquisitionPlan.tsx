"use client";

import { ArrowRight, Check, LoaderCircle, Route } from "lucide-react";
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
}: {
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
      className="space-y-3 rounded-2xl border-2 border-civic bg-mist/40 p-4"
    >
      <h3 className="flex items-center gap-2 font-extrabold">
        <Route className="size-5" aria-hidden="true" />
        Your acquisition plan
      </h3>
      <p className="text-sm text-muted-foreground">
        A path based on your selected documents and answers. It updates when
        your starting point changes.
      </p>
      <div
        role="group"
        aria-label="Plan preference"
        className="flex flex-wrap gap-2"
      >
        {(
          [
            { id: "fewest-documents", label: "Fewer documents" },
            { id: "lowest-fees", label: "Lower estimated fees" },
          ] as const
        ).map((option) => (
          <button
            key={option.id}
            type="button"
            aria-pressed={objective === option.id}
            onClick={() => onObjectiveChange(option.id)}
            className={`rounded-full border-2 px-3 py-2 text-xs font-bold ${objective === option.id ? "border-civic bg-civic text-white" : "border-border bg-card"}`}
          >
            {option.label}
          </button>
        ))}
      </div>
      {view.loading && (
        <p role="status" className="flex items-center gap-2 text-sm">
          <LoaderCircle className="size-4 animate-spin" aria-hidden="true" />
          Finding your path…
        </p>
      )}
      {view.error && (
        <div role="alert" className="space-y-2 text-sm">
          <p>{view.error}</p>
          <button
            type="button"
            className="font-bold text-civic underline"
            onClick={view.onRetry}
          >
            Try again
          </button>
        </div>
      )}
      {result?.status === "owned" && (
        <p role="status" className="text-sm font-semibold">
          You already have this item. Keep any validity details up to date
          before using it for another application.
        </p>
      )}
      {result && !plan && result.status !== "owned" && (
        <p role="status" className="text-sm">
          {result.status === "incomplete"
            ? "The search reached its limit before finding a complete path. Add your existing documents or answer eligibility questions, then try again."
            : "No supported path was found with your current answers and documents. Review eligibility and existing documents, or confirm an alternative with the issuing office."}
        </p>
      )}
      {plan && (
        <>
          {plan.questions.length > 0 && (
            <p
              role="status"
              className="rounded-xl bg-white p-3 text-sm font-semibold"
            >
              This is a conditional path. Confirm the questions and outside
              documents below before relying on it.
            </p>
          )}
          {result!.plans.length > 1 && (
            <div
              role="group"
              aria-label="Alternative plans"
              className="flex flex-wrap gap-2"
            >
              {result!.plans.map((p, i) => (
                <button
                  key={p.id}
                  type="button"
                  aria-pressed={p.id === plan.id}
                  onClick={() => onSelectPlan(p.id)}
                  className={`rounded-lg border-2 px-3 py-2 text-xs font-bold ${p.id === plan.id ? "border-civic bg-white" : "border-border"}`}
                >
                  Route {i + 1} · {p.steps.length} acquisition
                  {p.steps.length === 1 ? "" : "s"}
                </button>
              ))}
            </div>
          )}
          <p className="text-sm">
            <strong>
              {plan.steps.length} acquisition
              {plan.steps.length === 1 ? "" : "s"}
            </strong>{" "}
            · Estimated modeled fees{" "}
            <strong>
              ₱{plan.fees.min.toLocaleString()}
              {plan.fees.max !== plan.fees.min
                ? `–₱${plan.fees.max.toLocaleString()}`
                : ""}
            </strong>
          </p>
          <ol className="space-y-3">
            {plan.steps.map((step, index) => (
              <li
                key={step.id}
                className="space-y-2 rounded-xl bg-card p-3 ring-1 ring-border"
              >
                <button
                  type="button"
                  onClick={() => onOpen(step.id)}
                  className="flex w-full items-start justify-between gap-2 text-left"
                >
                  <span>
                    <span className="text-sm font-extrabold">
                      {index + 1}. {step.name}
                    </span>
                    <span className="mt-1 block text-xs text-muted-foreground">
                      {step.routeLabel}
                      {step.canStart ? " · Can start preparation" : ""}
                    </span>
                  </span>
                  <ArrowRight
                    className="mt-0.5 size-4 shrink-0"
                    aria-hidden="true"
                  />
                </button>
                {step.prerequisites.length > 0 && (
                  <p className="text-xs text-muted-foreground">
                    First obtain:{" "}
                    {step.prerequisites
                      .map(
                        (id) => plan.steps.find((s) => s.id === id)?.name ?? id,
                      )
                      .join(", ")}
                    .
                  </p>
                )}
                {(step.preferenceMismatch || step.overBudget) && (
                  <p className="text-xs font-semibold">
                    {step.preferenceMismatch &&
                      "This route differs from your application preference. "}
                    {step.overBudget &&
                      "Its modeled fee range exceeds your per-item budget."}
                  </p>
                )}
                <details>
                  <summary className="cursor-pointer text-xs font-bold text-civic">
                    Requirements and application steps
                  </summary>
                  <ul className="mt-2 space-y-2 text-sm">
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
                              <small className="block font-semibold">
                                Needs confirmation
                              </small>
                            )}
                          </span>
                        </li>
                      ))}
                  </ul>
                  <ol className="mt-3 list-decimal space-y-2 pl-5 text-sm">
                    {step.procedure.map((s) => (
                      <li key={s.id}>
                        <span className="text-xs font-bold text-civic">
                          {s.channel === "online" ? "Online" : "In person"}{" "}
                          ·{" "}
                        </span>
                        <Rich text={s.text} />
                        {s.completed && " ✓"}
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
                    className="mt-3 text-xs font-bold text-civic underline"
                  >
                    Open this guide to update its checklist
                  </button>
                </details>
              </li>
            ))}
          </ol>
          {plan.questions.length > 0 && (
            <details>
              <summary className="cursor-pointer text-sm font-bold">
                Questions to confirm this path
              </summary>
              <div className="mt-3 space-y-3">
                <FactQuestions
                  ids={factIds}
                  facts={facts}
                  onChange={onSetFact}
                />
                {plan.questions.some((q) => q.factId === "age") && (
                  <p className="text-sm">
                    Set the applicant age in the eligibility section below.
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
            </details>
          )}
          <button
            type="button"
            onClick={() => onFollow(plan)}
            className="min-h-11 w-full rounded-xl bg-civic px-3 py-2 text-sm font-bold text-white"
          >
            Start with {plan.steps[0]?.name}
          </button>
          <p className="text-xs text-muted-foreground">
            {signedIn
              ? "Saves your application routes, tracks the final goal, and opens the first guide."
              : "Opens the first guide with these application routes for this preview."}{" "}
            The suggested path updates as you acquire documents.
          </p>
          <p className="text-xs text-muted-foreground">
            {plan.explanation} Fees exclude unmodeled outside documents and
            incidental costs. Planned acquisitions are not marked as owned.
          </p>
        </>
      )}
      {result && !result.search.complete && (
        <p role="status" className="text-xs text-muted-foreground">
          The search was limited. This is the best path found in the explored
          options; other routes may exist.
        </p>
      )}
      {result && (
        <p className="text-[11px] text-muted-foreground">
          Based on the research catalog as of {result.asOf}. Confirm current
          requirements and fees with the issuing office.
        </p>
      )}
    </section>
  );
}
