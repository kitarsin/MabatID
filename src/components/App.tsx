"use client";

import { useCallback, useMemo, useState } from "react";
import { LibraryBig, LogOut, Map, TrendingUp } from "lucide-react";
import { ReactFlowProvider } from "@xyflow/react";
import { CARD_BY_ID } from "@/data/cards";
import { useStore } from "@/lib/store";
import { AuthScreen } from "./AuthScreen";
import { BrowseScreen } from "./BrowseScreen";
import { DetailSheet } from "./DetailSheet";
import { FilterBar, matchSet, NO_FILTERS, type Filters } from "./FilterBar";
import { Landing } from "./Landing";
import { Logo } from "./Logo";
import { Onboarding } from "./Onboarding";
import { ProgressScreen } from "./ProgressScreen";
import { SkillTree } from "./SkillTree";
import { TrackingBar } from "./TrackingBar";

type Screen = "landing" | "auth" | "tree" | "browse" | "progress" | "edit";
const EMPTY: ReadonlySet<string> = new Set();

export function App() {
  const { ready, me, users, logout, toggleOwned, togglePrep, toggleTrack, setPriority, savePrefs } = useStore();
  const [screen, setScreen] = useState<Screen>("landing");
  const [selected, setSelected] = useState<string | null>(null);
  // Ticked "Prepare" items: saved on the account when signed in, otherwise kept for this visit only.
  const [guestPrep, setGuestPrep] = useState<Record<string, string[]>>({});
  const prep = me ? (me.prep ?? {}) : guestPrep;
  const onTogglePrep = useCallback(
    (id: string, key: string) => {
      if (me) return togglePrep(id, key);
      setGuestPrep((g) => {
        const cur = g[id] ?? [];
        return { ...g, [id]: cur.includes(key) ? cur.filter((x) => x !== key) : [...cur, key] };
      });
    },
    [me, togglePrep],
  );
  const [filters, setFilters] = useState<Filters>(NO_FILTERS);
  const matchIds = useMemo(() => matchSet(filters), [filters]);

  const owned = useMemo<ReadonlySet<string>>(() => (me ? new Set(me.owned) : EMPTY), [me]);
  // `selected` keeps its connection lines lit after the sheet closes; tapping empty canvas clears it.
  const [sheetOpen, setSheetOpen] = useState(false);
  const select = useCallback((id: string) => { setSelected(id); setSheetOpen(true); }, []);
  const clearSelection = useCallback(() => setSelected(null), []);

  if (!ready) return <div className="min-h-dvh bg-navy" aria-busy="true" />;

  // Logged-in users skip the landing screen.
  const view: Screen = me && (screen === "landing" || screen === "auth") ? "tree" : screen;

  // First sign-in / register: ask what they have and how they like to apply.
  if (me && (!me.onboarded || screen === "edit"))
    return (
      <Onboarding
        me={me}
        editing={!!me.onboarded}
        onSave={(p) => { savePrefs(p); setScreen("tree"); }}
        onCancel={() => setScreen("progress")}
      />
    );

  if (view === "landing") return <Landing onAuth={() => setScreen("auth")} onPreview={() => setScreen("tree")} />;
  if (view === "auth")
    return <AuthScreen initial="register" onBack={() => setScreen("landing")} onDone={() => setScreen("tree")} />;

  return (
    <div className="flex h-dvh flex-col">
      <header className="flex items-center justify-between gap-2 bg-navy px-4 py-3 text-white">
        <Logo />
        {me ? (
          <button
            type="button"
            onClick={() => { logout(); setScreen("landing"); }}
            className="inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-semibold text-mist hover:bg-white/10"
          >
            <LogOut className="size-4" aria-hidden="true" /> Log out
          </button>
        ) : (
          <button
            type="button"
            onClick={() => setScreen("auth")}
            className="rounded-xl bg-amber px-4 py-2 text-sm font-bold text-navy hover:bg-amber/85"
          >
            Log in / Register
          </button>
        )}
      </header>

      {!me && (
        <p className="bg-mist px-4 py-2 text-center text-sm font-semibold text-navy">
          Preview mode — tap any ID to see its details. Register to track your progress.
        </p>
      )}

      <main className="relative min-h-0 flex-1 bg-background">
        {view === "tree" ? (
          <>
            <ReactFlowProvider>
              <SkillTree owned={owned} selectedId={selected} onSelect={select} onClear={clearSelection} matchIds={matchIds} liftControls={!!me?.priority} />
            </ReactFlowProvider>
            <Legend />
            <FilterBar filters={filters} onChange={setFilters} />
            {me && <TrackingBar me={me} onOpen={select} />}
          </>
        ) : view === "browse" ? (
          <div className="h-full overflow-y-auto bg-background pb-24">
            <BrowseScreen owned={owned} onOpen={select} />
          </div>
        ) : (
          me && (
            <div className="h-full overflow-y-auto bg-background pb-24">
              <ProgressScreen me={me} users={users} onSetPriority={setPriority} onStopTracking={toggleTrack} onEdit={() => setScreen("edit")} onPickCard={(id) => { setScreen("tree"); select(id); }} />
            </div>
          )
        )}
        <Dock view={view} onGo={setScreen} signedIn={!!me} raised={view === "tree" && !!me?.priority} />
      </main>

      <DetailSheet
        card={selected && sheetOpen ? CARD_BY_ID[selected] : null}
        owned={owned}
        signedIn={!!me}
        age={me?.age ?? null}
        budget={me?.budget}
        setup={me?.setup}
        prep={prep}
        tracking={me?.tracking ?? []}
        priority={me?.priority ?? null}
        onToggleTrack={toggleTrack}
        onSetPriority={setPriority}
        onTogglePrep={onTogglePrep}
        onClose={() => setSheetOpen(false)}
        onToggle={toggleOwned}
        onJump={select}
        onSignUp={() => { setSelected(null); setSheetOpen(false); setScreen("auth"); }}
      />
    </div>
  );
}

