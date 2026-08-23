"use client";

import { useState, useTransition, FormEvent } from "react";
import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";
import { Eye, EyeOff, Mail, Lock } from "lucide-react";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Field, Input, Label } from "@/components/ui/input";

const initialState = {
  email: "",
  password: "",
};

export default function LoginForm() {
  const router = useRouter();
  const [formState, setFormState] = useState(initialState);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const [showPassword, setShowPassword] = useState(false);
  const [showForgotPassword, setShowForgotPassword] = useState(false);
  const [forgotPasswordEmail, setForgotPasswordEmail] = useState("");
  const [forgotPasswordMessage, setForgotPasswordMessage] = useState<
    string | null
  >(null);
  const [isSendingEmail, setIsSendingEmail] = useState(false);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);

    startTransition(async () => {
      const result = await signIn("credentials", {
        redirect: false,
        email: formState.email,
        password: formState.password,
      });

      if (result?.error) {
        setError("Email o password non validi.");
        return;
      }

      // All users go to /dashboard, which handles role-based display
      router.push("/dashboard");
      router.refresh();
    });
  };

  const handleForgotPassword = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setForgotPasswordMessage(null);
    setIsSendingEmail(true);

    try {
      const response = await fetch("/api/auth/forgot-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: forgotPasswordEmail }),
      });

      const data = await response.json();

      if (!response.ok) {
        setForgotPasswordMessage(
          data.error || "Errore durante l'invio dell'email"
        );
        return;
      }

      setForgotPasswordMessage(data.message);
      setForgotPasswordEmail("");
    } catch (error) {
      console.error(error);
      setForgotPasswordMessage("Errore di connessione. Riprova più tardi.");
    } finally {
      setIsSendingEmail(false);
    }
  };

  return (
    <>
      <form onSubmit={handleSubmit} className="space-y-4">
        <Field label="Email">
          {(field) => (
            <Input
              {...field}
              type="email"
              required
              autoComplete="email"
              icon={<Mail />}
              value={formState.email}
              onChange={(event) =>
                setFormState((state) => ({
                  ...state,
                  email: event.target.value,
                }))
              }
              placeholder="tua.email@azienda.com"
            />
          )}
        </Field>

        <div className="space-y-1.5">
          <div className="flex items-center justify-between">
            <Label htmlFor="password">Password</Label>
            <button
              type="button"
              onClick={() => setShowForgotPassword(true)}
              className="cursor-pointer text-xs font-medium text-muted-foreground transition-colors hover:text-foreground"
            >
              Password dimenticata?
            </button>
          </div>
          <div className="relative">
            <Input
              id="password"
              type={showPassword ? "text" : "password"}
              required
              autoComplete="current-password"
              icon={<Lock />}
              className="pr-9"
              value={formState.password}
              onChange={(event) =>
                setFormState((state) => ({
                  ...state,
                  password: event.target.value,
                }))
              }
              placeholder="••••••••"
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

        {error && <Alert variant="error">{error}</Alert>}

        <Button type="submit" size="lg" loading={isPending} className="w-full">
          {isPending ? "Accesso in corso…" : "Accedi"}
        </Button>
      </form>

      {/* Forgot Password Modal */}
      {showForgotPassword && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="forgot-title"
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
        >
          <div
            className="absolute inset-0 bg-foreground/25 backdrop-blur-[2px] animate-in fade-in duration-150"
            onClick={() => setShowForgotPassword(false)}
          />
          <div className="relative w-full max-w-sm rounded-lg border border-border bg-card p-5 shadow-elevation-3 animate-in fade-in zoom-in-95 duration-150">
            <h3
              id="forgot-title"
              className="text-sm font-semibold tracking-tight text-foreground"
            >
              Recupera password
            </h3>
            <p className="mt-1 text-[13px] text-muted-foreground">
              Inserisci la tua email: ti invieremo un link per impostarne una nuova.
            </p>

            <form onSubmit={handleForgotPassword} className="mt-4 space-y-3">
              <Field label="Email">
                {(field) => (
                  <Input
                    {...field}
                    type="email"
                    required
                    autoComplete="email"
                    icon={<Mail />}
                    value={forgotPasswordEmail}
                    onChange={(e) => setForgotPasswordEmail(e.target.value)}
                    placeholder="tua.email@azienda.com"
                  />
                )}
              </Field>

              {forgotPasswordMessage && (
                <Alert
                  variant={
                    forgotPasswordMessage.includes("Errore") ? "error" : "success"
                  }
                >
                  {forgotPasswordMessage}
                </Alert>
              )}

              <div className="flex justify-end gap-2 pt-1">
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => {
                    setShowForgotPassword(false);
                    setForgotPasswordMessage(null);
                    setForgotPasswordEmail("");
                  }}
                >
                  Annulla
                </Button>
                <Button type="submit" loading={isSendingEmail}>
                  {isSendingEmail ? "Invio…" : "Invia link"}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
