"use client";

import { useState } from "react";
import { Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { CARDS, TIER_META, type Tier } from "@/data/cards";
import { BUDGETS, DEFAULT_BUDGET, DEFAULT_SETUP, SETUPS, type Budget, type Setup } from "@/lib/prefs";
import type { User } from "@/lib/store";
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
  onSave: (p: { owned: string[]; budget: Budget; setup: Setup }) => void;
  onCancel: () => void;
}) {
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
    <main id="main" tabIndex={-1} className="mx-auto flex min-h-dvh w-full max-w-md flex-col outline-none">
      <div className="flex-1 space-y-8 px-5 pb-32 pt-6">
        <div>
          <Logo dark />
          <h1 className="mt-5 text-2xl font-bold leading-tight tracking-tight">
            {editing ? "Update your checklist" : `Kumusta, ${me.name.split(" ")[0]}!`}
          </h1>
          <p className="mt-1 text-muted-foreground">
            {editing ? "Change what you have or how you like to apply." : "Tell us where you’re starting from. You can change this anytime."}
          </p>
        </div>

        <section aria-labelledby="have">
          <h2 id="have" className="text-lg font-bold">What do you already have?</h2>
          <p className="mb-3 text-sm text-muted-foreground">Tick everything you currently hold.</p>
          <div className="space-y-5">
            {TIERS.map((t) => (
              <fieldset key={t}>
                <legend className="mb-2 text-[13px] font-semibold text-civic">{TIER_META[t].label}</legend>
                <ul className="space-y-2">
                  {CARDS.filter((c) => c.tier === t).map((c) => (
                    <li key={c.id}>
                      <Row
                        type="checkbox"
                        checked={owned.has(c.id)}
                        onChange={() => toggle(c.id)}
                        icon={<CardIcon name={c.icon} className="size-5" />}
                        label={c.name}
                      />
                    </li>
                  ))}
                </ul>
              </fieldset>
            ))}
          </div>
        </section>

        <section aria-labelledby="budget">
          <h2 id="budget" className="text-lg font-bold">What’s your budget per ID?</h2>
          <p className="mb-3 text-sm text-muted-foreground">We’ll flag IDs that fit.</p>
          <div className="space-y-2" role="radiogroup" aria-labelledby="budget">
            {BUDGETS.map((b) => (
              <Row key={b.id} type="radio" name="budget" checked={budget === b.id} onChange={() => setBudget(b.id)} label={b.label} hint={b.hint} />
            ))}
          </div>
        </section>

        <section aria-labelledby="setup">
          <h2 id="setup" className="text-lg font-bold">How do you prefer to apply?</h2>
          <p className="mb-3 text-sm text-muted-foreground">Some IDs can only be done in person.</p>
          <div className="space-y-2" role="radiogroup" aria-labelledby="setup">
            {SETUPS.map((s) => (
              <Row key={s.id} type="radio" name="setup" checked={setup === s.id} onChange={() => setSetup(s.id)} label={s.label} hint={s.hint} />
            ))}
          </div>
        </section>
      </div>

      <div className="fixed inset-x-0 bottom-0 z-10 border-t border-border bg-background p-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
        <div className="mx-auto flex max-w-md gap-3">
          {editing && (
            <Button variant="outline" size="xl" onClick={onCancel}>
              Cancel
            </Button>
          )}
          <Button variant="cta" size="xl" onClick={() => onSave({ owned: [...owned], budget, setup })} className="flex-1">
            {editing ? "Save changes" : `Show my path · ${owned.size} selected`}
          </Button>
        </div>
      </div>
    </main>
  );
}

/**
 * A big tappable row backed by a real, visually hidden <input>: native keyboard behaviour
 * (Space toggles; arrow keys move within a radio group) and native screen reader semantics.
 */
function Row({
  type,
  name,
  checked,
  onChange,
  label,
  hint,
  icon,
}: {
  type: "checkbox" | "radio";
  name?: string;
  checked: boolean;
  onChange: () => void;
  label: string;
  hint?: string;
  icon?: React.ReactNode;
}) {
  return (
    <label
      className={`focus-ring-within flex min-h-14 w-full cursor-pointer items-center gap-3 rounded-2xl border-2 px-4 py-3 text-left transition-[background-color,border-color,scale] duration-[var(--dur-fast)] ease-[var(--ease-out)] active:scale-[0.985] active:duration-[var(--dur-press)] ${
        checked ? "border-civic bg-mist" : "border-border bg-card hover:bg-muted"
      }`}
    >
      <input type={type} name={name} checked={checked} onChange={onChange} className="sr-only" />
      <span
        aria-hidden="true"
        className={`grid size-6 shrink-0 place-items-center border-2 ${type === "radio" ? "rounded-full" : "rounded-md"} ${
          checked ? "border-civic bg-civic text-white" : "border-input bg-card"
        }`}
      >
        {checked && (type === "radio" ? <span className="size-2.5 rounded-full bg-white" /> : <Check className="size-4" strokeWidth={3} />)}
      </span>
      {icon && <span className="text-civic">{icon}</span>}
      <span className="min-w-0">
        <span className="block text-[15px] font-semibold leading-snug">{label}</span>
        {hint && <span className="block text-sm text-muted-foreground">{hint}</span>}
      </span>
    </label>
  );
}
