"use client";

import { useState, type FormEvent } from "react";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useStore } from "@/lib/store";
import { Logo } from "./Logo";

/** Deliberately credential-free until server authentication is connected. */
export function AuthScreen({
  onBack,
  onDone,
}: {
  onBack: () => void;
  onDone: () => void;
}) {
  const { users, createProfile, selectProfile } = useStore();
  const [error, setError] = useState<string | null>(null);
  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const error = createProfile({
      name: String(form.get("name") ?? ""),
      age: Number(form.get("age")),
    });
    setError(error);
    if (!error) onDone();
  }
  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-md flex-col px-6 pb-10 pt-6">
      <button
        type="button"
        onClick={onBack}
        className="-ml-2 mb-6 inline-flex w-fit items-center gap-1.5 rounded-lg p-2 text-sm font-semibold text-civic hover:bg-muted"
      >
        <ArrowLeft className="size-4" aria-hidden="true" /> Back
      </button>
      <Logo dark />
      <h1 className="mt-6 text-2xl font-extrabold">
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
              onClick={() => {
                selectProfile(user.id);
                onDone();
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
            className="h-12"
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
            className="h-12"
          />
          <p className="text-xs text-muted-foreground">
            For a child, enter the child’s age. Update it under Progress → Edit
            when it changes.
          </p>
        </div>
        {error && (
          <p role="alert" className="text-sm font-semibold text-destructive">
            {error}
          </p>
        )}
        <Button
          type="submit"
          className="h-14 w-full bg-civic text-base font-bold text-white"
        >
          Create device profile
        </Button>
      </form>
    </main>
  );
}
