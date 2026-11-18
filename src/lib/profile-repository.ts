import { parseBackup, diffProfiles, type ParsedBackup, type ProfileDifference } from "./backup";
import { normalizeProfile, type User } from "./profile";
import { canonical, compareProfiles, contentEqual, profileToken, revise, validHistory, type Comparison } from "./revisions";

export const STORAGE_KEY = "mabatid.profiles.v3";
export const LOCK_NAME = "mabatid-profile-storage";
export interface UndoSnapshot { before: User; afterToken: string; profileId: string }
export interface ProfileState { version: 3; users: User[]; activeId: string | null; undo: UndoSnapshot | null }
export interface ImportPreview {
  backup: ParsedBackup;
  targetToken: string | null;
  comparison: Comparison | "new";
  differences: ProfileDifference[];
  targetName?: string;
}
export type ImportChoice = "new" | "replace" | "keep-both";
export type StoragePort = Pick<Storage, "getItem" | "setItem" | "removeItem">;
export type Exclusive = <T>(task: () => Promise<T>) => Promise<T>;
export class ProfileStorageError extends Error {}
const empty = (): ProfileState => ({ version: 3, users: [], activeId: null, undo: null });
const message = (e: unknown) => e instanceof ProfileStorageError ? e : new ProfileStorageError("Could not save profiles. Browser storage may be full or unavailable. Your saved data has not been replaced.");
const browserLock: Exclusive = async (task) => {
  if (typeof navigator === "undefined" || !navigator.locks)
    throw new ProfileStorageError("Safe profile saving requires a browser with Web Locks on HTTPS or localhost.");
  return navigator.locks.request(LOCK_NAME, task);
};

/** All cooperating tabs serialize read/check/write under the same Web Lock.
 * Profiles, active selection and undo are one atomic localStorage value.
 * No caller publishes in-memory success until setItem returns successfully.
 */
