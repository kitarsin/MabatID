import assert from "node:assert/strict";
import test from "node:test";
import { createHash } from "node:crypto";
import { type User } from "../src/lib/profile";
import { preparationKeys } from "../src/lib/prepare";
import { parseBackup, exportBackup, MAX_BACKUP_BYTES, diffProfiles } from "../src/lib/backup";
import { canonical, compareProfiles, contentEqual, digest, HISTORY_LIMIT, profileContent, profileToken, revise, validHistory } from "../src/lib/revisions";
import { ProfileRepository, STORAGE_KEY, type Exclusive, type StoragePort } from "../src/lib/profile-repository";

class MemoryStorage implements StoragePort {
  values = new Map<string, string>();
  failWrite = false;
  failRead = false;
  writes = 0;
  getItem(key: string) { if (this.failRead) throw new Error("blocked"); return this.values.get(key) ?? null; }
  setItem(key: string, value: string) { if (this.failWrite) throw new Error("quota"); this.writes++; this.values.set(key, value); }
  removeItem(key: string) { this.values.delete(key); }
}
function lock(): Exclusive {
  let pending = Promise.resolve();
  return <T>(task: () => Promise<T>) => {
    const next = pending.then(task); pending = next.then(() => undefined, () => undefined); return next;
  };
}
async function fixture() {
  const storage = new MemoryStorage(), exclusive = lock();
  const repo = new ProfileRepository(storage, exclusive);
  await repo.load();
  let state = await repo.create("Test profile", 24);
  const id = state.activeId!;
  const prepKey = [...preparationKeys("postal")][0];
  state = await repo.edit(id, profileToken(state.users[0]), (p) => ({ ...p,
    owned: ["psa", "barangay-id"], budget: "low", setup: "onsite", onboarded: true,
    facts: { enrolled: false, employed: true, barangayIdEligible: true },
    documents: { "barangay-id": { issuedOn: "2026-01-01", noPrintedExpiry: true, validityConfirmed: true, photoSignature: true, philsysFields: true, addressCurrent: false } },
    tracking: ["postal", "passport"], priority: "postal", modes: { postal: "onsite" }, prep: { postal: [prepKey] },
  }));
  return { storage, exclusive, repo, state, id };
}
const edit = (p: User, patch: Partial<User>) => revise({ ...p, ...patch }, [p.revision!]);
async function incomingPreview(repo: ProfileRepository, p: User) { return repo.preview(await exportBackup(p)); }

test("SHA-256 fingerprints are interoperable and stable across key/set order", async () => {
  assert.equal(await digest({ b: 2, a: "é" }), createHash("sha256").update(canonical({ a: "é", b: 2 })).digest("hex"));
  const { state } = await fixture();
  assert.ok(contentEqual(state.users[0], { ...state.users[0], owned: [...state.users[0].owned].reverse() }));
});

test("complete export/import round trip preserves identity, metadata, evidence, routes, answers and history", async () => {
  const { state } = await fixture(), p = state.users[0];
  const file = await exportBackup(p), parsed = await parseBackup(file);
  assert.deepEqual(parsed.warnings, []);
  assert.equal(profileToken(parsed.profile), profileToken(p));
  const destination = new ProfileRepository(new MemoryStorage(), lock()); await destination.load();
  const preview = await destination.preview(file);
  assert.equal(preview.comparison, "new");
  const imported = await destination.commit(preview, "new");
  assert.equal(imported.activeId, p.id);
  assert.equal(profileToken(imported.users[0]), profileToken(p));
  assert.deepEqual(JSON.parse(await exportBackup(imported.users[0])).profile, profileContent(p));
});

test("newer ancestry wins even when IDs and checklist ticks were removed or answers corrected", async () => {
  const { state } = await fixture(), p = state.users[0];
  const newer = await edit(p, { owned: [], prep: {}, facts: { enrolled: true }, budget: "free", modes: { postal: "online" } });
  assert.equal(compareProfiles(p, newer), "newer");
  assert.equal(compareProfiles(newer, p), "older");
  const diffs = diffProfiles(p, newer);
  for (const section of ["Owned IDs/documents", "Checklist progress", "Eligibility answer", "Budget", "Selected route"])
    assert.ok(diffs.some((d) => d.label.includes(section)), section);
});

