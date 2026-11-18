"use client";

import { useEffect, useLayoutEffect, useRef, useState, type CSSProperties, type ReactNode } from "react";
import { Dialog } from "@base-ui/react/dialog";
import {
  ArrowRight,
  BookOpen,
  Heart,
  ListChecks,
  Mail,
  Map as MapIcon,
  RotateCcw,
  Search,
  Smartphone,
  XIcon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import xavierPhoto from "../../IDPics/1x1.jpg";
import kristianPhoto from "../../IDPics/photo_2026-11-18_18-45-07.jpg";
import {
  fetchLikes,
  sendLike,
  type LikeTally,
} from "@/lib/likes";
import { FeedbackForm } from "./FeedbackForm";
import { GithubMark, githubHandle, TeamIdCard, type TeamMember } from "./TeamIdCard";

const d = (ms: number) => ({ "--d": `${ms}ms` }) as CSSProperties;

function SectionHeading({ id, eyebrow, title, children }: { id: string; eyebrow: string; title: string; children?: ReactNode }) {
  return (
    <div style={d(0)} className="rise mx-auto max-w-2xl text-center [--rise-y:8px]">
      <p className="text-xs font-bold uppercase tracking-[0.16em] text-civic">{eyebrow}</p>
      <h2 id={id} className="mt-2 text-[length:clamp(1.6rem,6vw,2.4rem)] font-extrabold leading-[1.1] tracking-tight">
        {title}
      </h2>
      {children && <p className="mt-3 text-base leading-relaxed text-muted-foreground hero:text-lg">{children}</p>}
    </div>
  );
}

/* ---------------------------------- About --------------------------------- */

const FEATURES: { icon: typeof MapIcon; title: string; body: string }[] = [
  { icon: MapIcon, title: "ID path", body: "A map of which document unlocks which ID, starting from what you already hold." },
  { icon: Search, title: "Browse & filter", body: "Compare IDs by estimated fee, budget, and on-site or online application." },
  { icon: BookOpen, title: "Guides", body: "Step-by-step notes on requirements and what to bring before you line up." },
  { icon: ListChecks, title: "Progress", body: "Mark what you have and see the next IDs you're ready to get." },
  { icon: Smartphone, title: "Device profile", body: "Your details stay on your device, and you can move them to another one." },
];

export function AboutSection({ onPreview }: { onPreview: () => void }) {
  return (
    <section aria-labelledby="about-title" className="flex flex-col gap-10 hero:gap-14">
      <SectionHeading id="about-title" eyebrow="About" title="Your first valid ID, mapped out.">
        MabatID helps students, young adults and first-time jobseekers in the Philippines figure out which
        valid ID to get first, and what it takes. Tell it what documents you have, and it shows the IDs you
        can get next, the estimated fees, and what to bring.
      </SectionHeading>

      {/* Wrapping flex, not a grid, so an incomplete last row (5 items) sits centred. */}
      <ul className="flex flex-wrap justify-center gap-4">
        {FEATURES.map(({ icon: Icon, title, body }, i) => (
          <li
            key={title}
            style={d(80 + i * 50)}
            className="rise group/feat w-full rounded-3xl sm:w-[calc((100%-1rem)/2)] lg:w-[calc((100%-2rem)/3)] hero:p-6 bg-white/85 p-5 shadow-[0_1px_2px_rgb(27_54_93/0.05),0_18px_36px_-26px_rgb(27_54_93/0.35)] ring-1 ring-navy/5 transition-[translate,box-shadow] duration-[var(--dur-base)] ease-[var(--ease-out)] [--rise-y:10px] hover:-translate-y-0.5"
          >
            <span className="grid size-11 place-items-center rounded-2xl bg-mist/60 text-civic transition-transform duration-[var(--dur-base)] ease-[var(--ease-out)] group-hover/feat:-rotate-6 group-hover/feat:scale-105">
              <Icon className="size-5" aria-hidden="true" />
            </span>
            <h3 className="mt-4 text-base font-bold">{title}</h3>
            <p className="mt-1 text-sm leading-relaxed text-muted-foreground">{body}</p>
          </li>
        ))}
      </ul>

      <UnderTheHood />

      <div style={d(360)} className="rise flex justify-center">
        <Button onClick={onPreview} variant="brand" size="xl" className="btn-lift btn-shine w-full sm:w-auto sm:px-7">
          Preview your ID path
          <ArrowRight
            className="size-5 transition-transform duration-[var(--dur-base)] ease-[var(--ease-out)] group-hover/button:translate-x-1"
            aria-hidden="true"
          />
        </Button>
      </div>
    </section>
  );
}

/**
 * How the ID path is computed, in the project's own technical terms. Every claim maps to code:
 * rule kinds → lib/planner/types.ts · search, ranking, pruning, ordering → lib/planner/engine.ts ·
 * layout → lib/tree.ts (dagre, rankdir BT) · API → app/api/plans/{preview,tree}.
 */
const TECH: { term: string; title: string; body: string; tags: string[] }[] = [
  {
    term: "Model",
    title: "AND / OR requirement graph",
    body: "Every ID's prerequisites are a rule tree: all-of, any-of and at-least-N document rules, plus eligibility facts such as age.",
    tags: ["all", "any", "at-least-N", "eligibility facts"],
  },
  {
    term: "Engine",
    title: "Bounded backward chaining",
    body: "The planner starts from the target ID and works back to what you hold, as a beam search capped at 48 candidates and an 18,000-operation budget, with cycle detection.",
    tags: ["goal-driven", "beam search", "cycle detection"],
  },
  {
    term: "Ranking",
    title: "Lexicographic scoring",
    body: "Candidates are ranked by unknown eligibility, open questions and budget, then fewest documents or lowest fees. Dominated plans are pruned, and up to 3 alternatives are kept.",
    tags: ["fewest-documents", "lowest-fees", "dominance pruning"],
  },
  {
    term: "Ordering",
    title: "Kahn's topological sort",
    body: "The chosen plan's dependencies are put into a valid step-by-step order, so nothing is listed before what it needs.",
    tags: ["DAG", "O(V + E)"],
  },
  {
    term: "Layout",
    title: "Layered graph drawing",
    body: "The ID path is laid out bottom-to-top with Dagre's layered (Sugiyama-style) algorithm and rendered as an interactive React Flow canvas.",
    tags: ["Dagre", "React Flow"],
  },
  {
    term: "Stack",
    title: "Stateless planning API",
    body: "Next.js 16 App Router, React 19, TypeScript and Tailwind CSS 4. Plans come from stateless POST endpoints; profiles stay on the device.",
    tags: ["/api/plans/preview", "/api/plans/tree", "local-first"],
  },
];

function UnderTheHood() {
  return (
    <div className="flex flex-col gap-6" aria-labelledby="tech-title" role="group">
      <div style={d(300)} className="rise mx-auto max-w-2xl text-center [--rise-y:8px]">
        <p className="text-xs font-bold uppercase tracking-[0.16em] text-civic">Under the hood</p>
        <h3 id="tech-title" className="mt-2 text-[length:clamp(1.3rem,4.5vw,1.75rem)] font-extrabold leading-tight tracking-tight">
          How the ID path is computed
        </h3>
      </div>
      <ol className="flex flex-wrap justify-center gap-4">
        {TECH.map((t, i) => (
          <li
            key={t.term}
            style={d(340 + i * 50)}
            className="rise flex w-full flex-col rounded-3xl bg-white/70 p-5 ring-1 ring-navy/8 [--rise-y:10px] sm:w-[calc((100%-1rem)/2)] lg:w-[calc((100%-2rem)/3)]"
          >
            <p className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.14em] text-muted-foreground">
              <span className="font-mono text-civic">{String(i + 1).padStart(2, "0")}</span>
              {t.term}
            </p>
            <h4 className="mt-2 text-base font-bold">{t.title}</h4>
            <p className="mt-1 flex-1 text-sm leading-relaxed text-muted-foreground">{t.body}</p>
            <ul className="mt-3 flex flex-wrap gap-1.5" aria-label="Terms">
              {t.tags.map((tag) => (
                <li key={tag} className="rounded-md bg-navy/[0.05] px-2 py-0.5 font-mono text-[11px] font-medium text-navy">
                  {tag}
                </li>
              ))}
            </ul>
          </li>
        ))}
      </ol>
    </div>
  );
}

