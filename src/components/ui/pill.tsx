import * as React from "react"
import { cn } from "cn"

type PillTone = "mist" | "navy" | "civic" | "amber" | "muted" | "onDark"

const TONES: Record<PillTone, string> = {
  mist: "bg-mist text-navy",
  navy: "bg-navy text-white",
  civic: "bg-civic text-white",
  amber: "bg-amber text-navy",
  muted: "bg-muted text-muted-foreground",
  /** Quiet pill for navy surfaces. */
  onDark: "bg-white/10 text-white ring-1 ring-white/25",
}

/** Static label (status, tag, relation). 12px floor, sentence case. Not interactive: use Chip for that. */
function Pill({
  tone = "mist",
  className,
  ...props
}: React.ComponentProps<"span"> & { tone?: PillTone }) {
  return (
    <span
      data-slot="pill"
      className={cn(
        "inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs leading-none font-semibold whitespace-nowrap [&_svg]:shrink-0",
        TONES[tone],
        className
      )}
      {...props}
    />
  )
}

export { Pill }
export type { PillTone }