test("old progress exported later and reversed clocks never imply freshness", async () => {
  const { state } = await fixture(), old = state.users[0];
  const realNow = Date.now;
  Date.now = () => 1;
  let newer: User;
  try { newer = await edit(old, { owned: [] }); } finally { Date.now = realNow; }
  const laterExport = await parseBackup(await exportBackup(old, new Date("2099-01-01")));
  const earlierExport = await parseBackup(await exportBackup(newer!, new Date("1970-01-01")));
  assert.equal(compareProfiles(earlierExport.profile, laterExport.profile), "older");
  assert.equal(compareProfiles(laterExport.profile, earlierExport.profile), "newer");
});

test("independent edits conflict, while unrelated identity or unrelated ancestry is unknown", async () => {
  const { state } = await fixture(), base = state.users[0];
  const a = await edit(base, { name: "Renamed" }), b = await edit(base, { age: 25 });
  assert.equal(compareProfiles(a, b), "conflict");
  const unrelated = await revise({ ...base, age: 27 });
  assert.equal(compareProfiles(a, unrelated), "unknown");
  assert.equal(compareProfiles(base, await revise({ ...base, id: "separate", name: base.name })), "unknown");
});

test("missing, invalid and truncated history report uncertainty; identical content is already up to date", async () => {
  const { state } = await fixture(), base = state.users[0];
  const next = await edit(base, { age: 30 });
  const noHistory = { ...next, revision: undefined };
  assert.equal(compareProfiles(base, noHistory), "unknown");
  assert.equal(compareProfiles(base, { ...base, revision: undefined }), "same");
  const truncated = { ...next, revision: { head: next.revision!.head, nodes: next.revision!.nodes.slice(0, 1) } };
  assert.ok(await validHistory(truncated.revision, truncated));
  assert.equal(compareProfiles(base, truncated), "unknown");
  const raw = JSON.parse(await exportBackup(next)); raw.revision.nodes[0].contentHash = "0".repeat(64);
  const parsed = await parseBackup(JSON.stringify(raw));
  assert.equal(parsed.profile.revision, undefined);
  assert.ok(parsed.warnings.some((w) => w.includes("invalid")));
  assert.equal(compareProfiles(base, parsed.profile), "unknown");
  const contentMismatch = JSON.parse(await exportBackup(next)); contentMismatch.profile.age = 45;
  contentMismatch.contentHash = await digest(profileContent(contentMismatch.profile));
  assert.equal((await parseBackup(JSON.stringify(contentMismatch))).profile.revision, undefined);
});

test("history is bounded and disconnected/pruned branches do not claim a conflict", async () => {
  const { state } = await fixture(), base = state.users[0];
  let a = base;
  for (let i = 0; i < HISTORY_LIMIT + 3; i++) a = await edit(a, { age: 25 + i % 20 });
  assert.equal(a.revision!.nodes.length, HISTORY_LIMIT);
  assert.ok(await validHistory(a.revision, a));
  assert.equal(compareProfiles(base, a), "unknown");
  const sibling = await edit(base, { name: "Sibling" });
  assert.equal(compareProfiles(a, sibling), "unknown");
  const direct = await edit(a, { age: 88 });
  assert.equal(compareProfiles(a, direct), "newer");
});

test("no-op edits, equivalent set order, and repeated exports create no revisions or storage writes", async () => {
  const { repo, state, id, storage } = await fixture(), p = state.users[0], writes = storage.writes;
  await repo.edit(id, profileToken(p), (x) => ({ ...x, owned: [...x.owned].reverse(), facts: { ...x.facts, guardian: undefined } }));
  assert.equal(storage.writes, writes);
  await exportBackup(p); await exportBackup(p);
  assert.equal(profileToken((await repo.read()).users[0]), profileToken(p));
});