/* ---------------------------- Rates & Feedbacks --------------------------- */

const BURST = [0, 45, 90, 135, 180, 225, 270, 315];

export function RatesSection({ onAuth }: { onAuth: () => void }) {
  const [tally, setTally] = useState<LikeTally | null>(null);
  const liked = tally?.liked ?? false;
  const count = tally?.count ?? null;
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  /** Bumped on each successful like, to replay the pop + burst. */
  const [burst, setBurst] = useState(0);
  const busy = useRef(false);
  const revision = useRef(0);

  useEffect(() => {
    const ctrl = new AbortController();
    const refresh = () => {
      if (busy.current) return;
      const startedAt = revision.current;
      fetchLikes(ctrl.signal)
        .then((next) => { if (!ctrl.signal.aborted && !busy.current && revision.current === startedAt) setTally(next); })
        .catch(() => { /* Keep the last known count; the initial failure shows a retry. */ })
        .finally(() => { if (!ctrl.signal.aborted) setLoading(false); });
    };
    refresh();
    window.addEventListener("focus", refresh);
    const timer = window.setInterval(refresh, 60000);
    return () => { ctrl.abort(); window.removeEventListener("focus", refresh); window.clearInterval(timer); };
  }, []);

  async function like() {
    if (liked || busy.current || loading) return;
    busy.current = true;
    revision.current += 1;
    setError(null);
    setSending(true);
    // Optimistic: the heart fills right away; reverted if the server refuses.
    const previous = tally;
    if (previous) setTally({ ...previous, liked: true, count: previous.count + 1 });
    setBurst((b) => b + 1);
    try {
      // Retry can also establish the browser cookie after an initial load failure.
      if (!previous) await fetchLikes();
      setTally(await sendLike());
    } catch (error) {
      setTally(previous);
      setError(error instanceof Error ? error.message : "Couldn't send your like. Please try again.");
    } finally {
      busy.current = false;
      setSending(false);
    }
  }

  const again = tally ? new Date(tally.nextResetAt).toLocaleDateString("en-PH", { timeZone: "Asia/Manila", weekday: "long", month: "short", day: "numeric" }) : "Monday";

  return (
    <section aria-labelledby="rates-title" className="flex flex-col gap-8">
      <SectionHeading id="rates-title" eyebrow="Rates & Feedbacks" title="Found it useful? Leave a like." />

      <div
        style={d(100)}
        className="rise mx-auto flex w-full max-w-md flex-col items-center gap-6 rounded-[32px] bg-white/85 px-6 py-10 text-center shadow-[0_1px_2px_rgb(27_54_93/0.05),0_30px_60px_-34px_rgb(27_54_93/0.4)] ring-1 ring-navy/5 hero:py-12"
      >
        <div className="relative grid place-items-center">
          {burst > 0 && (
            <span key={burst} aria-hidden="true" className="pointer-events-none absolute inset-0 grid place-items-center">
              {BURST.map((a) => (
                <span key={a} className="like-particle" style={{ "--a": `${a}deg` } as CSSProperties} />
              ))}
            </span>
          )}
          <button
            type="button"
            onClick={like}
            disabled={loading || sending || liked}
            aria-pressed={liked}
            aria-disabled={liked || undefined}
            aria-label="Like MabatID"
            className={`relative grid size-28 place-items-center rounded-full transition-[background-color,box-shadow,scale] duration-[var(--dur-base)] ease-[var(--ease-out)] active:scale-[0.94] active:duration-[var(--dur-press)] ${
              liked
                ? "bg-amber text-navy shadow-[0_14px_30px_-12px_color-mix(in_srgb,var(--color-amber)_90%,transparent)]"
                : "bg-white text-civic shadow-[0_1px_2px_rgb(27_54_93/0.08),0_14px_30px_-16px_rgb(27_54_93/0.45)] ring-2 ring-civic/20 hover:ring-civic/40"
            } ${liked ? "cursor-default" : ""}`}
          >
            <Heart
              key={`h${burst}`}
              className={`size-12 ${burst > 0 ? "heart-pop" : ""}`}
              fill={liked ? "currentColor" : "none"}
              strokeWidth={2.2}
              aria-hidden="true"
            />
          </button>
        </div>

        <div className="flex min-h-[4.5rem] flex-col items-center gap-1">
          <p className="text-4xl font-extrabold tabular-nums tracking-tight">
            {loading ? (
              <span className="inline-block h-9 w-14 animate-pulse rounded-lg bg-navy/[0.06] align-middle" />
            ) : count === null ? (
              <span className="text-2xl text-muted-foreground">—</span>
            ) : (
              <span key={count} className="count-tick inline-block">
                {count.toLocaleString("en-PH")}
              </span>
            )}
          </p>
          <p className="text-sm font-medium text-muted-foreground">
            {count === null && !loading ? "Like count unavailable right now" : "likes this week"}
          </p>
        </div>

        <p aria-live="polite" className={`min-h-5 text-sm ${error ? "font-semibold text-destructive" : "text-muted-foreground"}`}>
          {error ?? (liked ? `Thanks! You can like again on ${again}.` : "Tap the heart to send a like.")}
        </p>
        <p className="-mt-3 text-xs text-muted-foreground">One like per browser each week. Resets Monday, 12:00 AM Philippine time.</p>
      </div>

      <div style={d(180)} className="rise mx-auto w-full max-w-md">
        <FeedbackForm onOpenProfile={onAuth} />
      </div>
    </section>
  );
}

