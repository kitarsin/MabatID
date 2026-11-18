"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  ArrowLeft,
  ArrowUpRight,
  LibraryBig,
  LogOut,
  Map,
  Signpost,
  Settings,
  TrendingUp,
} from "lucide-react";
import { ReactFlowProvider } from "@xyflow/react";
import { Button } from "@/components/ui/button";
import type { FactId, ProfileFacts } from "@/data/facts";
import {
  stepKey,
  evaluateApplication,
  sanitizeSaved,
  type Mode,
} from "@/lib/prepare";
import { SuggestedNext } from "./SuggestedNext";
import { useTreePlanning, type PlanningView } from "@/lib/use-tree-planning";
import type { PlanObjective } from "@/lib/planner/types";
import type { DocumentEvidenceMap } from "@/lib/documents";
import type { Budget, Setup } from "@/lib/prefs";
import { CARD_BY_ID } from "@/data/cards";
import type { Screen, View } from "@/lib/route";
import { useStore } from "@/lib/store";
import { profileToken } from "@/lib/revisions";
import { useAppRoute } from "@/lib/useAppRoute";
import { useHydrated } from "@/lib/useHydrated";
import { AppLoading } from "./AppLoading";
import { AuthScreen } from "./AuthScreen";
import { BrowseScreen } from "./BrowseScreen";
import { DetailSheet } from "./DetailSheet";
import { matchSet, NO_FILTERS, type Filters } from "@/lib/filters";
import { Landing } from "./Landing";
import { Logo } from "./Logo";
import { Onboarding } from "./Onboarding";
import { GuideScreen } from "./GuideScreen";
import { ProgressScreen } from "./ProgressScreen";
import { SettingsScreen } from "./SettingsScreen";
import { SkillTree } from "./SkillTree";
import { TrackingBar } from "./TrackingBar";
import { TreeToolbar } from "./TreeToolbar";

/** Per-screen document titles. The landing keeps the page's default title. */
const PAGE_TITLES: Record<string, string> = {
  auth: "Device profile · MabatID",
  tree: "Your ID path · MabatID",
  browse: "Browse IDs & documents · MabatID",
  progress: "Your progress · MabatID",
  settings: "Settings · MabatID",
  guide: "Guides · MabatID",
  onboarding: "Your checklist · MabatID",
};

