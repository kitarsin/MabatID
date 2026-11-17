"use client";

import { useCallback, useMemo, useState } from "react";
import { LibraryBig, LogOut, Map, TrendingUp } from "lucide-react";
import { ReactFlowProvider } from "@xyflow/react";
import type { FactId, ProfileFacts } from "@/data/facts";
import { stepKey, evaluateApplication, type Mode } from "@/lib/prepare";
import { CARD_BY_ID } from "@/data/cards";
import { useStore } from "@/lib/store";
import { AuthScreen } from "./AuthScreen";
import { BrowseScreen } from "./BrowseScreen";
import { DetailSheet } from "./DetailSheet";
import { FilterBar } from "./FilterBar";
import { matchSet, NO_FILTERS, type Filters } from "@/lib/filters";
import { Landing } from "./Landing";
import { Logo } from "./Logo";
import { Onboarding } from "./Onboarding";
import { ProgressScreen } from "./ProgressScreen";
import { SkillTree } from "./SkillTree";
import { TrackingBar } from "./TrackingBar";

type Screen = "landing" | "auth" | "tree" | "browse" | "progress" | "edit";
const EMPTY: ReadonlySet<string> = new Set();

export function App() {
  const {
    ready,
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
  const [guestFacts, setGuestFacts] = useState<ProfileFacts>({});
  const [guestAge, setGuestAge] = useState<number | null>(null);
  const [guestModes, setGuestModes] = useState<Record<string, Mode>>({});
  const facts = me?.facts ?? guestFacts;
  const onSetFact = (id: FactId, value: boolean | undefined) =>
    me ? setFact(id, value) : setGuestFacts((f) => ({ ...f, [id]: value }));
  const onSetMode = (id: string, mode: Mode) =>
    me ? setMode(id, mode) : setGuestModes((m) => ({ ...m, [id]: mode }));
  const [screen, setScreen] = useState<Screen>("landing");
  const [selected, setSelected] = useState<string | null>(null);
  // Ticked "Prepare" items: saved on the device profile, otherwise kept for this visit only.
  const [guestPrep, setGuestPrep] = useState<Record<string, string[]>>({});
  const prep = me ? (me.prep ?? {}) : guestPrep;
  const onTogglePrep = useCallback(
    (id: string, key: string) => {
      if (me) return togglePrep(id, key);
      setGuestPrep((g) => {
        const cur = g[id] ?? [];
        const sequence = evaluateApplication(id, EMPTY, cur, {
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
    [me, togglePrep, guestAge, guestFacts, guestModes],
  );
  const [filters, setFilters] = useState<Filters>(NO_FILTERS);

  const context = useMemo(
    () => ({
      age: me?.age ?? guestAge,
      facts: me?.facts ?? guestFacts,
      documents: me?.documents,
      prep: me?.prep ?? guestPrep,
      modes: me?.modes ?? guestModes,
      setup: me?.setup,
    }),
    [me, guestAge, guestFacts, guestPrep, guestModes],
  );
  const matchIds = useMemo(
    () => matchSet(filters, context),
    [filters, context],
  );
  const owned = useMemo<ReadonlySet<string>>(
    () => (me ? new Set(me.owned) : EMPTY),
    [me],
  );
  // `selected` keeps its connection lines lit after the sheet closes; tapping empty canvas clears it.
  const [sheetOpen, setSheetOpen] = useState(false);
  const select = useCallback((id: string) => {
    setSelected(id);
    setSheetOpen(true);
  }, []);
  const clearSelection = useCallback(() => setSelected(null), []);

  if (!ready) return <div className="min-h-dvh bg-navy" aria-busy="true" />;

  // Active device profiles skip the landing screen.
  const view: Screen =
    me && (screen === "landing" || screen === "auth") ? "tree" : screen;

  // New device profiles start with document and application preferences.
  if (me && (!me.onboarded || screen === "edit"))
    return (
      <Onboarding
        me={me}
        editing={!!me.onboarded}
        onSave={(p) => {
          savePrefs(p);
          setScreen("tree");
        }}
        onCancel={() => setScreen("progress")}
      />
    );

  if (view === "landing")
    return (
      <Landing
        onAuth={() => setScreen("auth")}
        onPreview={() => setScreen("tree")}
      />
    );
  if (view === "auth")
    return (
      <AuthScreen
        onBack={() => {
          setScreen(selected ? "tree" : "landing");
          setSheetOpen(!!selected);
        }}
        onDone={() => {
          setScreen("tree");
          setSheetOpen(!!selected);
        }}
      />
    );

  return (
    <div className="flex h-dvh flex-col">
      <header className="flex items-center justify-between gap-2 bg-navy px-4 py-3 text-white">
        <Logo />
        {me ? (
          <button
            type="button"
            onClick={() => {
              logout();
              setSelected(null);
              setSheetOpen(false);
              setScreen("landing");
            }}
            className="inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-semibold text-mist hover:bg-white/10"
          >
            <LogOut className="size-4" aria-hidden="true" /> Switch profile
          </button>
        ) : (
          <button
            type="button"
            onClick={() => setScreen("auth")}
            className="rounded-xl bg-amber px-4 py-2 text-sm font-bold text-navy hover:bg-amber/85"
          >
            Open device profile
          </button>
        )}
      </header>

      {!me && (
        <p className="bg-mist px-4 py-2 text-center text-sm font-semibold text-navy">
          Preview mode — tap any ID to see its details. Use a device profile to
          save your progress.
        </p>
      )}

      <main className="relative min-h-0 flex-1 bg-background">
        {view === "tree" ? (
          <>
            <ReactFlowProvider>
              <SkillTree
                context={context}
                owned={owned}
                selectedId={selected}
                onSelect={select}
                onClear={clearSelection}
                matchIds={matchIds}
                liftControls={!!me?.priority}
              />
            </ReactFlowProvider>
            <Legend />
            <FilterBar
              filters={filters}
              onChange={setFilters}
              context={context}
            />
            {me && <TrackingBar me={me} onOpen={select} />}
          </>
        ) : view === "browse" ? (
          <div className="h-full overflow-y-auto bg-background pb-24">
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
            <div className="h-full overflow-y-auto bg-background pb-24">
              <ProgressScreen
                me={me}
                onSetPriority={setPriority}
                onStopTracking={toggleTrack}
                onEdit={() => setScreen("edit")}
                onPickCard={(id) => {
                  setScreen("tree");
                  select(id);
                }}
              />
            </div>
          )
        )}
        <Dock
          view={view}
          onGo={setScreen}
          signedIn={!!me}
          raised={view === "tree" && !!me?.priority}
        />
      </main>

      <DetailSheet
        card={selected && sheetOpen ? CARD_BY_ID[selected] : null}
        owned={owned}
        signedIn={!!me}
        age={me?.age ?? guestAge}
        facts={facts}
        documents={me?.documents ?? {}}
        onSetDocument={setDocumentEvidence}
        mode={selected ? (me?.modes ?? guestModes)[selected] : undefined}
        modes={me?.modes ?? guestModes}
        onSetFact={onSetFact}
        onSetMode={onSetMode}
        onSetAge={setGuestAge}
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
        onSignUp={() => {
          setSheetOpen(false);
          setScreen("auth");
        }}
      />
    </div>
  );
}

/** Floating icon buttons on the left edge that switch between the ID path and Progress. */
function Dock({
  view,
  onGo,
  raised,
  signedIn,
}: {
  view: Screen;
  onGo: (s: Screen) => void;
  raised: boolean;
  signedIn: boolean;
}) {
  const items: { id: Screen; label: string; icon: React.ReactNode }[] = [
    { id: "tree", label: "ID path", icon: <Map className="size-6" /> },
    {
      id: "browse",
      label: "Browse IDs & documents",
      icon: <LibraryBig className="size-6" />,
    },
    // Progress needs an account, so preview users only get the first two.
    ...(signedIn
      ? [
          {
            id: "progress" as Screen,
            label: "Progress",
            icon: <TrendingUp className="size-6" />,
          },
        ]
      : []),
  ];
  return (
    <nav
      aria-label="Main"
      className={`absolute left-3 z-30 flex flex-col gap-2 rounded-full bg-navy/95 p-1.5 shadow-xl ring-1 ring-white/20 backdrop-blur ${
        raised
          ? "bottom-[calc(env(safe-area-inset-bottom)+4rem)]"
          : "bottom-[max(1rem,env(safe-area-inset-bottom))]"
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
      <li className="flex items-center gap-2">
        <span className="size-3 rounded-full bg-amber" /> Obtained
      </li>
      <li className="flex items-center gap-2">
        <span className="size-3 rounded-full border-2 border-civic bg-white" />{" "}
        Requirements ready
      </li>
      <li className="flex items-center gap-2">
        <span className="size-3 rounded-full border border-dashed border-slate-500 bg-white" />{" "}
        Needs preparation
      </li>
      <li className="max-w-36 border-t border-border pt-1.5 text-[10px] font-normal">
        Overview links only. Select an ID to see document relationships.
      </li>
    </ul>
  );
}
