import "server-only";
import { engagementConfig, engagementHandler } from "@/lib/engagement/server";

function handle(request: Request) {
  return engagementHandler(engagementConfig())(request, "likes");
}

export const GET = handle;
export const POST = handle;