export function App() {
  const {
    ready: storeReady,
    me,
    logout,
    toggleOwned,
    togglePrep,
    toggleTrack,
    setPriority,
    savePrefs,
    importProfile,
    setFact,
    setMode,
    setDocumentEvidence,
  } = useStore();
  // Not "ready" until the store has loaded AND this boundary has hydrated (see useHydrated), so no hydration mismatch.
  const hydrated = useHydrated();
  const ready = storeReady && hydrated;
  // The URL (?v=screen&id=open sheet) is the source of truth for the screen and the open detail sheet.
  const {
    screen: view,
    openId,
    go,
    home,
    landing,
    back,
    openCard,
    closeCard,
  } = useAppRoute(!!me, ready);
  const sheetOpen = !!openId;
  const [guestOwned, setGuestOwned] = useState<string[]>([]);
  const [guestDocuments, setGuestDocuments] = useState<DocumentEvidenceMap>({});
  const [guestBudget, setGuestBudget] = useState<Budget>("any");
  const [guestSetup, setGuestSetup] = useState<Setup>("both");
  const [objective, setObjective] = useState<PlanObjective>("fewest-documents");
  const [guestFacts, setGuestFacts] = useState<ProfileFacts>({});
  const [guestAge, setGuestAge] = useState<number | null>(null);
  const [guestModes, setGuestModes] = useState<Record<string, Mode>>({});
  const facts = me?.facts ?? guestFacts;
  const onSetFact = (id: FactId, value: boolean | undefined) =>
    me ? setFact(id, value) : setGuestFacts((f) => ({ ...f, [id]: value }));
  const onSetMode = (id: string, mode: Mode) =>
    me ? setMode(id, mode) : setGuestModes((m) => ({ ...m, [id]: mode }));
  const [selected, setSelected] = useState<string | null>(null);
  // Ticked "Prepare" items: saved on the device profile, otherwise kept for this visit only.
  const [guestPrep, setGuestPrep] = useState<Record<string, string[]>>({});
  const prep = me ? (me.prep ?? {}) : guestPrep;
  const onTogglePrep = useCallback(
    (id: string, key: string) => {
      if (me) return togglePrep(id, key);
      setGuestPrep((g) => {
        const cur = g[id] ?? [];
        const sequence = evaluateApplication(id, new Set(guestOwned), cur, {
          documents: guestDocuments,
          setup: guestSetup,
          age: guestAge,
          facts: guestFacts,
          mode: guestModes[id],
        }).steps;
        if (cur.includes(key)) {
          const index = sequence.findIndex((s) => stepKey(s.step) === key);
          const clear = new Set([
            key,
            ...(index < 0
              ? []
              : sequence.slice(index).map((s) => stepKey(s.step))),
          ]);
          return { ...g, [id]: cur.filter((k) => !clear.has(k)) };
        }
        if (
          key.startsWith("step:") &&
          !sequence.find((s) => stepKey(s.step) === key)?.enabled
        )
          return g;
        return { ...g, [id]: [...cur, key] };
      });
    },
    [
      me,
      togglePrep,
      guestAge,
      guestFacts,
      guestModes,
      guestOwned,
      guestDocuments,
      guestSetup,
    ],
  );
  const [filters, setFilters] = useState<Filters>(NO_FILTERS);

  const context = useMemo(
    () => ({
      age: me?.age ?? guestAge,
      facts: me?.facts ?? guestFacts,
      documents: me?.documents ?? guestDocuments,
      prep: me?.prep ?? guestPrep,
      modes: me?.modes ?? guestModes,
      setup: me?.setup ?? guestSetup,
    }),
    [
      me,
      guestAge,
      guestFacts,
      guestPrep,
      guestModes,
      guestDocuments,
      guestSetup,
    ],
  );
  const matchIds = useMemo(
    () => matchSet(filters, context),
    [filters, context],
  );
  const owned = useMemo<ReadonlySet<string>>(
    () => new Set(me?.owned ?? guestOwned),
    [me, guestOwned],
  );
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
      if (
        el instanceof HTMLElement &&
        !el.closest('[data-slot="sheet-content"]')
      )
        openerRef.current = el;
      openCard(id);
    },
    [openCard],
  );
  const clearSelection = useCallback(() => setSelected(null), []);
  const returnFocusTo = useCallback((): HTMLElement | null => {
    const id = selectedRef.current;
    const card = id
      ? document.querySelector<HTMLElement>(`[data-card-id="${id}"]`)
      : null;
    if (card?.isConnected) return card;
    if (openerRef.current?.isConnected) return openerRef.current;
    return document.getElementById("main");
  }, []);

  // `view` already has the guards applied (signed-in users never see the landing or auth).
  // New device profiles start with document and application preferences, whatever the URL says.
  const onboarding = (!!me && !me.onboarded) || view === "edit";
  const page = onboarding ? "onboarding" : view;

  const tree = useTreePlanning(
    {
      owned: [...owned].sort(),
      age: me?.age ?? guestAge,
      facts,
      documents: context.documents,
      ...sanitizeSaved(context.modes, prep),
      budget: me?.budget ?? guestBudget,
      setup: context.setup,
      objective,
      ...(selected ? { targetId: selected } : {}),
    },
    ready && (view === "tree" || view === "progress" || sheetOpen),
  );
  const planning: PlanningView = {
    result: tree.data?.goal,
    plan: tree.plan,
    loading: tree.loading,
    error: tree.error,
    objective,
    onObjectiveChange: setObjective,
    onSelectPlan: tree.onSelectPlan,
    onRetry: tree.onRetry,
  };
  const editStartingPoint = useCallback(() => go("edit"), [go]);
  const suggestions = (
    <SuggestedNext
      data={tree.data}
      loading={tree.loading}
      error={tree.error}
      onRetry={tree.onRetry}
      objective={objective}
      onObjectiveChange={setObjective}
      onEdit={editStartingPoint}
      onPick={(id) => {
        go("tree");
        select(id);
      }}
    />
  );

  // Screen changes are instant swaps, so tell assistive tech: update the title and move focus to <main>.
  const baseTitle = useRef<string | null>(null);
  const lastPage = useRef<string | null>(null);
  useEffect(() => {
    if (!ready) return;
    if (baseTitle.current === null) baseTitle.current = document.title;
    document.title = PAGE_TITLES[page] ?? baseTitle.current;
    if (lastPage.current && lastPage.current !== page)
      document.getElementById("main")?.focus({ preventScroll: true });
    lastPage.current = page;
  }, [ready, page]);

  if (!ready) return <AppLoading />;

  if (onboarding)
    return (
      <Onboarding
        me={
          me ?? {
            id: "preview",
            name: "Preview",
            age: guestAge ?? NaN,
            owned: guestOwned,
            documents: guestDocuments,
            budget: guestBudget,
            setup: guestSetup,
            createdAt: 0,
            onboarded: true,
          }
        }
        editing={!me || !!me.onboarded}
        onSave={async (p, expectedToken) => {
          if (me) {
            const problem = await savePrefs(p, expectedToken);
            if (problem) return;
          } else {
            setGuestAge(p.age);
            setGuestOwned(p.owned);
            setGuestDocuments(p.documents);
            setGuestBudget(p.budget);
            setGuestSetup(p.setup);
          }
          go("tree", { replace: true, keepId: true });
        }}
        onCancel={() => back("edit", me ? "settings" : "tree")}
      />
    );

  if (view === "landing")
    return <Landing onAuth={() => go("auth")} onPreview={() => go("tree")} />;
  if (view === "auth")
    return (
      <AuthScreen
        onBack={() => back("auth", selected ? "tree" : null)}
        onDone={() => {
          go("tree", { replace: true });
          if (selected) openCard(selected);
        }}
      />
    );

  return (
    <div className="app-shell flex h-dvh flex-col overflow-hidden">
      <a
        href="#main"
        onClick={(e) => {
          e.preventDefault();
          document.getElementById("main")?.focus();
        }}
        className="surface-navy fixed left-3 top-3 z-[60] -translate-y-[200%] rounded-xl bg-amber px-4 py-2.5 text-sm font-bold text-navy focus:translate-y-0"
      >
        Skip to main content
      </a>

      <header className="flex items-center justify-between gap-3 px-4 pt-3 pb-2 md:px-5">
        <div className="flex min-w-0 items-center gap-2 sm:gap-3">
          {/* Guests can return to the landing page (signed-in users have no landing: `/` is their ID path). */}
          {!me && (
            <Button
              type="button"
              variant="outline"
              size="md"
              onClick={landing}
              aria-label="Home"
              className="group/home w-11 px-0 sm:w-auto sm:px-3.5"
            >
              <ArrowLeft
                className="size-4 transition-transform duration-[var(--dur-base)] ease-[var(--ease-out)] group-hover/home:-translate-x-0.5"
                aria-hidden="true"
              />
              <span className="hidden sm:inline">Home</span>
            </Button>
          )}
          {me ? (
            <Logo dark />
          ) : (
            <button
              type="button"
              onClick={landing}
              aria-label="MabatID home"
              className="hidden rounded-full sm:inline-flex"
            >
              <Logo dark />
            </button>
          )}
          {!me && (
            <span className="hidden items-center gap-1.5 rounded-full bg-white/80 py-1 pr-3 pl-1 text-xs font-medium text-muted-foreground ring-1 ring-navy/8 backdrop-blur sm:inline-flex">
              <span className="rounded-full bg-mist px-2 py-0.5 font-semibold text-navy">
                Preview
              </span>
              Tap any ID to see its details
            </span>
          )}
        </div>
        {me ? (
          <Button
            type="button"
            variant="outline"
            size="md"
            onClick={() => {
              logout();
              setSelected(null);
              home();
            }}
          >
            <LogOut className="size-4" aria-hidden="true" /> Switch profile
          </Button>
        ) : (
          <Button
            type="button"
            variant="cta"
            size="md"
            onClick={() => go("auth")}
            className="pr-1.5"
          >
            Open device profile
            <span
              aria-hidden="true"
              className="grid size-8 place-items-center rounded-full bg-navy text-amber transition-transform duration-[var(--dur-base)] ease-[var(--ease-out)] group-hover/button:rotate-45"
            >
              <ArrowUpRight className="size-4" />
            </span>
          </Button>
        )}
      </header>

      {/* Below 768px: column, floating tab bar at the bottom. From 768px: row, the tab bar becomes a floating rail. */}
      <div className="flex min-h-0 flex-1 flex-col gap-3 px-3 pb-3 md:flex-row md:px-3">
        <TabBar view={view} onGo={go} />
        <main
          id="main"
          tabIndex={-1}
          className="panel relative flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden rounded-[28px] outline-none"
        >
          {view === "tree" ? (
            <>
              <h1 className="sr-only">Your ID path</h1>
              <TreeToolbar
                filters={filters}
                onChange={setFilters}
                context={context}
              />
              <div className="relative min-h-0 flex-1">
                <div className="absolute inset-0">
                  <ReactFlowProvider>
                    <SkillTree
                      context={context}
                      owned={owned}
                      selectedId={selected}
                      onSelect={select}
                      onClear={clearSelection}
                      matchIds={matchIds}
                      priorityId={me?.priority ?? null}
                      onEdit={editStartingPoint}
                      assessments={tree.data?.nodes}
                      recommendedIds={
                        tree.data?.recommendations.map((r) => r.id) ?? []
                      }
                      plan={tree.plan}
                      sheetOpen={sheetOpen}
                    />
                  </ReactFlowProvider>
                </div>
              </div>
              {me && <TrackingBar me={me} onOpen={select} />}
            </>
          ) : view === "browse" ? (
            <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain pb-6">
              <BrowseScreen
                owned={owned}
                onOpen={select}
                kind={filters.kind}
                onKindChange={(kind) =>
                  setFilters((previous) => ({ ...previous, kind }))
                }
              />
            </div>
          ) : view === "guide" ? (
            <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain pb-6">
              <GuideScreen
                owned={owned}
                context={context}
                signedIn={!!me}
                tracking={me?.tracking ?? []}
                onToggleTrack={toggleTrack}
                onOpen={select}
                onShowOnPath={(id) => {
                  go("tree");
                  setSelected(id);
                }}
                onSignUp={() => go("auth")}
              />
            </div>
          ) : view === "settings" ? (
            <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain pb-6">
              <SettingsScreen
                me={me}
                onSavePrefs={(p) => { void savePrefs(p, profileToken(me ?? undefined)); }}
                onEditCollection={() => go("edit")}
                onSwitchProfile={() => {
                  logout();
                  setSelected(null);
                  home();
                }}
                onCreateProfile={() => go("auth")}
                onImport={importProfile}
              />
            </div>
          ) : (
            <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain pb-6">
              {me ? (
                <ProgressScreen
                  me={me}
                  onSetPriority={setPriority}
                  onStopTracking={toggleTrack}
                  onPickCard={(id) => {
                    go("tree");
                    select(id);
                  }}
                  suggestions={suggestions}
                />
              ) : (
                <div className="mx-auto w-full max-w-md space-y-8 px-5 pt-6 pb-12">
                  <h1 className="text-2xl font-semibold tracking-tight text-navy">
                    Your progress
                  </h1>
                  {suggestions}
                  <div className="rounded-[24px] bg-mist/40 p-5 ring-1 ring-sky/25">
                    <p className="font-semibold text-navy">Save your progress</p>
                    <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">
                      Make a device profile to track IDs and keep your ticks.
                    </p>
                    <Button
                      type="button"
                      variant="cta"
                      size="md"
                      onClick={() => go("auth")}
                      className="mt-4"
                    >
                      Open device profile
                    </Button>
                  </div>
                </div>
              )}
            </div>
          )}
        </main>
      </div>

      <DetailSheet
        card={openId ? CARD_BY_ID[openId] : null}
        owned={owned}
        signedIn={!!me}
        age={me?.age ?? guestAge}
        facts={facts}
        documents={me?.documents ?? guestDocuments}
        onSetDocument={(id, value) =>
          me
            ? setDocumentEvidence(id, value)
            : setGuestDocuments((d) => ({ ...d, [id]: value }))
        }
        mode={selected ? (me?.modes ?? guestModes)[selected] : undefined}
        planning={planning}
        onSetFact={onSetFact}
        onSetMode={onSetMode}
        onSetAge={setGuestAge}
        budget={me?.budget ?? guestBudget}
        setup={me?.setup ?? guestSetup}
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
        onSignUp={() => go("auth")}
      />
    </div>
  );
}

