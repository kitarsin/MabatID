"use client";

import { useEffect, useId, useState } from "react";
import {
  Check,
  Copy,
  Download,
  LoaderCircle,
  RefreshCw,
  Send,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Disclosure } from "@/components/ui/disclosure";
import { Pill } from "@/components/ui/pill";
import type { User } from "@/lib/profile";
import {
  buildPayload,
  CODE_LENGTH,
  createTransferCode,
  formatCode,
  normalizeCode,
  redeemTransferCode,
  TRANSFER_CONNECTED,
  TransferError,
  type TransferCode,
  type TransferErrorKind,
} from "@/lib/transfer";

const ERRORS: Record<TransferErrorKind, string> = {
  "not-connected": "Transfers aren’t switched on yet. Please try again later.",
  invalid: `Enter all ${CODE_LENGTH} characters.`,
  "not-found": "We couldn’t find that code. Check it and try again.",
  expired: "This code has expired. Make a new one on your other device.",
  network: "Can’t connect right now. Check your internet and try again.",
};
const errorText = (e: unknown) =>
  e instanceof TransferError ? ERRORS[e.kind] : ERRORS.network;

/** Move a profile between devices with a short one-time code. UI only; see src/lib/transfer.ts. */
export function TransferPanel({
  me,
  onImport,
}: {
  me: User | null;
  onImport: (profile: unknown) => string | null;
}) {
  return (
    <section aria-labelledby="transfer">
      <div className="flex flex-wrap items-center gap-2">
        <h2
          id="transfer"
          className="flex-1 text-lg font-semibold tracking-tight text-navy"
        >
          Move to another device
        </h2>
        {!TRANSFER_CONNECTED && <Pill tone="muted">Preview · not connected yet</Pill>}
      </div>
      <p className="mt-1.5 text-[15px] leading-relaxed text-muted-foreground">
        Use a one-time code to copy everything to a new phone or computer.
      </p>
      <div className="mt-5 space-y-3">
        {me && <SendCard me={me} />}
        <ReceiveCard onImport={onImport} hasProfile={!!me} />
      </div>
    </section>
  );
}

function SendCard({ me }: { me: User }) {
  const [state, setState] = useState<
    | { s: "idle" }
    | { s: "loading" }
    | { s: "ready"; code: TransferCode }
    | { s: "error"; message: string }
  >({ s: "idle" });
  const [now, setNow] = useState(() => Date.now());
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (state.s !== "ready") return;
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, [state.s]);

  const create = async () => {
    setState({ s: "loading" });
    setCopied(false);
    try {
      const code = await createTransferCode(buildPayload(me));
      setNow(Date.now());
      setState({ s: "ready", code });
    } catch (e) {
      setState({ s: "error", message: errorText(e) });
    }
  };

  const left =
    state.s === "ready" ? Math.max(0, state.code.expiresAt - now) : 0;
  const expired = state.s === "ready" && left === 0;
  const mm = Math.floor(left / 60000);
  const ss = String(Math.floor((left % 60000) / 1000)).padStart(2, "0");

  return (
    <div className="rounded-[24px] bg-card p-5 ring-1 ring-navy/[0.08]">
      <div className="flex items-start gap-3">
        <span className="grid size-10 shrink-0 place-items-center rounded-full bg-mist/60 text-civic">
          <Send className="size-5" aria-hidden="true" />
        </span>
        <div className="min-w-0">
          <p className="font-semibold text-navy">Send from this device</p>
          <p className="mt-0.5 text-sm leading-relaxed text-muted-foreground">
            Make a code, then type it on your new device.
          </p>
        </div>
      </div>

      {state.s === "ready" ? (
        <div className="mt-5" aria-live="polite">
          <div
            className={`rounded-[20px] bg-navy/[0.04] px-4 py-5 text-center ring-1 ring-navy/[0.06] transition-opacity duration-[var(--dur-base)] ${expired ? "opacity-50" : ""}`}
          >
            <p className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">
              Your code
            </p>
            <p
              className="mt-2 font-mono text-[32px] leading-none font-semibold tracking-[0.12em] text-navy tabular-nums select-all"
              aria-label={state.code.code.split("").join(" ")}
            >
              {formatCode(state.code.code)}
            </p>
            <p className="mt-3 text-sm text-muted-foreground tabular-nums">
              {expired ? "This code has expired." : `Expires in ${mm}:${ss}`}
            </p>
          </div>
          <div className="mt-3 flex flex-wrap gap-2">
            {!expired && (
              <Button
                type="button"
                variant="brand"
                size="md"
                onClick={async () => {
                  try {
                    await navigator.clipboard.writeText(state.code.code);
                    setCopied(true);
                  } catch {
                    setCopied(false);
                  }
                }}
              >
                {copied ? (
                  <Check className="size-4" aria-hidden="true" />
                ) : (
                  <Copy className="size-4" aria-hidden="true" />
                )}
                {copied ? "Copied" : "Copy code"}
              </Button>
            )}
            <Button type="button" variant="outline" size="md" onClick={create}>
              <RefreshCw className="size-4" aria-hidden="true" />
              New code
            </Button>
          </div>
          {!TRANSFER_CONNECTED && (
            <p className="mt-3 text-xs leading-relaxed text-muted-foreground">
              This is a sample code for preview. It won’t work until transfers
              are switched on.
            </p>
          )}
        </div>
      ) : (
        <div className="mt-5 space-y-3">
          <Button
            type="button"
            variant="cta"
            size="md"
            onClick={create}
            disabled={state.s === "loading"}
          >
            {state.s === "loading" ? (
              <LoaderCircle className="size-4 animate-spin" aria-hidden="true" />
            ) : null}
            {state.s === "loading" ? "Making your code…" : "Make a code"}
          </Button>
          {state.s === "error" && (
            <p role="alert" className="text-sm text-destructive">
              {state.message}
            </p>
          )}
        </div>
      )}

      <Disclosure variant="inline" summary="What gets copied" className="mt-3">
        <ul className="list-disc space-y-1 pl-5 text-sm leading-relaxed text-muted-foreground">
          <li>Your name, age and answers</li>
          <li>IDs and documents you have</li>
          <li>Budget and how you like to apply</li>
          <li>Checklist ticks and chosen routes (your plans)</li>
          <li>What you’re tracking and your priority</li>
        </ul>
        <p className="mt-2 text-xs leading-relaxed text-muted-foreground">
          The code works once and expires after 10 minutes. Don’t share it with
          anyone.
        </p>
      </Disclosure>
    </div>
  );
}

