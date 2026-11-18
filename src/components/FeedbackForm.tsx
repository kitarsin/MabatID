"use client";

import { useId, useRef, useState, type FormEvent } from "react";
import { MessageSquareText, Star } from "lucide-react";
import { Button } from "./ui/button";
import { useStore } from "@/lib/store";
import { fetchLikes } from "@/lib/likes";
import { FEEDBACK_MAX_LENGTH, FEEDBACK_MIN_LENGTH } from "@/lib/engagement/protocol";
import { WeeklyLike } from "./WeeklyLike";

/** The local-profile gate is a UX restriction, not server authentication. */
export function FeedbackForm({ onOpenProfile, showLike = false }: { onOpenProfile: () => void; showLike?: boolean }) {
  const { me } = useStore();
  // Reset drafts when switching local profiles so one visitor never submits another's draft.
  return me?.onboarded ? <ProfileFeedback key={me.id} showLike={showLike} /> : (
    <aside aria-label="Written feedback" className="rounded-3xl bg-mist/35 p-5 text-left ring-1 ring-sky/25">
      {showLike && <div className="mb-5"><WeeklyLike compact /></div>}
      <MessageSquareText className="mb-3 size-5 text-civic" aria-hidden="true" />
      <p className="font-semibold text-navy">Want to share feedback?</p>
      <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
        Open a device profile and finish your checklist setup first. You can then leave a rating and feedback in Settings.
      </p>
      <Button type="button" onClick={onOpenProfile} variant="outline" size="md" className="mt-4">Open device profile</Button>
    </aside>
  );
}

function ProfileFeedback({ showLike }: { showLike: boolean }) {
  const id = useId();
  const [message, setMessage] = useState("");
  const [rating, setRating] = useState<number | null>(null);
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const busy = useRef(false);
  const pending = useRef<{ id: string; message: string; rating: number | null } | null>(null);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy.current) return;
    const trimmed = message.trim();
    if (trimmed.length < FEEDBACK_MIN_LENGTH || trimmed.length > FEEDBACK_MAX_LENGTH) {
      setError(`Write between ${FEEDBACK_MIN_LENGTH} and ${FEEDBACK_MAX_LENGTH.toLocaleString()} characters.`);
      return;
    }
    busy.current = true;
    setSending(true);
    setError(null);
    try {
      // Settings can be opened without ever visiting the landing likes section.
      await fetchLikes().catch(() => { throw new Error("Feedback is unavailable right now. Your draft is still here; please try again."); });
      if (!pending.current || pending.current.message !== trimmed || pending.current.rating !== rating) {
        pending.current = { id: crypto.randomUUID(), message: trimmed, rating };
      }
      const res = await fetch("/api/feedback", {
        method: "POST", credentials: "same-origin", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ submissionId: pending.current.id, message: trimmed, rating }),
      });
      const body = await res.json().catch(() => null);
      if (res.status === 429) throw new Error("You've reached the submission limit. Please try again in an hour.");
      if (res.status === 428) throw new Error("Allow cookies and try again to send feedback.");
      if (!res.ok || body?.ok !== true) throw new Error("Couldn't send your feedback. Your draft is still here; please try again.");
      setSent(true);
      setMessage("");
      setRating(null);
      pending.current = null;
    } catch (error) {
      setError(error instanceof Error ? error.message : "Couldn't send your feedback. Please try again.");
    } finally { busy.current = false; setSending(false); }
  }

  return (
    <section aria-labelledby={`${id}-heading`} className="rounded-3xl bg-white/85 p-5 text-left shadow-sm ring-1 ring-navy/10 sm:p-6">
      <div className="mb-2 flex items-center gap-2 text-navy">
        <MessageSquareText className="size-5 text-civic" aria-hidden="true" />
        <h2 id={`${id}-heading`} className="text-lg font-semibold">Rating & feedback</h2>
      </div>
      <p className="text-sm leading-relaxed text-muted-foreground">Tell us what helped and what we can improve. Your feedback is private to the MabatID team.</p>
      {showLike && <div className="mt-5"><WeeklyLike compact /></div>}
      {sent ? (
        <p role="status" className="mt-5 rounded-2xl bg-mist/40 p-4 text-sm font-semibold text-navy">Thanks! Your feedback has been sent to the team.</p>
      ) : (
        <form onSubmit={submit} className="mt-5 space-y-5">
          <fieldset disabled={sending}>
            <legend className="text-sm font-semibold text-navy">Your rating <span className="font-normal text-muted-foreground">(optional)</span></legend>
            <div className="mt-2 flex flex-wrap items-center gap-1">
              {[1, 2, 3, 4, 5].map((value) => (
                <label key={value} className="relative grid size-11 cursor-pointer place-items-center rounded-xl has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-civic hover:bg-amber/10">
                  <input className="peer sr-only" type="radio" name={`${id}-rating`} value={value} checked={rating === value} onChange={() => setRating(value)} aria-label={`${value} ${value === 1 ? "star" : "stars"}`} />
                  <Star aria-hidden="true" className={`size-7 ${rating !== null && value <= rating ? "fill-amber text-navy" : "text-navy/35"}`} strokeWidth={1.6} />
                </label>
              ))}
              {rating !== null && <button type="button" onClick={() => setRating(null)} className="min-h-11 px-2 text-sm font-medium text-civic underline underline-offset-4">Clear</button>}
            </div>
          </fieldset>
          <div>
            <label htmlFor={`${id}-message`} className="text-sm font-semibold text-navy">Your feedback</label>
            <textarea id={`${id}-message`} value={message} onChange={(event) => setMessage(event.target.value)} required minLength={FEEDBACK_MIN_LENGTH} maxLength={FEEDBACK_MAX_LENGTH} rows={5} disabled={sending}
              aria-describedby={`${id}-hint ${id}-length${error ? ` ${id}-error` : ""}`}
              className="mt-2 block w-full resize-y rounded-2xl border border-navy/15 bg-white px-4 py-3 text-base text-navy placeholder:text-muted-foreground disabled:opacity-60"
              placeholder="What worked well? What could be easier?" />
            <p id={`${id}-hint`} className="mt-2 text-xs leading-relaxed text-muted-foreground">At least 10 characters. Please leave out ID numbers, document details and other personal information.</p>
            <p id={`${id}-length`} className="mt-1 text-right text-xs tabular-nums text-muted-foreground">{message.length.toLocaleString()} / {FEEDBACK_MAX_LENGTH.toLocaleString()}</p>
          </div>
          {error && <p id={`${id}-error`} role="alert" className="text-sm font-medium text-destructive">{error}</p>}
          <Button type="submit" variant="brand" size="md" disabled={sending} className="w-full">{sending ? "Sending…" : "Send feedback"}</Button>
        </form>
      )}
    </section>
  );
}
