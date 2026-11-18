import { createHmac } from "node:crypto";
import { isIP } from "node:net";
import { engagementConfig, engagementDatabase, type EngagementDatabase } from "../engagement/server";
import { trustedIpHeader } from "../server/client-ip";

export const PLANNING_LIMITS = { global: 300, client: 60, seconds: 60 } as const;

const rejection = (status: 429 | 503) => Response.json({
  error: {
    code: status === 429 ? "RATE_LIMITED" : "PLANNING_UNAVAILABLE",
    message: status === 429
      ? "Too many planning requests. Please try again in a minute."
      : "Planning is temporarily unavailable. Please try again shortly.",
  },
}, { status, headers: { "Cache-Control": "no-store", "Retry-After": "60" } });

/** Both planning endpoints share Postgres counters across all Vercel function instances. */
export function planningRateLimiter(
  env: Readonly<Record<string, string | undefined>> = process.env,
  database?: EngagementDatabase,
) {
  return async (request: Request): Promise<Response | null> => {
    // Local development and unit tests do not consume production request quotas.
    if (env.NODE_ENV !== "production" && env.VERCEL !== "1") return null;
    const config = engagementConfig(env);
    if (!config) return rejection(503);
    try {
      const header = trustedIpHeader(env, env.PLANNING_TRUSTED_IP_HEADER);
      const ip = header ? request.headers.get(header)?.trim() : undefined;
      // Vercel supplies a trusted IP. Missing/invalid metadata must not disable its per-IP limit.
      if ((env.VERCEL === "1" || ip) && (!ip || isIP(ip) === 0)) return rejection(503);
      const db = database ?? engagementDatabase(config);
      const scope = env.VERCEL_ENV === "preview" ? "preview" : "production";
      const consume = async (bucket: string, limit: number) => {
        const allowed = await db.rpc("mabatid_engagement_rate", {
          p_bucket: bucket, p_limit: limit, p_seconds: PLANNING_LIMITS.seconds,
        });
        if (typeof allowed !== "boolean") throw new Error("Invalid rate response");
        return allowed;
      };
      if (ip) {
        const hash = createHmac("sha256", Buffer.from(config.signingSecret, "hex"))
          .update(`mabatid-planning-ip-v1\0${ip}`).digest("hex");
        if (!await consume(`planning:${scope}:ip:${hash}`, PLANNING_LIMITS.client)) return rejection(429);
      }
      if (!await consume(`planning:${scope}:global`, PLANNING_LIMITS.global)) return rejection(429);
      return null;
    } catch {
      // Missing schema or an unavailable limiter must never expose the expensive planner unbounded.
      return rejection(503);
    }
  };
}
