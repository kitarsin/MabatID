import * as React from "react"
import { cn } from "cn"

type ChipTone = "outline" | "mist" | "have"

const TONES: Record<ChipTone, string> = {
  outline: "border-navy/10 bg-white text-navy shadow-[0_1px_2px_rgb(27_54_93/0.06)] hover:border-navy/25",
  mist: "border-transparent bg-mist/70 text-navy hover:bg-mist",
  /** Something the user already has. */
  have: "border-amber bg-amber/90 text-navy",
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
        "inline-flex min-h-11 shrink-0 items-center justify-center gap-1.5 rounded-full border px-4 text-sm font-medium transition-[background-color,color,border-color,scale] duration-[var(--dur-fast)] ease-[var(--ease-out)] select-none active:scale-[0.97] active:duration-[var(--dur-press)] [&_svg]:shrink-0",
        pressed ? "border-navy bg-navy text-white shadow-[0_6px_14px_-8px_rgb(27_54_93/0.7)] hover:bg-navy" : TONES[tone],
        className
      )}
      {...props}
    />
  )
}

export { Chip }
export type { ChipTone }
