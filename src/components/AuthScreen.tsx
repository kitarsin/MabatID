"use client";

import { useState, type FormEvent } from "react";
import { ArrowLeft, Eye, EyeOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useStore } from "@/lib/store";
import { Logo } from "./Logo";

type Mode = "login" | "register";
type FieldName = "age" | "email" | "password";

export function AuthScreen({
  initial,
  onBack,
  onDone,
}: {
  initial: Mode;
  onBack: () => void;
  onDone: () => void;
}) {
  const { login, register } = useStore();
  const [mode, setMode] = useState<Mode>(initial);
  const [error, setError] = useState<string | null>(null);
  const [errorField, setErrorField] = useState<FieldName | null>(null);
  const [busy, setBusy] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  /** Show the message, mark the field that caused it, and put the cursor there. */
  function fail(message: string, field: FieldName) {
    setError(message);
    setErrorField(field);
    document.getElementById(field)?.focus();
  }

  function clearError() {
    setError(null);
    setErrorField(null);
  }

  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    clearError();
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
        fail("Enter a valid age (5–100).", "age");
        return;
      }
      err = await register({ name: String(f.get("name") ?? ""), email, password, age });
    }
    setBusy(false);
    // The only register error is a taken email; a failed login is a mismatch, so point at the password.
    if (err) fail(err, mode === "register" ? "email" : "password");
    else onDone();
  }

  const invalid = (field: FieldName) => (errorField === field ? true : undefined);
  const describedBy = (field: FieldName, hintId?: string) =>
    [hintId, errorField === field ? "auth-error" : undefined].filter(Boolean).join(" ") || undefined;

  return (
    <main id="main" tabIndex={-1} className="mx-auto flex min-h-dvh w-full max-w-md flex-col px-6 pb-10 pt-6 outline-none">
      <Button type="button" variant="ghost" size="md" onClick={onBack} className="-ml-3 mb-4 w-fit text-civic">
        <ArrowLeft className="size-4" aria-hidden="true" /> Back
      </Button>
      <Logo dark />
      <h1 className="mt-6 text-2xl font-bold leading-tight tracking-tight">
        {mode === "login" ? "Welcome back" : "Start your ID path"}
      </h1>
      <p className="mt-1 text-muted-foreground">
        {mode === "login" ? "Pick up where you left off." : "Track every ID you’ve got and see what to get next."}
      </p>

      <Tabs value={mode} onValueChange={(v) => { setMode(v as Mode); clearError(); }} className="mt-6">
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
              <Input
                id="age" name="age" type="number" inputMode="numeric" min={5} max={100} required className="h-12 bg-card"
                aria-invalid={invalid("age")} aria-describedby={describedBy("age", "age-hint")}
              />
            </Field>
          </>
        )}
        <Field id="email" label="Email">
          <Input
            id="email" name="email" type="email" required autoComplete="email" spellCheck={false} autoCapitalize="none"
            className="h-12 bg-card" aria-invalid={invalid("email")} aria-describedby={describedBy("email")}
          />
        </Field>
        <Field id="password" label="Password" hint={mode === "register" ? "At least 8 characters." : undefined}>
          <div className="relative">
            <Input
              id="password" name="password" type={showPassword ? "text" : "password"} required minLength={mode === "register" ? 8 : 1}
              autoComplete={mode === "login" ? "current-password" : "new-password"} className="h-12 bg-card pr-12"
              aria-invalid={invalid("password")} aria-describedby={describedBy("password", mode === "register" ? "password-hint" : undefined)}
            />
            <Button
              type="button"
              variant="ghost"
              size="icon-xl"
              onClick={() => setShowPassword((s) => !s)}
              aria-label="Show password"
              aria-pressed={showPassword}
              className="absolute right-0.5 top-0.5 size-11 text-muted-foreground"
            >
              {showPassword ? <EyeOff className="size-5" aria-hidden="true" /> : <Eye className="size-5" aria-hidden="true" />}
            </Button>
          </div>
        </Field>

        {error && (
          <p id="auth-error" role="alert" className="rounded-xl bg-destructive/10 px-3 py-2 text-sm font-semibold text-destructive">
            {error}
          </p>
        )}

        <Button type="submit" disabled={busy} variant="brand" size="xl" className="w-full">
          {busy ? (mode === "login" ? "Logging in…" : "Creating account…") : mode === "login" ? "Log in" : "Create account"}
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
      <Label htmlFor={id} className="text-sm font-semibold">{label}</Label>
      {children}
      {hint && <p id={`${id}-hint`} className="text-xs text-muted-foreground">{hint}</p>}
    </div>
  );
}