/* --------------------------------- The Team -------------------------------- */

const TEAM: TeamMember[] = [
  {
    lastName: "Imbang",
    givenNames: "Xavier",
    title: "Product Lead & Frontend Designer",
    contributions: [
      "Original idea and product concept",
      "Frontend design and user experience",
      "Research on ID and document prerequisites",
      "Application guides for each ID",
    ],
    github: "https://github.com/sagembng",
    email: "xgimbang@gmail.com",
    photo: xavierPhoto.src,
    idNo: "MBT-0001",
  },
  {
    lastName: "Villaraza",
    givenNames: "Kristian Lawrence",
    title: "Backend & Database Engineer",
    contributions: [
      "Backend and database",
      "Planning logic and ID prerequisites",
      "Proper category filtering",
      "APIs and other backend work",
    ],
    github: "https://github.com/kitarsin",
    email: "kristianlawrence8@gmail.com",
    photo: kristianPhoto.src,
    idNo: "MBT-0002",
  },
];

/**
 * Clicking a card zooms it to the centre of the screen (FLIP: the enlarged copy starts exactly over the
 * original and animates to its centred size), over a blurred backdrop. Escape, the close button or a click
 * outside reverses it back into place. The base-ui Dialog supplies focus trap, scroll lock and focus return.
 */
