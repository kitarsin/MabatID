import type { TreeNodeStatus } from "./planner/recommendations";

export const TREE_STATUS_LABELS: Record<TreeNodeStatus, string> = {
  owned: "Already have",
  available: "Requirements ready",
  preparation: "Needs preparation",
  confirmation: "Needs confirmation",
  ineligible: "Review eligibility",
  unresolved: "Review requirements",
};
