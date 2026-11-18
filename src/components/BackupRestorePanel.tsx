"use client";

import { useId, useRef, useState } from "react";
import { ImportReview } from "./ImportReview";
import { Button } from "@/components/ui/button";
import { MAX_BACKUP_BYTES } from "@/lib/backup";
import { profileToken } from "@/lib/revisions";
import type { ImportChoice, ImportPreview, ImportOptions } from "@/lib/profile-repository";
import { useStore, type BackupRestoreController } from "@/lib/store";

export interface BackupRestorePanelProps {
  controller: BackupRestoreController;
  onImported?: () => void;
}
/** File transport only. All validation, comparisons and writes belong to the shared controller. */
export function BackupRestorePanel({ controller, onImported }: BackupRestorePanelProps) {
  const uid = useId();
  const [selected, setSelected] = useState(controller.activeId ?? "");
  const [preview, setPreview] = useState<ImportPreview | null>(null);
  const [source, setSource] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const sequence = useRef(0);
  const chosen = controller.users.some((p) => p.id === selected) ? selected : controller.users[0]?.id ?? "";
  const snapshot = controller.undoSnapshot;
  const canUndo = !!snapshot && profileToken(controller.users.find((p) => p.id === snapshot.profileId)) === snapshot.afterToken;
  async function review(text: string) {
    const request = ++sequence.current;
    setBusy(true); setError(null); setStatus(null); setPreview(null);
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
  async function commit(choice: ImportChoice, options: ImportOptions) {
    if (!preview) return;
    setBusy(true); setError(null); setStatus(null);
    try {
      const problem = await controller.commitBackup(preview, choice, options);
      if (problem) { setError(problem); }
      else { setPreview(null); setSource(""); setStatus(choice === "same" ? "Profile already up to date. No data changed." : choice === "replace" ? "Profile replaced and saved on this device. Its previous version is available below for undo." : "Profile imported and saved on this device."); onImported?.(); }
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
      {preview && <ImportReview key={preview.targetToken ?? "new"} preview={preview} users={controller.users} busy={busy}
        onReview={() => { void review(source); }} onCommit={commit}
        onCancel={() => { ++sequence.current; setPreview(null); setSource(""); setError(null); }} />}
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