test("malformed, oversized, incompatible, deeply nested and wrong-type files are rejected without writes", async () => {
  const { repo, state, storage } = await fixture(), original = storage.getItem(STORAGE_KEY);
  const raw = JSON.parse(await exportBackup(state.users[0]));
  const cases = ["{", "null", "[]", "x".repeat(MAX_BACKUP_BYTES + 1), JSON.stringify({ ...raw, version: 9 }),
    JSON.stringify({ ...raw, format: "other" }), JSON.stringify({ ...raw, profile: { ...raw.profile, age: "24" } }),
    JSON.stringify({ ...raw, profile: { ...raw.profile, documents: { psa: { issuedOn: "2026-02-30" } } } }),
    JSON.stringify({ ...raw, profile: { ...raw.profile, owned: [1] } }),
    JSON.stringify({ ...raw, contentHash: "damaged" }),
    JSON.stringify({ ...raw, revision: { ...raw.revision, nodes: Array.from({ length: HISTORY_LIMIT + 1 }, () => raw.revision.nodes[0]) } }), '{"__proto__":{}}',
    JSON.stringify({ ...raw, extra: Array.from({ length: 513 }, () => 0) }),
  ];
  let deep: unknown = {}; for (let i = 0; i < 15; i++) deep = { next: deep };
  cases.push(JSON.stringify({ ...raw, deep }));
  for (const source of cases) { await assert.rejects(repo.preview(source)); assert.equal(storage.getItem(STORAGE_KEY), original); }
});

test("obsolete catalog identifiers are explained and sanitization requires acknowledgment", async () => {
  const { repo, state, storage } = await fixture();
  const raw = JSON.parse(await exportBackup(state.users[0]));
  raw.profile.owned.push("retired-document"); raw.profile.prep.postal.push("obsolete-step");
  raw.profile.facts.oldQuestion = true; raw.profile.modes.retired = "onsite";
  raw.contentHash = await digest(profileContent(raw.profile));
  delete raw.revision;
  const preview = await repo.preview(JSON.stringify(raw));
  for (const key of ["retired-document", "obsolete-step", "oldQuestion", "retired"])
    assert.ok(preview.backup.warnings.some((w) => w.includes(key)), key);
  const before = storage.getItem(STORAGE_KEY);
  await assert.rejects(repo.commit(preview, "replace", { confirmed: true }), /Acknowledge/);
  assert.equal(storage.getItem(STORAGE_KEY), before);
  const next = await repo.commit(preview, "keep-both", { acknowledged: true });
  assert.equal(next.users.length, 2);
  assert.ok(!next.users[1].owned.includes("retired-document"));
  assert.ok(await validHistory(next.users[1].revision, next.users[1]));
});

test("v2 migration preserves stable progress, ownership, active selection, identity and preferences", async () => {
  const { state } = await fixture(), p = state.users[0], storage = new MemoryStorage();
  storage.setItem("mabatid.profiles.v2", JSON.stringify([{ ...p, revision: undefined }]));
  storage.setItem("mabatid.active-profile.v2", JSON.stringify(p.id));
  const repo = new ProfileRepository(storage, lock()), next = await repo.load();
  assert.ok(contentEqual(next.users[0], p)); assert.equal(next.activeId, p.id);
  assert.ok(await validHistory(next.users[0].revision, next.users[0]));
  const token = profileToken(next.users[0]);
  assert.equal(profileToken((await repo.load()).users[0]), token);
});

test("migration failure leaves original storage intact; corrupt input is never silently erased", async () => {
  const { state } = await fixture(), storage = new MemoryStorage();
  storage.setItem("mabatid.users.v1", JSON.stringify([{ ...state.users[0], email: "old", passwordHash: "old", revision: undefined }]));
  storage.setItem("mabatid.session.v1", JSON.stringify(state.activeId));
  const repo = new ProfileRepository(storage, lock()), before = [...storage.values];
  storage.failWrite = true;
  await assert.rejects(repo.load(), /Could not save/); assert.deepEqual([...storage.values], before);
  await assert.rejects(repo.create("Unsafe", 20), /Reload/);
  storage.failWrite = false;
  const next = await repo.load();
  assert.equal(next.activeId, state.activeId);
  assert.deepEqual(next.users[0].prep, state.users[0].prep);
  assert.equal(storage.getItem("mabatid.users.v1"), null);
  assert.equal(storage.getItem(STORAGE_KEY)!.includes("passwordHash"), false);
  const damaged = new MemoryStorage(); damaged.setItem("mabatid.profiles.v2", "broken");
  await assert.rejects(new ProfileRepository(damaged, lock()).load());
  assert.equal(damaged.getItem("mabatid.profiles.v2"), "broken"); assert.equal(damaged.getItem(STORAGE_KEY), null);
});

