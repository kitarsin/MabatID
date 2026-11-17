"use client";

import type { CSSProperties } from "react";
import { ArrowRight, LogIn } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Pill } from "@/components/ui/pill";
import { CARD_BY_ID, type IdCard } from "@/data/cards";
import { TREE_STATUS_LABELS } from "@/lib/tree-status";
import { Logo } from "./Logo";
import { NodeCircle, type NodeVisualStatus } from "./NodeCircle";

/** Entrance timing: --d is the delay in ms (see .rise / .draw-edge in globals.css). */
const d = (ms: number) => ({ "--d": `${ms}ms` }) as CSSProperties;

export function Landing({
  onAuth,
  onPreview,
}: {
  onAuth: () => void;
  onPreview: () => void;
}) {
  return (
    <main
      id="main"
      tabIndex={-1}
      className="surface-navy flex min-h-dvh flex-col bg-navy text-white outline-none"
    >
      <div className="mx-auto flex w-full max-w-md flex-1 flex-col px-6 pb-8 pt-6 short:pb-5 short:pt-4 hero:max-w-5xl hero:px-10 hero:pb-12 hero:pt-8">
        <Logo />

        <div className="flex flex-1 flex-col justify-end gap-8 pt-8 short:gap-5 short:pt-4 hero:grid hero:grid-cols-[minmax(0,1fr)_auto] hero:items-center hero:justify-center hero:gap-20 hero:pt-0">
          <HeroPath />

          <div className="hero:order-1 hero:max-w-md">
            <h1
              style={d(160)}
              className="rise text-balance text-[length:clamp(1.9rem,8vw,2.1rem)] font-extrabold leading-[1.1] tracking-tight short:text-[length:1.7rem] hero:text-[2.6rem]"
            >
              From baseline documents to your first valid ID.
            </h1>
            <p
              style={d(220)}
              className="rise mt-4 text-pretty text-base leading-relaxed text-mist short:mt-3 short:text-sm short:leading-snug"
            >
              One step unlocks the next. Explore what to get, estimated fees and
              what to bring — for students, young adults and first-time
              jobseekers.
            </p>

            <div
              style={d(280)}
              className="rise mt-8 flex flex-col gap-3 short:mt-5 short:gap-2"
            >
              <Button onClick={onPreview} variant="cta" size="xl">
                Preview your ID path{" "}
                <ArrowRight className="size-5" aria-hidden="true" />
              </Button>
              <p className="-mt-1 mb-1 text-center text-xs text-mist">
                Free · No profile needed to preview
              </p>
              <Button onClick={onAuth} variant="onDark" size="xl">
                <LogIn className="size-5" aria-hidden="true" /> Open device
                profile
              </Button>
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}

/**
 * A real slice of the product instead of a generic motif: three actual items drawn with the same node
 * language as the tree. The chain is read from the overview `parent` links in the card data (the last
 * item's parent, and its parent's parent), so it is true by construction: PSA Birth Certificate →
 * Barangay Clearance → Postal ID. Statuses are illustrative (you hold the first item, the second is
 * ready, the third still needs preparation), not computed from a profile.
 * Decorative (aria-hidden): the headline and buttons carry the message.
 * Below 900px it is a compact row; from 900px it is a stepper that climbs bottom-to-top like the tree.
 */
const HERO_END = "postal";

function heroChain(): IdCard[] {
  const chain: IdCard[] = [];
  let id: string | undefined = HERO_END;
  while (id && CARD_BY_ID[id] && chain.length < 3) {
    chain.unshift(CARD_BY_ID[id]);
    id = CARD_BY_ID[id].parent;
  }
  return chain;
}

const HERO_STATUSES: NodeVisualStatus[] = ["owned", "available", "locked"];
const HERO_LABELS: Record<string, string> = {
  owned: TREE_STATUS_LABELS.owned,
  available: TREE_STATUS_LABELS.available,
  locked: TREE_STATUS_LABELS.preparation,
};
const HERO_CHAIN = heroChain();

function HeroPath() {
  const nodes = HERO_CHAIN.map((card, i) => ({
    card,
    status: HERO_STATUSES[i] ?? "locked",
  }));
  return (
    <div
      aria-hidden="true"
      className="flex justify-center hero:order-2 hero:rounded-3xl hero:bg-white/5 hero:p-12 hero:ring-1 hero:ring-white/10"
    >
      <div className="flex w-full max-w-sm items-start hero:w-auto hero:max-w-none hero:flex-col-reverse">
        {nodes.map(({ card, status }, i) => (
          <HeroStep
            key={card.id}
            index={i}
            card={card}
            status={status}
            next={nodes[i + 1]?.status}
          />
        ))}
      </div>
    </div>
  );
}

function HeroStep({
  index,
  card,
  status,
  next,
}: {
  index: number;
  card: IdCard;
  status: NodeVisualStatus;
  next?: NodeVisualStatus;
}) {
  // Edge to the next step, styled like the tree: amber = both owned, dashed = ready to get, plain = not yet.
  const edge =
    next === undefined
      ? null
      : status === "owned" && next === "owned"
        ? "border-amber"
        : status === "owned" && next === "available"
          ? "border-dashed border-mist"
          : "border-white/30";
  const pulse = status === "available";
  return (
    <>
      <div
        style={d(80 + index * 60)}
        className="rise flex w-20 shrink-0 flex-col items-center gap-2 text-center short:gap-1.5 hero:w-auto hero:flex-row hero:gap-5 hero:text-left [--rise-y:8px]"
      >
        <NodeCircle
          status={status}
          icon={card.icon}
          className={`short:size-14! ${pulse ? "pulse-ring pulse-once" : ""}`}
          style={
            pulse
              ? ({
                  "--pulse-delay": "700ms",
                  "--pulse-color": "var(--color-sky)",
                } as CSSProperties)
              : undefined
          }
        />
        <span className="flex flex-col items-center gap-1.5 hero:items-start">
          <span className="text-balance text-[13px] font-semibold leading-tight hero:text-base">
            {card.short}
          </span>
          <span className="hidden hero:block">
            <Pill
              tone={
                status === "owned"
                  ? "amber"
                  : status === "available"
                    ? "mist"
                    : "onDark"
              }
            >
              {HERO_LABELS[status]}
            </Pill>
          </span>
        </span>
      </div>
      {edge && (
        <span
          style={d(index * 60)}
          className={`draw-edge mt-[34px] min-w-3 flex-1 border-t-[3px] short:mt-[26px] hero:ml-[34px] hero:mt-0 hero:h-14 hero:w-0 hero:min-w-0 hero:flex-none hero:border-l-[3px] hero:border-t-0 ${edge}`}
        />
      )}
    </>
  );
}
