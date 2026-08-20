"use client";

import { useState, useTransition, FormEvent, useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { CheckCircle2, Eye, EyeOff, Lock } from "lucide-react";
import { Alert } from "@/components/ui/alert";
import { Button, buttonClasses } from "@/components/ui/button";
import { Field, Input, Label } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";

function ResetPasswordForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [formState, setFormState] = useState({
    newPassword: "",
    confirmPassword: "",
  });
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [showPassword, setShowPassword] = useState(false);
  const [token, setToken] = useState<string | null>(null);
  const [email, setEmail] = useState<string | null>(null);

  useEffect(() => {
    const tokenParam = searchParams.get("token");
    const emailParam = searchParams.get("email");

    if (!tokenParam || !emailParam) {
      // Use setTimeout to avoid synchronous state update during render
      setTimeout(() => {
        setError("Link non valido. Richiedi un nuovo reset della password.");
      }, 0);
      return;
    }

    setTimeout(() => {
      setToken(tokenParam);
      setEmail(emailParam);
    }, 0);
  }, [searchParams]);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);

    if (formState.newPassword !== formState.confirmPassword) {
      setError("Le password non corrispondono");
      return;
    }

    if (formState.newPassword.length < 8) {
      setError("La password deve essere di almeno 8 caratteri");
      return;
    }

    if (!token || !email) {
      setError("Dati mancanti. Richiedi un nuovo reset della password.");
      return;
    }

    startTransition(async () => {
      try {
        const response = await fetch("/api/auth/reset-password", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            email,
            token,
            newPassword: formState.newPassword,
          }),
        });

        const data = await response.json();

        if (!response.ok) {
          setError(data.error || "Errore durante il reset della password");
          return;
        }

        setSuccess(true);
        
        // Forza il logout per invalidare la sessione corrente
        try {
          await fetch("/api/auth/signout", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ callbackUrl: "/" }),
          });
        } catch (e) {
          console.error("Errore durante il logout automatico:", e);
        }
        
        setTimeout(() => {
          router.push("/?passwordReset=true");
        }, 2000);
      } catch (err) {
        console.error(err);
        setError("Errore di connessione. Riprova più tardi.");
      }
    });
  };

  if (success) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background px-5 py-12">
        <div className="w-full max-w-[22rem] text-center">
          <span className="mx-auto flex size-12 items-center justify-center rounded-full bg-success-subtle text-success">
            <CheckCircle2 className="size-5" />
          </span>
          <h1 className="mt-4 text-xl font-semibold tracking-tight text-foreground">
            Password aggiornata
          </h1>
          <p className="mt-1.5 text-sm text-muted-foreground">
            La tua password è stata reimpostata. Ti stiamo riportando al login…
          </p>
          <Link
            href="/"
            className={buttonClasses({ size: "lg", className: "mt-6 w-full" })}
          >
            Vai al login
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-5 py-12">
      <div className="w-full max-w-[22rem]">
        <div className="mb-7">
          <span className="flex size-10 items-center justify-center rounded-md border border-border bg-card text-muted-foreground">
            <Lock className="size-4" />
          </span>
          <h1 className="mt-4 text-2xl font-semibold tracking-tight text-foreground">
            Reimposta password
          </h1>
          <p className="mt-1.5 text-sm text-muted-foreground">
            Scegli una nuova password di almeno 8 caratteri.
          </p>
        </div>

        {error && <Alert variant="error" className="mb-4">{error}</Alert>}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="newPassword">Nuova password</Label>
            <div className="relative">
              <Input
                id="newPassword"
                type={showPassword ? "text" : "password"}
                required
                minLength={8}
                autoComplete="new-password"
                className="pr-9"
                value={formState.newPassword}
                onChange={(event) =>
                  setFormState((state) => ({
                    ...state,
                    newPassword: event.target.value,
                  }))
                }
                placeholder="Almeno 8 caratteri"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                aria-label={showPassword ? "Nascondi password" : "Mostra password"}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 cursor-pointer rounded-sm p-0.5 text-muted-foreground transition-colors hover:text-foreground"
              >
                {showPassword ? (
                  <EyeOff className="size-4" />
                ) : (
                  <Eye className="size-4" />
                )}
              </button>
            </div>
          </div>

          <Field label="Conferma password" htmlFor="confirmPassword">
            {(field) => (
              <Input
                {...field}
                type={showPassword ? "text" : "password"}
                required
                minLength={8}
                autoComplete="new-password"
                value={formState.confirmPassword}
                onChange={(event) =>
                  setFormState((state) => ({
                    ...state,
                    confirmPassword: event.target.value,
                  }))
                }
                placeholder="Ripeti la password"
              />
            )}
          </Field>

          <Button type="submit" size="lg" className="w-full" loading={isPending}>
            {isPending ? "Reimpostazione…" : "Reimposta password"}
          </Button>

          <p className="pt-1 text-center">
            <Link
              href="/"
              className="text-[13px] text-muted-foreground transition-colors hover:text-foreground"
            >
              Torna al login
            </Link>
          </p>
        </form>
      </div>
    </div>
  );
}

export default function ResetPasswordView() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center bg-background px-5">
          <div className="w-full max-w-[22rem] space-y-3">
            <Skeleton className="h-10 w-10 rounded-md" />
            <Skeleton className="h-7 w-56" />
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-9 w-full" />
            <Skeleton className="h-9 w-full" />
          </div>
        </div>
      }
    >
      <ResetPasswordForm />
    </Suspense>
  );
}
