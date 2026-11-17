"use client";

import { useState } from "react";
import { Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { EXTRA_DOCUMENTS } from "@/data/documents";
import { Input } from "./ui/input";
import { CARDS, TIER_META, type Tier } from "@/data/cards";
import {
  BUDGETS,
  DEFAULT_BUDGET,
  DEFAULT_SETUP,
  SETUPS,
  type Budget,
  type Setup,
} from "@/lib/prefs";
import type { User } from "@/lib/store";
import type { DocumentEvidenceMap } from "@/lib/documents";
import { BarangayIdFields } from "./BarangayIdFields";
import { CardIcon } from "./icons";
import { Logo } from "./Logo";

const TIERS: Tier[] = [0, 1, 2, 3];

export function Onboarding({
  me,
  editing,
  onSave,
  onCancel,
}: {
  me: User;
  editing: boolean;
  onSave: (p: {
    owned: string[];
    documents: DocumentEvidenceMap;
    budget: Budget;
    setup: Setup;
    age: number;
  }) => void;
  onCancel: () => void;
}) {
  const [age, setAge] = useState(me.age);
  const validAge = Number.isInteger(age) && age >= 0 && age <= 120;
  const [documents, setDocuments] = useState<DocumentEvidenceMap>(
    me.documents ?? {},
  );
  const [owned, setOwned] = useState<Set<string>>(new Set(me.owned));
  const [budget, setBudget] = useState<Budget>(me.budget ?? DEFAULT_BUDGET);
  const [setup, setSetup] = useState<Setup>(me.setup ?? DEFAULT_SETUP);

  const toggle = (id: string) =>
    setOwned((prev) => {
      const next = new Set(prev);
      if (!next.delete(id)) next.add(id);
      return next;
    });

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-md flex-col">
      <div className="flex-1 space-y-8 px-5 pb-32 pt-6">
        <div>
          <Logo dark />
          <h1 className="mt-5 text-2xl font-extrabold tracking-tight">
            {editing
              ? "Update your checklist"
              : `Kumusta, ${me.name.split(" ")[0]}!`}
          </h1>
          <p className="mt-1 text-muted-foreground">
            {editing
              ? "Change what you have or how you like to apply."
              : "Tell us where you’re starting from. You can change this anytime."}
          </p>
        </div>

        <div className="space-y-2">
          <label htmlFor="profile-age" className="font-bold">
            Applicant age
          </label>
          <Input
            id="profile-age"
            type="number"
            min={0}
            max={120}
            value={Number.isNaN(age) ? "" : age}
            onChange={(event) =>
              setAge(
                event.target.value === "" ? NaN : Number(event.target.value),
              )
            }
          />
          <p className="text-xs text-muted-foreground">
            Keep this up to date so age checks remain accurate.
          </p>
        </div>
        <section aria-labelledby="have">
          <h2 id="have" className="text-lg font-extrabold">
            1 · What do you already have?
          </h2>
          <p className="mb-3 text-sm text-muted-foreground">
            Select current documents belonging to the applicant. Child’s
            documents are listed separately. Check any validity or format
            conditions with the issuing office.
          </p>
          <div className="space-y-5">
            {TIERS.map((t) => (
              <fieldset key={t}>
                <legend className="mb-2 text-xs font-bold uppercase tracking-wider text-civic">
                  {TIER_META[t].label}
                </legend>
                <ul className="space-y-2">
                  {CARDS.filter((c) => c.tier === t).map((c) => (
                    <li key={c.id}>
                      <Row
                        role="checkbox"
                        checked={owned.has(c.id)}
                        onClick={() => toggle(c.id)}
                        icon={<CardIcon name={c.icon} className="size-5" />}
                        label={c.name}
                      />
                      {c.id === "barangay-id" && owned.has(c.id) && (
                        <div className="mt-2">
                          <BarangayIdFields
                            prefix="onboarding-barangay"
                            value={documents[c.id] ?? {}}
                            onChange={(value) =>
                              setDocuments((d) => ({ ...d, [c.id]: value }))
                            }
                          />
                        </div>
                      )}
                    </li>
                  ))}
                </ul>
              </fieldset>
            ))}
            <fieldset>
              <legend className="mb-2 text-xs font-bold uppercase text-civic">
                Other documents
              </legend>
              <ul className="space-y-2">
                {EXTRA_DOCUMENTS.map((d) => (
                  <li key={d.id}>
                    <Row
                      role="checkbox"
                      checked={owned.has(d.id)}
                      onClick={() => toggle(d.id)}
                      label={d.name}
                    />
                  </li>
                ))}
              </ul>
            </fieldset>
          </div>
        </section>

        <section aria-labelledby="budget">
          <h2 id="budget" className="text-lg font-extrabold">
            2 · What’s your budget per ID?
          </h2>
          <p className="mb-3 text-sm text-muted-foreground">
            We’ll compare standard fees. Waivers and additional costs need
            confirmation.
          </p>
          <ul className="space-y-2" role="radiogroup" aria-labelledby="budget">
            {BUDGETS.map((b) => (
              <li key={b.id}>
                <Row
                  role="radio"
                  checked={budget === b.id}
                  onClick={() => setBudget(b.id)}
                  label={b.label}
                  hint={b.hint}
                />
              </li>
            ))}
          </ul>
        </section>

        <section aria-labelledby="setup">
          <h2 id="setup" className="text-lg font-extrabold">
            3 · How do you prefer to apply?
          </h2>
          <p className="mb-3 text-sm text-muted-foreground">
            Some IDs can only be done in person.
          </p>
          <ul className="space-y-2" role="radiogroup" aria-labelledby="setup">
            {SETUPS.map((s) => (
              <li key={s.id}>
                <Row
                  role="radio"
                  checked={setup === s.id}
                  onClick={() => setSetup(s.id)}
                  label={s.label}
                  hint={s.hint}
                />
              </li>
            ))}
          </ul>
        </section>
      </div>

      <div className="fixed inset-x-0 bottom-0 z-10 border-t border-border bg-background/95 p-4 pb-[max(1rem,env(safe-area-inset-bottom))] backdrop-blur">
        <div className="mx-auto flex max-w-md gap-3">
          {editing && (
            <Button
              variant="outline"
              onClick={onCancel}
              className="h-14 rounded-2xl px-5 text-base font-bold"
            >
              Cancel
            </Button>
          )}
          <Button
            disabled={!validAge}
            onClick={() =>
              onSave({ owned: [...owned], documents, budget, setup, age })
            }
            className="h-14 flex-1 rounded-2xl bg-amber text-base font-bold text-navy hover:bg-amber/85"
          >
            {editing ? "Save changes" : `Show my path · ${owned.size} selected`}
          </Button>
        </div>
      </div>
    </main>
  );
}

