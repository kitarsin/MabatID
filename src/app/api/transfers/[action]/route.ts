import "server-only";
import { relayConfig, relayHandler } from "@/lib/transfers/server";
async function handle(request: Request, context: { params: Promise<{ action: string }> }) {
  return relayHandler(relayConfig())(request,(await context.params).action);
}
export const GET = handle;
export const POST = handle;
