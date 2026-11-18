import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import { createClient } from "@supabase/supabase-js";
import { isTally, parseFeedback } from "./protocol";
import { trustedIpHeader } from "../server/client-ip";

export interface EngagementConfig { url: string; secretKey: string; signingSecret: string; trustedIpHeader?: string }
export interface EngagementDatabase { rpc(name: string, args: Record<string, unknown>): Promise<unknown> }

export function engagementConfig(env: Readonly<Record<string, string | undefined>> = process.env): EngagementConfig | null {
  const url = env.SUPABASE_URL, secretKey = env.SUPABASE_SECRET_KEY;
  const signingSecret = env.ENGAGEMENT_SECRET || env.TRANSFER_CODE_SECRET;
  if (!url || !secretKey || !signingSecret || !/^[a-f0-9]{64}$/i.test(signingSecret)) return null;
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== "https:" && !(parsed.protocol === "http:" && ["localhost", "127.0.0.1"].includes(parsed.hostname))) return null;
  } catch { return null; }
  return { url, secretKey, signingSecret, trustedIpHeader: trustedIpHeader(env, env.ENGAGEMENT_TRUSTED_IP_HEADER) };
}

export function engagementDatabase(config: EngagementConfig): EngagementDatabase {
  const client = createClient(config.url, config.secretKey, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    global: { fetch: (input, init) => fetch(input, { ...init, signal: AbortSignal.timeout(10000) }) },
  });
  return { async rpc(name, args) {
    const { data, error } = await client.rpc(name, args);
    if (error) throw new Error("Engagement database unavailable");
    return data;
  } };
}

class EngagementError extends Error {
  constructor(public status: number, public kind: string, public retryAfter?: number) { super(kind); }
}
const COOKIE = "mabatid-visitor";
function fingerprint(config: EngagementConfig, domain: string, value: string) {
  return createHmac("sha256", Buffer.from(config.signingSecret, "hex")).update(`mabatid-engagement-v1:${domain}\0${value}`).digest("hex");
}
function identity(request: Request, config: EngagementConfig) {
  const value = request.headers.get("cookie")?.split(";").map((part) => part.trim()).find((part) => part.startsWith(`${COOKIE}=`))?.slice(COOKIE.length + 1);
  if (!value || !/^[a-f0-9]{64}\.[a-f0-9]{64}$/.test(value)) return null;
  const [token, signature] = value.split(".");
  return timingSafeEqual(Buffer.from(signature, "hex"), Buffer.from(fingerprint(config, "cookie", token), "hex")) ? token : null;
}
function sameOrigin(request: Request) {
  const raw = request.headers.get("origin"), target = new URL(request.url);
  let origin: URL;
  try { origin = new URL(raw ?? ""); } catch { throw new EngagementError(403, "origin"); }
  const local = ["localhost", "127.0.0.1", "[::1]"].includes(origin.hostname);
  if (raw !== origin.origin || origin.host !== (request.headers.get("host") ?? target.host).toLowerCase() ||
    (origin.protocol !== "https:" && !(origin.protocol === "http:" && local)) ||
    request.headers.get("sec-fetch-site") === "cross-site") throw new EngagementError(403, "origin");
}
async function readBody(request: Request) {
  if (request.headers.get("content-type")?.split(";")[0].trim().toLowerCase() !== "application/json") throw new EngagementError(415, "invalid");
  const limit = 16384, length = Number(request.headers.get("content-length") ?? 0);
  if (!Number.isFinite(length) || length < 0 || length > limit) throw new EngagementError(413, "too-large");
  if (!request.body) throw new EngagementError(400, "invalid");
  const reader = request.body.getReader(), chunks: Uint8Array[] = [];
  let size = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > limit) { await reader.cancel(); throw new EngagementError(413, "too-large"); }
      chunks.push(value);
    }
    return JSON.parse(Buffer.concat(chunks).toString("utf8")) as unknown;
  } catch (error) {
    if (error instanceof EngagementError) throw error;
    throw new EngagementError(400, "invalid");
  } finally { reader.releaseLock(); }
}

export function engagementHandler(config: EngagementConfig | null, database?: EngagementDatabase) {
  return async (request: Request, action: "likes" | "feedback") => {
    const headers = new Headers({ "Cache-Control": "private, no-store", "Content-Type": "application/json", "X-Content-Type-Options": "nosniff", Vary: "Cookie" });
    const response = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers });
    if (!config) return response({ error: "unavailable" }, 503);
    try {
      const db = database ?? engagementDatabase(config);
      if (request.method !== "POST" && !(action === "likes" && request.method === "GET")) return response({ error: "method" }, 405);
      if (request.method === "POST") sameOrigin(request);
      else if (request.headers.get("sec-fetch-site") === "cross-site") throw new EngagementError(403, "origin");
      let visitor = identity(request, config);
      if (!visitor) {
        // Establish an identity before accepting mutations; never count a cookieless POST.
        if (request.method === "POST") throw new EngagementError(428, "cookies-required");
        visitor = randomBytes(32).toString("hex");
        const url = new URL(request.url);
        const secure = url.protocol === "https:" || !["localhost", "127.0.0.1", "[::1]"].includes(url.hostname);
        headers.set("Set-Cookie", `${COOKIE}=${visitor}.${fingerprint(config, "cookie", visitor)}; Path=/; Max-Age=31536000; HttpOnly; SameSite=Lax${secure ? "; Secure" : ""}`);
      }
      const browserHash = fingerprint(config, "browser", visitor);
      if (request.method === "GET") {
        const tally = await db.rpc("mabatid_like_tally", { p_browser_hash: browserHash });
        if (!isTally(tally)) throw new Error("Invalid tally");
        return response(tally);
      }
      const feedback = action === "feedback" ? parseFeedback(await readBody(request)) : null;
      if (action === "feedback" && !feedback) throw new EngagementError(400, "invalid");
      const rate = async (bucket: string, limit: number, seconds: number) => {
        const allowed = await db.rpc("mabatid_engagement_rate", { p_bucket: bucket, p_limit: limit, p_seconds: seconds });
        if (allowed !== true) throw new EngagementError(429, "limited", seconds);
      };
      await rate(`global:${action}`, action === "likes" ? 120 : 20, 60);
      await rate(`browser:${action}:${browserHash}`, action === "likes" ? 10 : 3, action === "likes" ? 60 : 3600);
      const ip = config.trustedIpHeader ? request.headers.get(config.trustedIpHeader) : null;
      if (ip) await rate(`ip:${action}:${fingerprint(config, "ip", ip.slice(0, 256))}`, action === "likes" ? 30 : 10, 3600);
      if (feedback) {
        const saved = await db.rpc("mabatid_feedback_submit", { p_browser_hash: browserHash, p_submission_id: feedback.submissionId, p_message: feedback.message, p_rating: feedback.rating });
        if (saved !== true) throw new EngagementError(409, "conflict");
        return response({ ok: true });
      }
      const tally = await db.rpc("mabatid_like_add", { p_browser_hash: browserHash });
      if (!isTally(tally) || !("already" in tally) || typeof tally.already !== "boolean") throw new Error("Invalid tally");
      return response(tally, tally.already ? 409 : 200);
    } catch (error) {
      if (error instanceof EngagementError && error.retryAfter) headers.set("Retry-After", String(error.retryAfter));
      return response({ error: error instanceof EngagementError ? error.kind : "unavailable" }, error instanceof EngagementError ? error.status : 503);
    }
  };
}
