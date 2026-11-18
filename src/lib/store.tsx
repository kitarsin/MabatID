"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import type { FactId } from "@/data/facts";
import { CARDS } from "@/data/cards";
import type { User } from "./profile";
import { evaluateApplication, preparationKeys, stepKey, type Mode } from "./prepare";
import type { DocumentEvidence, DocumentEvidenceMap } from "./documents";
import type { Budget, Setup } from "./prefs";
import { ProfileRepository, STORAGE_KEY, type ProfileState, type ImportPreview, type ImportChoice } from "./profile-repository";
import { exportBackup } from "./backup";
import { profileToken } from "./revisions";
export type { User } from "./profile";

export interface BackupRestoreController {
  users: User[];
  activeId: string | null;
  undoSnapshot: ProfileState["undo"];
  downloadBackup: (id: string) => Promise<string>;
  previewBackup: (source: string) => Promise<ImportPreview>;
  commitBackup: (preview: ImportPreview, choice: ImportChoice, options: { confirmed?: boolean; acknowledged?: boolean }) => Promise<string | null>;
  undoReplacement: (token: string) => Promise<string | null>;
}
interface Store extends BackupRestoreController {
  ready: boolean;
  me: User | null;
  createProfile: (v: { name: string; age: number }) => Promise<string | null>;
  /** Legacy transfer preview only. Future transports must use previewBackup/commitBackup. */
  importProfile: (profile: unknown) => string | null;
  selectProfile: (id: string) => Promise<string | null>;
  logout: () => void;
  toggleOwned: (id: string) => void;
  togglePrep: (id: string, key: string) => void;
  toggleTrack: (id: string) => void;
  setPriority: (id: string) => void;
  setFact: (fact: FactId, value: boolean | undefined) => void;
  setMode: (id: string, mode: Mode) => void;
  setDocumentEvidence: (id: string, evidence: DocumentEvidence) => void;
  savePrefs: (p: { owned: string[]; documents: DocumentEvidenceMap; budget: Budget; setup: Setup; age: number }, expectedToken?: string | null) => Promise<string | null>;
}
const Ctx = createContext<Store | null>(null);
const initial: ProfileState = { version: 3, users: [], activeId: null, undo: null };
export function StoreProvider({ children }: { children: ReactNode }) {
  const [ready, setReady] = useState(false);
  const [state, setState] = useState<ProfileState>(initial);
  const [error, setError] = useState<string | null>(null);
  const saved = useRef(state);
  const repository = useRef<ProfileRepository | null>(null);
  const initialized = useRef(false);
  const queue = useRef(Promise.resolve());
  const generation = useRef(0);
  const publish = useCallback((next: ProfileState) => { saved.current = next; setState(next); }, []);
  useEffect(() => {
    let live = true;
    let repo: ProfileRepository;
    try { repo = new ProfileRepository(localStorage); repository.current = repo; }
    catch { queueMicrotask(() => { if (live) { setError("Browser storage is unavailable. Existing profiles cannot be loaded or changed."); setReady(true); } }); return; }
    const refresh = () => { const request = ++generation.current; void repo.read().then((next) => { if (live && request === generation.current) publish(next); }).catch((e: Error) => { if (live) setError(e.message); }); };
    void repo.load().then((next) => { if (live) { initialized.current = true; publish(next); } }).catch((e: Error) => { if (live) setError(e.message); }).finally(() => { if (live) setReady(true); });
    const onStorage = (event: StorageEvent) => { if (event.key === STORAGE_KEY || event.key === null) refresh(); };
    window.addEventListener("storage", onStorage);
    window.addEventListener("focus", refresh);
    return () => { live = false; window.removeEventListener("storage", onStorage); window.removeEventListener("focus", refresh); };
  }, [publish]);
  const requireRepo = useCallback(() => {
    if (!initialized.current || !repository.current) throw new Error("Profiles could not be loaded safely. Reload before saving.");
    return repository.current;
  }, []);
  const perform = useCallback((action: (repo: ProfileRepository) => Promise<ProfileState>): Promise<string | null> => {
    const result = queue.current.then(async () => {
      try { ++generation.current; const next = await action(requireRepo()); ++generation.current; publish(next); setError(null); return null; }
      catch (e) {
        const problem = e instanceof Error ? e.message : "Could not save this profile.";
        ++generation.current;
        setError(problem);
        // Refresh from durable storage only; never publish the failed candidate.
        try { if (initialized.current && repository.current) publish(await repository.current.read()); } catch { /* Preserve last confirmed state. */ }
        return problem;
      }
    });
    queue.current = result.then(() => undefined);
    return result;
  }, [publish, requireRepo]);
  const { users, activeId: meId } = state;
  const createProfile = useCallback(({ name, age }: { name: string; age: number }) => perform((repo) => repo.create(name, age)), [perform]);
  const selectProfile = useCallback((id: string) => perform((repo) => repo.select(id)), [perform]);
  const logout = useCallback(() => { void perform((repo) => repo.select(null)); }, [perform]);
  const importProfile = useCallback(() => "Use Backup & restore to review this profile before saving.", []);
  const updateMe = useCallback((update: (p: User) => User, expectedToken?: string | null) => {
    const id = saved.current.activeId;
    if (!id) return Promise.resolve("No active profile.");
    return perform((repo) => repo.edit(id, expectedToken === undefined ? profileToken(saved.current.users.find((p) => p.id === id)) : expectedToken, update));
  }, [perform]);
  const downloadBackup = useCallback(async (id: string) => {
    const current = await requireRepo().read();
    const profile = current.users.find((p) => p.id === id);
    if (!profile) throw new Error("This profile is no longer available.");
    return exportBackup(profile);
  }, [requireRepo]);
  const previewBackup = useCallback((source: string) => requireRepo().preview(source), [requireRepo]);
  const commitBackup = useCallback((preview: ImportPreview, choice: ImportChoice, options: { confirmed?: boolean; acknowledged?: boolean }) => perform((repo) => repo.commit(preview, choice, options)), [perform]);
  const undoReplacement = useCallback((token: string) => perform((repo) => repo.undo(token)), [perform]);
  const toggleOwned = useCallback(
    (id: string) =>
      updateMe((p) => ({
        ...p,
        owned: p.owned.includes(id)
          ? p.owned.filter((d) => d !== id)
          : [...p.owned, id],
      })),
    [updateMe],
  );
  const toggleTrack = useCallback(
    (id: string) => {
      if (!CARDS.some((c) => c.id === id)) return;
      updateMe((p) => ({
        ...p,
        tracking: p.tracking?.includes(id)
          ? p.tracking.filter((c) => c !== id)
          : [...(p.tracking ?? []), id],
      }));
    },
    [updateMe],
  );
  const setPriority = useCallback(
    (id: string) =>
      updateMe((p) => (p.tracking?.includes(id) ? { ...p, priority: id } : p)),
    [updateMe],
  );
  const togglePrep = useCallback(
    (id: string, key: string) => {
      if (!CARDS.some((c) => c.id === id) || !preparationKeys(id).has(key))
        return;
      updateMe((p) => {
        const current = p.prep?.[id] ?? [];
        if (current.includes(key)) {
          const sequence = evaluateApplication(id, new Set(p.owned), current, {
            age: p.age,
            facts: p.facts,
            documents: p.documents,
            mode: p.modes?.[id],
            setup: p.setup,
          }).steps;
          const index = sequence.findIndex((s) => stepKey(s.step) === key);
          const clear = new Set([
            key,
            ...(index < 0
              ? []
              : sequence.slice(index).map((s) => stepKey(s.step))),
          ]);
          return {
            ...p,
            prep: { ...p.prep, [id]: current.filter((k) => !clear.has(k)) },
          };
        }
        if (key.startsWith("step:")) {
          const step = evaluateApplication(id, new Set(p.owned), current, {
            age: p.age,
            facts: p.facts,
            documents: p.documents,
            mode: p.modes?.[id],
            setup: p.setup,
          }).steps.find((s) => stepKey(s.step) === key);
          if (!step?.enabled) return p;
        }
        return { ...p, prep: { ...p.prep, [id]: [...current, key] } };
      });
    },
    [updateMe],
  );
  const setFact = useCallback(
    (fact: FactId, value: boolean | undefined) =>
      updateMe((p) => ({ ...p, facts: { ...p.facts, [fact]: value } })),
    [updateMe],
  );
  const setMode = useCallback(
    (id: string, mode: Mode) =>
      updateMe((p) => ({ ...p, modes: { ...p.modes, [id]: mode } })),
    [updateMe],
  );
  const setDocumentEvidence = useCallback(
    (id: string, evidence: DocumentEvidence) =>
      updateMe((p) => ({
        ...p,
        documents: { ...p.documents, [id]: evidence },
      })),
    [updateMe],
  );
  const savePrefs = useCallback(
    (prefs: {
      owned: string[];
      documents: DocumentEvidenceMap;
      budget: Budget;
      setup: Setup;
      age: number;
    }, expectedToken?: string | null) => updateMe((p) => ({ ...p, ...prefs, onboarded: true }), expectedToken),
    [updateMe],
  );
  const me = useMemo(() => users.find((p) => p.id === meId) ?? null, [users, meId]);
  const value: Store = {
    ready, users, me, activeId: meId, undoSnapshot: state.undo,
    createProfile, selectProfile, logout, importProfile,
    toggleOwned, togglePrep, toggleTrack, setPriority, savePrefs, setFact, setMode, setDocumentEvidence,
    downloadBackup, previewBackup, commitBackup, undoReplacement,
  };
  return <Ctx.Provider value={value}>
    {error && <div role="alert" className="relative z-50 border-b border-destructive/30 bg-card p-4 text-sm text-destructive">
      {error} <button type="button" className="ml-2 min-h-11 underline" onClick={() => setError(null)}>Dismiss</button>
    </div>}
    {children}
  </Ctx.Provider>;
}
export function useStore() {
  const store = useContext(Ctx);
  if (!store) throw new Error("useStore must be used inside <StoreProvider>");
  return store;
}
