"use client";

import { useLayoutEffect, useRef, useState, type CSSProperties } from "react";
import { ArrowRight, LogIn } from "lucide-react";
import { AboutSection, RatesSection, TeamSection } from "./LandingSections";
import { Button } from "@/components/ui/button";
import { Pill, type PillTone } from "@/components/ui/pill";
import { CARD_BY_ID, type IdCard } from "@/data/cards";
import { RENDERS } from "@/data/renders";
import { TREE_STATUS_LABELS } from "@/lib/tree-status";
import { Logo } from "./Logo";
import { NodeCircle, type NodeVisualStatus } from "./NodeCircle";

/** Entrance timing: --d is the delay in ms (see .rise / .draw-edge in globals.css). */
const d = (ms: number) => ({ "--d": `${ms}ms` }) as CSSProperties;

type Section = "home" | "about" | "rates" | "team";
/** `short` replaces the label on the narrowest phones (< 360px) so all four tabs fit on one row. */
const TABS: { id: Section; label: string; short?: string }[] = [
  { id: "home", label: "Home" },
  { id: "about", label: "About" },
  { id: "rates", label: "Rates & Feedbacks", short: "Rates" },
  { id: "team", label: "The Team", short: "Team" },
];

export function Landing({
  onAuth,
  onPreview,
}: {
  onAuth: () => void;
  onPreview: () => void;
}) {
  const [section, setSection] = useState<Section>("home");

  function go(next: Section) {
    setSection(next);
    // On phones the header can scroll away under a long section; bring the new content into view.
    const still = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    window.scrollTo({ top: 0, behavior: still ? "auto" : "smooth" });
  }

  return (
    <main
      id="main"
      tabIndex={-1}
      className="landing-bg relative isolate flex min-h-dvh flex-col overflow-x-clip text-navy outline-none"
    >
      <Backdrop />

      <div className="mx-auto flex w-full max-w-md flex-1 flex-col px-4 pb-8 pt-3 short:pb-5 sm:max-w-2xl sm:px-6 sm:pt-4 hero:max-w-7xl hero:px-12 hero:pb-16 hero:pt-6 xl:px-16">
        {/* Phones: logo above a full-width nav. From sm: one row, logo left, tabs right. */}
        <header
          style={d(0)}
          className="rise flex flex-col gap-1.5 rounded-[26px] bg-white/75 p-1.5 shadow-[0_1px_2px_rgb(27_54_93/0.05),0_12px_32px_-18px_rgb(27_54_93/0.25)] ring-1 ring-navy/5 backdrop-blur-md sm:flex-row sm:items-center sm:justify-between sm:rounded-full sm:pl-4"
        >
          <button
            type="button"
            onClick={() => go("home")}
            aria-label="MabatID home"
            aria-current={section === "home" ? "page" : undefined}
            className="self-start rounded-full px-1.5 py-1 transition-[scale] duration-[var(--dur-fast)] ease-[var(--ease-out)] active:scale-[0.97] sm:self-center sm:px-0"
          >
            <Logo dark />
          </button>
          <LandingNav section={section} onSelect={go} />
        </header>

        {section === "home" ? (
          <Hero key="home" onAuth={onAuth} onPreview={onPreview} />
        ) : (
          <div key={section} className="mx-auto w-full max-w-5xl flex-1 pt-10 hero:pt-20">
            {section === "about" ? (
              <AboutSection onPreview={onPreview} />
            ) : section === "rates" ? (
              <RatesSection onAuth={onAuth} />
            ) : (
              <TeamSection />
            )}
          </div>
        )}
      </div>
    </main>
  );
}

/**
 * Segmented nav with one sliding highlight. The highlight is positioned imperatively from the active
 * button's box (no state, no re-render), and follows layout changes via ResizeObserver.
 */
function LandingNav({
  section,
  onSelect,
}: {
  section: Section;
  onSelect: (s: Section) => void;
}) {
  const navRef = useRef<HTMLDivElement>(null);
  const indRef = useRef<HTMLSpanElement>(null);

  useLayoutEffect(() => {
    const nav = navRef.current;
    const ind = indRef.current;
    if (!nav || !ind) return;
    const place = () => {
      const btn = nav.querySelector<HTMLElement>(`[data-tab="${section}"]`);
      if (!btn) {
        ind.style.opacity = "0";
        return;
      }
      ind.style.width = `${btn.offsetWidth}px`;
      ind.style.translate = `${btn.offsetLeft}px 0`;
      ind.style.opacity = "1";
    };
    place();
    const ro = new ResizeObserver(place);
    ro.observe(nav);
    return () => ro.disconnect();
  }, [section]);

  return (
    <nav aria-label="About MabatID" className="w-full sm:w-auto">
      <div
        ref={navRef}
        className="relative flex rounded-full bg-navy/[0.04] p-1 ring-1 ring-navy/5"
      >
        <span
          ref={indRef}
          aria-hidden="true"
          className="nav-indicator absolute bottom-1 left-0 top-1 rounded-full bg-white opacity-0 shadow-[0_1px_2px_rgb(27_54_93/0.08),0_6px_14px_-8px_rgb(27_54_93/0.3)]"
        />
        {TABS.map((t) => {
          const active = section === t.id;
          return (
            <button
              key={t.id}
              type="button"
              data-tab={t.id}
              onClick={() => onSelect(t.id)}
              aria-current={active ? "page" : undefined}
              className={`relative z-10 inline-flex min-h-10 flex-1 items-center justify-center whitespace-nowrap rounded-full px-1.5 text-[13px] font-semibold min-[400px]:px-3 transition-colors duration-[var(--dur-fast)] ease-[var(--ease-out)] sm:min-h-9 sm:flex-none sm:px-4 sm:text-sm ${
                active ? "text-navy" : "text-muted-foreground hover:text-navy"
              }`}
            >
              {t.short ? (
                <>
                  <span className="min-[360px]:hidden">{t.short}</span>
                  <span className="hidden min-[360px]:inline">{t.label}</span>
                </>
              ) : (
                t.label
              )}
            </button>
          );
        })}
      </div>
    </nav>
  );
}

