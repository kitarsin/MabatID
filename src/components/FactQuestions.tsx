"use client";

import { FACTS, type FactId, type ProfileFacts } from "@/data/facts";

export function FactQuestions({
  ids,
  facts,
  onChange,
}: {
  ids: FactId[];
  facts: ProfileFacts;
  onChange: (id: FactId, value: boolean | undefined) => void;
}) {
  return (
    <div className="space-y-3">
      {[...new Set(ids)].map((id) => (
        <fieldset key={id} className="rounded-xl border border-border p-3">
          <legend className="px-1 text-sm font-semibold">{FACTS[id]}</legend>
          <div className="flex flex-wrap gap-2">
            {[
              { label: "Yes", value: true },
              { label: "No", value: false },
              { label: "Not sure", value: undefined },
            ].map((option) => (
              <button
                key={option.label}
                type="button"
                aria-pressed={facts[id] === option.value}
                onClick={() => onChange(id, option.value)}
                className={`rounded-lg border-2 px-3 py-2 text-sm font-bold ${facts[id] === option.value ? "border-civic bg-mist text-navy" : "border-border bg-card"}`}
              >
                {option.label}
              </button>
            ))}
          </div>
        </fieldset>
      ))}
    </div>
  );
}
