import { buildPlannerCatalog } from "@/lib/planner/catalog";
import { planAcquisition } from "@/lib/planner/engine";
import {
  parsePlanningInput,
  PlanningRequestError,
  readPlanningRequest,
} from "@/lib/planner/request";

/** Stateless, private preview. Profiles remain local until authentication/persistence integration. */
export async function POST(request: Request) {
  const headers = { "Cache-Control": "no-store" };
  try {
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
