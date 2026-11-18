"use client";

import { useEffect, useRef, useState, type CSSProperties, type PointerEvent } from "react";
import { Check, Mail } from "lucide-react";

/** GitHub mark (lucide v1 ships no brand icons). */
function GithubMark({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 16 16" fill="currentColor" aria-hidden="true" className={className}>
      <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0016 8c0-4.42-3.58-8-8-8z" />
    </svg>
  );
}

export interface TeamMember {
  lastName: string;
  givenNames: string;
  /** Shown on the back of the card. */
  title: string;
  contributions: string[];
  github: string;
  email: string;
  /** Image URL (a static import's .src). Falls back to initials if it fails to load. */
  photo: string;
  idNo: string;
}

export function githubHandle(url: string) {
  return url.replace(/^https?:\/\/(www\.)?github\.com\//, "").replace(/\/$/, "");
}

export { GithubMark };

/**
 * A team member "stored" in a valid-ID-style card: CR80 proportions (1.586:1), guilloche background,
 * holographic seal and a machine-readable strip. It is styled after an ID, not a copy of a government one.
 * The reverse side carries the member's title and what they built; the card flips in 3D to show it.
 *
 * Layers:  perspective → .id-tilt (pointer tilt) → .id-flip (rotateY 180° when flipped) → two .id-card faces.
 * The faces hide their backs (backface-visibility), and the face turned away is `inert`, so keyboard and
 * screen-reader users only ever reach the side that is showing.
 *
 * `onOpen` adds a card-sized button under the front's links (stretched-button pattern, so the links stay
 * their own targets). `zoomed` renders the enlarged copy (no entrance, no idle float); there `onFlip`
 * turns the card. `concealed` hides the original while its enlarged copy is open, keeping its space
 * (visibility, not opacity: the entrance animation's fill would override an opacity value).
 */
export function TeamIdCard({
  member,
  delay = 0,
  onOpen,
  onFlip,
  flipped = false,
  zoomed = false,
  concealed = false,
}: {
  member: TeamMember;
  delay?: number;
  onOpen?: (card: HTMLElement) => void;
  onFlip?: () => void;
  flipped?: boolean;
  zoomed?: boolean;
  concealed?: boolean;
}) {
  const tiltRef = useRef<HTMLDivElement>(null);
  const frontRef = useRef<HTMLDivElement>(null);
  const backRef = useRef<HTMLDivElement>(null);
  const [photoFailed, setPhotoFailed] = useState(false);

  // Flipping from the card itself makes the focused face inert (the browser drops focus); carry focus to
  // the flip control on the face now showing.
  const refocus = useRef(false);
  const flipFromCard = () => {
    refocus.current = true;
    onFlip?.();
  };
  useEffect(() => {
    if (!refocus.current) return;
    refocus.current = false;
    const shown = flipped ? backRef.current : frontRef.current;
    shown?.querySelector<HTMLElement>("button")?.focus({ preventScroll: true });
  }, [flipped]);
  const name = `${member.givenNames} ${member.lastName}`;
  const handle = githubHandle(member.github);
  const initials = `${member.givenNames[0] ?? ""}${member.lastName[0] ?? ""}`;
  const mrz = `MBT<${member.lastName}<<${member.givenNames.replace(/ /g, "<")}`
    .toUpperCase()
    .padEnd(44, "<")
    .slice(0, 44);

  function onMove(e: PointerEvent<HTMLDivElement>) {
    if (e.pointerType !== "mouse") return;
    const el = tiltRef.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    const px = (e.clientX - r.left) / r.width;
    const py = (e.clientY - r.top) / r.height;
    el.style.setProperty("--ry", `${(px - 0.5) * 14}deg`);
    el.style.setProperty("--rx", `${(0.5 - py) * 12}deg`);
    el.style.setProperty("--mx", `${px * 100}%`);
    el.style.setProperty("--my", `${py * 100}%`);
    el.dataset.tilting = "";
  }

  function onLeave() {
    const el = tiltRef.current;
    if (!el) return;
    el.style.setProperty("--rx", "0deg");
    el.style.setProperty("--ry", "0deg");
    delete el.dataset.tilting;
  }

  const frontAction = onOpen
    ? {
        label: `Enlarge ${name}'s ID card`,
        run: () => tiltRef.current && onOpen(tiltRef.current),
        cursor: "cursor-zoom-in",
      }
    : onFlip
      ? { label: `Flip ${name}'s card to see contributions`, run: flipFromCard, cursor: "cursor-pointer" }
      : null;

  return (
    <div
      className={zoomed ? "w-full" : "id-enter w-full max-w-[440px]"}
      style={{ "--d": `${delay}ms`, visibility: concealed ? "hidden" : undefined } as CSSProperties}
    >
      <div
        className={zoomed ? "[perspective:1400px]" : "id-float"}
        style={{ "--float-delay": `${-delay * 4}ms` } as CSSProperties}
      >
        <div
          ref={tiltRef}
          onPointerMove={onMove}
          onPointerLeave={onLeave}
          className="id-tilt relative aspect-[1.586] w-full"
        >
          <div className="id-flip absolute inset-0" data-flipped={flipped || undefined}>
            {/* ---------------- Front ---------------- */}
            <div
              ref={frontRef}
              className="id-card @container absolute inset-0 overflow-hidden rounded-[18px] text-navy"
              inert={flipped}
            >
              {frontAction && (
                <button
                  type="button"
                  onClick={frontAction.run}
                  aria-label={frontAction.label}
                  className={`absolute inset-0 z-[1] rounded-[18px] focus-visible:outline-offset-[-4px] ${frontAction.cursor}`}
                />
              )}
              <div className="flex items-center justify-between gap-2 bg-civic px-[4.5%] py-[2.2%] text-white">
                <span className="text-[max(9px,2.7cqw)] font-bold uppercase tracking-[0.14em]">
                  MabatID · Team Card
                </span>
                <span className="font-mono text-[max(9px,2.5cqw)] tracking-wider text-white/85">
                  {member.idNo}
                </span>
              </div>

              <div className="flex gap-[4.5%] px-[4.5%] pt-[4%]">
                <div className="relative aspect-[4/5] w-[28%] shrink-0 overflow-hidden rounded-lg bg-mist/50 ring-1 ring-navy/10">
                  {photoFailed ? (
                    <span className="grid h-full place-items-center text-[7cqw] font-extrabold text-civic">
                      {initials}
                    </span>
                  ) : (
                    // eslint-disable-next-line @next/next/no-img-element -- small static portrait, same pattern as the renders
                    <img
                      src={member.photo}
                      alt={`Photo of ${name}`}
                      draggable={false}
                      decoding="async"
                      onError={() => setPhotoFailed(true)}
                      className="h-full w-full select-none object-cover object-top"
                    />
                  )}
                </div>

                <dl className="flex min-w-0 flex-1 flex-col gap-[1.2cqw]">
                  <Field label="Last name" value={member.lastName} />
                  <Field label="Given names" value={member.givenNames} />
                  <div>
                    <dt className="id-label">GitHub</dt>
                    <dd>
                      <a href={member.github} target="_blank" rel="noopener noreferrer" className="id-link">
                        <GithubMark className="size-[1.1em] shrink-0" />
                        <span className="truncate">{handle}</span>
                        <span className="sr-only"> (GitHub, opens in a new tab)</span>
                      </a>
                    </dd>
                  </div>
                  <div>
                    <dt className="id-label">Email</dt>
                    <dd>
                      <a href={`mailto:${member.email}`} className="id-link">
                        <Mail className="size-[1.1em] shrink-0" aria-hidden="true" />
                        <span className="truncate">{member.email}</span>
                      </a>
                    </dd>
                  </div>
                </dl>
              </div>

              <span aria-hidden="true" className="id-holo absolute right-[4.5%] top-[22%] size-[13%]" />
              <p
                aria-hidden="true"
                className="absolute inset-x-0 bottom-0 truncate bg-navy/[0.04] px-[4.5%] py-[2%] font-mono text-[max(8px,2.3cqw)] tracking-[0.18em] text-navy/55"
              >
                {mrz}
              </p>
              <span aria-hidden="true" className="id-sheen pointer-events-none absolute inset-0" />
            </div>

            {/* ---------------- Back ---------------- */}
            <div
              ref={backRef}
              className="id-card id-card-back @container absolute inset-0 overflow-hidden rounded-[18px] text-navy"
              inert={!flipped}
            >
              {onFlip && (
                <button
                  type="button"
                  onClick={flipFromCard}
                  aria-label={`Flip ${name}'s card to the front`}
                  className="absolute inset-0 z-[1] cursor-pointer rounded-[18px] focus-visible:outline-offset-[-4px]"
                />
              )}
              <div className="flex items-center justify-between gap-2 bg-navy px-[4.5%] py-[2.2%] text-white">
                <span className="text-[max(9px,2.7cqw)] font-bold uppercase tracking-[0.14em]">
                  Contributions
                </span>
                <span className="font-mono text-[max(9px,2.5cqw)] tracking-wider text-white/75">
                  {member.idNo}
                </span>
              </div>

              <div className="px-[5%] pt-[3.5%]">
                <p className="id-label">Title</p>
                <p className="text-[max(13px,4.4cqw)] font-extrabold leading-tight tracking-tight text-civic">
                  {member.title}
                </p>
                <ul className="mt-[2.5cqw] flex flex-col gap-[1.1cqw]">
                  {member.contributions.map((c) => (
                    <li key={c} className="flex items-start gap-[1.6cqw] text-[max(10px,2.9cqw)] font-medium leading-snug">
                      <span
                        aria-hidden="true"
                        className="mt-[0.15em] grid size-[1.15em] shrink-0 place-items-center rounded-full bg-amber text-navy"
                      >
                        <Check className="size-[0.75em]" strokeWidth={3.5} />
                      </span>
                      <span>{c}</span>
                    </li>
                  ))}
                </ul>
              </div>

              <p
                aria-hidden="true"
                className="absolute inset-x-0 bottom-0 flex justify-between gap-2 bg-navy/[0.04] px-[4.5%] py-[2%] font-mono text-[max(8px,2.3cqw)] tracking-[0.14em] text-navy/55"
              >
                <span className="truncate">BUILT FOR MABATID</span>
                <span className="shrink-0">{name.toUpperCase()}</span>
              </p>
              <span aria-hidden="true" className="id-sheen pointer-events-none absolute inset-0" />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0">
      <dt className="id-label">{label}</dt>
      <dd className="truncate text-[max(12px,4cqw)] font-extrabold uppercase leading-tight tracking-tight">{value}</dd>
    </div>
  );
}