test("failed edit, create, selection, replacement and undo leave the entire durable state unchanged", async () => {
  const { repo, storage, state, id } = await fixture(), p = state.users[0];
  const preview = await incomingPreview(repo, await edit(p, { age: 55 }));
  const before = storage.getItem(STORAGE_KEY);
  storage.failWrite = true;
  await assert.rejects(repo.edit(id, profileToken(p), (x) => ({ ...x, age: 99 })));
  await assert.rejects(repo.create("New", 20)); await assert.rejects(repo.select(null));
  await assert.rejects(repo.commit(preview, "replace", { confirmed: true }));
  assert.equal(storage.getItem(STORAGE_KEY), before);
  storage.failWrite = false;
  const next = await repo.commit(preview, "replace", { confirmed: true });
  const replaced = storage.getItem(STORAGE_KEY); storage.failWrite = true;
  await assert.rejects(repo.undo(next.undo!.afterToken)); assert.equal(storage.getItem(STORAGE_KEY), replaced);
  storage.failRead = true; await assert.rejects(repo.read(), /Could not read/);
});

test("replacement matches permanent ID despite rename, preserves unrelated profiles, and requires confirmation", async () => {
  const { repo, state, id } = await fixture(), p = state.users[0];
  const second = await repo.create(p.name, 19), unrelated = second.users.find((x) => x.id !== id)!;
  const incoming = await edit(p, { name: "Different nickname", owned: [] });
  const preview = await incomingPreview(repo, incoming);
  assert.equal(preview.comparison, "newer"); assert.equal(preview.targetName, p.name);
  await assert.rejects(repo.commit(preview, "new"), /already exists/);
  await assert.rejects(repo.commit(preview, "replace"), /confirmation/);
  const next = await repo.commit(preview, "replace", { confirmed: true });
  assert.equal(next.users.length, 2); assert.equal(profileToken(next.users.find((x) => x.id === unrelated.id)), profileToken(unrelated));
  assert.equal(next.users.find((x) => x.id === id)!.name, "Different nickname");
});

test("stale previews, deleted targets, and stale cross-tab updates cannot overwrite later edits", async () => {
  const { repo, storage, exclusive, state, id } = await fixture(), p = state.users[0];
  const tab = new ProfileRepository(storage, exclusive);
  const preview = await incomingPreview(repo, await edit(p, { age: 77 }));
  const next = await tab.edit(id, profileToken(p), (x) => ({ ...x, name: "Other tab" }));
  const raw = storage.getItem(STORAGE_KEY);
  for (const choice of ["replace", "keep-both"] as const) await assert.rejects(repo.commit(preview, choice, { confirmed: true }), /changed after/);
  await assert.rejects(repo.edit(id, profileToken(p), (x) => ({ ...x, age: 25 })), /another tab/);
  assert.equal(storage.getItem(STORAGE_KEY), raw);
  storage.setItem(STORAGE_KEY, JSON.stringify({ ...next, users: [], activeId: null }));
  await assert.rejects(repo.commit(preview, "replace", { confirmed: true }), /changed after/);
});

test("two tabs serialize concurrent edits; stale edits reject while unrelated profiles remain intact", async () => {
  const { repo, storage, exclusive, state, id } = await fixture(), p = state.users[0];
  const tab = new ProfileRepository(storage, exclusive);
  const results = await Promise.allSettled([
    repo.edit(id, profileToken(p), (x) => ({ ...x, age: 26 })),
    tab.edit(id, profileToken(p), (x) => ({ ...x, age: 27 })),
  ]);
  assert.deepEqual(results.map((r) => r.status).sort(), ["fulfilled", "rejected"]);
  await Promise.all([repo.create("A", 20), tab.create("B", 20)]);
  assert.equal((await repo.read()).users.length, 3);
});

test("keep both forks identity and ancestry; subsequent edits have independent histories", async () => {
  const { repo, state, id } = await fixture(), p = state.users[0];
  const preview = await incomingPreview(repo, await edit(p, { age: 34 }));
  const next = await repo.commit(preview, "keep-both"), copy = next.users.find((x) => x.id !== id)!;
  assert.equal(profileToken(next.users.find((x) => x.id === id)), profileToken(p));
  assert.equal(copy.revision!.nodes.length, 1); assert.deepEqual(copy.revision!.nodes[0].parents, []);
  assert.notEqual(copy.id, id); assert.equal(copy.name, p.name);
  assert.ok(await validHistory(copy.revision, copy));
});

