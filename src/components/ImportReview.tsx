"use client";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { diffProfiles } from "@/lib/backup";
import { profileToken } from "@/lib/revisions";
import type { User } from "@/lib/profile";
import type { ImportPreview, ImportChoice, ImportOptions } from "@/lib/profile-repository";
const descriptions = {
  new: "This profile identity is new to this browser.",
  same: "Already up to date: this profile has the same saved content.",
  newer: "The imported version is newer: its revision history contains this browser’s current revision.",
  older: "This backup is older: this browser’s history contains its revision. Replacing will restore older content.",
  conflict: "Conflict: both versions changed independently after a shared revision. Review the differences and choose which content to keep.",
  unknown: "Cannot reliably determine freshness. Revision history is missing, invalid, unrelated, or has been pruned. Review all differences before replacing.",
};
/** The same preview and explicit decisions for files and transfer codes. */
export function ImportReview({ preview, users, busy, onReview, onCommit, onCancel }: {
  preview: ImportPreview;
  users: User[];
  busy: boolean;
  onReview: () => void;
  onCommit: (choice: ImportChoice, options: ImportOptions) => void;
  onCancel: () => void;
}) {
  const [confirmed, setConfirmed] = useState(false);
  const [acknowledged, setAcknowledged] = useState(false);
  const target = users.find((p) => p.id === preview.backup.profile.id);
  const stale = profileToken(target) !== preview.targetToken;
  const warningsAccepted = !preview.backup.warnings.length || acknowledged;
  return (
    <div aria-label="Import preview" className="space-y-4 border-t border-border pt-4">
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
        {stale ? <div role="alert" className="space-y-2 text-sm"><p>The target profile changed after this preview. Review it again before importing.</p><Button type="button" variant="outline" onClick={onReview} disabled={busy}>Review again</Button></div> : <>
          {preview.comparison !== "new" && preview.comparison !== "same" && <label className="flex min-h-11 items-start gap-3 text-sm"><input type="checkbox" checked={confirmed} onChange={(e) => setConfirmed(e.target.checked)} disabled={busy} className="mt-1 size-5 shrink-0" /><span>I confirm replacing “{preview.targetName}” with the content shown above. One previous replacement can be undone while that profile remains unchanged.</span></label>}
          <div className="flex flex-wrap gap-2">
            {preview.comparison === "new" ? <Button type="button" variant="brand" disabled={busy || !warningsAccepted} onClick={() => onCommit("new", { confirmed, acknowledged })}>Import as new profile</Button> : <>
              {preview.comparison === "same" && <Button type="button" variant="brand" disabled={busy || !warningsAccepted} onClick={() => onCommit("same", { confirmed, acknowledged })}>Keep current profile</Button>}
              {preview.comparison !== "same" && <Button type="button" variant="brand" disabled={busy || !confirmed || !warningsAccepted} onClick={() => onCommit("replace", { confirmed, acknowledged })}>Replace existing profile</Button>}
              <Button type="button" variant="outline" disabled={busy || !warningsAccepted} onClick={() => onCommit("keep-both", { confirmed, acknowledged })}>Keep both</Button>
            </>}
          </div>
        </>}
        <Button type="button" variant="ghost" disabled={busy} onClick={onCancel}>Cancel</Button>
      </div>
  );
}
