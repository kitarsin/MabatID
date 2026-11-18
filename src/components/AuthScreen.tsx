"use client";

import { useState, type FormEvent } from "react";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useStore } from "@/lib/store";
import { Logo } from "./Logo";
import { ProfileBackupRestore } from "./BackupRestorePanel";

type FieldName = "name" | "age";

/** Deliberately credential-free until server authentication is connected. */
export function AuthScreen({
  onBack,
  onDone,
}: {
  onBack: () => void;
  onDone: () => void;
}) {
  const { users, createProfile, selectProfile } = useStore();
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [errorField, setErrorField] = useState<FieldName | null>(null);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (saving) return;
    const form = new FormData(event.currentTarget);
    setSaving(true);
    const error = await createProfile({
      name: String(form.get("name") ?? ""),
      age: Number(form.get("age")),
    });
    setSaving(false);
    setError(error);
    if (error) {
      // The store reports one message per problem ("Enter a name…" / "Enter an age…"); mark that field and focus it.
      const field: FieldName | null = /\bage\b/i.test(error) ? "age" : /\bname\b/i.test(error) ? "name" : null;
      setErrorField(field);
      if (field) document.getElementById(field)?.focus();
    } else {
      setErrorField(null);
      onDone();
    }
  }
  const invalid = (field: FieldName) => (errorField === field ? true : undefined);
  const describedBy = (field: FieldName, hintId?: string) =>
    [hintId, errorField === field ? "auth-error" : undefined]
      .filter(Boolean)
      .join(" ") || undefined;
  return (
    <main
      id="main"
      tabIndex={-1}
      className="mx-auto flex min-h-dvh w-full max-w-md flex-col px-6 pb-10 pt-6 outline-none"
    >
      <Button
        type="button"
        variant="ghost"
        size="md"
        onClick={onBack}
        className="-ml-3 mb-4 w-fit text-civic"
      >
        <ArrowLeft className="size-4" aria-hidden="true" /> Back
      </Button>
      <Logo dark />
      <h1 className="mt-6 text-2xl font-bold leading-tight tracking-tight">
        Your profile on this device
      </h1>
      <p className="mt-2 text-sm text-muted-foreground">
        Save your ID checklist in this browser. Profiles have no password
        protection; anyone using this browser can open them. They do not sync
        across devices.
      </p>
      {users.length > 0 && (
        <section className="mt-6 space-y-2" aria-label="Saved device profiles">
          <h2 className="font-bold">Continue a profile</h2>
          {users.map((user) => (
            <Button
              key={user.id}
              variant="outline"
              className="h-auto min-h-12 w-full justify-start whitespace-normal break-words text-left"
              disabled={saving}
              onClick={async () => {
                setSaving(true);
                const problem = await selectProfile(user.id);
                setSaving(false);
                if (problem) setError(problem); else onDone();
              }}
            >
              {user.name}
            </Button>
          ))}
        </section>
      )}
      <form onSubmit={submit} className="mt-6 space-y-4">
        <h2 className="font-bold">Create a device profile</h2>
        <div className="space-y-2">
          <Label htmlFor="name">Name or nickname</Label>
          <Input
            id="name"
            name="name"
            required
            maxLength={40}
            autoComplete="nickname"
            className="h-12 bg-card"
            aria-invalid={invalid("name")}
            aria-describedby={describedBy("name")}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="age">Applicant age</Label>
          <Input
            id="age"
            name="age"
            type="number"
            required
            min={0}
            max={120}
            inputMode="numeric"
            className="h-12 bg-card"
            aria-invalid={invalid("age")}
            aria-describedby={describedBy("age", "age-hint")}
          />
          <p id="age-hint" className="text-xs text-muted-foreground">
            For a child, enter the child’s age. You can change it later in
            Settings.
          </p>
        </div>
        {error && (
          <p
            id="auth-error"
            role="alert"
            className="rounded-xl bg-destructive/10 px-3 py-2 text-sm font-semibold text-destructive"
          >
            {error}
          </p>
        )}
        <Button type="submit" variant="brand" size="xl" className="w-full" disabled={saving}>
          Create device profile
        </Button>
      </form>
      <div className="mt-8"><ProfileBackupRestore onImported={onDone} /></div>
    </main>
  );
}
