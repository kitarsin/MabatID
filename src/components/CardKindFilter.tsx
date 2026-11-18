"use client";

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
      <legend className="text-xs font-bold uppercase tracking-wider text-civic">
        Item type
      </legend>
      <div className="flex flex-wrap gap-2">
        {options.map((option) => (
          <button
            key={option.value ?? "all"}
            type="button"
            aria-pressed={value === option.value}
            onClick={() => onChange(option.value)}
            className={`rounded-full border-2 px-3 py-1.5 text-sm font-bold ${value === option.value ? "border-civic bg-civic text-white" : "border-border bg-white text-navy hover:bg-muted"}`}
          >
            {option.label}
          </button>
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
