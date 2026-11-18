import type { User } from "./profile";

/**
 * Device-to-device transfer — FRONTEND CONTRACT ONLY.
 *
 * The UI (Settings → "Move to another device") calls `createTransferCode` on the old device and
 * `redeemTransferCode` on the new one. The backend is not built yet: until it is, set nothing here and the
 * UI shows a "Preview" badge; creating returns a sample code and redeeming fails with `not-connected`.
 *
 * For the backend:
 * - Store `TransferPayload` against a short one-time code (8 characters from TRANSFER_ALPHABET).
 * - Codes expire (suggested: 10 minutes) and are deleted once redeemed.
 * - The payload is the whole device profile. The acquisition plan is not stored separately: it is
 *   re-computed from the profile's documents, answers (`facts`), checklist ticks (`prep`), chosen
 *   application routes (`modes`), `tracking` and `priority`.
 * - Rate-limit redeem attempts; codes are guessable by brute force otherwise.
 */

export interface TransferPayload {
  version: 1;
  exportedAt: string; // ISO time
  profile: User;
}

export interface TransferCode {
  /** 8 characters, no separator. Display with `formatCode`. */
  code: string;
  /** Epoch ms. */
  expiresAt: number;
}

export type TransferErrorKind =
  | "not-connected"
  | "invalid"
  | "not-found"
  | "expired"
  | "network";

export class TransferError extends Error {
  constructor(public kind: TransferErrorKind) {
    super(kind);
  }
}

/** Flip to true when the backend endpoints below are implemented. */
export const TRANSFER_CONNECTED = false;

/** No 0/O or 1/I/L, so codes are easy to read aloud and type. */
export const TRANSFER_ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
export const CODE_LENGTH = 8;
export const CODE_TTL_MS = 10 * 60 * 1000;

export function buildPayload(profile: User): TransferPayload {
  return { version: 1, exportedAt: new Date().toISOString(), profile };
}

/** Keep only allowed characters, upper-cased, max 8. */
export function normalizeCode(input: string): string {
  return input
    .toUpperCase()
    .split("")
    .filter((c) => TRANSFER_ALPHABET.includes(c))
    .join("")
    .slice(0, CODE_LENGTH);
}

/** "ABCD2345" → "ABCD-2345". */
export function formatCode(code: string): string {
  return code.length > 4 ? `${code.slice(0, 4)}-${code.slice(4)}` : code;
}

const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** TODO(backend): POST the payload, receive { code, expiresAt }. */
export async function createTransferCode(
  payload: TransferPayload,
): Promise<TransferCode> {
  void payload;
  await wait(700);
  // Sample code so the UI can be reviewed before the backend exists. It cannot be redeemed.
  const bytes = crypto.getRandomValues(new Uint8Array(CODE_LENGTH));
  const code = [...bytes]
    .map((b) => TRANSFER_ALPHABET[b % TRANSFER_ALPHABET.length])
    .join("");
  return { code, expiresAt: Date.now() + CODE_TTL_MS };
}

/** TODO(backend): exchange a code for its payload (then delete it server-side). */
export async function redeemTransferCode(
  code: string,
): Promise<TransferPayload> {
  if (normalizeCode(code).length !== CODE_LENGTH)
    throw new TransferError("invalid");
  await wait(700);
  throw new TransferError("not-connected");
}
