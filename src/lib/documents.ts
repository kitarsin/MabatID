/** Only dates and self-reported format checks are stored, never ID numbers or scans. */
export interface DocumentEvidence {
  issuedOn?: string;
  expiresOn?: string;
  noPrintedExpiry?: boolean;
  validityConfirmed?: boolean;
  photoSignature?: boolean;
  philsysFields?: boolean;
  addressCurrent?: boolean;
}
export type DocumentCheck =
  "photoSignature" | "philsysFields" | "addressCurrent";
export type DocumentEvidenceMap = Record<string, DocumentEvidence>;
export const todayISO = () => new Date().toISOString().slice(0, 10);
export function isCalendarDate(value: unknown): value is string {
  return (
    typeof value === "string" &&
    /^\d{4}-\d{2}-\d{2}$/.test(value) &&
    Number.isFinite(Date.parse(value)) &&
    new Date(value).toISOString().slice(0, 10) === value
  );
}
export function normalizeEvidence(value: unknown): DocumentEvidence {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  const raw = value as Record<string, unknown>;
  const result: DocumentEvidence = {};
  for (const key of ["issuedOn", "expiresOn"] as const)
    if (isCalendarDate(raw[key])) result[key] = raw[key];
  for (const key of [
    "noPrintedExpiry",
    "validityConfirmed",
    "photoSignature",
    "philsysFields",
    "addressCurrent",
  ] as const)
    if (typeof raw[key] === "boolean") result[key] = raw[key];
  if (result.noPrintedExpiry) delete result.expiresOn;
  return result;
}
export function documentValidity(
  evidence: DocumentEvidence = {},
  asOf = todayISO(),
) {
  if (
    evidence.issuedOn &&
    (!isCalendarDate(evidence.issuedOn) || evidence.issuedOn > asOf)
  )
    return {
      status: "needs-confirmation" as const,
      reason: "Enter a valid issue date that is not in the future.",
    };
  if (evidence.noPrintedExpiry) {
    if (!evidence.issuedOn)
      return {
        status: "needs-confirmation" as const,
        reason:
          "No printed expiry: enter the issue date and confirm current validity with the issuing barangay.",
      };
    if (!evidence.validityConfirmed)
      return {
        status: "needs-confirmation" as const,
        reason:
          "Confirm with the issuing barangay that this undated-expiry card is still valid. No expiry period is assumed.",
      };
    return {
      status: "valid" as const,
      reason:
        "Issue date recorded; current validity confirmed with the barangay.",
    };
  }
  if (!evidence.expiresOn || !isCalendarDate(evidence.expiresOn))
    return {
      status: "needs-confirmation" as const,
      reason:
        "Enter the printed expiry date, or select no printed expiry and enter the issue date.",
    };
  if (evidence.issuedOn && evidence.issuedOn > evidence.expiresOn)
    return {
      status: "needs-confirmation" as const,
      reason: "The expiry date must not precede the issue date.",
    };
  if (evidence.expiresOn < asOf)
    return {
      status: "expired" as const,
      reason:
        "This card has expired. Renew it or use another accepted document.",
    };
  return {
    status: "valid" as const,
    reason: "The recorded printed expiry date has not passed.",
  };
}
export function documentUsable(
  id: string,
  owned: ReadonlySet<string> | null,
  documents: DocumentEvidenceMap = {},
  checks: DocumentCheck[] = [],
  asOf?: string,
) {
  if (!owned?.has(id)) return false;
  if (id !== "barangay-id") return true;
  const evidence = documents[id] ?? {};
  return (
    documentValidity(evidence, asOf).status === "valid" &&
    checks.every((check) => evidence[check] === true)
  );
}
