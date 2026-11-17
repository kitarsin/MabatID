"use client";

import { useState, type FormEvent } from "react";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useStore } from "@/lib/store";
import { Logo } from "./Logo";

export function AuthScreen({
  initial,
  onBack,
  onDone,
}: {
  initial: "login" | "register";
  onBack: () => void;
  onDone: () => void;
}) {
  const { login, register } = useStore();
  const [mode, setMode] = useState<"login" | "register">(initial);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    const f = new FormData(e.currentTarget);
    const email = String(f.get("email") ?? "");
    const password = String(f.get("password") ?? "");
    setBusy(true);
    let err: string | null;
    if (mode === "login") {
      err = await login(email, password);
    } else {
      const age = Number(f.get("age"));
      if (!Number.isInteger(age) || age < 5 || age > 100) {
        setBusy(false);
        setError("Enter a valid age (5–100).");
        return;
      }
      err = await register({ name: String(f.get("name") ?? ""), email, password, age });
    }
    setBusy(false);
    if (err) setError(err);
    else onDone();
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
      <h1 className="mt-6 text-2xl font-extrabold tracking-tight">
        {mode === "login" ? "Welcome back" : "Start your ID path"}
      </h1>
      <p className="mt-1 text-muted-foreground">
        {mode === "login" ? "Pick up where you left off." : "Track every ID you’ve got and see what to get next."}
      </p>

      <Tabs value={mode} onValueChange={(v) => { setMode(v as typeof mode); setError(null); }} className="mt-6">
        <TabsList className="grid h-11 w-full grid-cols-2">
          <TabsTrigger value="login">Log in</TabsTrigger>
          <TabsTrigger value="register">Register</TabsTrigger>
        </TabsList>
      </Tabs>

      <form onSubmit={submit} className="mt-6 space-y-4" key={mode}>
        {mode === "register" && (
          <>
            <Field id="name" label="Name or nickname">
              <Input id="name" name="name" required autoComplete="nickname" maxLength={40} className="h-12 bg-card" />
            </Field>
            <Field id="age" label="Your age" hint="Used to flag IDs you can already apply for.">
              <Input id="age" name="age" type="number" inputMode="numeric" min={5} max={100} required className="h-12 bg-card" />
            </Field>
          </>
        )}
        <Field id="email" label="Email">
          <Input id="email" name="email" type="email" required autoComplete="email" className="h-12 bg-card" />
        </Field>
        <Field id="password" label="Password">
          <Input
            id="password" name="password" type="password" required minLength={mode === "register" ? 8 : 1}
            autoComplete={mode === "login" ? "current-password" : "new-password"} className="h-12 bg-card"
          />
        </Field>
        {mode === "register" && <p className="-mt-2 text-xs text-muted-foreground">At least 8 characters.</p>}

        {error && (
          <p role="alert" className="rounded-xl bg-destructive/10 px-3 py-2 text-sm font-semibold text-destructive">
            {error}
          </p>
        )}

        <Button type="submit" disabled={busy} className="h-14 w-full rounded-2xl bg-civic text-base font-bold text-white hover:bg-navy">
          {busy ? "One moment…" : mode === "login" ? "Log in" : "Create account"}
        </Button>
      </form>

      <p className="mt-6 text-center text-xs text-muted-foreground">
        Prototype: accounts are stored only in this browser until the MabatID server is connected.
      </p>
    </main>
  );
}

function Field({ id, label, hint, children }: { id: string; label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={id} className="text-sm font-bold">{label}</Label>
      {children}
      {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
    </div>
  );
}