export class ProfileRepository {
  constructor(private storage: StoragePort, private exclusive: Exclusive = browserLock) {}
  private get(key: string): unknown {
    const value = this.storage.getItem(key);
    return value === null ? null : JSON.parse(value);
  }
  private async savedProfile(raw: unknown): Promise<User> {
    const p = normalizeProfile(raw);
    if (!p) throw new ProfileStorageError("Saved profile data is invalid. It has been left untouched.");
    const revision = await validHistory((raw as User).revision, p);
    if (!revision) throw new ProfileStorageError("Saved revision data does not match its profile. Storage has been left untouched.");
    return { ...p, revision };
  }
  async read(): Promise<ProfileState> {
    try {
      const raw = this.get(STORAGE_KEY) as ProfileState | null;
      if (raw === null) return empty();
      if (raw.version !== 3 || !Array.isArray(raw.users)) throw new Error("invalid envelope");
      const users = await Promise.all(raw.users.map((p) => this.savedProfile(p)));
      if (new Set(users.map((p) => p.id)).size !== users.length ||
        (raw.activeId !== null && !users.some((p) => p.id === raw.activeId))) throw new Error("invalid selection");
      let undo: UndoSnapshot | null = null;
      if (raw.undo) {
        const before = await this.savedProfile(raw.undo.before);
        if (before.id !== raw.undo.profileId || typeof raw.undo.afterToken !== "string") throw new Error("invalid undo");
        undo = { before, afterToken: raw.undo.afterToken, profileId: before.id };
      }
      return { version: 3, users, activeId: raw.activeId, undo };
    } catch (e) {
      if (e instanceof ProfileStorageError) throw e;
      throw new ProfileStorageError("Could not read saved profiles. Existing browser data has been left untouched.");
    }
  }
  private write(state: ProfileState) { this.storage.setItem(STORAGE_KEY, JSON.stringify(state)); }
  async load(): Promise<ProfileState> {
    try {
      return await this.exclusive(async () => {
        if (this.storage.getItem(STORAGE_KEY) !== null) return this.read();
        const originals = ["mabatid.profiles.v2", "mabatid.active-profile.v2", "mabatid.users.v1", "mabatid.session.v1"].map((key) => [key, this.storage.getItem(key)] as const);
        const current = this.get("mabatid.profiles.v2");
        const legacy = current === null;
        const source = current ?? this.get("mabatid.users.v1") ?? [];
        if (!Array.isArray(source)) throw new Error("invalid legacy profiles");
        const users: User[] = [];
        for (const raw of source) {
          // Stable checklist keys survive; only obsolete positional keys are discarded.
          const p = normalizeProfile(raw);
          if (!p || users.some((u) => u.id === p.id)) throw new Error("invalid legacy profile");
          if (legacy) p.needsChecklistReview = true;
          users.push(await revise(p));
        }
        const selected = this.get(legacy ? "mabatid.session.v1" : "mabatid.active-profile.v2");
        const state: ProfileState = { version: 3, users, activeId: typeof selected === "string" && users.some((u) => u.id === selected) ? selected : null, undo: null };
        if (originals.some(([key, value]) => this.storage.getItem(key) !== value)) throw new ProfileStorageError("Profiles changed during migration. Reload to review the latest saved data.");
        this.write(state);
        // v2 is retained as migration recovery data. Remove old mock credentials only after success.
        for (const key of ["mabatid.users.v1", "mabatid.session.v1"]) {
          try { this.storage.removeItem(key); } catch { /* The new atomic record is already durable. */ }
        }
        return state;
      });
    } catch (e) { throw message(e); }
  }
  private async transaction(update: (state: ProfileState) => Promise<ProfileState>): Promise<ProfileState> {
    try {
      return await this.exclusive(async () => {
        if (this.storage.getItem(STORAGE_KEY) === null) throw new ProfileStorageError("Profile storage changed or was cleared. Reload before saving.");
        const original = this.storage.getItem(STORAGE_KEY);
        const state = await this.read();
        const next = await update(state);
        if (this.storage.getItem(STORAGE_KEY) !== original) throw new ProfileStorageError("Profile storage changed during this operation. Review again before saving.");
        if (canonical(state) !== canonical(next)) this.write(next);
        return next;
      });
    } catch (e) { throw message(e); }
  }
  async create(name: string, age: number) {
    if (!name.trim() || name.trim().length > 40) throw new ProfileStorageError("Enter a name with 1–40 characters.");
    if (!Number.isInteger(age) || age < 0 || age > 120) throw new ProfileStorageError("Enter an age from 0 to 120.");
    return this.transaction(async (state) => {
      const p = normalizeProfile({ id: crypto.randomUUID(), name, age, owned: [], createdAt: Date.now() })!;
      const profile = await revise(p);
      return { ...state, users: [...state.users, profile], activeId: profile.id };
    });
  }
  async select(id: string | null) {
    return this.transaction(async (state) => {
      if (id !== null && !state.users.some((u) => u.id === id)) throw new ProfileStorageError("This profile is no longer available. Review the updated profiles.");
      return { ...state, activeId: id };
    });
  }
  async edit(id: string, expected: string | null, update: (p: User) => User) {
    return this.transaction(async (state) => {
      const current = state.users.find((p) => p.id === id);
      if (!current || profileToken(current) !== expected) throw new ProfileStorageError("This profile changed in another tab. Review the updated profile before trying again.");
      const next = normalizeProfile(update(structuredClone(current)));
      if (!next || next.id !== current.id) throw new ProfileStorageError("Invalid profile update.");
      if (contentEqual(current, next)) return state;
      const saved = await revise(next, [current.revision!]);
      return { ...state, users: state.users.map((p) => p.id === id ? saved : p) };
    });
  }
  async preview(source: string): Promise<ImportPreview> {
    const backup = await parseBackup(source), state = await this.read();
    const current = state.users.find((p) => p.id === backup.profile.id);
    return {
      backup, targetToken: profileToken(current), targetName: current?.name,
      comparison: current ? compareProfiles(current, backup.profile) : "new",
      differences: current ? diffProfiles(current, backup.profile) : [],
    };
  }
  async commit(preview: ImportPreview, choice: ImportChoice, options: { confirmed?: boolean; acknowledged?: boolean } = {}) {
    return this.transaction(async (state) => {
      const incoming = preview.backup.profile;
      const current = state.users.find((p) => p.id === incoming.id);
      if (profileToken(current) !== preview.targetToken)
        throw new ProfileStorageError("The target profile changed after this preview. Review the file again before importing.");
      if (preview.backup.warnings.length && !options.acknowledged)
        throw new ProfileStorageError("Acknowledge the backup warnings before importing.");
      if (choice === "new" && current) throw new ProfileStorageError("This identity already exists. Review replacement or keep both.");
      if (choice === "replace" && (!current || !options.confirmed))
        throw new ProfileStorageError("Explicit confirmation is required before replacing an existing profile.");
      let saved: User, undo = state.undo;
      if (choice === "keep-both") {
        saved = await revise({ ...incoming, id: crypto.randomUUID(), revision: undefined });
      } else if (choice === "replace" && current) {
        const comparison = compareProfiles(current, incoming);
        if (comparison === "same") throw new ProfileStorageError("This profile is already up to date.");
        // A fast-forward preserves incoming ancestry. Rollbacks/resolutions explicitly join known heads.
        saved = comparison === "newer" ? structuredClone(incoming) :
          await revise(incoming, [current.revision!, ...(incoming.revision ? [incoming.revision] : [])]);
        undo = { before: current, afterToken: profileToken(saved)!, profileId: current.id };
      } else {
        saved = incoming.revision ? structuredClone(incoming) : await revise(incoming);
      }
      return { ...state, users: choice === "replace" ? state.users.map((p) => p.id === incoming.id ? saved : p) : [...state.users, saved], activeId: saved.id, undo };
    });
  }
  async undo(expectedAfterToken: string) {
    return this.transaction(async (state) => {
      const snapshot = state.undo, current = state.users.find((p) => p.id === snapshot?.profileId);
      if (!snapshot || !current || snapshot.afterToken !== expectedAfterToken || profileToken(current) !== snapshot.afterToken)
        throw new ProfileStorageError("Undo is unavailable because the replaced profile has subsequently changed.");
      const restored = await revise(snapshot.before, [current.revision!, snapshot.before.revision!]);
      return { ...state, users: state.users.map((p) => p.id === current.id ? restored : p), undo: null };
    });
  }
}
