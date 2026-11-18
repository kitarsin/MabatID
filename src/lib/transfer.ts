import { TransferError, normalizeCode, type TransferClaim, type TransferCode } from "./transfers/protocol";
export * from "./transfers/protocol";
async function call<T>(action: string, body?: Record<string, unknown>): Promise<T> {
  let response: Response;
  try { response = await fetch(`/api/transfers/${action}`, { method: body ? "POST" : "GET", cache: "no-store", headers: body ? { "Content-Type": "application/json" } : undefined, body: body ? JSON.stringify(body) : undefined, signal: AbortSignal.timeout(15000) }); }
  catch { throw new TransferError("network"); }
  if (!response.ok) throw new TransferError(response.status === 429 ? "limited" : response.status === 404 ? "not-found" : response.status === 400 || response.status === 413 || response.status === 415 ? "invalid" : "unavailable");
  try { return await response.json() as T; } catch { throw new TransferError("network"); }
}
export const transferAvailable = async () => { try { return (await call<{ enabled: boolean }>("status")).enabled === true; } catch { return false; } };
export const randomToken = () => [...crypto.getRandomValues(new Uint8Array(32))].map((n) => n.toString(16).padStart(2,"0")).join("");
export async function createTransferCode(backup: string, id: string, ownerToken: string): Promise<TransferCode> {
  return { ...await call<Omit<TransferCode,"ownerToken">>("create", { backup, id, ownerToken }), ownerToken };
}
export const redeemTransferCode = (code: string, claimToken: string) => call<TransferClaim>("claim", { code: normalizeCode(code), claimToken });
export const finishTransfer = (id: string, claimToken: string) => call("finish", { id, claimToken });
export const releaseTransfer = (id: string, claimToken: string) => call("release", { id, claimToken });
export const revokeTransfer = (id: string, ownerToken: string) => call("revoke", { id, ownerToken });
