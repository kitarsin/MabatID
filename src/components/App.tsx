"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { LibraryBig, LogOut, Map, TrendingUp } from "lucide-react";
import { ReactFlowProvider } from "@xyflow/react";
import { Button } from "@/components/ui/button";
import { CARD_BY_ID } from "@/data/cards";
import type { Screen, View } from "@/lib/route";
import { useStore } from "@/lib/store";
import { useAppRoute } from "@/lib/useAppRoute";
import { useHydrated } from "@/lib/useHydrated";
import { AppLoading } from "./AppLoading";
import { AuthScreen } from "./AuthScreen";
import { BrowseScreen } from "./BrowseScreen";
import { DetailSheet } from "./DetailSheet";
import { matchSet, NO_FILTERS, type Filters } from "./FilterBar";
import { Landing } from "./Landing";
import { Logo } from "./Logo";
import { Onboarding } from "./Onboarding";
import { ProgressScreen } from "./ProgressScreen";
import { SkillTree } from "./SkillTree";
import { TrackingBar } from "./TrackingBar";
import { TreeToolbar } from "./TreeToolbar";

const EMPTY: ReadonlySet<string> = new Set();

/** Per-screen document titles. The landing keeps the page's default title. */
const PAGE_TITLES: Record<string, string> = {
  auth: "Log in or register · MabatID",
  tree: "Your ID path · MabatID",
  browse: "Browse IDs · MabatID",
  progress: "Your progress · MabatID",
  onboarding: "Your checklist · MabatID",
};

export function App() {
  const { ready: storeReady, me, logout, toggleOwned, togglePrep, toggleTrack, setPriority, savePrefs } = useStore();
  // Not "ready" until the store has loaded AND this boundary has hydrated (see useHydrated), so no hydration mismatch.
  const hydrated = useHydrated();
  const ready = storeReady && hydrated;
  // The URL (?v=screen&id=open sheet) is the source of truth for the screen and the open detail sheet.
  const { screen: view, openId, go, home, back, openCard, closeCard } = useAppRoute(!!me, ready);
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
  // Whenever the URL opens a sheet (tap, deep link, Back/Forward) the highlight follows it.
  const [seenId, setSeenId] = useState<string | null>(null);
  if (openId !== seenId) {
    setSeenId(openId);
    if (openId) setSelected(openId);
  }
  // Where focus goes when the sheet closes: the control that opened it. `openerRef` is the element that had
  // focus when the sheet was first opened (jumping between IDs from inside the sheet keeps the original);
  // `selectedRef` is the ID the sheet ended on, whose node/card is tagged with data-card-id.
  const openerRef = useRef<HTMLElement | null>(null);
  const selectedRef = useRef<string | null>(null);
  useEffect(() => {
    if (openId) selectedRef.current = openId;
  }, [openId]);
  const select = useCallback(
    (id: string) => {
      const el = document.activeElement;
      if (el instanceof HTMLElement && !el.closest('[data-slot="sheet-content"]')) openerRef.current = el;
      openCard(id);
    },
    [openCard],
  );
  const clearSelection = useCallback(() => setSelected(null), []);
  const returnFocusTo = useCallback((): HTMLElement | null => {
    const id = selectedRef.current;
    const card = id ? document.querySelector<HTMLElement>(`[data-card-id="${id}"]`) : null;
    if (card?.isConnected) return card;
    if (openerRef.current?.isConnected) return openerRef.current;
    return document.getElementById("main");
  }, []);

  // `view` already has the guards applied (signed-in users never see the landing or auth; progress/edit need an account).
  // First sign-in / register: ask what they have and how they like to apply, whatever the URL says.
  const onboarding = !!me && (!me.onboarded || view === "edit");
  const page = onboarding ? "onboarding" : view;

  // Screen changes are instant swaps, so tell assistive tech: update the title and move focus to <main>.
  const baseTitle = useRef<string | null>(null);
  const lastPage = useRef<string | null>(null);
  useEffect(() => {
    if (!ready) return;
    if (baseTitle.current === null) baseTitle.current = document.title;
    document.title = PAGE_TITLES[page] ?? baseTitle.current;
    if (lastPage.current && lastPage.current !== page) document.getElementById("main")?.focus({ preventScroll: true });
    lastPage.current = page;
  }, [ready, page]);

  if (!ready) return <AppLoading />;

  if (me && onboarding)
    return (
      <Onboarding
        me={me}
        editing={!!me.onboarded}
        onSave={(p) => { savePrefs(p); go("tree", { replace: true, keepId: true }); }}
        onCancel={() => back("edit", "progress")}
      />
    );

  if (view === "landing") return <Landing onAuth={() => go("auth")} onPreview={() => go("tree")} />;
  if (view === "auth")
    return <AuthScreen initial="register" onBack={() => back("auth", null)} onDone={() => go("tree", { replace: true })} />;

  return (
    <div className="flex h-dvh flex-col">
      <a
        href="#main"
        onClick={(e) => { e.preventDefault(); document.getElementById("main")?.focus(); }}
        className="surface-navy fixed left-3 top-3 z-[60] -translate-y-[200%] rounded-xl bg-amber px-4 py-2.5 text-sm font-bold text-navy focus:translate-y-0"
      >
        Skip to main content
      </a>

      <header className="surface-navy flex items-center justify-between gap-2 bg-navy px-4 py-2 text-white">
        <Logo />
        {me ? (
          <Button
            type="button"
            variant="ghost"
            size="md"
            onClick={() => { logout(); home(); }}
            className="text-mist hover:bg-white/10 hover:text-white"
          >
            <LogOut className="size-4" aria-hidden="true" /> Log out
          </Button>
        ) : (
          <Button type="button" variant="cta" size="md" onClick={() => go("auth")}>
            Log in / Register
          </Button>
        )}
      </header>

      {!me && (
        <p className="bg-mist px-4 py-2 text-center text-sm font-semibold text-navy">
          Preview mode — tap any ID to see its details. Register to track your progress.
        </p>
      )}

      {/* Below 768px: column, tab bar at the bottom. From 768px: row, tab bar becomes a left rail. */}
      <div className="flex min-h-0 flex-1 flex-col md:flex-row">
        <TabBar view={view} onGo={go} signedIn={!!me} />
        <main id="main" tabIndex={-1} className="flex min-h-0 min-w-0 flex-1 flex-col bg-background outline-none">
          {view === "tree" ? (
            <>
              <h1 className="sr-only">Your ID path</h1>
              <TreeToolbar filters={filters} onChange={setFilters} />
              <div className="relative min-h-0 flex-1">
                <div className="absolute inset-0">
                  <ReactFlowProvider>
                    <SkillTree
                      owned={owned}
                      selectedId={selected}
                      onSelect={select}
                      onClear={clearSelection}
                      matchIds={matchIds}
                      priorityId={me?.priority ?? null}
                    />
                  </ReactFlowProvider>
                </div>
              </div>
              {me && <TrackingBar me={me} onOpen={select} />}
            </>
          ) : view === "browse" ? (
            <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain bg-background pb-6">
              <BrowseScreen owned={owned} onOpen={select} />
            </div>
          ) : (
            me && (
              <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain bg-background pb-6">
                <ProgressScreen me={me} onSetPriority={setPriority} onStopTracking={toggleTrack} onEdit={() => go("edit")} onPickCard={(id) => { go("tree"); select(id); }} />
              </div>
            )
          )}
        </main>
      </div>

      <DetailSheet
        card={openId ? CARD_BY_ID[openId] : null}
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
        onClose={closeCard}
        finalFocus={returnFocusTo}
        onToggle={toggleOwned}
        onJump={select}
        onSignUp={() => { setSelected(null); go("auth"); }}
      />
    </div>
  );
}

