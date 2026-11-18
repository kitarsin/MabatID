import { createCipheriv, createDecipheriv, createHmac, randomBytes, randomInt } from "node:crypto";
import { createClient } from "@supabase/supabase-js";
import { MAX_BACKUP_BYTES, parseBackup } from "../backup";
import { CODE_LENGTH, TRANSFER_ALPHABET, validCode, validId, validToken } from "./protocol";

export interface RelayDatabase { rpc(name: string, args?: Record<string, unknown>): Promise<unknown> }
export interface RelayConfig { url: string; secretKey: string; codeSecret: string; trustedIpHeader?: string }
export class RelayError extends Error { constructor(public status: number, public kind: string) { super(kind); } }
export function relayConfig(env: Readonly<Record<string, string | undefined>> = process.env): RelayConfig | null {
  const { SUPABASE_URL: url, SUPABASE_SECRET_KEY: secretKey, TRANSFER_CODE_SECRET: codeSecret } = env;
  if (!url || !secretKey || !codeSecret || !/^[a-f0-9]{64}$/i.test(codeSecret)) return null;
  try { const parsed = new URL(url); if (parsed.protocol !== "https:" && !(parsed.protocol === "http:" && ["localhost", "127.0.0.1"].includes(parsed.hostname))) return null; } catch { return null; }
  return { url, secretKey, codeSecret, trustedIpHeader: env.TRANSFER_TRUSTED_IP_HEADER?.toLowerCase() };
}
export function supabaseDatabase(config: RelayConfig): RelayDatabase {
  // Never a browser/session client: user JWTs cannot replace this server role.
  const client = createClient(config.url, config.secretKey, { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false }, global: { fetch: (input, init) => fetch(input, { ...init, signal: AbortSignal.timeout(10000) }) } });
  return { async rpc(name, args) { const { data, error } = await client.rpc(name, args); if (error) throw new RelayError(503, "unavailable"); return data; } };
}
export class TransferRelay {
  constructor(private db: RelayDatabase, private config: RelayConfig) {}
  fingerprint(domain: string, value: string) { return createHmac("sha256", Buffer.from(this.config.codeSecret,"hex")).update(`${domain}\0${value}`).digest("hex"); }
  private encryptionKey() { return Buffer.from(this.fingerprint("encryption-key", "v1"), "hex"); }
  encrypt(value: { id: string; backup: string; code: string }) {
    const iv = randomBytes(12), cipher = createCipheriv("aes-256-gcm", this.encryptionKey(), iv);
    cipher.setAAD(Buffer.from("mabatid-transfer-v1"));
    const ciphertext = Buffer.concat([cipher.update(JSON.stringify(value),"utf8"),cipher.final()]);
    return Buffer.concat([iv,cipher.getAuthTag(),ciphertext]).toString("base64");
  }
  decrypt(value: string): { id: string; backup: string; code: string } {
    try {
      const raw = Buffer.from(value,"base64"), decipher = createDecipheriv("aes-256-gcm",this.encryptionKey(),raw.subarray(0,12));
      decipher.setAAD(Buffer.from("mabatid-transfer-v1")); decipher.setAuthTag(raw.subarray(12,28));
      const result = JSON.parse(Buffer.concat([decipher.update(raw.subarray(28)),decipher.final()]).toString("utf8"));
      if (!validId(result.id) || typeof result.backup !== "string" || !validCode(result.code)) throw new Error();
      return result;
    } catch { throw new RelayError(503,"unavailable"); }
  }
  async limit(action: string, request: Request) {
    const limits: Record<string, number> = { create: 20, claim: 60, finish: 120, release: 60, revoke: 60 };
    const global = await this.db.rpc("mabatid_transfer_rate", { p_bucket: `global:${action}`, p_limit: limits[action], p_seconds: 60 });
    if (global !== true) throw new RelayError(429,"limited");
    // Trust only an explicitly configured header that the deployment proxy overwrites.
    const ip = this.config.trustedIpHeader ? request.headers.get(this.config.trustedIpHeader) : null;
    if (ip) {
      const allowed = await this.db.rpc("mabatid_transfer_rate", { p_bucket: `${action}:${this.fingerprint("client",ip.slice(0,256))}`, p_limit: action === "create" ? 5 : 20, p_seconds: 60 });
      if (allowed !== true) throw new RelayError(429,"limited");
    }
  }
  async handle(action: string, body: Record<string, unknown>) {
    if (action === "create") {
      if (!validId(body.id) || !validToken(body.ownerToken) || typeof body.backup !== "string") throw new RelayError(400,"invalid");
      if (Buffer.byteLength(body.backup,"utf8") > MAX_BACKUP_BYTES) throw new RelayError(413,"invalid");
      try { await parseBackup(body.backup); } catch { throw new RelayError(400,"invalid"); }
      const code = Array.from({ length: CODE_LENGTH },() => TRANSFER_ALPHABET[randomInt(TRANSFER_ALPHABET.length)]).join("");
      const row = await this.db.rpc("mabatid_transfer_create", { p_id: body.id, p_code_hash: this.fingerprint("code",code), p_owner_hash: this.fingerprint("owner",body.ownerToken), p_ciphertext: this.encrypt({ id: body.id, backup: body.backup, code }) }) as Record<string, unknown> | null;
      if (row?.full) throw new RelayError(503,"unavailable");
      if (!row || typeof row.ciphertext !== "string" || typeof row.expiresAt !== "string") throw new RelayError(404,"not-found");
      const bundle = this.decrypt(row.ciphertext);
      if (bundle.id !== body.id || row.id !== body.id || bundle.backup !== body.backup) throw new RelayError(404,"not-found");
      return { id: row.id, code: bundle.code, expiresAt: Date.parse(row.expiresAt), remainingMs: Math.max(0,Date.parse(row.expiresAt)-Date.now()) };
    }
    if (action === "claim") {
      if (!validCode(body.code) || !validToken(body.claimToken)) throw new RelayError(400,"invalid");
      const row = await this.db.rpc("mabatid_transfer_claim", { p_code_hash: this.fingerprint("code",body.code), p_claim_hash: this.fingerprint("claim",body.claimToken) }) as Record<string, unknown> | null;
      if (!row) throw new RelayError(404,"not-found");
      if (!validId(row.id)) throw new RelayError(503,"unavailable");
      const bundle = row.completed === true ? null : this.decrypt(String(row.ciphertext));
      // The authenticated bundle binds its content to both the transfer ID and readable code.
      // Copying valid ciphertext into another database row cannot turn this endpoint into a decryption oracle.
      if (bundle && (bundle.id !== row.id || bundle.code !== body.code)) throw new RelayError(503,"unavailable");
      return { id: row.id, expiresAt: Date.parse(String(row.expiresAt)), completed: row.completed === true, backup: bundle?.backup ?? null };
    }
    if (!validId(body.id)) throw new RelayError(400,"invalid");
    const owner = action === "revoke", token = owner ? body.ownerToken : body.claimToken;
    if (!validToken(token)) throw new RelayError(400,"invalid");
    const result = await this.db.rpc(`mabatid_transfer_${action}`, { p_id: body.id, [owner ? "p_owner_hash" : "p_claim_hash"]: this.fingerprint(owner ? "owner" : "claim",token) });
    if (result !== true) throw new RelayError(404,"not-found");
    return { ok: true };
  }
}
const headers = { "Cache-Control": "no-store", "Content-Type": "application/json", "Referrer-Policy": "no-referrer", "X-Content-Type-Options": "nosniff" };
const response = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { ...headers, ...(status === 429 ? { "Retry-After": "60" } : {}) } });
/** Bounded streaming parser; the raw request body may JSON-escape every backup character. */
async function readBody(request: Request) {
  if (request.headers.get("content-type")?.toLowerCase().split(";")[0].trim() !== "application/json") throw new RelayError(415,"invalid");
  const limit = MAX_BACKUP_BYTES * 6 + 4096;
  const declared = Number(request.headers.get("content-length") ?? 0);
  if (!Number.isFinite(declared) || declared < 0 || declared > limit) throw new RelayError(413,"invalid");
  if (!request.body) throw new RelayError(400,"invalid");
  const reader = request.body.getReader(), chunks: Uint8Array[] = []; let length = 0;
  try {
    while (true) { const { value, done } = await reader.read(); if (done) break; length += value.byteLength; if (length > limit) { await reader.cancel(); throw new RelayError(413,"invalid"); } chunks.push(value); }
    const raw = JSON.parse(Buffer.concat(chunks).toString("utf8"));
    if (!raw || typeof raw !== "object" || Array.isArray(raw) || Object.keys(raw).length > 5) throw new Error();
    return raw as Record<string, unknown>;
  } catch (e) { if (e instanceof RelayError) throw e; throw new RelayError(400,"invalid"); }
  finally { reader.releaseLock(); }
}
export function relayHandler(config: RelayConfig | null, database?: RelayDatabase) {
  return async (request: Request, action: string) => {
    if (!config) return response({ error: "unavailable" },503);
    const relay = new TransferRelay(database ?? supabaseDatabase(config),config);
    try {
      if (action === "status" && request.method === "GET") {
        const ready = await (database ?? supabaseDatabase(config)).rpc("mabatid_transfer_health");
        return response({ enabled: ready === 1 });
      }
      if (!["create","claim","finish","release","revoke"].includes(action) || request.method !== "POST") return response({ error: "invalid" },405);
      const origin = request.headers.get("origin");
      const target = new URL(request.url);
      let browserOrigin: URL | null = null;
      try { browserOrigin = origin ? new URL(origin) : null; } catch { throw new RelayError(403,"invalid"); }
      // Next's internal request URL can use the bind hostname (0.0.0.0).
      // Host is the browser's HTTP destination; never trust X-Forwarded-Host here.
      const destination = (request.headers.get("host") ?? target.host).toLowerCase();
      const secureOrigin = browserOrigin?.protocol === "https:" || (browserOrigin?.protocol === "http:" && ["localhost","127.0.0.1","[::1]"].includes(browserOrigin.hostname));
      if (!browserOrigin || browserOrigin.origin !== origin || browserOrigin.host !== destination || !secureOrigin || request.headers.get("sec-fetch-site") === "cross-site") throw new RelayError(403,"invalid");
      await relay.limit(action,request);
      const body = await readBody(request);
      return response(await relay.handle(action,body));
    } catch (e) { return response({ error: e instanceof RelayError ? e.kind : "unavailable" },e instanceof RelayError ? e.status : 503); }
  };
}
