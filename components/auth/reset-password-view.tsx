"use client";

import { useState, useTransition, FormEvent, useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { CheckCircle2, Lock, Eye, EyeOff, Loader2, AlertCircle } from "lucide-react";

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
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <div className="w-full max-w-md">
          <div className="bg-card rounded-2xl shadow-xl border border-border p-8 text-center animate-in fade-in zoom-in-95 duration-300">
            <div className="w-16 h-16 bg-emerald-500/20 rounded-full flex items-center justify-center mx-auto mb-4">
              <CheckCircle2 className="w-8 h-8 text-emerald-600 dark:text-emerald-400" />
            </div>
            <h2 className="text-2xl font-bold text-foreground mb-2">Password Aggiornata!</h2>
            <p className="text-muted-foreground mb-6">
              La tua password è stata reimpostata con successo. Verrai reindirizzato alla pagina di login...
            </p>
            <Link
              href="/"
              className="inline-flex items-center justify-center rounded-xl bg-primary px-6 py-3 text-sm font-semibold text-primary-foreground shadow-lg transition-all hover:bg-primary/90"
            >
              Vai al Login
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <div className="w-full max-w-md">
        <div className="bg-card rounded-2xl shadow-xl border border-border p-8 animate-in fade-in slide-in-from-bottom-4 duration-300">
          <div className="text-center mb-8">
            <div className="w-16 h-16 bg-primary/10 rounded-2xl flex items-center justify-center mx-auto mb-4 border border-primary/20">
              <Lock className="w-8 h-8 text-primary" />
            </div>
            <h1 className="text-2xl font-bold text-foreground mb-2">Reimposta Password</h1>
            <p className="text-sm text-muted-foreground">
              Inserisci la tua nuova password
            </p>
          </div>

          {error && (
            <div className="rounded-xl bg-destructive/10 p-4 border border-destructive/20 shadow-sm mb-6 animate-in fade-in slide-in-from-top-2">
              <div className="flex items-start gap-3">
                <div className="flex-shrink-0 w-8 h-8 rounded-lg bg-destructive/20 flex items-center justify-center">
                  <AlertCircle className="w-4 h-4 text-destructive" />
                </div>
                <p className="text-sm text-destructive font-medium pt-1">
                  {error}
                </p>
              </div>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label htmlFor="newPassword" className="block text-sm font-semibold text-foreground mb-2">
                Nuova Password
              </label>
              <div className="relative">
                <input
                  id="newPassword"
                  type={showPassword ? "text" : "password"}
                  required
                  minLength={8}
                  value={formState.newPassword}
                  onChange={(event) =>
                    setFormState((state) => ({ ...state, newPassword: event.target.value }))
                  }
                  className="block w-full rounded-xl border border-input bg-background px-4 py-3 pr-11 text-sm text-foreground placeholder:text-muted-foreground outline-none transition-all focus:border-primary focus:ring-2 focus:ring-primary/20"
                  placeholder="Almeno 8 caratteri"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute inset-y-0 right-0 flex items-center pr-3 text-muted-foreground hover:text-foreground transition-colors"
                >
                  {showPassword ? (
                    <EyeOff className="h-5 w-5" />
                  ) : (
                    <Eye className="h-5 w-5" />
                  )}
                </button>
              </div>
            </div>

            <div>
              <label htmlFor="confirmPassword" className="block text-sm font-semibold text-foreground mb-2">
                Conferma Password
              </label>
              <input
                id="confirmPassword"
                type={showPassword ? "text" : "password"}
                required
                minLength={8}
                value={formState.confirmPassword}
                onChange={(event) =>
                  setFormState((state) => ({ ...state, confirmPassword: event.target.value }))
                }
                className="block w-full rounded-xl border border-input bg-background px-4 py-3 text-sm text-foreground placeholder:text-muted-foreground outline-none transition-all focus:border-primary focus:ring-2 focus:ring-primary/20"
                placeholder="Ripeti la password"
              />
            </div>

            <button
              type="submit"
              disabled={isPending}
              className="w-full flex items-center justify-center gap-2 rounded-xl bg-primary px-4 py-3.5 text-sm font-semibold text-primary-foreground shadow-lg transition-all hover:bg-primary/90 hover:scale-[1.02] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:scale-100"
            >
              {isPending ? (
                <>
                  <Loader2 className="animate-spin h-4 w-4" />
                  Reimpostazione in corso...
                </>
              ) : (
                "Reimposta Password"
              )}
            </button>

            <div className="text-center pt-2">
              <Link
                href="/"
                className="text-sm font-medium text-primary hover:underline transition-colors"
              >
                Torna al Login
              </Link>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}

export default function ResetPasswordView() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center">
          <Loader2 className="animate-spin h-8 w-8 text-primary mx-auto" />
          <p className="mt-4 text-muted-foreground">Caricamento...</p>
        </div>
      </div>
    }>
      <ResetPasswordForm />
    </Suspense>
  );
}