function Hero({ onAuth, onPreview }: { onAuth: () => void; onPreview: () => void }) {
  return (
        // Stacked (< 900px): card on top, centred copy and buttons at the bottom within thumb reach.
        // Desktop: two balanced columns, vertically centred in the space under the header.
        <div className="flex flex-1 flex-col justify-end gap-8 pt-8 short:gap-5 short:pt-4 hero:grid hero:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)] hero:content-center hero:items-center hero:gap-12 hero:py-16 xl:gap-20">
          <HeroCard />

          <div className="mx-auto w-full max-w-xl text-center hero:order-1 hero:mx-0 hero:justify-self-start hero:text-left">
            <h1
              style={d(160)}
              className="rise text-balance text-[length:clamp(1.9rem,8vw,2.2rem)] font-extrabold leading-[1.08] tracking-tight short:text-[length:1.7rem] hero:text-[length:clamp(2.5rem,3.6vw,3.4rem)]"
            >
              From baseline documents to your{" "}
              <span className="text-civic">first valid ID.</span>
            </h1>
            <p
              style={d(220)}
              className="rise mx-auto mt-4 max-w-md text-pretty text-base leading-relaxed text-muted-foreground short:mt-3 short:text-sm short:leading-snug hero:mx-0 hero:mt-6 hero:text-lg"
            >
              One step unlocks the next. Explore what to get, estimated fees and
              what to bring — for students, young adults and first-time
              jobseekers.
            </p>

            {/* Each button rises in on its own beat, lifts on hover, and presses down (Button's scale).
                The primary one also carries a periodic light sweep and a nudging arrow. */}
            <div className="mt-8 flex flex-col gap-3 short:mt-5 short:gap-2 sm:flex-row sm:justify-center hero:mt-10 hero:justify-start">
              <Button
                onClick={onPreview}
                variant="brand"
                size="xl"
                style={d(280)}
                className="rise btn-lift btn-shine sm:px-7 [--rise-y:14px]"
              >
                Preview your ID path
                <ArrowRight
                  className="size-5 transition-transform duration-[var(--dur-base)] ease-[var(--ease-out)] group-hover/button:translate-x-1"
                  aria-hidden="true"
                />
              </Button>
              <Button
                onClick={onAuth}
                variant="outline"
                size="xl"
                style={d(360)}
                className="rise btn-lift sm:px-7 [--rise-y:14px]"
              >
                <LogIn
                  className="size-5 transition-transform duration-[var(--dur-base)] ease-[var(--ease-out)] group-hover/button:translate-x-0.5 group-hover/button:scale-110"
                  aria-hidden="true"
                />{" "}
                Open device profile
              </Button>
            </div>
          </div>
        </div>
  );
}

