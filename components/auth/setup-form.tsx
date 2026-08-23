"use client";

import { useState, useTransition, FormEvent } from "react";
import { useRouter } from "next/navigation";
import { FileText, Upload } from "lucide-react";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/input";

const initialState = {
  name: "",
  email: "",
  password: "",
  confirmPassword: "",
};

export default function SetupForm() {
  const router = useRouter();
  const [formState, setFormState] = useState(initialState);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const [showRestore, setShowRestore] = useState(false);
  const [restoreFile, setRestoreFile] = useState<File | null>(null);
  const [isRestoring, setIsRestoring] = useState(false);
  const [restoreSuccess, setRestoreSuccess] = useState(false);

  const handleRestore = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);

    if (!restoreFile) {
      setError("Please select a backup file");
      return;
    }

    setIsRestoring(true);

    try {
      const formData = new FormData();
      formData.append("file", restoreFile);

      const response = await fetch("/api/admin/backups/restore", {
        method: "POST",
        body: formData,
      });

      const data = await response.json();

      if (!response.ok) {
        setError(data.error || "Restore failed");
        setIsRestoring(false);
        return;
      }

      // Restore successful
      setRestoreSuccess(true);
      setIsRestoring(false);
      
      // Redirect to login after a short delay
      setTimeout(() => {
        router.push("/?restored=true");
      }, 2000);
    } catch (err) {
      setError("An unexpected error occurred during restore");
      console.error(err);
      setIsRestoring(false);
    }
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);

    // Validate password match
    if (formState.password !== formState.confirmPassword) {
      setError("Passwords do not match");
      return;
    }

    startTransition(async () => {
      try {
        const response = await fetch("/api/setup", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: formState.name,
            email: formState.email,
            password: formState.password,
          }),
        });

        const data = await response.json();

        if (!response.ok) {
          setError(data.error || "Setup failed");
          return;
        }

        // Setup successful, redirect to login
        router.push("/?setup=complete");
      } catch (err) {
        setError("An unexpected error occurred");
        console.error(err);
      }
    });
  };

  if (showRestore) {
    return (
      <div className="mt-8 space-y-4">
        <form onSubmit={handleRestore} className="space-y-4">
          <div>
            <h3 className="text-sm font-semibold tracking-tight text-foreground">
              Ripristina da backup
            </h3>
            <p className="mt-1 text-[13px] leading-relaxed text-muted-foreground">
              Carica un file <code className="font-mono text-xs">.db</code>{" "}
              generato da un backup. Sostituisce tutti i dati e riavvia
              l&apos;applicazione.
            </p>
          </div>

          <label
            htmlFor="backup-file"
            className="flex h-28 w-full cursor-pointer flex-col items-center justify-center gap-1.5 rounded-md border border-dashed border-border bg-muted/40 transition-colors hover:border-muted-foreground/40 hover:bg-muted/60"
          >
            <Upload className="size-5 text-muted-foreground" />
            <span className="text-[13px] text-muted-foreground">
              <span className="font-medium text-foreground">Scegli un file</span>{" "}
              o trascinalo qui
            </span>
            <span className="text-xs text-muted-foreground/70">
              Solo file SQLite .db
            </span>
            <input
              id="backup-file"
              name="backup-file"
              type="file"
              accept=".db"
              required
              onChange={(e) => setRestoreFile(e.target.files?.[0] || null)}
              className="hidden"
            />
          </label>

          {restoreFile && (
            <p className="flex items-center gap-2 text-[13px] font-medium text-foreground">
              <FileText className="size-4 text-muted-foreground" />
              {restoreFile.name}
            </p>
          )}

          {restoreSuccess && (
            <Alert variant="success">
              Database ripristinato. Reindirizzamento in corso…
            </Alert>
          )}

          {error && <Alert variant="error">{error}</Alert>}

          <div className="flex gap-2">
            <Button
              type="button"
              variant="outline"
              className="flex-1"
              disabled={isRestoring}
              onClick={() => {
                setShowRestore(false);
                setError(null);
                setRestoreFile(null);
              }}
            >
              Annulla
            </Button>
            <Button
              type="submit"
              className="flex-1"
              loading={isRestoring}
              disabled={!restoreFile}
            >
              {isRestoring ? "Ripristino…" : "Ripristina"}
            </Button>
          </div>
        </form>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="mt-8 space-y-4">
      <Field label="Nome completo" htmlFor="name">
        {(field) => (
          <Input
            {...field}
            name="name"
            type="text"
            required
            value={formState.name}
            onChange={(event) =>
              setFormState((state) => ({ ...state, name: event.target.value }))
            }
            placeholder="Mario Rossi"
          />
        )}
      </Field>

      <Field label="Email" htmlFor="email">
        {(field) => (
          <Input
            {...field}
            name="email"
            type="email"
            autoComplete="email"
            required
            value={formState.email}
            onChange={(event) =>
              setFormState((state) => ({ ...state, email: event.target.value }))
            }
            placeholder="admin@azienda.com"
          />
        )}
      </Field>

      <Field label="Password" hint="Minimo 8 caratteri" htmlFor="password">
        {(field) => (
          <Input
            {...field}
            name="password"
            type="password"
            autoComplete="new-password"
            required
            minLength={8}
            value={formState.password}
            onChange={(event) =>
              setFormState((state) => ({ ...state, password: event.target.value }))
            }
            placeholder="••••••••"
          />
        )}
      </Field>

      <Field label="Conferma password" htmlFor="confirmPassword">
        {(field) => (
          <Input
            {...field}
            name="confirmPassword"
            type="password"
            autoComplete="new-password"
            required
            minLength={8}
            value={formState.confirmPassword}
            onChange={(event) =>
              setFormState((state) => ({
                ...state,
                confirmPassword: event.target.value,
              }))
            }
            placeholder="••••••••"
          />
        )}
      </Field>

      {error && <Alert variant="error">{error}</Alert>}

      <Button type="submit" size="lg" className="w-full" loading={isPending}>
        {isPending ? "Creazione account…" : "Crea account amministratore"}
      </Button>

      <div className="relative py-1">
        <div className="absolute inset-0 flex items-center">
          <div className="w-full border-t border-border" />
        </div>
        <div className="relative flex justify-center">
          <span className="bg-background px-2 text-xs text-muted-foreground">
            oppure
          </span>
        </div>
      </div>

      <Button
        type="button"
        variant="outline"
        className="w-full"
        onClick={() => setShowRestore(true)}
      >
        Ripristina da backup
      </Button>
    </form>
  );
}
