"use client";

import type { ComponentProps } from "react";
import { FilterBar } from "./FilterBar";

/**
 * In-flow bar above the skill-tree canvas: legend on the left, Groups + Filter on the right.
 * Every prop goes straight to FilterBar. The legend stays on one row at 375px (even with the filter badge);
 * at 320px it may wrap, but it never overlaps the buttons.
 */
export function TreeToolbar(props: ComponentProps<typeof FilterBar>) {
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
      <FilterBar {...props} />
    </div>
  );
}
