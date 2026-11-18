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
    <div className="relative z-20 flex min-h-14 shrink-0 items-center justify-between gap-2 px-3 py-1.5">
      <ul aria-label="Legend" className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1 rounded-full bg-white/80 px-2.5 py-2 sm:gap-x-3 sm:px-3.5 text-xs font-medium text-navy shadow-[0_1px_2px_rgb(27_54_93/0.06)] ring-1 ring-navy/8 backdrop-blur">
        <li className="flex shrink-0 items-center gap-1 whitespace-nowrap">
          <span aria-hidden="true" className="size-3 shrink-0 rounded-full bg-amber" /> Have
        </li>
        <li className="flex shrink-0 items-center gap-1 whitespace-nowrap">
          <span aria-hidden="true" className="size-3 shrink-0 rounded-full border-2 border-civic bg-white" /> Ready
        </li>
        <li className="flex shrink-0 items-center gap-1 whitespace-nowrap">
          <span aria-hidden="true" className="size-3 shrink-0 rounded-full border-2 border-dashed border-locked-line bg-white" /> Preparing
        </li>
      </ul>
      <FilterBar {...props} />
    </div>
  );
}
