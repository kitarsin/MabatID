import * as React from "react";
import { Check, ClipboardList, HelpCircle, Lock } from "lucide-react";
import type { TreeNodeStatus } from "@/lib/planner/recommendations";
import { CardIcon } from "./icons";

/**
 * The status language of an ID node, shared by the skill tree and the landing hero. Shape AND colour carry
 * the status, never colour alone: filled amber = have, civic outline = requirements ready, amber outline +
 * question mark = needs confirmation, dashed = still needs preparation / review. `locked` is only used by the
 * landing illustration.
 */
export type NodeVisualStatus = TreeNodeStatus | "locked";

const TONE: Record<"owned" | "available" | "confirmation" | "other", string> = {
  owned: "border-amber bg-amber text-navy shadow-[0_2px_10px_color-mix(in_srgb,var(--color-amber)_45%,transparent)]",
  available: "border-civic bg-white text-civic shadow-[0_2px_8px_color-mix(in_srgb,var(--color-civic)_25%,transparent)]",
  confirmation: "border-amber bg-white text-navy",
  other: "border-dashed border-locked-line bg-white text-locked",
};

function toneOf(status: NodeVisualStatus): keyof typeof TONE {
  return status === "owned" || status === "available" || status === "confirmation" ? status : "other";
}

export function NodeCircle({
  status,
  icon,
  className = "",
  children,
  ...rest
}: {
  status: NodeVisualStatus;
  icon: string;
} & React.ComponentProps<"span">) {
  const badge =
    "absolute -right-1 -top-1 grid size-6 place-items-center rounded-full text-white shadow";
  return (
    <span
      className={`node-circle relative grid size-[72px] place-items-center rounded-full border-[3px] ${TONE[toneOf(status)]} ${className}`}
      {...rest}
    >
      {children}
      <CardIcon name={icon} className="size-8" />
      {status === "owned" ? (
        <span className={`${badge} bg-navy`}>
          <Check className="size-4" strokeWidth={3} aria-hidden="true" />
        </span>
      ) : status === "confirmation" ? (
        <span className={`${badge} bg-civic`}>
          <HelpCircle className="size-4" aria-hidden="true" />
        </span>
      ) : status === "locked" ? (
        <span className={`${badge} bg-locked`}>
          <Lock className="size-3.5" aria-hidden="true" />
        </span>
      ) : (
        <span className={`${badge} ${status === "available" ? "bg-civic" : "bg-locked"}`}>
          <ClipboardList className="size-3.5" aria-hidden="true" />
        </span>
      )}
    </span>
  );
}
