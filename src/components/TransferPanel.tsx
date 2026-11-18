"use client";

import { useEffect, useId, useRef, useState } from "react";
import { Check, Copy, Download, LoaderCircle, RefreshCw, Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useStore, type BackupRestoreController } from "@/lib/store";
import type { ImportChoice, ImportOptions, ImportPreview } from "@/lib/profile-repository";
import { CODE_LENGTH, TransferError, createTransferCode, finishTransfer, formatCode, normalizeCode, randomToken, redeemTransferCode, releaseTransfer, revokeTransfer, transferAvailable, validCode, validId, validToken, type TransferCode, type TransferClaim } from "@/lib/transfer";
import { ImportReview } from "./ImportReview";

const errorText = (e: unknown) => e instanceof Error ? e.message : "Could not complete this transfer.";
export function TransferPanel({ controller }: { controller: BackupRestoreController }) {
  const [available, setAvailable] = useState<boolean | null>(null);
  useEffect(() => { let live = true; void transferAvailable().then((value) => { if (live) setAvailable(value); }); return () => { live = false; }; }, []);
  return <section aria-label="Move to another device" className="space-y-4">
    <h2 className="text-lg font-semibold tracking-tight text-navy">Move to another device</h2>
    <p className="text-sm text-muted-foreground">Use a private, one-time code to copy a profile. This temporarily uploads an encrypted backup to our server and Supabase; our server can decrypt it. Codes expire after 10 minutes. There is no continuous synchronization. Anyone with the code can retrieve the backup, so share it privately.</p>
    {available === null ? <p role="status" className="text-sm">Checking code transfers…</p> : !available ? <div className="space-y-2 rounded-2xl bg-muted p-4 text-sm">
      <p role="status">Code transfers are unavailable right now. You can still use Backup &amp; restore above.</p>
      <Button type="button" variant="outline" size="md" onClick={async () => { setAvailable(null); setAvailable(await transferAvailable()); }}>Check again</Button>
    </div> : <div className="space-y-4">
      {controller.users.length > 0 && <SendCard controller={controller} />}
      <ReceiveCard controller={controller} />
    </div>}
  </section>;
}
function SendCard({ controller }: { controller: BackupRestoreController }) {
  const uid = useId();
  const [selected, setSelected] = useState(controller.activeId ?? controller.users[0]?.id ?? "");
  const [code, setCode] = useState<TransferCode | null>(null);
  const [busy, setBusy] = useState(false), [error, setError] = useState<string | null>(null), [copied, setCopied] = useState(false);
  const [remaining, setRemaining] = useState(0);
  const clock = useRef({ start: 0, duration: 0 });
  const pending = useRef<{ id: string; token: string; backup: string; profileId: string } | null>(null);
  const chosen = controller.users.some((p) => p.id === selected) ? selected : controller.users[0]?.id ?? "";
  useEffect(() => {
    if (!code) return;
    const timer = window.setInterval(() => setRemaining(Math.max(0,clock.current.duration-(performance.now()-clock.current.start))),1000);
    return () => window.clearInterval(timer);
  }, [code]);
  async function create() {
    setBusy(true); setError(null); setCopied(false);
    try {
      if (code) {
        try { await revokeTransfer(code.id,code.ownerToken); } catch (e) { if (!(e instanceof TransferError && e.kind === "not-found")) throw e; }
        setCode(null); pending.current = null;
      }
      if (!pending.current || pending.current.profileId !== chosen) pending.current = { id: crypto.randomUUID(), token: randomToken(), backup: await controller.downloadBackup(chosen), profileId: chosen };
      const request = pending.current;
      const result = await createTransferCode(request.backup,request.id,request.token);
      clock.current = { start: performance.now(), duration: result.remainingMs };
      setRemaining(result.remainingMs); setCode(result);
    } catch (e) { setError(errorText(e)); }
    finally { setBusy(false); }
  }
  return <div className="space-y-4 rounded-[24px] bg-card p-5 ring-1 ring-navy/[0.08]">
    <h3 className="flex items-center gap-2 font-semibold"><Send aria-hidden="true" className="size-5 text-civic" /> Send from this device</h3>
    <label className="block space-y-2 text-sm font-semibold" htmlFor={`${uid}-profile`}>Profile to send
      <select id={`${uid}-profile`} value={chosen} disabled={busy || !!code} onChange={(e) => { setSelected(e.target.value); pending.current = null; }} className="block min-h-12 w-full min-w-0 rounded-xl border border-border bg-card px-3 text-sm">
        {controller.users.map((p) => <option key={p.id} value={p.id}>{p.name} · {p.id.slice(0,8)}</option>)}
      </select>
    </label>
    {code && <div className="space-y-3 rounded-2xl bg-muted p-4 text-center" aria-live="polite">
      <p className="text-xs font-semibold uppercase text-muted-foreground">Your private code</p>
      <p className="break-all font-mono text-xl font-bold tracking-wider select-all">{formatCode(code.code)}</p>
      <p className="text-sm tabular-nums">{remaining > 0 ? `Expires in ${Math.floor(remaining/60000)}:${String(Math.floor(remaining/1000)%60).padStart(2,"0")}` : "This code has expired. Make a new one."}</p>
      <p className="text-xs text-muted-foreground">This is a snapshot. Edits made after generating this code are not included.</p>
    </div>}
    <div className="flex flex-wrap gap-2">
      {code && remaining > 0 && <Button type="button" variant="brand" size="md" disabled={busy} onClick={async () => { try { await navigator.clipboard.writeText(formatCode(code.code)); setCopied(true); } catch { setError("Could not copy. Select the code above to copy it manually."); } }}>{copied ? <Check aria-hidden="true" /> : <Copy aria-hidden="true" />}{copied ? "Copied" : "Copy code"}</Button>}
      <Button type="button" variant="cta" size="md" disabled={busy || !chosen} onClick={create}>{busy ? <LoaderCircle className="animate-spin" aria-hidden="true" /> : code ? <RefreshCw aria-hidden="true" /> : null}{busy ? "Making code…" : code ? "New code" : "Make a code"}</Button>
      {code && <Button type="button" variant="outline" size="md" disabled={busy} onClick={async () => { setBusy(true); setError(null); try { await revokeTransfer(code.id,code.ownerToken); setCode(null); pending.current = null; } catch (e) { if (e instanceof TransferError && e.kind === "not-found") { setCode(null); pending.current = null; } else setError(errorText(e)); } finally { setBusy(false); } }}>Cancel code</Button>}
    </div>
    {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
  </div>;
}
const PENDING_KEY = "mabatid.transfer.receive.v1";
interface Pending { code: string; claimToken: string; id?: string }
function remember(pending: Pending) {
  try { sessionStorage.setItem(PENDING_KEY,JSON.stringify(pending)); } catch { throw new TransferError("storage"); }
}
function ReceiveCard({ controller }: { controller: BackupRestoreController }) {
  const uid = useId();
  const [code, setCode] = useState("");
  const [pending, setPending] = useState<Pending | null>(null);
  const [claim, setClaim] = useState<TransferClaim | null>(null);
  const [preview, setPreview] = useState<ImportPreview | null>(null);
  const [busy, setBusy] = useState(false), [error, setError] = useState<string | null>(null), [status, setStatus] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const request = useRef<Pending | null>(null);
  useEffect(() => {
    let live = true;
    // Resume credentials only, never the personal payload, survive a reload in this tab.
    void Promise.resolve().then(() => {
      try {
        const raw = JSON.parse(sessionStorage.getItem(PENDING_KEY) ?? "null") as Pending | null;
        if (live && raw && validCode(raw.code) && validToken(raw.claimToken) && (!raw.id || validId(raw.id))) { request.current = raw; setPending(raw); setCode(raw.code); }
      } catch { /* A new receive attempt reports unavailable session storage explicitly. */ }
    });
    return () => { live = false; };
  }, []);
  const savedHere = saved || !!(pending?.id && controller.importReceipts?.[pending.id]);
  function clearPending() { try { sessionStorage.removeItem(PENDING_KEY); } catch { /* A stale completion credential cannot repeat a receipted import. */ } request.current = null; setPending(null); setClaim(null); setPreview(null); setCode(""); }
  async function acknowledge(value: Pending) {
    if (!value.id) return;
    try { await finishTransfer(value.id,value.claimToken); }
    catch (e) { if (!(e instanceof TransferError && e.kind === "not-found")) throw e; }
    clearPending(); setSaved(false); setStatus("Profile saved on this device. Transfer complete.");
  }
  async function receive() {
    setBusy(true); setError(null); setStatus(null); setPreview(null);
    let previouslySaved = false;
    try {
      const value = request.current ?? { code: normalizeCode(code), claimToken: randomToken() };
      if (!validCode(value.code)) throw new TransferError("invalid");
      remember(value); request.current = value; setPending(value);
      const result = await redeemTransferCode(value.code,value.claimToken);
      const next = { ...value, id: result.id }; remember(next); request.current = next; setPending(next); setClaim(result);
      if (controller.importReceipts?.[result.id]) { previouslySaved = true; setSaved(true); await acknowledge(next); return; }
      if (result.completed || !result.backup) throw new TransferError("not-found");
      setPreview(await controller.previewBackup(result.backup));
    } catch (e) { setError(previouslySaved ? "Your profile is already saved. Use Finish transfer to retry completion without importing again." : errorText(e)); }
    finally { setBusy(false); }
  }
  async function cancel() {
    setBusy(true); setError(null);
    try {
      let value = request.current;
      if (value) {
        if (!value.id) {
          try { const result = await redeemTransferCode(value.code,value.claimToken); value = { ...value, id: result.id }; } catch (e) { if (!(e instanceof TransferError && e.kind === "not-found")) throw e; }
        }
        if (value.id && !controller.importReceipts?.[value.id]) { try { await releaseTransfer(value.id,value.claimToken); } catch (e) { if (!(e instanceof TransferError && e.kind === "not-found")) throw e; } }
      }
      clearPending(); setStatus("Transfer review canceled. Saved profiles have not been changed.");
    } catch (e) { setError(errorText(e)); }
    finally { setBusy(false); }
  }
  async function commit(choice: ImportChoice, options: ImportOptions) {
    if (!preview || !claim || !request.current) return;
    setBusy(true); setError(null); let durable = false;
    const value = request.current;
    try {
      const verified = await redeemTransferCode(value.code,value.claimToken);
      if (verified.id !== claim.id || verified.completed) throw new TransferError("not-found");
      const problem = await controller.commitBackup(preview,choice,{ ...options, receipt: claim.id });
      if (problem) { setError(problem); return; }
      durable = true; setSaved(true); setPreview(null);
      await acknowledge(value);
    } catch (e) { setError(durable ? "Your profile is saved. Transfer completion could not be confirmed; use Finish transfer to retry without importing again." : errorText(e)); }
    finally { setBusy(false); }
  }
  return <div className="space-y-4 rounded-[24px] bg-card p-5 ring-1 ring-navy/[0.08]">
    <h3 className="flex items-center gap-2 font-semibold"><Download aria-hidden="true" className="size-5 text-civic" /> Get from another device</h3>
    {!preview && !savedHere && <form className="space-y-3" onSubmit={(e) => { e.preventDefault(); void receive(); }}>
      <label htmlFor={uid} className="block text-sm font-semibold">Transfer code</label>
      <input id={uid} value={formatCode(code)} onChange={(e) => { setCode(normalizeCode(e.target.value).slice(0,CODE_LENGTH)); setError(null); }} disabled={busy || !!pending} placeholder="XXXX-XXXX-XXXX" autoComplete="one-time-code" autoCapitalize="characters" spellCheck={false} maxLength={CODE_LENGTH+2} aria-invalid={!!error || undefined} className="min-h-12 w-full min-w-0 rounded-2xl border border-border bg-card px-3 text-center font-mono text-base font-semibold tracking-wider" />
      <Button type="submit" variant="brand" size="md" disabled={busy || !validCode(code)}>{busy ? "Getting backup…" : pending ? "Resume transfer" : "Review transfer"}</Button>
    </form>}
    {preview && <ImportReview key={preview.targetToken ?? "new"} preview={preview} users={controller.users} busy={busy} onReview={() => { void receive(); }} onCommit={commit} onCancel={() => { void cancel(); }} />}
    {savedHere && pending?.id && <div className="space-y-2"><p role="status" className="text-sm">Your profile has been saved locally.</p><Button type="button" variant="brand" size="md" disabled={busy} onClick={async () => { setBusy(true); setError(null); try { await acknowledge(pending); } catch { setError("Your profile is saved. Could not confirm completion; try again later."); } finally { setBusy(false); } }}>Finish transfer</Button></div>}
    {pending && !preview && !savedHere && <Button type="button" variant="ghost" size="md" disabled={busy} onClick={cancel}>Cancel transfer review</Button>}
    {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
    {status && <p role="status" className="text-sm font-semibold">{status}</p>}
  </div>;
}
export function ProfileTransfers() { return <TransferPanel controller={useStore()} />; }
