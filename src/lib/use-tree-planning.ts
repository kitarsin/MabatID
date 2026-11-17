"use client";

import { useEffect, useState } from "react";
import type {
  TreePlanningInput,
  TreePlanningResult,
} from "./planner/recommendations";
import type {
  AcquisitionPlan,
  PlanObjective,
  PlanningResult,
} from "./planner/types";

export interface PlanningView {
  result?: PlanningResult;
  plan?: AcquisitionPlan;
  loading: boolean;
  error?: string;
  objective: PlanObjective;
  onObjectiveChange: (objective: PlanObjective) => void;
  onSelectPlan: (id: string) => void;
  onRetry: () => void;
}

/** One response drives recommendations, the graph and the guide; stale responses never cross profiles. */
export function useTreePlanning(input: TreePlanningInput, enabled: boolean) {
  const requestKey = JSON.stringify(input);
  const [response, setResponse] = useState<{
    key: string;
    data?: TreePlanningResult;
    error?: string;
  } | null>(null);
  const [selection, setSelection] = useState<{
    key: string;
    id: string;
  } | null>(null);
  const [retry, setRetry] = useState(0);
  useEffect(() => {
    if (!enabled) return;
    const controller = new AbortController();
    const timer = setTimeout(async () => {
      try {
        const result = await fetch("/api/plans/tree", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: requestKey,
          signal: controller.signal,
          cache: "no-store",
        });
        const json = await result.json();
        if (!result.ok)
          throw new Error(
            json.error?.message ?? "Could not update your paths.",
          );
        if (!controller.signal.aborted)
          setResponse({ key: requestKey, data: json });
      } catch (error) {
        if (!controller.signal.aborted)
          setResponse({
            key: requestKey,
            error:
              error instanceof Error
                ? error.message
                : "Could not update your paths.",
          });
      }
    }, 350);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [requestKey, enabled, retry]);
  const current = response?.key === requestKey ? response : null;
  const data = current?.data;
  const plan =
    data?.goal?.plans.find(
      (p) => selection?.key === requestKey && p.id === selection.id,
    ) ?? data?.goal?.plans[0];
  return {
    data,
    plan,
    loading: enabled && !current,
    error: current?.error,
    onSelectPlan: (id: string) => setSelection({ key: requestKey, id }),
    onRetry: () => {
      setResponse(null);
      setRetry((n) => n + 1);
    },
  };
}