test("older/conflicting/unknown replacements record explicit resolution revisions without merging content", async () => {
  for (const kind of ["older", "conflict", "unknown"] as const) {
    const { repo, state, id } = await fixture(), base = state.users[0];
    const currentState = await repo.edit(id, profileToken(base), (p) => ({ ...p, age: 31 }));
    const current = currentState.users[0];
    const incoming = kind === "older" ? base : kind === "conflict" ? await edit(base, { name: "Incoming" }) : { ...base, name: "No history", revision: undefined };
    const preview = await incomingPreview(repo, incoming);
    assert.equal(preview.comparison, kind);
    const next = await repo.commit(preview, "replace", { confirmed: true, acknowledged: true }), saved = next.users[0];
    assert.ok(contentEqual(saved, incoming)); assert.notEqual(saved.revision!.head, incoming.revision?.head);
    assert.ok(saved.revision!.nodes[0].parents.includes(current.revision!.head));
    assert.equal(compareProfiles(current, saved), "newer");
  }
});

test("undo survives reload, restores only target, and is itself a new revision", async () => {
  const { repo, storage, exclusive, state, id } = await fixture(), before = state.users[0];
  const preview = await incomingPreview(repo, await edit(before, { age: 70 }));
  const replaced = await repo.commit(preview, "replace", { confirmed: true });
  const reload = new ProfileRepository(storage, exclusive), loaded = await reload.load();
  assert.ok(loaded.undo); const another = await reload.create("Unrelated", 15);
  const restored = await reload.undo(loaded.undo!.afterToken), p = restored.users.find((x) => x.id === id)!;
  assert.ok(contentEqual(p, before)); assert.notEqual(p.revision!.head, before.revision!.head);
  assert.equal(compareProfiles(replaced.users[0], p), "newer"); assert.equal(restored.undo, null);
  assert.equal(profileToken(restored.users.find((x) => x.id === another.activeId)), profileToken(another.users.find((x) => x.id === another.activeId)));
  assert.equal(restored.activeId, another.activeId);
});

test("later edits disable undo, including edit-then-revert to identical content", async () => {
  const { repo, state, id } = await fixture(), before = state.users[0];
  const replaced = await repo.commit(await incomingPreview(repo, await edit(before, { age: 50 })), "replace", { confirmed: true });
  const a = await repo.edit(id, profileToken(replaced.users[0]), (p) => ({ ...p, age: 51 }));
  const b = await repo.edit(id, profileToken(a.users[0]), (p) => ({ ...p, age: 50 }));
  assert.ok(contentEqual(b.users[0], replaced.users[0]));
  await assert.rejects(repo.undo(replaced.undo!.afterToken), /subsequently changed/);
});

test("raw storage changes during asynchronous work abort even writers outside the lock", async () => {
  const { repo, storage, state, id } = await fixture();
  const prior = storage.getItem(STORAGE_KEY)!;
  const external = JSON.stringify({ ...state, activeId: null });
  await assert.rejects(repo.edit(id, profileToken(state.users[0]), (p) => {
    storage.setItem(STORAGE_KEY, external);
    return { ...p, age: 40 };
  }), /changed during/);
  assert.equal(storage.getItem(STORAGE_KEY), external);
  assert.notEqual(external, prior);
});

test("invalid saved history and failed lock acquisition never overwrite durable data", async () => {
  const { storage, state } = await fixture();
  const corrupted = structuredClone(state); corrupted.users[0].age = 99;
  storage.setItem(STORAGE_KEY, JSON.stringify(corrupted));
  const original = storage.getItem(STORAGE_KEY);
  await assert.rejects(new ProfileRepository(storage, lock()).load(), /revision data/);
  const unavailable: Exclusive = async () => { throw new Error("locks unavailable"); };
  await assert.rejects(new ProfileRepository(storage, unavailable).create("Blocked", 24));
  assert.equal(storage.getItem(STORAGE_KEY), original);
});

test("even empty obsolete document and checklist entries require explicit acknowledgment", async () => {
  const { state } = await fixture();
  const raw = JSON.parse(await exportBackup(state.users[0]));
  raw.profile.documents.retired = {}; raw.profile.prep.retired = [];
  const parsed = await parseBackup(JSON.stringify(raw));
  assert.ok(parsed.warnings.some((w) => w.includes("document entry “retired”")));
  assert.ok(parsed.warnings.some((w) => w.includes("checklist entry “retired”")));
});
