import * as React from "react";
import { Check, Lock } from "lucide-react";
import type { NodeStatus } from "@/lib/tree";
import { CardIcon } from "./icons";

/**
 * The status language of an ID node, shared by the skill tree and the landing hero:
 * filled amber = have, outlined civic = ready, dashed = locked (shape AND colour, never colour alone).
 */
const TONE: Record<NodeStatus, string> = {
  owned: "border-amber bg-amber text-navy shadow-[0_2px_10px_color-mix(in_srgb,var(--color-amber)_45%,transparent)]",
  available: "border-civic bg-white text-civic shadow-[0_2px_8px_color-mix(in_srgb,var(--color-civic)_25%,transparent)]",
  locked: "border-dashed border-locked-line bg-white text-locked",
};

export function NodeCircle({
  status,
  icon,
  className = "",
  children,
  ...rest
}: {
  status: NodeStatus;
  icon: string;
} & React.ComponentProps<"span">) {
  return (
    <span
      className={`node-circle relative grid size-[72px] place-items-center rounded-full border-[3px] ${TONE[status]} ${className}`}
      {...rest}
    >
      {children}
      <CardIcon name={icon} className="size-8" />
      {status === "owned" && (
        <span className="absolute -right-1 -top-1 grid size-6 place-items-center rounded-full bg-navy text-white shadow">
          <Check className="size-4" strokeWidth={3} aria-hidden="true" />
        </span>
      )}
      {status === "locked" && (
        <span className="absolute -right-1 -top-1 grid size-6 place-items-center rounded-full bg-locked text-white">
          <Lock className="size-3.5" aria-hidden="true" />
        </span>
      )}
    </span>
  );
}
