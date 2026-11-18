/** Browser-safe protocol constants. No server credentials or database clients. */
export const TRANSFER_ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
export const CODE_LENGTH = 12;
export const CODE_TTL_MS = 10 * 60 * 1000;
export const normalizeCode = (input: string) => input.toUpperCase().replace(/[\s-]/g, "");
export const validCode = (value: unknown): value is string => typeof value === "string" && value.length === CODE_LENGTH && [...value].every((c) => TRANSFER_ALPHABET.includes(c));
export const formatCode = (code: string) => code.match(/.{1,4}/g)?.join("-") ?? "";
export const validToken = (value: unknown): value is string => typeof value === "string" && /^[a-f0-9]{64}$/.test(value);
export const validId = (value: unknown): value is string => typeof value === "string" && /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(value);
export interface TransferCode { id: string; code: string; ownerToken: string; expiresAt: number; remainingMs: number }
export interface TransferClaim { id: string; expiresAt: number; backup: string | null; completed: boolean }
export class TransferError extends Error {
  constructor(public kind: "unavailable" | "invalid" | "not-found" | "limited" | "network" | "storage") {
    super({ unavailable: "Code transfers are unavailable right now. You can use a JSON backup instead.", invalid: "Enter all 12 characters from your other device.", "not-found": "This code is invalid, expired, already used, or reserved by another device.", limited: "Too many transfer requests. Wait a few minutes and try again.", network: "Could not connect. Your saved profiles have not been changed.", storage: "Allow session storage to receive a code, or use a JSON backup instead." }[kind]);
  }
}
