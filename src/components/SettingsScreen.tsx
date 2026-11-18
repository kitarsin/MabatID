"use client";

import { LogOut, Pencil, UserRound } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Chip } from "@/components/ui/chip";
import { CARDS } from "@/data/cards";
import { EXTRA_DOCUMENTS } from "@/data/documents";
import { BUDGETS, DEFAULT_SETUP, SETUPS, type Budget, type Setup } from "@/lib/prefs";
import type { User } from "@/lib/store";
import { CardIcon } from "./icons";
import { ProfileTransfers } from "./TransferPanel";
import { ProfileBackupRestore } from "./BackupRestorePanel";

const INVENTORY = [...CARDS, ...EXTRA_DOCUMENTS];

/** Account settings: profile, saved count, preferences, collection and device transfer. */
export function SettingsScreen({
  me,
  onSavePrefs,
  onEditCollection,
  onSwitchProfile,
  onCreateProfile,
}: {
  me: User | null;
  onSavePrefs: (p: {
    owned: string[];
    documents: NonNullable<User["documents"]>;
    budget: Budget;
    setup: Setup;
    age: number;
  }) => void;
  onEditCollection: () => void;
  onSwitchProfile: () => void;
  onCreateProfile: () => void;
}) {
  return (
    <div className="mx-auto w-full max-w-md space-y-10 px-5 pt-6 pb-12">
      <h1 className="text-2xl font-semibold tracking-tight text-navy">Settings</h1>
      {me ? (
        <Signed me={me} onSavePrefs={onSavePrefs} onEditCollection={onEditCollection} onSwitchProfile={onSwitchProfile} />
      ) : (
        <section className="rounded-[24px] bg-mist/40 p-5 ring-1 ring-sky/25">
          <p className="font-semibold text-navy">No profile on this device</p>
          <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">
            Make a device profile to save your IDs, preferences and progress.
          </p>
          <Button type="button" variant="cta" size="md" onClick={onCreateProfile} className="mt-4">
            Open device profile
          </Button>
        </section>
      )}
      <ProfileBackupRestore />
      <ProfileTransfers />
    </div>
  );
}

