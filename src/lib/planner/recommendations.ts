import { buildPlannerCatalog, type PlanningInput } from "./catalog";
import { planAcquisition } from "./engine";
import { evaluateApplication } from "../prepare";
import { documentValidity } from "../documents";
import type { AcquisitionPlan, PlanObjective, PlanningResult } from "./types";

export type TreeNodeStatus =
  | "owned"
  | "available"
  | "preparation"
  | "confirmation"
  | "ineligible"
  | "unresolved";
export interface NodeAssessment {
  status: TreeNodeStatus;
  reason: string;
  additionalAcquisitions: number | null;
  questions: number;
  limited: boolean;
}
export interface Recommendation extends NodeAssessment {
  id: string;
  fees: { min: number; max: number };
}
export interface TreePlanningResult {
  catalogVersion: string;
  asOf: string;
  objective: PlanObjective;
  nodes: Record<string, NodeAssessment>;
  recommendations: Recommendation[];
  goal?: PlanningResult;
}
export type TreePlanningInput = Omit<PlanningInput, "targetId"> & {
  targetId?: string;
};

function unknownCount(plan: AcquisitionPlan) {
  return new Set(
    plan.questions.map((t) =>
      t.factId
        ? `fact:${t.factId}`
        : t.documentId
          ? `doc:${t.documentId}`
          : t.id,
    ),
  ).size;
}

/** Rank whole explored paths, not credential groups or the number of ticked checklist rows. */
export function recommendAcquisitions(
  input: TreePlanningInput,
  asOf?: string,
): TreePlanningResult {
  const catalog = buildPlannerCatalog(
    { ...input, targetId: input.targetId ?? "philsys" },
    asOf,
  );
  const nodes: TreePlanningResult["nodes"] = {};
  const candidates: { recommendation: Recommendation; score: number[] }[] = [];
  const owned = new Set(input.owned);
  const objective = input.objective ?? "fewest-documents";
  let goal: PlanningResult | undefined;
  for (const node of Object.values(catalog.acquisitions)) {
    const result = planAcquisition(
      catalog,
      node.id,
      node.id === input.targetId
        ? { objective }
        : { objective, maxOperations: 6000, maxFrontier: 24, maxPlans: 1 },
    );
    if (node.id === input.targetId) goal = result;
    const plan = result.plans[0];
    const ineligible = node.routes.every((r) =>
      r.eligibility.some((t) => t.state === "missing"),
    );
    let assessment: NodeAssessment;
    if (node.owned) {
      assessment = {
        status: "owned",
        reason:
          node.id === "barangay-id" &&
          documentValidity(input.documents?.[node.id], catalog.asOf).status !==
            "valid"
            ? documentValidity(input.documents?.[node.id], catalog.asOf).reason
            : "You have this. Each office decides if it accepts it.",
        additionalAcquisitions: 0,
        questions: 0,
        limited: false,
      };
    } else if (!plan) {
      assessment = {
        status: ineligible ? "ineligible" : "unresolved",
        reason: ineligible
          ? "Based on your answers, you may not qualify yet. Check the guide."
          : result.search.complete
            ? "No route found with what you have. Check the guide for what’s needed."
            : "We couldn’t find a full route yet. Add what you have or answer a few questions.",
        additionalAcquisitions: null,
        questions: 0,
        limited: !result.search.complete,
      };
    } else {
      const target = plan.steps.find((s) => s.id === node.id)!;
      const state = evaluateApplication(node.id, owned, input.prep?.[node.id], {
        ...input,
        mode: target.mode === "hybrid" ? "online" : target.mode,
        asOf: catalog.asOf,
      });
      const extra = plan.steps.length - 1;
      const used = [
        ...new Set(
          plan.satisfied
            .filter((t) => t.forId === node.id && t.documentId)
            .map((t) => catalog.documents[t.documentId!]?.name)
            .filter(Boolean),
        ),
      ];
      const questions = unknownCount(plan);
      const status = questions
        ? "confirmation"
        : state.ready
          ? "available"
          : "preparation";
      const reason = questions
        ? `Answer ${questions} quick question${questions === 1 ? "" : "s"} in the guide to confirm.`
        : extra
          ? `First get ${plan.steps
              .filter((s) => s.id !== node.id)
              .map((s) => s.name)
              .join(", ")}.`
          : used.length
            ? `Uses your ${used.slice(0, 2).join(" and ")}. Check what’s left in the guide.`
            : "Open the guide to see what to bring and where to go.";
      assessment = {
        status,
        reason,
        additionalAcquisitions: extra,
        questions,
        limited: !result.search.complete,
      };
      if (node.kind === "id") {
        const unknownEligibility = new Set(
          plan.questions
            .filter((q) => q.kind === "eligibility")
            .map((q) => q.factId ?? q.id),
        ).size;
        const budgetMisses = plan.steps.filter((s) => s.overBudget).length;
        const preferenceMisses = plan.steps.filter(
          (s) => s.preferenceMismatch,
        ).length;
        const score = [
          unknownEligibility,
          questions,
          budgetMisses,
          ...(objective === "lowest-fees"
            ? [plan.fees.max, extra]
            : [extra, plan.fees.max]),
          preferenceMisses,
        ];
        candidates.push({
          recommendation: { id: node.id, ...assessment, fees: plan.fees },
          score,
        });
      }
    }
    nodes[node.id] = assessment;
  }
  candidates.sort((a, b) => {
    for (let i = 0; i < a.score.length; i++)
      if (a.score[i] !== b.score[i]) return a.score[i] - b.score[i];
    return a.recommendation.id.localeCompare(b.recommendation.id);
  });
  return {
    catalogVersion: catalog.version,
    asOf: catalog.asOf,
    objective,
    nodes,
    recommendations: candidates.slice(0, 3).map((c) => c.recommendation),
    ...(goal ? { goal } : {}),
  };
}
