import type { User } from "./profile";

export const HISTORY_LIMIT = 64;
export interface RevisionNode {
  id: string;
  nonce: string;
  parents: string[];
  contentHash: string;
}
export interface RevisionHistory {
  head: string;
  nodes: RevisionNode[];
}
export type Comparison = "same" | "newer" | "older" | "conflict" | "unknown";

/** Stable JSON: object key order and set ordering never make a saved edit. */
export function canonical(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonical).join(",")}]`;
  if (value && typeof value === "object")
    return `{${Object.entries(value).filter(([, v]) => v !== undefined).sort(([a], [b]) => a < b ? -1 : a > b ? 1 : 0).map(([k, v]) => `${JSON.stringify(k)}:${canonical(v)}`).join(",")}}`;
  return JSON.stringify(value) ?? "null";
}
const sorted = (v: string[] = []) => [...new Set(v)].sort();
const nonempty = (v: Record<string, unknown> = {}) => Object.fromEntries(
  Object.entries(v).filter(([, x]) => x !== undefined && (Array.isArray(x) ? x.length > 0 : x && typeof x === "object" ? Object.keys(x).length > 0 : true)),
);
/** Only persisted inputs. Recommendations and revision/export times are excluded. */
export function profileContent(p: User) {
  return {
    id: p.id, name: p.name, age: p.age, createdAt: p.createdAt,
    onboarded: p.onboarded ?? false, owned: sorted(p.owned),
    budget: p.budget ?? "any", setup: p.setup ?? "both",
    tracking: sorted(p.tracking), priority: p.priority ?? null,
    facts: nonempty(p.facts), modes: nonempty(p.modes),
    prep: nonempty(Object.fromEntries(Object.entries(p.prep ?? {}).map(([k, v]) => [k, sorted(v)]))),
    documents: nonempty(p.documents), needsChecklistReview: p.needsChecklistReview ?? false,
  };
}
export const contentEqual = (a: User, b: User) => canonical(profileContent(a)) === canonical(profileContent(b));
export const profileToken = (p?: User) => p ? canonical({ content: profileContent(p), revision: p.revision ?? null }) : null;
export async function digest(value: unknown): Promise<string> {
  const hash = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(canonical(value)));
  return [...new Uint8Array(hash)].map((b) => b.toString(16).padStart(2, "0")).join("");
}
const nodeId = (profileId: string, n: Omit<RevisionNode, "id">) => digest({ profileId, ...n });

/** Invalid or missing metadata is never accepted as evidence of freshness. */
export async function validHistory(value: unknown, p: User): Promise<RevisionHistory | undefined> {
  if (!value || typeof value !== "object") return;
  const h = value as RevisionHistory;
  if (typeof h.head !== "string" || !Array.isArray(h.nodes) || !h.nodes.length || h.nodes.length > HISTORY_LIMIT) return;
  const seen = new Map<string, RevisionNode>();
  for (const n of h.nodes) {
    if (!n || typeof n !== "object" || !/^[a-f0-9]{64}$/.test(n.id) ||
      typeof n.nonce !== "string" || !n.nonce || n.nonce.length > 128 ||
      !/^[a-f0-9]{64}$/.test(n.contentHash) || !Array.isArray(n.parents) || n.parents.length > 2 ||
      n.parents.some((id) => typeof id !== "string" || !/^[a-f0-9]{64}$/.test(id)) ||
      new Set(n.parents).size !== n.parents.length || seen.has(n.id)) return;
    const { id, nonce, parents, contentHash } = n;
    if (id !== await nodeId(p.id, { nonce, parents, contentHash })) return;
    seen.set(id, { id, nonce, parents, contentHash });
  }
  if (seen.get(h.head)?.contentHash !== await digest(profileContent(p))) return;
  const visiting = new Set<string>(), reached = new Set<string>();
  function visit(id: string): boolean {
    if (visiting.has(id)) return false;
    if (reached.has(id) || !seen.has(id)) return true; // pruned boundary
    visiting.add(id);
    if (!seen.get(id)!.parents.every(visit)) return false;
    visiting.delete(id); reached.add(id); return true;
  }
  if (!visit(h.head) || reached.size !== seen.size) return;
  return { head: h.head, nodes: [...seen.values()] };
}

/** Breadth-first retention keeps both resolution parents before older ancestry. */
function bound(head: string, nodes: RevisionNode[]): RevisionHistory {
  const map = new Map(nodes.map((n) => [n.id, n]));
  const queue = [head], kept = new Map<string, RevisionNode>();
  while (queue.length && kept.size < HISTORY_LIMIT) {
    const id = queue.shift()!, n = map.get(id);
    if (!n || kept.has(id)) continue;
    kept.set(id, n); queue.push(...n.parents);
  }
  return { head, nodes: [...kept.values()] };
}
export async function revise(p: User, bases: RevisionHistory[] = []): Promise<User> {
  const parents = [...new Set(bases.map((b) => b.head))].slice(0, 2);
  const node = { nonce: crypto.randomUUID(), parents, contentHash: await digest(profileContent(p)) };
  const id = await nodeId(p.id, node);
  return { ...p, revision: bound(id, [{ id, ...node }, ...bases.flatMap((b) => b.nodes)]) };
}
function ancestry(h: RevisionHistory) {
  const nodes = new Map(h.nodes.map((n) => [n.id, n])), ids = new Set<string>();
  let complete = true;
  function visit(id: string) {
    if (ids.has(id)) return;
    const n = nodes.get(id);
    if (!n) { complete = false; return; }
    ids.add(id); n.parents.forEach(visit);
  }
  visit(h.head);
  return { ids, complete };
}
/** Call with validated histories only. Identity always takes precedence over nickname. */
export function compareProfiles(current: User, incoming: User): Comparison {
  if (current.id !== incoming.id) return "unknown";
  if (contentEqual(current, incoming)) return "same";
  const a = current.revision, b = incoming.revision;
  if (!a || !b) return "unknown";
  const aa = ancestry(a), bb = ancestry(b);
  if (bb.ids.has(a.head)) return "newer";
  if (aa.ids.has(b.head)) return "older";
  if (aa.complete && bb.complete && [...aa.ids].some((id) => bb.ids.has(id))) return "conflict";
  return "unknown";
}
