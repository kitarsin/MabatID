import type { TreeNodeStatus } from "./planner/recommendations";

export const TREE_STATUS_LABELS: Record<TreeNodeStatus, string> = {
  owned: "You have it",
  available: "Ready to apply",
  preparation: "Still preparing",
  confirmation: "Needs a check",
  ineligible: "Check if you qualify",
  unresolved: "Check what’s needed",
};