function Signed({
  me,
  onSavePrefs,
  onEditCollection,
  onSwitchProfile,
}: {
  me: User;
  onSavePrefs: Parameters<typeof SettingsScreen>[0]["onSavePrefs"];
  onEditCollection: () => void;
  onSwitchProfile: () => void;
}) {
  const owned = new Set(me.owned);
  const have = INVENTORY.filter((c) => owned.has(c.id));
  const pct = Math.round((have.length / INVENTORY.length) * 100);
  const budget = me.budget ?? "any";
  const setup = me.setup ?? DEFAULT_SETUP;
  const save = (patch: { budget?: Budget; setup?: Setup }) =>
    onSavePrefs({
      owned: me.owned,
      documents: me.documents ?? {},
      budget,
      setup,
      age: me.age,
      ...patch,
    });

  return (
    <>
      <section aria-label="Profile" className="flex items-center gap-4">
        <span className="grid size-14 shrink-0 place-items-center rounded-full bg-navy text-xl font-semibold text-amber">
          {me.name.trim()[0]?.toUpperCase() ?? <UserRound className="size-6" aria-hidden="true" />}
        </span>
        <div className="min-w-0 flex-1">
          <p className="truncate text-lg font-semibold text-navy">{me.name}</p>
          <p className="text-sm text-muted-foreground">
            Age {me.age} · saved on this device only
          </p>
        </div>
        <Button type="button" variant="outline" size="md" onClick={onSwitchProfile}>
          <LogOut className="size-4" aria-hidden="true" />
          <span className="sr-only sm:not-sr-only">Switch</span>
        </Button>
      </section>

      <section className="surface-navy rounded-[28px] bg-navy p-6 text-white">
        <div className="flex items-center gap-4">
          <Ring pct={pct} />
          <div>
            <p className="text-xl font-bold leading-tight tabular-nums">
              {have.length} of {INVENTORY.length} saved
            </p>
            <p className="mt-1 text-sm text-mist">
              IDs and documents you have. You don’t need them all.
            </p>
          </div>
        </div>
      </section>

      <section aria-labelledby="prefs">
        <h2 id="prefs" className="text-lg font-semibold tracking-tight text-navy">
          Preferences
        </h2>
        <p className="mt-1.5 text-[15px] leading-relaxed text-muted-foreground">
          We use these to suggest IDs and routes.
        </p>
        <div className="mt-5 space-y-6">
          <div role="group" aria-labelledby="prefs-budget">
            <p id="prefs-budget" className="mb-3 text-sm font-semibold text-navy">
              Budget per ID
            </p>
            <div className="flex flex-wrap gap-2">
              {BUDGETS.map((b) => (
                <Chip key={b.id} pressed={budget === b.id} onClick={() => save({ budget: b.id })}>
                  {b.label}
                </Chip>
              ))}
            </div>
          </div>
          <div role="group" aria-labelledby="prefs-setup">
            <p id="prefs-setup" className="mb-3 text-sm font-semibold text-navy">
              How you like to apply
            </p>
            <div className="flex flex-wrap gap-2">
              {SETUPS.map((s) => (
                <Chip key={s.id} pressed={setup === s.id} onClick={() => save({ setup: s.id })}>
                  {s.label}
                </Chip>
              ))}
            </div>
            <p className="mt-2 text-xs text-muted-foreground">
              {SETUPS.find((s) => s.id === setup)?.hint}
            </p>
          </div>
        </div>
      </section>

      <section aria-labelledby="collection">
        <div className="flex items-center gap-2">
          <h2 id="collection" className="flex-1 text-lg font-semibold tracking-tight text-navy">
            Your collection
          </h2>
          <Button type="button" variant="outline" size="md" onClick={onEditCollection}>
            <Pencil className="size-4" aria-hidden="true" /> Edit
          </Button>
        </div>
        <p className="mt-1.5 text-[15px] leading-relaxed text-muted-foreground">
          {have.length
            ? `${have.length} ID${have.length === 1 ? "" : "s"} and documents you have now.`
            : "Nothing added yet. Tap Edit to add what you have."}
        </p>
        {have.length > 0 && (
          <ul className="mt-5 grid grid-cols-1 gap-2.5 sm:grid-cols-2">
            {have.map((c) => (
              <li
                key={c.id}
                className="flex items-center gap-3 rounded-[18px] bg-card px-3.5 py-3 ring-1 ring-navy/[0.08]"
              >
                <span className="grid size-9 shrink-0 place-items-center rounded-full bg-amber text-navy">
                  <CardIcon name={"icon" in c ? c.icon : "receipt"} className="size-4" />
                </span>
                <span className="min-w-0 text-sm font-medium leading-snug text-navy">
                  {"short" in c ? c.short : c.name}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </>
  );
}

function Ring({ pct }: { pct: number }) {
  const r = 34,
    c = 2 * Math.PI * r;
  return (
    <svg viewBox="0 0 80 80" className="size-20 shrink-0 -rotate-90" role="img" aria-label={`${pct}% saved`}>
      <circle cx="40" cy="40" r={r} fill="none" className="stroke-mist/25" strokeWidth="9" />
      <circle
        cx="40"
        cy="40"
        r={r}
        fill="none"
        className="stroke-amber transition-[stroke-dashoffset] duration-[400ms] ease-[var(--ease-out)]"
        strokeWidth="9"
        strokeLinecap="round"
        strokeDasharray={c}
        strokeDashoffset={c * (1 - pct / 100)}
      />
      <text
        x="40"
        y="40"
        transform="rotate(90 40 40)"
        textAnchor="middle"
        dominantBaseline="central"
        className="fill-white tabular-nums"
        fontSize="18"
        fontWeight="800"
      >
        {pct}%
      </text>
    </svg>
  );
}
