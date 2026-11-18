"use client";

import { useId, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { MAX_BACKUP_BYTES, diffProfiles } from "@/lib/backup";
import { profileToken } from "@/lib/revisions";
import type { ImportChoice, ImportPreview } from "@/lib/profile-repository";
import { useStore, type BackupRestoreController } from "@/lib/store";

export interface BackupRestorePanelProps {
  controller: BackupRestoreController;
  onImported?: () => void;
}
const descriptions = {
  new: "This profile identity is new to this browser.",
  same: "Already up to date: this profile has the same saved content.",
  newer: "The imported version is newer: its revision history contains this browser’s current revision.",
  older: "This backup is older: this browser’s history contains its revision. Replacing will restore older content.",
  conflict: "Conflict: both versions changed independently after a shared revision. Review the differences and choose which content to keep.",
  unknown: "Cannot reliably determine freshness. Revision history is missing, invalid, unrelated, or has been pruned. Review all differences before replacing.",
};

/** File transport only. All validation, comparisons and writes belong to the shared controller. */
export function BackupRestorePanel({ controller, onImported }: BackupRestorePanelProps) {
  const uid = useId();
  const [selected, setSelected] = useState(controller.activeId ?? "");
  const [preview, setPreview] = useState<ImportPreview | null>(null);
  const [source, setSource] = useState("");
  const [acknowledged, setAcknowledged] = useState(false);
  const [confirmed, setConfirmed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const sequence = useRef(0);
  const chosen = controller.users.some((p) => p.id === selected) ? selected : controller.users[0]?.id ?? "";
  const target = preview ? controller.users.find((p) => p.id === preview.backup.profile.id) : undefined;
  const stale = !!preview && profileToken(target) !== preview.targetToken;
  const snapshot = controller.undoSnapshot;
  const canUndo = !!snapshot && profileToken(controller.users.find((p) => p.id === snapshot.profileId)) === snapshot.afterToken;
  const warningsAccepted = !preview?.backup.warnings.length || acknowledged;
  async function review(text: string) {
    const request = ++sequence.current;
    setBusy(true); setError(null); setStatus(null); setPreview(null); setConfirmed(false); setAcknowledged(false);
    try { const next = await controller.previewBackup(text); if (request === sequence.current) { setPreview(next); setSource(text); } }
    catch (e) { if (request === sequence.current) setError(e instanceof Error ? e.message : "Could not read this backup."); }
    finally { if (request === sequence.current) setBusy(false); }
  }
  async function download() {
    setBusy(true); setError(null); setStatus(null);
    try {
      const text = await controller.downloadBackup(chosen);
      const url = URL.createObjectURL(new Blob([text], { type: "application/json" }));
      const link = document.createElement("a");
      link.href = url; link.download = `mabatid-${chosen.replace(/[^a-zA-Z0-9-]/g, "_")}.json`;
      document.body.append(link); link.click(); link.remove();
      window.setTimeout(() => URL.revokeObjectURL(url), 1000);
      setStatus("Backup download started. Keep the file somewhere private.");
    } catch (e) { setError(e instanceof Error ? e.message : "Could not download the backup."); }
    finally { setBusy(false); }
  }
  async function commit(choice: ImportChoice) {
    if (!preview) return;
    setBusy(true); setError(null); setStatus(null);
    try {
      const problem = await controller.commitBackup(preview, choice, { confirmed, acknowledged });
      if (problem) { setError(problem); setConfirmed(false); }
      else { setPreview(null); setSource(""); setStatus(choice === "replace" ? "Profile replaced and saved on this device. Its previous version is available below for undo." : "Profile imported and saved on this device."); onImported?.(); }
    } catch (e) { setError(e instanceof Error ? e.message : "Could not save the profile."); }
    finally { setBusy(false); }
  }
  return (
    <section aria-labelledby={`${uid}-title`} className="min-w-0 space-y-4 break-words rounded-2xl border border-border bg-card p-4">
      <h2 id={`${uid}-title`} className="text-lg font-semibold">Backup &amp; restore</h2>
      <p className="text-sm text-muted-foreground">Download a profile to a JSON file and import it on another device. Files are processed locally. Backups contain personal information and are not encrypted. They do not continuously synchronize devices.</p>
      {controller.users.length > 0 && <div className="space-y-2">
        <label htmlFor={`${uid}-profile`} className="block text-sm font-semibold">Profile to back up</label>
        <select id={`${uid}-profile`} value={chosen} onChange={(e) => setSelected(e.target.value)} disabled={busy} className="min-h-12 w-full min-w-0 rounded-xl border border-border bg-card px-3 text-sm">
          {controller.users.map((p) => <option key={p.id} value={p.id}>{p.name} · {p.id.slice(0, 8)}</option>)}
        </select>
        <Button type="button" variant="outline" onClick={download} disabled={busy || !chosen}>Download JSON backup</Button>
      </div>}
      <div className="space-y-2">
        <label htmlFor={`${uid}-file`} className="block text-sm font-semibold">Select a backup file</label>
        <input id={`${uid}-file`} type="file" accept=".json,application/json" disabled={busy} aria-describedby={`${uid}-limit`} className="block min-h-12 w-full min-w-0 max-w-full cursor-pointer rounded-xl border border-civic/25 bg-mist/30 p-3 text-sm text-muted-foreground file:mr-3 file:min-h-11 file:max-w-full file:cursor-pointer file:rounded-full file:border-0 file:bg-civic file:px-4 file:py-2 file:text-sm file:font-semibold file:whitespace-normal file:text-white hover:file:bg-navy disabled:cursor-not-allowed disabled:opacity-50" onChange={async (e) => {
          const file = e.target.files?.[0]; e.target.value = "";
          if (!file) return;
          setPreview(null); setStatus(null); setError(null);
          if (file.size > MAX_BACKUP_BYTES) { setError("Backup exceeds the 1 MiB file limit."); return; }
          setBusy(true);
          try { await review(await file.text()); }
          catch { setError("Could not read this file."); setBusy(false); }
        }} />
        <p id={`${uid}-limit`} className="text-xs text-muted-foreground">JSON files, up to 1 MiB. You can import before creating a profile. Selecting a file does not change saved profiles.</p>
      </div>
      {preview && <div aria-label="Import preview" className="space-y-4 border-t border-border pt-4">
        <h3 className="font-semibold">Import preview: {preview.backup.profile.name}</h3>
        <p className="break-all text-xs text-muted-foreground">Profile ID: {preview.backup.profile.id}</p>
        <p className="text-sm">Applicant age: {preview.backup.profile.age}. {preview.backup.profile.owned.length} owned IDs/documents.</p>
        <p className="text-xs text-muted-foreground">Exported {preview.backup.exportedAt}. This date does not indicate which version is newer.</p>
        <p role="status" className="text-sm font-semibold">{descriptions[preview.comparison]}</p>
        {preview.targetName && <p className="text-sm">Matching profile on this device: {preview.targetName}. Matching uses the permanent ID.</p>}
        <details className="text-sm" open={preview.comparison !== "same"}>
          <summary className="min-h-11 cursor-pointer py-2 font-semibold">{preview.comparison === "new" ? "Content to import" : `Changes (${preview.differences.length})`}</summary>
          <dl className="max-h-80 space-y-3 overflow-y-auto break-words">
            {(preview.comparison === "new" ? diffProfiles({ id: preview.backup.profile.id, name: "", age: 0, owned: [], createdAt: 0 }, preview.backup.profile) : preview.differences).map((d, i) => <div key={i} className="rounded-xl bg-muted p-3">
              <dt className="font-semibold">{d.label}</dt><dd className="mt-1">{preview.comparison !== "new" && <>On device: {d.before}<br /></>}From backup: {d.after}</dd>
            </div>)}
          </dl>
        </details>
        {preview.backup.warnings.length > 0 && <div className="space-y-3 rounded-xl bg-muted p-3 text-sm">
          <p className="font-semibold">Review before importing</p>
          <ul className="max-h-48 list-disc space-y-2 overflow-y-auto break-words pl-5">{preview.backup.warnings.map((w, i) => <li key={i}>{w}</li>)}</ul>
          <label className="flex min-h-11 items-start gap-3"><input type="checkbox" checked={acknowledged} onChange={(e) => setAcknowledged(e.target.checked)} disabled={busy || stale} className="mt-1 size-5 shrink-0" /><span>I understand these warnings and accept importing the sanitized profile.</span></label>
        </div>}
        {stale ? <div role="alert" className="space-y-2 text-sm"><p>The target profile changed after this preview. Review it again before importing.</p><Button type="button" variant="outline" onClick={() => review(source)} disabled={busy}>Review again</Button></div> : <>
          {preview.comparison !== "new" && preview.comparison !== "same" && <label className="flex min-h-11 items-start gap-3 text-sm"><input type="checkbox" checked={confirmed} onChange={(e) => setConfirmed(e.target.checked)} disabled={busy} className="mt-1 size-5 shrink-0" /><span>I confirm replacing “{preview.targetName}” with the content shown above. One previous replacement can be undone while that profile remains unchanged.</span></label>}
          <div className="flex flex-wrap gap-2">
            {preview.comparison === "new" ? <Button type="button" variant="brand" disabled={busy || !warningsAccepted} onClick={() => commit("new")}>Import as new profile</Button> : <>
              {preview.comparison !== "same" && <Button type="button" variant="brand" disabled={busy || !confirmed || !warningsAccepted} onClick={() => commit("replace")}>Replace existing profile</Button>}
              <Button type="button" variant="outline" disabled={busy || !warningsAccepted} onClick={() => commit("keep-both")}>Keep both</Button>
            </>}
          </div>
        </>}
        <Button type="button" variant="ghost" disabled={busy} onClick={() => { ++sequence.current; setPreview(null); setSource(""); setConfirmed(false); setAcknowledged(false); setError(null); }}>Cancel</Button>
      </div>}
      {snapshot && <div className="space-y-2 border-t border-border pt-4 text-sm">
        <p>Previous replacement: {snapshot.before.name}</p>
        <Button type="button" variant="outline" disabled={busy || !canUndo} onClick={async () => {
          setBusy(true); setError(null); setStatus(null);
          try { const problem = await controller.undoReplacement(snapshot.afterToken); if (problem) setError(problem); else { setStatus("Previous profile content restored and saved as a new revision."); setPreview(null); } }
          catch { setError("Could not undo the replacement."); }
          finally { setBusy(false); }
        }}>Undo last replacement</Button>
        {!canUndo && <p>Undo is disabled because this profile has changed since replacement. Later edits are protected.</p>}
      </div>}
      {busy && <p role="status" className="text-sm">Working…</p>}
      {error && <p role="alert" className="break-words text-sm text-destructive">{error}</p>}
      {status && <p role="status" className="text-sm font-semibold">{status}</p>}
    </section>
  );
}

/** Small app adapter; Settings can use this or pass an explicit controller to the panel. */
export function ProfileBackupRestore({ onImported }: { onImported?: () => void }) {
  return <BackupRestorePanel controller={useStore()} onImported={onImported} />;
}
