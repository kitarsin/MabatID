import { recommendAcquisitions } from "@/lib/planner/recommendations";
import {
  parseTreeInput,
  PlanningRequestError,
  readPlanningRequest,
} from "@/lib/planner/request";

export async function POST(request: Request) {
  const headers = { "Cache-Control": "no-store" };
  try {
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
