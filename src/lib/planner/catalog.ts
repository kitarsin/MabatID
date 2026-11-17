import { CARDS } from "@/data/cards";
import { DETAILS, type PrepItem } from "@/data/details";
import { EXTRA_DOCUMENTS } from "@/data/documents";
import { FACTS, conditionFacts, conditionValue } from "@/data/facts";
import { documentUsable, documentValidity, todayISO } from "../documents";
import {
  evaluateApplication,
  procedureSteps,
  type ApplicationContext,
  type Mode,
} from "../prepare";
import { estimateFee, fitsBudget } from "../prefs";
import type { User } from "../profile";
import type {
  DocumentRule,
  PlannerCatalog,
  PlannerRoute,
  PlanTask,
  Rule,
} from "./types";

export const CATALOG_VERSION = "mabatid-research-2026-11-18-v2";
export interface PlanningInput
  extends Pick<
    User,
    "owned" | "facts" | "documents" | "prep" | "modes" | "budget" | "setup"
  > {
  targetId: string;
  age?: number | null;
  objective?: "fewest-documents" | "lowest-fees";
}

/** Adapter consumes the same checklist/evaluator as the app; no dependency on visual tree parents. */
export function buildPlannerCatalog(
  input: PlanningInput,
  asOf = todayISO(),
): PlannerCatalog {
  const owned = new Set(input.owned);
  const documents: PlannerCatalog["documents"] = Object.fromEntries([
    ...CARDS.map((c) => [c.id, { name: c.name, acquisitionId: c.id }]),
    ...EXTRA_DOCUMENTS.map((d) => [
      d.id,
      { name: d.name, existingOnly: ["umid", "company-id"].includes(d.id) },
    ]),
  ]);
  const acquisitions: PlannerCatalog["acquisitions"] = {};
  for (const card of CARDS) {
    const d = DETAILS[card.id];
    const selected = input.modes?.[card.id];
    const modes: Mode[] =
      d.procedure === "hybrid"
        ? ["online"]
        : selected
          ? [selected]
          : ([d.onsite && "onsite", d.online && "online"].filter(
              Boolean,
            ) as Mode[]);
    const routes: PlannerRoute[] = modes.map((mode) => {
      const context: ApplicationContext = {
        age: input.age,
        facts: input.facts,
        documents: input.documents,
        setup: input.setup,
        budget: input.budget,
        mode,
        asOf,
      };
      const state = evaluateApplication(
        card.id,
        owned,
        input.prep?.[card.id],
        context,
      );
      const prefix = `${card.id}:${mode}`;
      const rows = new Map(
        state.prep.nodes
          .flatMap((node) =>
            node.kind === "row"
              ? [node.row]
              : node.routes.flatMap((r) => r.rows),
          )
          .map((row) => [row.key, row]),
      );
      const task = (
        id: string,
        label: string,
        status: PlanTask["state"],
        kind: PlanTask["kind"] = "preparation",
        factId?: string,
      ): Rule => ({
        kind: "task",
        task: {
          id: `${prefix}:${id}`,
          forId: card.id,
          label,
          state: status,
          kind,
          ...(factId ? { factId } : {}),
        },
      });
      function itemRule(item: PrepItem): Rule {
        const row = rows.get(item.id);
        const id = `${prefix}:${item.id}`;
        if (!row) return { kind: "all", id, children: [] };
        if (row.checked && row.source !== "profile")
          return task(item.id, item.t, "satisfied");
        if (
          item.when &&
          conditionValue(item.when, input.facts ?? {}, input.age) === undefined
        ) {
          const facts = conditionFacts(item.when, input.age).filter(
            (fact) => input.facts?.[fact] === undefined,
          );
          return {
            kind: "all",
            id,
            children: [
              task(
                `${item.id}:conditional`,
                `Check whether this requirement applies: ${item.t}`,
                "unknown",
                "preparation",
                facts[0] ?? "age",
              ),
              ...facts
                .slice(1)
                .map((fact) =>
                  task(
                    `${item.id}:fact:${fact}`,
                    FACTS[fact],
                    "unknown",
                    "preparation",
                    fact,
                  ),
                ),
            ],
          };
        }
        // Forms/receipts produced by a procedure are actions, never recursive document dependencies.
        if (
          item.completedBy &&
          procedureSteps(card.id, context).some(
            ({ step }) => step.id === item.completedBy,
          )
        )
          return task(item.id, item.t, "missing", "procedure");
        if (!item.ids?.length) return task(item.id, item.t, "missing");
        const docRules: DocumentRule[] = [...new Set(item.ids)].map((rawId): DocumentRule => {
          const documentId =
            item.subject && item.subject !== "self" && !rawId.includes(":")
              ? `${item.subject}:${rawId}`
              : rawId;
          const usable = documentUsable(
            documentId,
            owned,
            input.documents,
            item.documentChecks?.[rawId],
            asOf,
          );
          const held = owned.has(documentId);
          const confirmation =
            documentId === "barangay-id"
              ? held &&
                documentValidity(input.documents?.[documentId], asOf).status !==
                  "valid"
                ? documentValidity(input.documents?.[documentId], asOf).reason
                : `Confirm the Barangay ID's dates and required card details before using it for ${card.name}.`
              : undefined;
          return {
            kind: "document",
            id: `${id}:document:${documentId}`,
            forId: card.id,
            documentId,
            label: documents[documentId]?.name ?? documentId,
            state: usable
              ? "satisfied"
              : held
                ? "needs-confirmation"
                : "missing",
            ...(confirmation ? { confirmation } : {}),
          };
        }).filter((rule) => row.source !== "profile" || rule.state === "satisfied");
        const requirement: Rule =
          (item.min ?? 1) > 1
            ? {
                kind: "at-least",
                id: `${id}:documents`,
                count: item.min!,
                options: docRules,
              }
            : { kind: "any", id: `${id}:documents`, options: docRules };
        return item.confirm
          ? {
              kind: "all",
              id,
              children: [
                requirement,
                task(`${item.id}:confirm`, item.t, "missing", "confirmation"),
              ],
            }
          : requirement;
      }
      const children: Rule[] = [];
      const funds = rows.get("funds")!;
      children.push(
        task("funds", funds.text, funds.checked ? "satisfied" : "missing"),
      );
      for (const entry of d.req.prepare) {
        if ("either" in entry)
          children.push({
            kind: "any",
            id: `${prefix}:${entry.id}`,
            options: entry.either
              .filter(
                (route) =>
                  !route.when ||
                  conditionValue(route.when, input.facts ?? {}, input.age) !==
                    false,
              )
              .map((route) => ({
                kind: "all",
                id: `${prefix}:${entry.id}:${route.id}`,
                children: [
                  ...(route.when &&
                  conditionValue(route.when, input.facts ?? {}, input.age) ===
                    undefined
                    ? conditionFacts(route.when, input.age).length
                      ? conditionFacts(route.when, input.age)
                          .filter((fact) => input.facts?.[fact] === undefined)
                          .map((fact) =>
                            task(
                              `${route.id}:eligibility:${fact}`,
                              FACTS[fact],
                              "unknown",
                              "eligibility",
                              fact,
                            ),
                          )
                      : [
                          task(
                            `${route.id}:eligibility:age`,
                            "Confirm the applicant age for this route.",
                            "unknown",
                            "eligibility",
                            "age",
                          ),
                        ]
                    : []),
                  ...route.items.filter((i) => !i.opt).map(itemRule),
                ],
              })),
          });
        else if (!entry.opt) children.push(itemRule(entry));
      }
      return {
        id: prefix,
        mode: d.procedure === "hybrid" ? "hybrid" : mode,
        label:
          d.procedure === "hybrid"
            ? "Online preparation + in-person phase"
            : mode === "online"
              ? d.onlineRequiresVisit
                ? "Online request + visit"
                : "Online"
              : "On-site",
        eligibility: state.eligibility.checks.map((check) => ({
          id: `${prefix}:eligibility:${check.id}`,
          forId: card.id,
          label: check.label,
          state: check.status,
          kind: "eligibility",
          factId: check.fact ?? (check.id === "age" ? "age" : undefined),
        })),
        requirements: { kind: "all", id: `${prefix}:requirements`, children },
        fee: estimateFee(card.id, mode, input.facts),
        preferenceMismatch:
          !!input.setup &&
          input.setup !== "both" &&
          (d.procedure === "hybrid" ||
            mode !== input.setup ||
            (mode === "online" && d.onlineRequiresVisit)),
        overBudget: !fitsBudget(card.id, input.budget, mode, input.facts),
        canStart: state.steps.find((s) => !s.checked)?.enabled ?? false,
        procedure: state.steps.map(({ step, mode, checked }) => ({
          id: step.id,
          channel: mode,
          text: step.t,
          completed: checked,
          ...(step.link ? { link: step.link } : {}),
        })),
      };
    });
    acquisitions[card.id] = {
      id: card.id,
      name: card.name,
      kind: card.kind,
      owned: owned.has(card.id),
      routes,
      refs: d.refs,
    };
  }
  return { version: CATALOG_VERSION, asOf, acquisitions, documents };
}
