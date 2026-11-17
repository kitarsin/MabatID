"use client";

import { FilterBar, type Filters } from "./FilterBar";

/**
 * In-flow bar above the skill-tree canvas: legend on the left, Filter on the right.
 * Replaces the floating Legend + Filter that used to sit on top of the nodes.
 */
export function TreeToolbar({ filters, onChange }: { filters: Filters; onChange: (f: Filters) => void }) {
  return (
    <div className="relative z-20 flex min-h-12 shrink-0 items-center justify-between gap-2 border-b border-border bg-background px-2.5 py-0.5">
      <ul aria-label="Legend" className="flex min-w-0 flex-wrap items-center gap-x-1.5 gap-y-1 py-1 text-xs font-semibold text-navy">
        <li className="flex shrink-0 items-center gap-1 whitespace-nowrap">
          <span aria-hidden="true" className="size-3 shrink-0 rounded-full bg-amber" /> Obtained
        </li>
        <li className="flex shrink-0 items-center gap-1 whitespace-nowrap">
          <span aria-hidden="true" className="size-3 shrink-0 rounded-full border-2 border-civic bg-white" /> Ready to get
        </li>
        <li className="flex shrink-0 items-center gap-1 whitespace-nowrap">
          <span aria-hidden="true" className="size-3 shrink-0 rounded-full border-2 border-dashed border-locked-line bg-white" /> Locked
        </li>
      </ul>
      <FilterBar filters={filters} onChange={onChange} />
    </div>
  );
}
