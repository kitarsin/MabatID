import * as React from "react"
import { cn } from "cn"

type ChipTone = "outline" | "mist" | "have"

const TONES: Record<ChipTone, string> = {
  outline: "border-border bg-white text-navy hover:bg-mist",
  mist: "border-transparent bg-mist text-navy hover:bg-sky",
  /** Something the user already has. */
  have: "border-amber bg-amber text-navy",
}

/**
 * Pill-shaped button, 44px high.
 * Pass `pressed` to make it a toggle (sets aria-pressed and the filled "on" look);
 * leave it undefined for a plain action chip (e.g. jump to another ID).
 */
function Chip({
  pressed,
  tone = "outline",
  className,
  type = "button",
  ...props
}: Omit<React.ComponentProps<"button">, "aria-pressed"> & { pressed?: boolean; tone?: ChipTone }) {
  return (
    <button
      type={type}
      data-slot="chip"
      aria-pressed={pressed}
      className={cn(
        "inline-flex min-h-11 shrink-0 items-center justify-center gap-1 rounded-full border-2 px-3.5 text-sm font-semibold transition-[background-color,color,border-color,scale] duration-[var(--dur-fast)] ease-[var(--ease-out)] select-none active:scale-[0.97] active:duration-[var(--dur-press)] [&_svg]:shrink-0",
        pressed ? "border-civic bg-civic text-white hover:bg-civic" : TONES[tone],
        className
      )}
      {...props}
    />
  )
}

export { Chip }
export type { ChipTone }