export function TeamSection() {
  const [zoom, setZoom] = useState<number | null>(null);
  const [closing, setClosing] = useState(false);
  const sources = useRef<(HTMLElement | null)[]>([]);

  function open(i: number, card: HTMLElement) {
    sources.current[i] = card;
    setClosing(false);
    setZoom(i);
  }

  return (
    <section aria-labelledby="team-title" className="flex flex-col gap-10 hero:gap-14">
      <SectionHeading id="team-title" eyebrow="The Team" title="The people behind MabatID.">
        Fittingly, our own IDs. Tap a card to take a closer look, then flip it to see what we built.
      </SectionHeading>
      {/* Side by side only once both cards fit at a readable width; centred either way. */}
      <ul className="mx-auto grid w-full max-w-4xl justify-items-center gap-10 hero:grid-cols-2 hero:gap-12">
        {TEAM.map((m, i) => (
          <li key={m.idNo} className="flex w-full justify-center">
            <TeamIdCard
              member={m}
              delay={120 + i * 120}
              onOpen={(card) => open(i, card)}
              concealed={zoom === i}
            />
          </li>
        ))}
      </ul>

      <Dialog.Root
        open={zoom !== null}
        onOpenChange={(next) => {
          if (!next) setClosing(true);
        }}
      >
        <Dialog.Portal>
          <Dialog.Backdrop
            className={`fixed inset-0 z-50 bg-navy/45 backdrop-blur-sm transition-opacity duration-300 ease-[var(--ease-out)] data-starting-style:opacity-0 ${closing ? "opacity-0" : ""}`}
          />
          {/* Width is capped by height too, so card + links always fit on short/landscape screens. */}
          <Dialog.Popup className="fixed inset-0 z-50 m-auto flex h-fit w-[min(92vw,720px,calc((100dvh-12rem)*1.586))] flex-col items-center gap-4 outline-none">
            {zoom !== null && (
              <ZoomedCard
                member={TEAM[zoom]}
                source={() => sources.current[zoom] ?? null}
                closing={closing}
                onClosed={() => {
                  setZoom(null);
                  setClosing(false);
                }}
              />
            )}
          </Dialog.Popup>
        </Dialog.Portal>
      </Dialog.Root>
    </section>
  );
}

/** Transform that puts a box laid out at `to` exactly over `from`. */
function flipFrom(from: DOMRect, to: DOMRect) {
  const dx = from.left + from.width / 2 - (to.left + to.width / 2);
  const dy = from.top + from.height / 2 - (to.top + to.height / 2);
  return `translate(${dx}px, ${dy}px) scale(${from.width / to.width})`;
}

const prefersReducedMotion = () =>
  typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

