"use client";

import { Chip } from "@/components/ui/chip";
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
              <Chip
                key={option.label}
                pressed={facts[id] === option.value}
                onClick={() => onChange(id, option.value)}
              >
                {option.label}
              </Chip>
            ))}
          </div>
        </fieldset>
      ))}
    </div>
  );
}
