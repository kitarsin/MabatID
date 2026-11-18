import { Button as ButtonPrimitive } from "@base-ui/react/button"
import { cva, type VariantProps } from "class-variance-authority"
import { cn } from "cn"

// Focus ring comes from the single global :focus-visible rule (globals.css), so no per-control ring here.
// Transitions are explicit (never `all`) and use the shared motion tokens.
const buttonVariants = cva(
  "group/button inline-flex shrink-0 items-center justify-center rounded-lg border border-transparent bg-clip-padding text-sm font-medium whitespace-nowrap transition-[background-color,color,border-color,scale] duration-[var(--dur-fast)] ease-[var(--ease-out)] select-none active:not-aria-[haspopup]:scale-[0.97] active:not-aria-[haspopup]:duration-[var(--dur-press)] disabled:pointer-events-none disabled:opacity-50 aria-invalid:border-destructive aria-invalid:ring-3 aria-invalid:ring-destructive/20 dark:aria-invalid:border-destructive/50 dark:aria-invalid:ring-destructive/40 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
  {
    variants: {
      variant: {
        default: "bg-primary text-primary-foreground hover:bg-primary/85",
        outline:
          "border-navy/10 bg-white text-navy shadow-[0_1px_2px_rgb(27_54_93/0.06),0_4px_12px_-6px_rgb(27_54_93/0.12)] hover:border-navy/20 hover:bg-white aria-expanded:border-civic/40 aria-expanded:bg-mist/40",
        secondary:
          "bg-secondary text-secondary-foreground hover:bg-[color-mix(in_oklch,var(--secondary),var(--foreground)_5%)] aria-expanded:bg-secondary aria-expanded:text-secondary-foreground",
        ghost:
          "hover:bg-muted hover:text-foreground aria-expanded:bg-muted aria-expanded:text-foreground dark:hover:bg-muted/50",
        destructive:
          "bg-destructive/10 text-destructive hover:bg-destructive/20 dark:bg-destructive/20 dark:hover:bg-destructive/30",
        link: "text-primary underline-offset-4 hover:underline",
        /** Primary call to action: amber fill, navy text (6.1:1). */
        cta: "bg-amber text-navy shadow-[inset_0_1px_0_rgb(255_255_255/0.45),0_8px_20px_-10px_color-mix(in_srgb,var(--color-amber)_90%,transparent)] hover:bg-[color-mix(in_oklch,var(--color-amber),var(--color-navy)_10%)]",
        /** Civic-blue fill, white text (7.1:1). */
        brand: "bg-civic text-white shadow-[inset_0_1px_0_rgb(255_255_255/0.18),0_8px_20px_-10px_color-mix(in_srgb,var(--color-civic)_90%,transparent)] hover:bg-navy aria-expanded:bg-navy",
        /** Outlined secondary on navy surfaces. */
        onDark: "border-2 border-mist bg-transparent text-white hover:bg-white/10",
      },
      size: {
        default:
          "h-8 gap-1.5 px-2.5 has-data-[icon=inline-end]:pr-2 has-data-[icon=inline-start]:pl-2",
        xs: "h-6 gap-1 rounded-[min(var(--radius-md),10px)] px-2 text-xs in-data-[slot=button-group]:rounded-lg has-data-[icon=inline-end]:pr-1.5 has-data-[icon=inline-start]:pl-1.5 [&_svg:not([class*='size-'])]:size-3",
        sm: "h-7 gap-1 rounded-[min(var(--radius-md),12px)] px-2.5 text-[0.8rem] in-data-[slot=button-group]:rounded-lg has-data-[icon=inline-end]:pr-1.5 has-data-[icon=inline-start]:pl-1.5 [&_svg:not([class*='size-'])]:size-3.5",
        /** 44px-high control. */
        md: "h-11 gap-2 rounded-full px-4 text-sm font-semibold",
        lg: "h-12 gap-2 rounded-full px-5 text-base font-semibold",
        xl: "h-14 gap-2 rounded-full px-6 text-base font-semibold",
        icon: "size-8",
        "icon-xs":
          "size-6 rounded-[min(var(--radius-md),10px)] in-data-[slot=button-group]:rounded-lg [&_svg:not([class*='size-'])]:size-3",
        "icon-sm":
          "size-7 rounded-[min(var(--radius-md),12px)] in-data-[slot=button-group]:rounded-lg",
        "icon-lg": "size-9",
        /** 44px square icon button (touch target). */
        "icon-xl": "size-11 rounded-full",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
)

function Button({
  className,
  variant = "default",
  size = "default",
  ...props
}: ButtonPrimitive.Props & VariantProps<typeof buttonVariants>) {
  return (
    <ButtonPrimitive
      data-slot="button"
      className={cn(buttonVariants({ variant, size, className }))}
      {...props}
    />
  )
}

export { Button, buttonVariants }
