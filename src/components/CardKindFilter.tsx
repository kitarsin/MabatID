"use client";

import { Chip } from "@/components/ui/chip";
import { CARD_KIND_META, type CardKind } from "@/data/cards";

/** Shared options keep the tree and browse controls consistent. */
export function CardKindFilter({
  value,
  onChange,
}: {
  value: CardKind | null;
  onChange: (value: CardKind | null) => void;
}) {
  const options = [
    { value: null, label: "All types" },
    ...Object.entries(CARD_KIND_META).map(([value, meta]) => ({
      value: value as CardKind,
      label: meta.label,
    })),
  ];
  return (
    <fieldset className="space-y-2">
      <legend className="text-[13px] font-semibold text-civic">
        Item type
      </legend>
      <div className="flex flex-wrap gap-2">
        {options.map((option) => (
          <Chip
            key={option.value ?? "all"}
            pressed={value === option.value}
            onClick={() => onChange(option.value)}
          >
            {option.label}
          </Chip>
        ))}
      </div>
      {value && (
        <p className="text-xs text-muted-foreground">
          {CARD_KIND_META[value].blurb}
        </p>
      )}
    </fieldset>
  );
}
