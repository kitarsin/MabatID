"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { LibraryBig, LogOut, Map, TrendingUp } from "lucide-react";
import { ReactFlowProvider } from "@xyflow/react";
import { Button } from "@/components/ui/button";
import type { FactId, ProfileFacts } from "@/data/facts";
import { stepKey, evaluateApplication, type Mode } from "@/lib/prepare";
import { TreeAdvisor } from "./TreeAdvisor";
import { useTreePlanning, type PlanningView } from "@/lib/use-tree-planning";
import type { PlanObjective } from "@/lib/planner/types";
import type { DocumentEvidenceMap } from "@/lib/documents";
import type { Budget, Setup } from "@/lib/prefs";
import { CARD_BY_ID } from "@/data/cards";
import type { Screen, View } from "@/lib/route";
import { useStore } from "@/lib/store";
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
import { ProgressScreen } from "./ProgressScreen";
import { SkillTree } from "./SkillTree";
import { TrackingBar } from "./TrackingBar";
import { TreeToolbar } from "./TreeToolbar";

/** Per-screen document titles. The landing keeps the page's default title. */
const PAGE_TITLES: Record<string, string> = {
  auth: "Device profile · MabatID",
  tree: "Your ID path · MabatID",
  browse: "Browse IDs & documents · MabatID",
  progress: "Your progress · MabatID",
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
      prep,
      modes: context.modes,
      budget: me?.budget ?? guestBudget,
      setup: context.setup,
      objective,
      ...(selected ? { targetId: selected } : {}),
    },
    ready && (view === "tree" || sheetOpen),
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
  const chooseGoal = useCallback((id: string) => setSelected(id), []);

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
        onSave={(p) => {
          if (me) savePrefs(p);
          else {
            setGuestAge(p.age);
            setGuestOwned(p.owned);
            setGuestDocuments(p.documents);
            setGuestBudget(p.budget);
            setGuestSetup(p.setup);
          }
          go("tree", { replace: true, keepId: true });
        }}
        onCancel={() => back("edit", me ? "progress" : "tree")}
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
    <div className="flex h-dvh flex-col overflow-hidden">
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

      <header className="surface-navy flex items-center justify-between gap-2 bg-navy px-4 py-2 text-white">
        <Logo />
        {me ? (
          <Button
            type="button"
            variant="ghost"
            size="md"
            onClick={() => {
              logout();
              setSelected(null);
              home();
            }}
            className="text-mist hover:bg-white/10 hover:text-white"
          >
            <LogOut className="size-4" aria-hidden="true" /> Switch profile
          </Button>
        ) : (
          <Button
            type="button"
            variant="cta"
            size="md"
            onClick={() => go("auth")}
          >
            Open device profile
          </Button>
        )}
      </header>

      {!me && (
        <p className="bg-mist px-4 py-2 text-center text-sm font-semibold text-navy">
          Preview mode — tap any ID to see its details. Use a device profile to
          save your progress.
        </p>
      )}

      {/* Below 768px: column, tab bar at the bottom. From 768px: row, tab bar becomes a left rail. */}
      <div className="flex min-h-0 flex-1 flex-col md:flex-row">
        <TabBar view={view} onGo={go} signedIn={!!me} />
        <main
          id="main"
          tabIndex={-1}
          className="flex min-h-0 min-w-0 flex-1 flex-col bg-background outline-none"
        >
          {view === "tree" ? (
            <>
              {/* In flow, above the canvas. Capped so the canvas keeps room on short phones (it scrolls inside). */}
              <div className="max-h-[40dvh] shrink-0 overflow-y-auto overscroll-contain">
                <TreeAdvisor
                  data={tree.data}
                  view={planning}
                  selectedId={selected}
                  onChooseGoal={chooseGoal}
                  onOpenGuide={select}
                  onClear={clearSelection}
                  onEdit={editStartingPoint}
                />
              </div>
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
                    />
                  </ReactFlowProvider>
                </div>
              </div>
              {me && <TrackingBar me={me} onOpen={select} />}
            </>
          ) : view === "browse" ? (
            <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain bg-background pb-6">
              <BrowseScreen
                owned={owned}
                onOpen={select}
                kind={filters.kind}
                onKindChange={(kind) =>
                  setFilters((previous) => ({ ...previous, kind }))
                }
              />
            </div>
          ) : (
            me && (
              <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain bg-background pb-6">
                <ProgressScreen
                  me={me}
                  onSetPriority={setPriority}
                  onStopTracking={toggleTrack}
                  onEdit={() => go("edit")}
                  onPickCard={(id) => {
                    go("tree");
                    select(id);
                  }}
                />
              </div>
            )
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
  signedIn,
}: {
  view: Screen;
  onGo: (v: View) => void;
  signedIn: boolean;
}) {
  const items: { id: View; label: string; icon: React.ReactNode }[] = [
    { id: "tree", label: "ID path", icon: <Map className="size-6" /> },
    {
      id: "browse",
      label: "Browse IDs & documents",
      icon: <LibraryBig className="size-6" />,
    },
    // Progress needs a device profile, so preview users only get the first two.
    ...(signedIn
      ? [
          {
            id: "progress" as View,
            label: "Progress",
            icon: <TrendingUp className="size-6" />,
          },
        ]
      : []),
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
                active
                  ? "bg-amber text-navy"
                  : "text-white/80 group-hover:bg-white/10"
              }`}
            >
              {it.icon}
            </span>
            <span
              className={`text-balance px-0.5 text-center text-xs leading-tight font-semibold transition-colors duration-[var(--dur-fast)] ease-[var(--ease-out)] ${
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