/**
 * Main navigation. In flow (never overlays content): a bottom tab bar below 768px, a left rail from 768px.
 * It comes first in the DOM (so the rail is first in tab order on desktop) and is moved below <main> on
 * small screens with `order-last`. Each item has a visible label; the active one gets an amber pill.
 */
function TabBar({
  view,
  onGo,
}: {
  view: Screen;
  onGo: (v: View) => void;
}) {
  const items: { id: View; label: string; icon: React.ReactNode }[] = [
    { id: "tree", label: "ID path", icon: <Map className="size-5" /> },
    {
      id: "browse",
      label: "Browse",
      icon: <LibraryBig className="size-5" />,
    },
    {
      id: "guide" as View,
      label: "Guides",
      icon: <Signpost className="size-5" />,
    },
    {
      id: "progress" as View,
      label: "Progress",
      icon: <TrendingUp className="size-5" />,
    },
    {
      id: "settings" as View,
      label: "Settings",
      icon: <Settings className="size-5" />,
    },
  ];
  return (
    <nav
      aria-label="Main"
      className="rail surface-navy order-last mb-[env(safe-area-inset-bottom)] flex shrink-0 items-stretch justify-around gap-1 rounded-[24px] bg-navy p-1.5 md:order-first md:w-[84px] md:flex-col md:items-stretch md:justify-start md:gap-1.5 md:px-2 md:py-3"
    >
      {items.map((it) => {
        const active = view === it.id;
        return (
          <button
            key={it.id}
            type="button"
            aria-current={active ? "page" : undefined}
            onClick={() => onGo(it.id)}
            className={`group flex min-h-14 flex-1 flex-col items-center justify-center gap-1 rounded-[18px] py-1.5 transition-[background-color,scale] duration-[var(--dur-fast)] ease-[var(--ease-out)] active:scale-[0.97] active:duration-[var(--dur-press)] md:flex-none ${
              active ? "bg-white/10 shadow-[inset_0_1px_0_rgb(255_255_255/0.12)]" : "hover:bg-white/5"
            }`}
          >
            <span
              aria-hidden="true"
              className={`grid size-10 place-items-center rounded-[14px] transition-[background-color,color,box-shadow] duration-[var(--dur-fast)] ease-[var(--ease-out)] ${
                active
                  ? "bg-amber text-navy shadow-[0_6px_16px_-6px_color-mix(in_srgb,var(--color-amber)_80%,transparent)]"
                  : "text-white/75 group-hover:text-white"
              }`}
            >
              {it.icon}
            </span>
            <span
              className={`text-balance px-0.5 text-center text-[11px] leading-tight font-semibold transition-colors duration-[var(--dur-fast)] ease-[var(--ease-out)] ${
                active ? "text-white" : "text-white/70"
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
