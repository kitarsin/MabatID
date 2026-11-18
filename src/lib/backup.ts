import { CARDS } from "@/data/cards";
import { EXTRA_DOCUMENTS } from "@/data/documents";
import { DETAILS } from "@/data/details";
import { FACTS } from "@/data/facts";
import { BUDGETS, SETUPS } from "./prefs";
import { isCalendarDate } from "./documents";
import { preparationKeys } from "./prepare";
import { normalizeProfile, type User } from "./profile";
import { canonical, contentEqual, digest, HISTORY_LIMIT, profileContent, validHistory } from "./revisions";

export const BACKUP_FORMAT = "mabatid-profile-backup";
export const BACKUP_VERSION = 1;
export const MAX_BACKUP_BYTES = 1024 * 1024;
export interface ParsedBackup { profile: User; warnings: string[]; exportedAt: string }
export class BackupError extends Error {}
function fail(message: string): never { throw new BackupError(message); }
const object = (v: unknown): v is Record<string, unknown> => !!v && typeof v === "object" && !Array.isArray(v);
const text = (v: unknown, max = 256): v is string => typeof v === "string" && v.length > 0 && v.length <= max;
const stringArray = (v: unknown) => Array.isArray(v) && v.length <= 512 && v.every((x) => text(x));
const evidenceDates = ["issuedOn", "expiresOn"];
const evidenceFlags = ["noPrintedExpiry", "validityConfirmed", "photoSignature", "philsysFields", "addressCurrent"];

/** Bound depth, width, total nodes and strings before walking untrusted fields. */
function checkComplexity(value: unknown) {
  let count = 0;
  function visit(v: unknown, depth: number) {
    if (++count > 20000 || depth > 12) fail("This backup is too complex.");
    if (typeof v === "string" && v.length > 2048) fail("A backup field is too long.");
    if (v && typeof v === "object") {
      const entries = Object.entries(v);
      if (entries.length > (Array.isArray(v) ? 512 : 256)) fail("This backup has too many entries.");
      for (const [k, x] of entries) {
        if (["__proto__", "constructor", "prototype"].includes(k) || k.length > 256) fail("This backup contains an unsafe field.");
        visit(x, depth + 1);
      }
    }
  }
  visit(value, 0);
}
function validateFields(p: Record<string, unknown>) {
  if (!text(p.id, 128) || !text(p.name, 40) || !(p.name as string).trim() ||
    !Number.isInteger(p.age) || (p.age as number) < 0 || (p.age as number) > 120 ||
    typeof p.createdAt !== "number" || !Number.isFinite(p.createdAt) || !stringArray(p.owned))
    fail("Invalid profile identity, nickname, age, creation date or document list.");
  for (const k of ["onboarded", "needsChecklistReview"])
    if (p[k] !== undefined && typeof p[k] !== "boolean") fail(`Invalid ${k} field.`);
  if (p.tracking !== undefined && !stringArray(p.tracking)) fail("Invalid tracked goals.");
  if (p.priority !== undefined && p.priority !== null && !text(p.priority)) fail("Invalid priority.");
  // Unknown preference values may be from an obsolete catalog; types must still be valid.
  for (const k of ["budget", "setup"]) if (p[k] !== undefined && !text(p[k])) fail(`Invalid ${k} preference.`);
  for (const k of ["facts", "prep", "modes", "documents"]) {
    if (p[k] === undefined) continue;
    if (!object(p[k])) fail(`Invalid ${k} structure.`);
    for (const v of Object.values(p[k] as Record<string, unknown>)) {
      if (k === "facts" && typeof v !== "boolean") fail("Answers must be true or false.");
      if (k === "prep" && !stringArray(v)) fail("Invalid checklist progress.");
      if (k === "modes" && !text(v)) fail("Invalid application route.");
      if (k === "documents") {
        if (!object(v)) fail("Invalid document evidence.");
        for (const [field, entry] of Object.entries(v)) {
          if (evidenceDates.includes(field) && !isCalendarDate(entry)) fail("Invalid recorded document date.");
          if (evidenceFlags.includes(field) && typeof entry !== "boolean") fail("Invalid document confirmation.");
        }
      }
    }
  }
}

