import { buildPlannerCatalog } from "@/lib/planner/catalog";
import { planAcquisition } from "@/lib/planner/engine";
import { planningRateLimiter } from "@/lib/planner/rate-limit";
import {
  parsePlanningInput,
  PlanningRequestError,
  readPlanningRequest,
} from "@/lib/planner/request";

export const maxDuration = 30;

/** Profile inputs are not persisted; only shared, anonymous rate counters are updated. */
export async function POST(request: Request) {
  const headers = { "Cache-Control": "no-store" };
  try {
    const limited = await planningRateLimiter()(request);
    if (limited) return limited;
    const input = parsePlanningInput(await readPlanningRequest(request));
    return Response.json(
      planAcquisition(buildPlannerCatalog(input), input.targetId, {
        objective: input.objective,
      }),
      { headers },
    );
  } catch (error) {
    if (error instanceof PlanningRequestError)
      return Response.json(
        { error: { code: "INVALID_REQUEST", message: error.message } },
        { status: error.status, headers },
      );
    return Response.json(
      {
        error: {
          code: "PLANNING_FAILED",
          message: "Could not generate a plan. Please try again.",
        },
      },
      { status: 500, headers },
    );
  }
}