/** Floating icon buttons on the left edge that switch between the ID path and Progress. */
function Dock({ view, onGo, raised, signedIn }: { view: Screen; onGo: (s: Screen) => void; raised: boolean; signedIn: boolean }) {
  const items: { id: Screen; label: string; icon: React.ReactNode }[] = [
    { id: "tree", label: "ID path", icon: <Map className="size-6" /> },
    { id: "browse", label: "Browse IDs", icon: <LibraryBig className="size-6" /> },
    // Progress needs an account, so preview users only get the first two.
    ...(signedIn ? [{ id: "progress" as Screen, label: "Progress", icon: <TrendingUp className="size-6" /> }] : []),
  ];
  return (
    <nav
      aria-label="Main"
      className={`absolute left-3 z-30 flex flex-col gap-2 rounded-full bg-navy/95 p-1.5 shadow-xl ring-1 ring-white/20 backdrop-blur ${
        raised ? "bottom-[calc(env(safe-area-inset-bottom)+4rem)]" : "bottom-[max(1rem,env(safe-area-inset-bottom))]"
      }`}
    >
      {items.map((it) => {
        const active = view === it.id;
        return (
          <button
            key={it.id}
            type="button"
            title={it.label}
            aria-label={it.label}
            aria-current={active ? "page" : undefined}
            onClick={() => onGo(it.id)}
            className={`grid size-12 place-items-center rounded-full transition-colors ${
              active ? "bg-amber text-navy" : "text-white hover:bg-white/15"
            }`}
          >
            <span aria-hidden="true">{it.icon}</span>
          </button>
        );
      })}
    </nav>
  );
}

function Legend() {
  return (
    <ul className="pointer-events-none absolute left-3 top-3 z-10 flex flex-col gap-1.5 rounded-xl bg-white/90 p-2.5 text-[11px] font-bold text-navy shadow ring-1 ring-border backdrop-blur">
      <li className="flex items-center gap-2"><span className="size-3 rounded-full bg-amber" /> Obtained</li>
      <li className="flex items-center gap-2"><span className="size-3 rounded-full border-2 border-civic bg-white" /> Ready to get</li>
      <li className="flex items-center gap-2"><span className="size-3 rounded-full border border-dashed border-slate-500 bg-white" /> Locked</li>
    </ul>
  );
}
