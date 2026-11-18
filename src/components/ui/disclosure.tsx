import * as React from "react"
import { ChevronDown } from "lucide-react"
import { cn } from "cn"

/**
 * "Show the short version, open for the rest." A native <details>, so it works without JS, is keyboard
 * accessible and is found by in-page search.
 * - `card`: a soft panel whose whole header row toggles (for long sections).
 * - `inline`: a small "More details" link under a summary sentence.
 */
function Disclosure({
  summary,
  hint,
  variant = "card",
  defaultOpen,
  className,
  children,
}: {
  summary: React.ReactNode
  /** Short text under the summary (card variant), e.g. "3 notes". */
  hint?: React.ReactNode
  variant?: "card" | "inline"
  defaultOpen?: boolean
  className?: string
  children: React.ReactNode
}) {
  if (variant === "inline")
    return (
      <details data-slot="disclosure" className={cn("group/disc", className)} open={defaultOpen}>
        <summary className="inline-flex min-h-10 cursor-pointer list-none items-center gap-1 rounded-full text-sm font-semibold text-civic select-none [&::-webkit-details-marker]:hidden">
          <span className="group-open/disc:hidden">{summary}</span>
          <span className="hidden group-open/disc:inline">Show less</span>
          <ChevronDown
            className="size-4 transition-transform duration-[var(--dur-base)] ease-[var(--ease-out)] group-open/disc:rotate-180"
            aria-hidden="true"
          />
        </summary>
        <div className="disclosure-body pt-1 pb-1">{children}</div>
      </details>
    )
  return (
    <details
      data-slot="disclosure"
      className={cn("group/disc rounded-[20px] bg-navy/[0.035] ring-1 ring-navy/[0.06]", className)}
      open={defaultOpen}
    >
      <summary className="flex min-h-14 cursor-pointer list-none items-center gap-3 rounded-[20px] px-4 py-3 select-none transition-colors duration-[var(--dur-fast)] hover:bg-navy/[0.03] [&::-webkit-details-marker]:hidden">
        <span className="min-w-0 flex-1">
          <span className="block text-[15px] font-semibold text-navy">{summary}</span>
          {hint && <span className="mt-0.5 block text-xs text-muted-foreground">{hint}</span>}
        </span>
        <span
          aria-hidden="true"
          className="grid size-8 shrink-0 place-items-center rounded-full bg-white text-navy shadow-[0_1px_2px_rgb(27_54_93/0.08)] ring-1 ring-navy/10 transition-transform duration-[var(--dur-base)] ease-[var(--ease-out)] group-open/disc:rotate-180"
        >
          <ChevronDown className="size-4" />
        </span>
      </summary>
      <div className="disclosure-body px-4 pt-1 pb-4">{children}</div>
    </details>
  )
}

export { Disclosure }