export async function exportBackup(profile: User, now = new Date()): Promise<string> {
  const revision = await validHistory(profile.revision, profile);
  return JSON.stringify({
    format: BACKUP_FORMAT, version: BACKUP_VERSION, exportedAt: now.toISOString(),
    profile: profileContent(profile), contentHash: await digest(profileContent(profile)),
    ...(revision ? { revision } : {}),
  }, null, 2);
}

/** Transport-independent: a future code service passes the same JSON here. No writes. */
export async function parseBackup(source: string): Promise<ParsedBackup> {
  if (new TextEncoder().encode(source).byteLength > MAX_BACKUP_BYTES) fail("Backup exceeds the 1 MiB file limit.");
  let raw: unknown;
  try { raw = JSON.parse(source); } catch { fail("Choose a valid JSON backup file."); }
  checkComplexity(raw);
  if (!object(raw) || raw.format !== BACKUP_FORMAT) fail("This is not a MabatID profile backup.");
  if (raw.version !== BACKUP_VERSION) fail("Unsupported backup version. Use a compatible MabatID version.");
  if (!text(raw.exportedAt, 64) || !Number.isFinite(Date.parse(raw.exportedAt))) fail("Invalid informational export date.");
  if (!object(raw.profile)) fail("The backup has no valid profile.");
  validateFields(raw.profile);
  const original = raw.profile as unknown as User;
  if (typeof raw.contentHash !== "string" || raw.contentHash !== await digest(profileContent(original)))
    fail("Backup content does not match its fingerprint. The file may be damaged or edited.");
  const profile = normalizeProfile(original)!;
  const warnings: string[] = [];
  if (object(raw.revision) && Array.isArray(raw.revision.nodes) && raw.revision.nodes.length > HISTORY_LIMIT)
    fail(`Backup revision history exceeds the ${HISTORY_LIMIT}-node limit.`);
  const revision = await validHistory(raw.revision, original);
  if (!revision) warnings.push("Revision history is missing, invalid, or does not match the profile. Freshness cannot be reliably determined; importing starts a new revision.");
  // Show every normalization, including obsolete catalog/checklist IDs, before saving.
  for (const change of diffProfiles(original, profile))
    warnings.push(`Unrecognized or obsolete data / normalization — ${change.label}: ${change.before} → ${change.after}`);
  const documentIds = new Set([...CARDS, ...EXTRA_DOCUMENTS].map((c) => c.id));
  const cardIds = new Set(CARDS.map((c) => c.id));
  for (const id of Object.keys(original.documents ?? {}))
    if (!documentIds.has(id)) warnings.push(`Unrecognized document entry “${id}” will be omitted.`);
  for (const [id, keys] of Object.entries(original.prep ?? {})) {
    if (!cardIds.has(id)) warnings.push(`Unrecognized checklist entry “${id}” will be omitted.`);
    else for (const key of keys) if (!preparationKeys(id).has(key)) warnings.push(`Unrecognized checklist key “${id}.${key}” will be omitted.`);
  }
  const allowed = new Set(Object.keys(profileContent(profile)));
  for (const key of Object.keys(raw.profile)) if (!allowed.has(key)) warnings.push(`Unrecognized profile field “${key}” will be omitted.`);
  for (const [id, evidence] of Object.entries(original.documents ?? {}))
    for (const key of Object.keys(evidence))
      if (![...evidenceDates, ...evidenceFlags].includes(key)) warnings.push(`Unrecognized document field “${id}.${key}” will be omitted.`);
  if (revision && contentEqual(original, profile)) profile.revision = revision;
  else if (revision) warnings.push("Sanitizing changes the saved content. A new revision will be recorded and freshness is unknown.");
  return { profile, warnings, exportedAt: raw.exportedAt };
}