function ZoomedCard({
  member,
  source,
  closing,
  onClosed,
}: {
  member: TeamMember;
  source: () => HTMLElement | null;
  closing: boolean;
  onClosed: () => void;
}) {
  const cardRef = useRef<HTMLDivElement>(null);
  const sourceRef = useRef(source);
  const closedRef = useRef(onClosed);
  useLayoutEffect(() => {
    sourceRef.current = source;
    closedRef.current = onClosed;
  });

  // Enter: start over the original card, then release to the centred layout.
  useLayoutEffect(() => {
    const el = cardRef.current;
    const from = sourceRef.current()?.getBoundingClientRect();
    if (!el || !from || prefersReducedMotion()) return;
    el.style.transition = "none";
    el.style.transform = flipFrom(from, el.getBoundingClientRect());
    void el.offsetWidth; // commit the start frame
    el.style.transition = "transform 520ms cubic-bezier(0.16, 1, 0.3, 1)";
    el.style.transform = "";
  }, []);

  // Exit: fly back onto the original, then let the dialog unmount.
  useEffect(() => {
    if (!closing) return;
    const el = cardRef.current;
    const from = sourceRef.current()?.getBoundingClientRect();
    if (!el || !from || prefersReducedMotion()) {
      closedRef.current();
      return;
    }
    el.style.transition = "transform 360ms cubic-bezier(0.4, 0, 0.2, 1)";
    el.style.transform = flipFrom(from, el.getBoundingClientRect());
    const t = window.setTimeout(() => closedRef.current(), 360);
    return () => window.clearTimeout(t);
  }, [closing]);

  const [flipped, setFlipped] = useState(false);
  // On close the card turns back to its front while it flies home, so it lands matching the original.
  const showBack = flipped && !closing;
  const toggle = () => setFlipped((f) => !f);

  const name = `${member.givenNames} ${member.lastName}`;
  return (
    <>
      <Dialog.Title className="sr-only">{name}, team ID card</Dialog.Title>

      <div ref={cardRef} className="w-full will-change-transform">
        <TeamIdCard member={member} zoomed flipped={showBack} onFlip={toggle} />
      </div>

      {/* Full-size, readable contact links (the card text is small on phones). */}
      {/* Outer fades out on close; inner rises in after the card lands (separate so the two don't fight). */}
      <div className={`w-full transition-opacity duration-200 ${closing ? "opacity-0" : ""}`}>
      <div
        style={d(260)}
        className="rise grid w-full gap-2 sm:grid-cols-2 [--rise-y:8px]"
      >
        <a
          href={member.github}
          target="_blank"
          rel="noopener noreferrer"
          className="flex min-h-12 min-w-0 flex-1 items-center gap-3 rounded-2xl bg-white px-4 py-3 text-navy shadow-[0_10px_30px_-18px_rgb(27_54_93/0.6)] ring-1 ring-navy/5 transition-colors hover:bg-mist/30"
        >
          <GithubMark className="size-5 shrink-0" />
          <span className="flex min-w-0 flex-col">
            <span className="text-xs font-semibold text-muted-foreground">GitHub</span>
            <span className="truncate text-base font-bold">{githubHandle(member.github)}</span>
          </span>
          <span className="sr-only"> (opens in a new tab)</span>
        </a>
        <a
          href={`mailto:${member.email}`}
          className="flex min-h-12 min-w-0 flex-1 items-center gap-3 rounded-2xl bg-white px-4 py-3 text-navy shadow-[0_10px_30px_-18px_rgb(27_54_93/0.6)] ring-1 ring-navy/5 transition-colors hover:bg-mist/30"
        >
          <Mail className="size-5 shrink-0 text-civic" aria-hidden="true" />
          <span className="flex min-w-0 flex-col">
            <span className="text-xs font-semibold text-muted-foreground">Email</span>
            <span className="truncate text-base font-bold">{member.email}</span>
          </span>
        </a>
        <div className="flex gap-2 sm:col-span-2 sm:justify-center">
          <Button
            type="button"
            variant="outline"
            onClick={toggle}
            className="btn-lift h-12 flex-1 gap-2 rounded-2xl px-5 text-sm font-semibold sm:flex-none"
          >
            <RotateCcw
              className={`size-4 transition-transform duration-500 ease-[var(--ease-out)] ${showBack ? "-rotate-180" : ""}`}
              aria-hidden="true"
            />
            {showBack ? "Front" : "Contributions"}
          </Button>
          <Dialog.Close
            render={<Button variant="outline" size="icon-xl" className="size-12 shrink-0 rounded-2xl" />}
          >
            <XIcon className="size-5" aria-hidden="true" />
            <span className="sr-only">Close</span>
          </Dialog.Close>
        </div>
      </div>
      </div>
    </>
  );
}
