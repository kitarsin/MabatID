"use client";

/**
 * Front-end-only account + progress store.
 *
 * Everything lives in this browser's localStorage so the UI can be built and
 * tested before the backend exists. The shape (User, owned[]) is what the API
 * should eventually return — swap the bodies of register/login/toggleOwned for
 * fetch calls and the screens won't need to change.
 * NOT real security: passwords are only salted-hashed locally for the demo.
 */

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import type { Budget, Setup } from "./prefs";

export interface User {
  id: string;
  name: string;
  email: string;
  age: number;
  passHash: string;
  owned: string[]; // card ids the user already holds
  createdAt: number;
  onboarded?: boolean; // finished the first-time checklist
  budget?: Budget;
  setup?: Setup;
  tracking?: string[]; // IDs the user is working toward
  priority?: string | null; // the one shown in the floating progress bar
  prep?: Record<string, string[]>; // ticked "Prepare" row keys per card id
}

const USERS_KEY = "mabatid.users.v1";
const SESSION_KEY = "mabatid.session.v1";

function read<T>(key: string, fallback: T): T {
  try {
    const raw = window.localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}
function write(key: string, value: unknown) {
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* storage unavailable — state still works for this session */
  }
}

async function hash(email: string, password: string) {
  const data = new TextEncoder().encode(`mabatid:${email.toLowerCase()}:${password}`);
  const buf = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

interface Store {
  ready: boolean;
  users: User[];
  me: User | null;
  register: (v: { name: string; email: string; password: string; age: number }) => Promise<string | null>;
  login: (email: string, password: string) => Promise<string | null>;
  logout: () => void;
  toggleOwned: (cardId: string) => void;
  togglePrep: (cardId: string, key: string) => void;
  toggleTrack: (cardId: string) => void;
  setPriority: (cardId: string) => void;
  savePrefs: (p: { owned: string[]; budget: Budget; setup: Setup }) => void;
}

const Ctx = createContext<Store | null>(null);

export function StoreProvider({ children }: { children: ReactNode }) {
  const [ready, setReady] = useState(false);
  const [users, setUsers] = useState<User[]>([]);
  const [meId, setMeId] = useState<string | null>(null);

  useEffect(() => {
    // Hydrate from localStorage after mount (it doesn't exist during SSR).
    // One priority at most, and it must be one of the tracked IDs.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setUsers(
      read<User[]>(USERS_KEY, []).map((u) => {
        const tracking = [...new Set(u.tracking ?? [])];
        return { ...u, tracking, priority: tracking.includes(u.priority ?? "") ? u.priority : (tracking[0] ?? null) };
      }),
    );
    setMeId(read<string | null>(SESSION_KEY, null));
    setReady(true);
  }, []);

  // Accepts a new list or an updater, so quick successive changes never overwrite each other.
  const persist = useCallback((next: User[] | ((prev: User[]) => User[])) => {
    setUsers((prev) => {
      const value = typeof next === "function" ? next(prev) : next;
      write(USERS_KEY, value);
      return value;
    });
  }, []);

  const register: Store["register"] = useCallback(
    async ({ name, email, password, age }) => {
      const e = email.trim().toLowerCase();
      if (users.some((u) => u.email === e)) return "That email is already registered. Try logging in.";
      const user: User = {
        id: crypto.randomUUID(),
        name: name.trim(),
        email: e,
        age,
        passHash: await hash(e, password),
        owned: [],
        createdAt: Date.now(),
      };
      persist([...users, user]);
      setMeId(user.id);
      write(SESSION_KEY, user.id);
      return null;
    },
    [users, persist],
  );

  const login: Store["login"] = useCallback(
    async (email, password) => {
      const e = email.trim().toLowerCase();
      const user = users.find((u) => u.email === e);
      if (!user || user.passHash !== (await hash(e, password))) return "Email or password doesn’t match.";
      setMeId(user.id);
      write(SESSION_KEY, user.id);
      return null;
    },
    [users],
  );

  const logout = useCallback(() => {
    setMeId(null);
    write(SESSION_KEY, null);
  }, []);

  const toggleOwned = useCallback(
    (cardId: string) => {
      if (!meId) return;
      persist((prev) =>
        prev.map((u) => {
          if (u.id !== meId) return u;
          const had = u.owned.includes(cardId);
          const owned = had ? u.owned.filter((x) => x !== cardId) : [...u.owned, cardId];
          // Getting an ID finishes it: stop tracking and move the priority along.
          const tracking = had ? u.tracking : (u.tracking ?? []).filter((x) => x !== cardId);
          const priority = tracking?.includes(u.priority ?? "") ? u.priority : (tracking?.[0] ?? null);
          return { ...u, owned, tracking, priority };
        }),
      );
    },
    [meId, persist],
  );

  const toggleTrack = useCallback(
    (cardId: string) => {
      if (!meId) return;
      persist((prev) =>
        prev.map((u) => {
          if (u.id !== meId) return u;
          const cur = u.tracking ?? [];
          const tracking = cur.includes(cardId) ? cur.filter((x) => x !== cardId) : [...cur, cardId];
          // First tracked ID becomes the priority; dropping the priority hands it to the next one.
          const priority = tracking.includes(u.priority ?? "") ? u.priority : (tracking[0] ?? null);
          return { ...u, tracking, priority };
        }),
      );
    },
    [meId, persist],
  );

  const setPriority = useCallback(
    (cardId: string) => {
      if (!meId) return;
      persist((prev) => prev.map((u) => (u.id === meId && (u.tracking ?? []).includes(cardId) ? { ...u, priority: cardId } : u)));
    },
    [meId, persist],
  );

  const togglePrep = useCallback(
    (cardId: string, key: string) => {
      if (!meId) return;
      persist((prev) =>
        prev.map((u) => {
          if (u.id !== meId) return u;
          const cur = (u.prep?.[cardId] ?? []).map(String);
          const next = cur.includes(key) ? cur.filter((k) => k !== key) : [...cur, key];
          return { ...u, prep: { ...u.prep, [cardId]: next } };
        }),
      );
    },
    [meId, persist],
  );

  const savePrefs = useCallback(
    (p: { owned: string[]; budget: Budget; setup: Setup }) => {
      if (!meId) return;
      persist((prev) => prev.map((u) => (u.id === meId ? { ...u, ...p, onboarded: true } : u)));
    },
    [meId, persist],
  );

  const me = useMemo(() => users.find((u) => u.id === meId) ?? null, [users, meId]);
  const value = useMemo(
    () => ({ ready, users, me, register, login, logout, toggleOwned, togglePrep, toggleTrack, setPriority, savePrefs }),
    [ready, users, me, register, login, logout, toggleOwned, togglePrep, toggleTrack, setPriority, savePrefs],
  );
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useStore() {
  const v = useContext(Ctx);
  if (!v) throw new Error("useStore must be used inside <StoreProvider>");
  return v;
}
