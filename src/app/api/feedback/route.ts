import "server-only";
import { engagementConfig, engagementHandler } from "@/lib/engagement/server";

export function POST(request: Request) {
  return engagementHandler(engagementConfig())(request, "feedback");
}
