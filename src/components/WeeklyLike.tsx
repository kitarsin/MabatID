"use client";

import { useEffect, useRef, useState, type CSSProperties } from "react";
import { Heart } from "lucide-react";
import { fetchLikes, sendLike, type LikeTally } from "@/lib/likes";

const BURST = [0, 45, 90, 135, 180, 225, 270, 315];

/** The same browser cookie and weekly allowance are used in every placement. */
export function WeeklyLike({ compact = false }: { compact?: boolean }) {
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
    <div role="group" aria-label="Weekly likes" className={compact
      ? "flex flex-col gap-3 rounded-2xl bg-mist/30 p-4 ring-1 ring-sky/25"
      : "mx-auto flex w-full max-w-md flex-col items-center gap-6 rounded-[32px] bg-white/85 px-6 py-10 text-center shadow-[0_1px_2px_rgb(27_54_93/0.05),0_30px_60px_-34px_rgb(27_54_93/0.4)] ring-1 ring-navy/5 hero:py-12"}>
      <div className={compact ? "flex items-center gap-4" : "contents"}>
        <div className="relative grid shrink-0 place-items-center">
          {burst > 0 && (
            <span key={burst} aria-hidden="true" className="pointer-events-none absolute inset-0 grid place-items-center">
              {BURST.map((angle) => (
                <span key={angle} className="like-particle" style={{ "--a": `${angle}deg` } as CSSProperties} />
              ))}
            </span>
          )}
          <button type="button" onClick={like} disabled={loading || sending || liked}
            aria-pressed={liked} aria-label="Like MabatID"
            className={`relative grid place-items-center rounded-full transition-[background-color,box-shadow,scale] duration-[var(--dur-base)] ease-[var(--ease-out)] active:scale-[0.94] active:duration-[var(--dur-press)] ${compact ? "size-16" : "size-28"} ${liked
              ? "cursor-default bg-amber text-navy shadow-[0_14px_30px_-12px_color-mix(in_srgb,var(--color-amber)_90%,transparent)]"
              : "bg-white text-civic shadow-[0_1px_2px_rgb(27_54_93/0.08),0_14px_30px_-16px_rgb(27_54_93/0.45)] ring-2 ring-civic/20 hover:ring-civic/40"}`}>
            <Heart key={`h${burst}`} className={`${compact ? "size-7" : "size-12"} ${burst > 0 ? "heart-pop" : ""}`}
              fill={liked ? "currentColor" : "none"} strokeWidth={2.2} aria-hidden="true" />
          </button>
        </div>
        <div className={compact ? "flex min-w-0 flex-col gap-1" : "flex min-h-[4.5rem] flex-col items-center gap-1"}>
          <p className={`${compact ? "text-3xl" : "text-4xl"} font-extrabold tabular-nums tracking-tight text-navy`}>
            {loading ? (
              <span className="inline-block h-9 w-14 animate-pulse rounded-lg bg-navy/[0.06] align-middle" />
            ) : count === null ? (
              <span className="text-2xl text-muted-foreground">—</span>
            ) : (
              <span key={count} className="count-tick inline-block">{count.toLocaleString("en-PH")}</span>
            )}
          </p>
          <p className="text-sm font-medium text-muted-foreground">
            {count === null && !loading ? "Like count unavailable right now" : "likes this week"}
          </p>
        </div>
      </div>
      <p aria-live="polite" className={`min-h-5 text-sm ${error ? "font-semibold text-destructive" : "text-muted-foreground"}`}>
        {error ?? (liked ? `Thanks! You can like again on ${again}.` : "Tap the heart to send a like.")}
      </p>
      <p className={`${compact ? "" : "-mt-3 "}text-xs leading-relaxed text-muted-foreground`}>One like per browser each week. Resets Monday, 12:00 AM Philippine time.</p>
    </div>
  );
}