export interface ProfileDifference { label: string; before: string; after: string }
const names = new Map([...CARDS, ...EXTRA_DOCUMENTS].map((c) => [c.id, c.name]));
const labels: Record<string, string> = {
  name: "Nickname", age: "Applicant age", createdAt: "Profile creation metadata",
  onboarded: "Setup completed", owned: "Owned IDs/documents", tracking: "Tracked goals",
  priority: "Priority", facts: "Eligibility answer", budget: "Budget", setup: "Application preference",
  documents: "Document evidence", modes: "Selected route", prep: "Checklist progress",
  needsChecklistReview: "Checklist review needed", issuedOn: "Issue date", expiresOn: "Expiry date",
  noPrintedExpiry: "No printed expiry", validityConfirmed: "Validity confirmed",
  photoSignature: "Photo and signature confirmed", philsysFields: "PhilSys fields confirmed", addressCurrent: "Current address confirmed",
};
const display = (v: unknown): string => v === undefined || v === null ? "Not recorded" :
  typeof v === "boolean" ? (v ? "Yes" : "No") :
  Array.isArray(v) ? (v.length ? v.map(display).join(", ") : "None") :
  typeof v === "string" ? names.get(v) ?? BUDGETS.find((b) => b.id === v)?.label ?? SETUPS.find((s) => s.id === v)?.label ?? v : String(v);
const checklistLabels = new Map(Object.entries(DETAILS).flatMap(([id, d]) => [
  [`${id}:funds`, "Application funds prepared"],
  ...d.req.prepare.flatMap((entry) => "either" in entry ? entry.either.flatMap((r) => r.items.map((i) => [`${id}:${i.id}`, i.t])) : [[`${id}:${entry.id}`, entry.t]]),
  ...[...d.steps.onsite, ...d.steps.online].map((step) => [`${id}:step:${step.id}`, step.t]),
] as [string, string][]));
function fieldDisplay(value: unknown, path: string[]): string {
  if (path[0] === "prep" && typeof value === "string")
    return (checklistLabels.get(`${path[1]}:${value}`) ?? value).replaceAll("**", "");
  if (path[0] === "modes" && (value === "online" || value === "onsite"))
    return value === "online" ? "Online route" : "On-site route";
  return display(value);
}
export function diffProfiles(before: User, after: User): ProfileDifference[] {
  const changes: ProfileDifference[] = [];
  function walk(a: unknown, b: unknown, path: string[]) {
    if (canonical(a) === canonical(b)) return;
    if ((object(a) || a === undefined) && (object(b) || b === undefined) && (object(a) || object(b))) {
      const aa = object(a) ? a : {}, bb = object(b) ? b : {};
      for (const k of new Set([...Object.keys(aa), ...Object.keys(bb)])) walk(aa[k], bb[k], [...path, k]);
    } else {
      const label = path.map((k) => labels[k] ?? names.get(k) ?? FACTS[k as keyof typeof FACTS] ?? k).join(" · ");
      if (Array.isArray(a) || Array.isArray(b)) {
        const aa = Array.isArray(a) ? a : [], bb = Array.isArray(b) ? b : [];
        for (const x of aa.filter((x) => !bb.includes(x))) changes.push({ label, before: fieldDisplay(x, path), after: "Removed" });
        for (const x of bb.filter((x) => !aa.includes(x))) changes.push({ label, before: "Not recorded", after: `Added: ${fieldDisplay(x, path)}` });
      } else changes.push({ label, before: fieldDisplay(a, path), after: fieldDisplay(b, path) });
    }
  }
  const a = profileContent(before), b = profileContent(after);
  for (const key of Object.keys(a).filter((k) => k !== "id")) walk(a[key as keyof typeof a], b[key as keyof typeof b], [key]);
  return changes;
}