/**
 * Main navigation. In flow (never overlays content): a bottom tab bar below 768px, a left rail from 768px.
 * It comes first in the DOM (so the rail is first in tab order on desktop) and is moved below <main> on
 * small screens with `order-last`. Each item has a visible label; the active one gets an amber pill.
 */
function TabBar({ view, onGo, signedIn }: { view: Screen; onGo: (v: View) => void; signedIn: boolean }) {
  const items: { id: View; label: string; icon: React.ReactNode }[] = [
    { id: "tree", label: "ID path", icon: <Map className="size-6" /> },
    { id: "browse", label: "Browse IDs", icon: <LibraryBig className="size-6" /> },
    // Progress needs an account, so preview users only get the first two.
    ...(signedIn ? [{ id: "progress" as View, label: "Progress", icon: <TrendingUp className="size-6" /> }] : []),
  ];
  return (
    <nav
      aria-label="Main"
      className="surface-navy order-last flex shrink-0 items-stretch justify-around gap-1 border-t border-white/15 bg-navy px-2 pt-1.5 pb-[env(safe-area-inset-bottom)] md:order-first md:w-20 md:flex-col md:items-stretch md:justify-start md:gap-2 md:border-r md:border-t-0 md:px-1 md:py-3"
    >
      {items.map((it) => {
        const active = view === it.id;
        return (
          <button
            key={it.id}
            type="button"
            aria-current={active ? "page" : undefined}
            onClick={() => onGo(it.id)}
            className="group flex min-h-14 flex-1 flex-col items-center justify-center gap-1 rounded-xl transition-[scale] duration-[var(--dur-fast)] ease-[var(--ease-out)] active:scale-[0.97] active:duration-[var(--dur-press)] md:flex-none"
          >
            <span
              aria-hidden="true"
              className={`grid h-8 w-14 place-items-center rounded-full transition-[background-color,color] duration-[var(--dur-fast)] ease-[var(--ease-out)] ${
                active ? "bg-amber text-navy" : "text-white/80 group-hover:bg-white/10"
              }`}
            >
              {it.icon}
            </span>
            <span
              className={`text-xs leading-none font-semibold transition-colors duration-[var(--dur-fast)] ease-[var(--ease-out)] ${
                active ? "text-white" : "text-white/80"
              }`}
            >
              {it.label}
            </span>
          </button>
        );
      })}
    </nav>
  );
}