function Row({
  role,
  checked,
  onClick,
  label,
  hint,
  icon,
}: {
  role: "checkbox" | "radio";
  checked: boolean;
  onClick: () => void;
  label: string;
  hint?: string;
  icon?: React.ReactNode;
}) {
  return (
    <button
      type="button"
      role={role}
      aria-checked={checked}
      onClick={onClick}
      className={`flex min-h-14 w-full items-center gap-3 rounded-2xl border-2 px-4 py-3 text-left transition-colors ${
        checked
          ? "border-civic bg-mist"
          : "border-border bg-card hover:bg-muted"
      }`}
    >
      <span
        aria-hidden="true"
        className={`grid size-6 shrink-0 place-items-center border-2 ${role === "radio" ? "rounded-full" : "rounded-md"} ${
          checked ? "border-civic bg-civic text-white" : "border-input bg-card"
        }`}
      >
        {checked &&
          (role === "radio" ? (
            <span className="size-2.5 rounded-full bg-white" />
          ) : (
            <Check className="size-4" strokeWidth={3} />
          ))}
      </span>
      {icon && <span className="text-civic">{icon}</span>}
      <span className="min-w-0">
        <span className="block text-[15px] font-bold leading-snug">
          {label}
        </span>
        {hint && (
          <span className="block text-sm text-muted-foreground">{hint}</span>
        )}
      </span>
    </button>
  );
}