function ReceiveCard({
  onImport,
  hasProfile,
}: {
  onImport: (profile: unknown) => string | null;
  hasProfile: boolean;
}) {
  const id = useId();
  const [code, setCode] = useState("");
  const [step, setStep] = useState<"enter" | "confirm" | "loading" | "done">(
    "enter",
  );
  const [error, setError] = useState<string | null>(null);
  const complete = code.length === CODE_LENGTH;

  const redeem = async () => {
    setStep("loading");
    setError(null);
    try {
      const payload = await redeemTransferCode(code);
      const problem = onImport(payload.profile);
      if (problem) {
        setError(problem);
        setStep("enter");
      } else setStep("done");
    } catch (e) {
      setError(errorText(e));
      setStep("enter");
    }
  };

  return (
    <div className="rounded-[24px] bg-card p-5 ring-1 ring-navy/[0.08]">
      <div className="flex items-start gap-3">
        <span className="grid size-10 shrink-0 place-items-center rounded-full bg-mist/60 text-civic">
          <Download className="size-5" aria-hidden="true" />
        </span>
        <div className="min-w-0">
          <p className="font-semibold text-navy">Get from another device</p>
          <p className="mt-0.5 text-sm leading-relaxed text-muted-foreground">
            Type the code shown on your old device.
          </p>
        </div>
      </div>

      {step === "done" ? (
        <p
          role="status"
          className="mt-5 flex items-center gap-2 rounded-2xl bg-mist/50 px-4 py-3 text-sm font-semibold text-navy"
        >
          <Check className="size-4" strokeWidth={3} aria-hidden="true" />
          All set — your profile is on this device now.
        </p>
      ) : (
        <form
          className="mt-5 space-y-3"
          onSubmit={(e) => {
            e.preventDefault();
            if (!complete) return setError(ERRORS.invalid);
            setStep("confirm");
          }}
        >
          <label htmlFor={id} className="sr-only">
            Transfer code
          </label>
          <input
            id={id}
            value={formatCode(code)}
            onChange={(e) => {
              setCode(normalizeCode(e.target.value));
              setError(null);
              if (step === "confirm") setStep("enter");
            }}
            placeholder="XXXX-XXXX"
            inputMode="text"
            autoCapitalize="characters"
            autoComplete="one-time-code"
            spellCheck={false}
            maxLength={CODE_LENGTH + 1}
            aria-invalid={!!error || undefined}
            aria-describedby={error ? `${id}-error` : undefined}
            disabled={step === "loading"}
            className="h-14 w-full rounded-2xl border border-navy/15 bg-white px-4 text-center font-mono text-2xl font-semibold tracking-[0.12em] text-navy uppercase placeholder:text-navy/20 focus-visible:border-civic"
          />
          {error && (
            <p id={`${id}-error`} role="alert" className="text-sm text-destructive">
              {error}
            </p>
          )}

          {step === "confirm" || step === "loading" ? (
            <div className="space-y-3 rounded-2xl bg-amber/15 p-4">
              <p className="text-sm leading-relaxed text-navy">
                {hasProfile
                  ? "This adds the transferred profile to this device and switches to it. Your current profile stays saved."
                  : "This adds the transferred profile to this device and opens it."}
              </p>
              <div className="flex flex-wrap gap-2">
                <Button
                  type="button"
                  variant="cta"
                  size="md"
                  onClick={redeem}
                  disabled={step === "loading"}
                >
                  {step === "loading" && (
                    <LoaderCircle className="size-4 animate-spin" aria-hidden="true" />
                  )}
                  {step === "loading" ? "Getting your data…" : "Yes, bring it over"}
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="md"
                  onClick={() => setStep("enter")}
                  disabled={step === "loading"}
                >
                  Cancel
                </Button>
              </div>
            </div>
          ) : (
            <Button type="submit" variant="brand" size="md" disabled={!complete}>
              Continue
            </Button>
          )}
        </form>
      )}
    </div>
  );
}
