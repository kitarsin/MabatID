import { recommendAcquisitions } from "@/lib/planner/recommendations";
import { planningRateLimiter } from "@/lib/planner/rate-limit";
import {
  parseTreeInput,
  PlanningRequestError,
  readPlanningRequest,
} from "@/lib/planner/request";

export const maxDuration = 30;

export async function POST(request: Request) {
  const headers = { "Cache-Control": "no-store" };
  try {
    const limited = await planningRateLimiter()(request);
    if (limited) return limited;
    return Response.json(
      recommendAcquisitions(parseTreeInput(await readPlanningRequest(request))),
      { headers },
    );
  } catch (error) {
    if (error instanceof PlanningRequestError)
      return Response.json(
        { error: { code: "INVALID_REQUEST", message: error.message } },
        { status: error.status, headers },
      );
    console.error("Skill tree planning failed", error);
    return Response.json(
      {
        error: {
          code: "PLANNING_FAILED",
          message: "Could not update your skill tree. Please try again.",
        },
      },
      { status: 500, headers },
    );
  }
}
