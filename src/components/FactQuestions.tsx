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
        <fieldset key={id} className="rounded-[20px] bg-white p-4 ring-1 ring-navy/[0.08]">
          <legend className="float-left mb-3 w-full text-sm leading-relaxed font-medium text-navy">
            {FACTS[id]}
          </legend>
          <div className="clear-both flex flex-wrap gap-2">
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
