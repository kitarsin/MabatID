import { CARDS, type CardKind, type Category, type Tier } from "@/data/cards";
import { fitsBudget, type Budget } from "./prefs";
import { applicationMode } from "./prepare";
import type { ReadinessContext } from "./tree";

export interface Filters {
  tiers: Tier[];
  category: Category | null;
  budget: Budget | null;
  kind: CardKind | null;
}
export const NO_FILTERS: Filters = {
  tiers: [],
  category: null,
  budget: null,
  kind: null,
};
export type FilterContext = Pick<ReadinessContext, "facts" | "modes" | "setup">;

export const activeFilterCount = (filters: Filters) =>
  Number(filters.tiers.length > 0) +
  Number(filters.category !== null) +
  Number(filters.budget !== null) +
  Number(filters.kind !== null);

/** Use the same fee conditions and selected route as details and recommendations. */
export function matchSet(
  filters: Filters,
  context: FilterContext = {},
): Set<string> | null {
  if (!activeFilterCount(filters)) return null;
  return new Set(
    CARDS.filter(
      (card) =>
        (!filters.kind || card.kind === filters.kind) &&
        (!filters.tiers.length || filters.tiers.includes(card.tier)) &&
        (!filters.category || card.category === filters.category) &&
        (!filters.budget ||
          fitsBudget(
            card.id,
            filters.budget,
            applicationMode(card.id, {
              setup: context.setup,
              mode: context.modes?.[card.id],
            }),
            context.facts,
          )),
    ).map((card) => card.id),
  );
}
