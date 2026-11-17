/** Serializable planner contracts. No React, Next.js, database, or layout dependencies. */
export type RequirementState = "satisfied" | "missing" | "unknown";
export interface PlanTask {
  id: string;
  forId: string;
  label: string;
  state: RequirementState;
  kind:
    | "preparation"
    | "document"
    | "confirmation"
    | "eligibility"
    | "procedure";
  documentId?: string;
  factId?: string;
}
export type Rule =
  | { kind: "all"; id: string; children: Rule[] }
  | { kind: "any"; id: string; options: Rule[] }
  | { kind: "at-least"; id: string; count: number; options: DocumentRule[] }
  | { kind: "task"; task: PlanTask }
  | DocumentRule;
export interface DocumentRule {
  kind: "document";
  id: string;
  forId: string;
  documentId: string;
  label: string;
  state: "satisfied" | "missing" | "needs-confirmation";
  confirmation?: string;
}
export interface PlannerRoute {
  id: string;
  mode: "onsite" | "online" | "hybrid";
  label: string;
  eligibility: PlanTask[];
  requirements: Rule;
  fee: { min: number; max: number };
  preferenceMismatch: boolean;
  overBudget: boolean;
  canStart: boolean;
  procedure: {
    id: string;
    channel: "onsite" | "online";
    text: string;
    completed: boolean;
    link?: { label: string; url: string };
  }[];
}
export interface PlannerAcquisition {
  id: string;
  name: string;
  kind: "id" | "document";
  owned: boolean;
  routes: PlannerRoute[];
  refs: { label: string; url?: string }[];
}
export interface PlannerCatalog {
  version: string;
  asOf: string;
  acquisitions: Record<string, PlannerAcquisition>;
  documents: Record<
    string,
    { name: string; acquisitionId?: string; existingOnly?: boolean }
  >;
}
export type PlanObjective = "fewest-documents" | "lowest-fees";
export interface PlanStep {
  id: string;
  name: string;
  kind: "id" | "document";
  routeId: string;
  mode: PlannerRoute["mode"];
  routeLabel: string;
  prerequisites: string[];
  canStart: boolean;
  eligibility: PlanTask[];
  requirements: PlanTask[];
  fee: { min: number; max: number };
  preferenceMismatch: boolean;
  overBudget: boolean;
  procedure: PlannerRoute["procedure"];
  refs: PlannerAcquisition["refs"];
}
export interface AcquisitionPlan {
  id: string;
  steps: PlanStep[];
  choices: Record<string, string[]>;
  fees: { min: number; max: number };
  missingDocuments: string[];
  questions: PlanTask[];
  satisfied: PlanTask[];
  explanation: string;
}
export interface PlanningResult {
  targetId: string;
  catalogVersion: string;
  asOf: string;
  objective: PlanObjective;
  status: "owned" | "planned" | "needs-input" | "blocked" | "incomplete";
  plans: AcquisitionPlan[];
  search: { complete: boolean; operations: number; limit: number };
  diagnostics: {
    cycles: string[][];
    unavailable: string[];
    ineligible: string[];
  };
}
