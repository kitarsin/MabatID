"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import type { FactId } from "@/data/facts";
import { CARDS } from "@/data/cards";
import { normalizeProfile, parseProfiles, type User } from "./profile";
import {
  evaluateApplication,
  preparationKeys,
  stepKey,
  type Mode,
} from "./prepare";
import type { DocumentEvidence, DocumentEvidenceMap } from "./documents";
import type { Budget, Setup } from "./prefs";
export type { User } from "./profile";

const PROFILES_KEY = "mabatid.profiles.v2";
const ACTIVE_KEY = "mabatid.active-profile.v2";
const LEGACY_USERS_KEY = "mabatid.users.v1";
const LEGACY_SESSION_KEY = "mabatid.session.v1";
function read(key: string): unknown {
  try {
    return JSON.parse(localStorage.getItem(key) ?? "null");
  } catch {
    return null;
  }
}
function write(key: string, value: unknown): boolean {
  try {
    localStorage.setItem(key, JSON.stringify(value));
    return true;
  } catch {
    return false;
  }
}
interface Store {
  ready: boolean;
  users: User[];
  me: User | null;
  createProfile: (v: { name: string; age: number }) => string | null;
  /** Adds a profile received from another device (as a new profile) and switches to it. Null on success. */
  importProfile: (profile: unknown) => string | null;
  selectProfile: (id: string) => void;
  logout: () => void;
  toggleOwned: (cardId: string) => void;
  togglePrep: (cardId: string, key: string) => void;
  toggleTrack: (cardId: string) => void;
  setPriority: (cardId: string) => void;
  setFact: (fact: FactId, value: boolean | undefined) => void;
  setMode: (cardId: string, mode: Mode) => void;
  setDocumentEvidence: (id: string, evidence: DocumentEvidence) => void;
  savePrefs: (p: {
    owned: string[];
    documents: DocumentEvidenceMap;
    budget: Budget;
    setup: Setup;
    age: number;
  }) => void;
}
const Ctx = createContext<Store | null>(null);
export function StoreProvider({ children }: { children: ReactNode }) {
  const [ready, setReady] = useState(false);
  const [users, setUsers] = useState<User[]>([]);
  const [meId, setMeId] = useState<string | null>(null);
  useEffect(() => {
    const saved = read(PROFILES_KEY);
    const migrating = saved === null;
    const profiles = parseProfiles(
      migrating ? read(LEGACY_USERS_KEY) : saved,
      migrating,
    );
    const active = read(migrating ? LEGACY_SESSION_KEY : ACTIVE_KEY);
    // Only erase the legacy records after the credential-free replacement is saved.
    if (
      write(PROFILES_KEY, profiles) &&
      write(
        ACTIVE_KEY,
        typeof active === "string" && profiles.some((p) => p.id === active)
          ? active
          : null,
      )
    ) {
      localStorage.removeItem(LEGACY_USERS_KEY);
      localStorage.removeItem(LEGACY_SESSION_KEY);
    }
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setUsers(profiles);
    setMeId(
      typeof active === "string" && profiles.some((p) => p.id === active)
        ? active
        : null,
    );
    setReady(true);
  }, []);
  const persist = useCallback((update: (previous: User[]) => User[]) => {
    setUsers((previous) => {
      const next = update(previous)
        .map((p) => normalizeProfile(p))
        .filter((p): p is User => p !== null);
      write(PROFILES_KEY, next);
      return next;
    });
  }, []);
  const updateMe = useCallback(
    (update: (profile: User) => User) => {
      if (meId)
        persist((profiles) =>
          profiles.map((p) => (p.id === meId ? update(p) : p)),
        );
    },
    [meId, persist],
  );
  const selectProfile = useCallback(
    (id: string) => {
      if (!users.some((p) => p.id === id)) return;
      setMeId(id);
      write(ACTIVE_KEY, id);
    },
    [users],
  );
  const createProfile = useCallback(
    ({ name, age }: { name: string; age: number }) => {
      if (!name.trim() || name.trim().length > 40)
        return "Enter a name with 1–40 characters.";
      if (!Number.isInteger(age) || age < 0 || age > 120)
        return "Enter an age from 0 to 120.";
      const profile: User = {
        id: crypto.randomUUID(),
        name: name.trim(),
        age,
        owned: [],
        createdAt: Date.now(),
      };
      persist((profiles) => [...profiles, profile]);
      setMeId(profile.id);
      write(ACTIVE_KEY, profile.id);
      return null;
    },
    [persist],
  );
  const importProfile = useCallback(
    (incoming: unknown) => {
      const clean = normalizeProfile(incoming);
      if (!clean) return "This transfer couldn’t be read.";
      const profile: User = { ...clean, id: crypto.randomUUID() };
      persist((profiles) => [...profiles, profile]);
      setMeId(profile.id);
      write(ACTIVE_KEY, profile.id);
      return null;
    },
    [persist],
  );
  const logout = useCallback(() => {
    setMeId(null);
    write(ACTIVE_KEY, null);
  }, []);
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
    }) => updateMe((p) => ({ ...p, ...prefs, onboarded: true })),
    [updateMe],
  );
  const me = useMemo(
    () => users.find((p) => p.id === meId) ?? null,
    [users, meId],
  );
  const value = useMemo(
    () => ({
      ready,
      users,
      me,
      createProfile,
      importProfile,
      selectProfile,
      logout,
      toggleOwned,
      togglePrep,
      toggleTrack,
      setPriority,
      savePrefs,
      setFact,
      setMode,
      setDocumentEvidence,
    }),
    [
      ready,
      users,
      me,
      createProfile,
      importProfile,
      selectProfile,
      logout,
      toggleOwned,
      togglePrep,
      toggleTrack,
      setPriority,
      savePrefs,
      setFact,
      setMode,
      setDocumentEvidence,
    ],
  );
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}
export function useStore() {
  const store = useContext(Ctx);
  if (!store) throw new Error("useStore must be used inside <StoreProvider>");
  return store;
}