/** Soft, slowly drifting colour fields behind everything. Decorative. */
function Backdrop() {
  return (
    <div aria-hidden="true" className="pointer-events-none absolute inset-0 -z-10 overflow-hidden">
      <span
        className="landing-blob -left-24 -top-24 size-[22rem] bg-mist/70"
        style={{ "--bx": "60px", "--by": "40px" } as CSSProperties}
      />
      <span
        className="landing-blob -right-32 top-1/4 size-[26rem] bg-sky/30"
        style={{ "--bx": "-50px", "--by": "60px", animationDelay: "-6s" } as CSSProperties}
      />
      <span
        className="landing-blob -bottom-40 left-1/3 size-[24rem] bg-amber/15"
        style={{ "--bx": "40px", "--by": "-50px", animationDelay: "-11s" } as CSSProperties}
      />
    </div>
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
 * Below 900px each step's 3D render floats in a row above its node; from 900px renders float around the
 * card (FLOATERS).
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
const HERO_TONES: Record<string, PillTone> = {
  owned: "amber",
  available: "mist",
  locked: "muted",
};
const HERO_CHAIN = heroChain();

/**
 * Desktop floating renders (from 900px): [card id, placement classes, tilt, bob duration, bob delay].
 * 900–1279px they tuck in close to the card; from 1280px they spread into the free space around it.
 * Below 900px the renders are instead lined up above the compact path (see HeroCard).
 */
const FLOATERS: [string, string, number, string, string][] = [
  ["psa", "-left-10 -top-8 w-20 xl:-left-20 xl:w-24", -9, "7s", "0s"],
  ["philsys", "-right-12 top-[30%] w-28 xl:-right-24 xl:top-[34%] xl:w-36", 7, "6s", "-2s"],
  ["postal", "-bottom-10 -left-8 w-24 xl:-bottom-14 xl:-left-16 xl:w-32", 4, "8s", "-4s"],
];

/** Tilt for each document in the stacked layout's row, left to right. */
const ROW_TILT = [-6, 4, -3];

function HeroCard() {
  const nodes = HERO_CHAIN.map((card, i) => ({
    card,
    status: HERO_STATUSES[i] ?? "locked",
  }));
  return (
    <div aria-hidden="true" className="relative mx-auto w-full max-w-xl hero:order-2 hero:mx-0 hero:w-auto hero:justify-self-center">
      {FLOATERS.map(([id, pos, rot, dur, delay], i) =>
        RENDERS[id] ? (
          <div
            key={id}
            style={d(420 + i * 90)}
            className={`rise pointer-events-none absolute z-0 hidden hero:block ${pos} [--rise-y:14px]`}
          >
            <img
              src={RENDERS[id].front}
              alt=""
              draggable={false}
              decoding="async"
              className="float-card render-img w-full select-none"
              style={
                {
                  "--rot": `${rot}deg`,
                  "--float-dur": dur,
                  "--float-delay": delay,
                } as CSSProperties
              }
            />
          </div>
        ) : null,
      )}

      {/* Stacked layout: each step's own document floats directly above its node, its lower edge tucked
          behind the card. Columns mirror the card's row (px-4 + w-20 nodes at both ends and the centre). */}
      <div className="relative z-0 -mb-5 flex items-end justify-between px-4 short:-mb-4 hero:hidden">
        {nodes.map(({ card }, i) =>
          RENDERS[card.id] ? (
            <div
              key={card.id}
              style={d(380 + i * 90)}
              className="rise flex w-20 justify-center [--rise-y:12px]"
            >
              <img
                src={RENDERS[card.id].front}
                alt=""
                draggable={false}
                decoding="async"
                className="float-card render-img h-[72px] w-auto max-w-[104px] select-none object-contain short:h-14 sm:h-20"
                style={
                  {
                    "--rot": `${ROW_TILT[i] ?? 0}deg`,
                    "--float-dur": `${6 + i}s`,
                    "--float-delay": `${-i * 1.5}s`,
                  } as CSSProperties
                }
              />
            </div>
          ) : (
            <span key={card.id} className="w-20" />
          ),
        )}
      </div>

      <div
        style={d(60)}
        className="rise relative z-10 rounded-[28px] bg-white/90 px-4 py-5 shadow-[0_1px_2px_rgb(27_54_93/0.05),0_30px_60px_-30px_rgb(27_54_93/0.35)] ring-1 ring-navy/5 backdrop-blur short:py-4 hero:px-12 hero:py-12 xl:px-14"
      >

        <div className="flex w-full items-start hero:w-auto hero:flex-col-reverse">
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
          ? "border-dashed border-civic/60"
          : "border-locked-line/50";
  const pulse = status === "available";
  // NodeCircle gets shrink-0: in the desktop row a wrapping label would otherwise squeeze it into an oval.
  return (
    <>
      <div
        style={d(140 + index * 70)}
        className="rise group/step flex w-20 shrink-0 flex-col items-center gap-2 text-center short:gap-1.5 hero:w-auto hero:flex-row hero:gap-5 hero:text-left [--rise-y:8px]"
      >
        <NodeCircle
          status={status}
          icon={card.icon}
          className={`shrink-0 short:size-14! group-hover/step:scale-105 ${pulse ? "pulse-ring" : ""}`}
          style={
            pulse
              ? ({
                  "--pulse-delay": "900ms",
                  "--pulse-color": "var(--color-civic)",
                  "--pulse-count": "infinite",
                } as CSSProperties)
              : undefined
          }
        />
        <span className="flex flex-col items-center gap-1.5 hero:items-start">
          <span className="text-balance text-[13px] font-semibold leading-tight hero:text-base">
            {card.short}
          </span>
          <span className="hidden hero:block">
            <Pill tone={HERO_TONES[status]}>{HERO_LABELS[status]}</Pill>
          </span>
        </span>
      </div>
      {edge && (
        <span
          style={d(index * 70)}
          className={`draw-edge relative mt-[34px] min-w-3 flex-1 border-t-[3px] short:mt-[26px] hero:ml-[34px] hero:mt-0 hero:h-16 hero:w-0 hero:min-w-0 hero:flex-none hero:border-l-[3px] hero:border-t-0 ${edge}`}
        >
          {/* A small spark travels each edge toward the goal, so the path reads as moving forward. */}
          <span
            className="edge-spark"
            style={{ "--d": `${1000 + index * 1200}ms` } as CSSProperties}
          />
        </span>
      )}
    </>
  );
}
