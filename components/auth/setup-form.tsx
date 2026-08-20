"use client";

import { useState, useTransition, FormEvent } from "react";
import { useRouter } from "next/navigation";
import { AlertCircle, CheckCircle2, Upload, Loader2, FileText } from "lucide-react";

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
      <div className="mt-8 space-y-6">
        <form
          onSubmit={handleRestore}
          className="rounded-xl border border-border bg-card p-8 shadow-lg backdrop-blur-sm animate-in fade-in slide-in-from-bottom-4 duration-300"
        >
          <h3 className="mb-4 text-lg font-semibold text-foreground">
            Restore from Backup
          </h3>
          <p className="mb-6 text-sm text-muted-foreground">
            Upload a backup file (.sql) to restore your database. This will replace all current data.
          </p>

          <div className="space-y-4">
            <div>
              <label htmlFor="backup-file" className="block text-sm font-medium text-foreground">
                Backup File
              </label>
              <div className="mt-1 flex items-center justify-center w-full">
                <label
                  htmlFor="backup-file"
                  className="flex flex-col items-center justify-center w-full h-32 border-2 border-dashed rounded-lg cursor-pointer bg-muted/50 hover:bg-muted border-border hover:border-primary/50 transition-colors"
                >
                  <div className="flex flex-col items-center justify-center pt-5 pb-6">
                    <Upload className="w-8 h-8 mb-3 text-muted-foreground" />
                    <p className="mb-2 text-sm text-muted-foreground">
                      <span className="font-semibold">Click to upload</span> or drag and drop
                    </p>
                    <p className="text-xs text-muted-foreground">SQL file only</p>
                  </div>
                  <input
                    id="backup-file"
                    name="backup-file"
                    type="file"
                    accept=".sql"
                    required
                    onChange={(e) => setRestoreFile(e.target.files?.[0] || null)}
                    className="hidden"
                  />
                </label>
              </div>
              {restoreFile && (
                <p className="mt-2 text-sm text-primary font-medium flex items-center gap-2">
                  <FileText className="h-4 w-4" />
                  {restoreFile.name}
                </p>
              )}
            </div>
          </div>

          {restoreSuccess && (
            <div className="mt-4 rounded-md bg-emerald-500/10 border border-emerald-500/20 p-4 animate-in fade-in slide-in-from-top-2">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
                <p className="text-sm text-emerald-800 dark:text-emerald-200">
                  Database restored successfully! Redirecting...
                </p>
              </div>
            </div>
          )}

          {error && (
            <div className="mt-4 rounded-md bg-destructive/10 border border-destructive/20 p-4 animate-in fade-in slide-in-from-top-2">
              <div className="flex items-center gap-2">
                <AlertCircle className="h-5 w-5 text-destructive" />
                <p className="text-sm text-destructive" role="alert">
                  {error}
                </p>
              </div>
            </div>
          )}

          <div className="mt-6 flex gap-3">
            <button
              type="button"
              onClick={() => {
                setShowRestore(false);
                setError(null);
                setRestoreFile(null);
              }}
              className="flex-1 rounded-md border border-input bg-background px-3 py-2 text-sm font-semibold text-foreground shadow-sm transition hover:bg-accent hover:text-accent-foreground"
              disabled={isRestoring}
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isRestoring || !restoreFile}
              className="flex-1 inline-flex items-center justify-center rounded-md bg-primary px-3 py-2 text-sm font-semibold text-primary-foreground shadow-sm transition hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {isRestoring ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Restoring...
                </>
              ) : (
                "Restore Database"
              )}
            </button>
          </div>
        </form>

        <div className="text-center">
          <button
            onClick={() => {
              setShowRestore(false);
              setError(null);
            }}
            className="text-sm text-primary hover:underline"
          >
            ← Back to Setup
          </button>
        </div>
      </div>
    );
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="mt-8 space-y-6 rounded-xl border border-border bg-card p-8 shadow-lg backdrop-blur-sm animate-in fade-in slide-in-from-bottom-4 duration-300"
    >
      <div className="space-y-4">
        <div>
          <label htmlFor="name" className="block text-sm font-medium text-foreground">
            Full Name
          </label>
          <input
            id="name"
            name="name"
            type="text"
            required
            value={formState.name}
            onChange={(event) =>
              setFormState((state) => ({ ...state, name: event.target.value }))
            }
            className="mt-1 block w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground shadow-sm outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/20"
            placeholder="John Doe"
          />
        </div>

        <div>
          <label htmlFor="email" className="block text-sm font-medium text-foreground">
            Email Address
          </label>
          <input
            id="email"
            name="email"
            type="email"
            autoComplete="email"
            required
            value={formState.email}
            onChange={(event) =>
              setFormState((state) => ({ ...state, email: event.target.value }))
            }
            className="mt-1 block w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground shadow-sm outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/20"
            placeholder="admin@company.com"
          />
        </div>

        <div>
          <label htmlFor="password" className="block text-sm font-medium text-foreground">
            Password
          </label>
          <input
            id="password"
            name="password"
            type="password"
            autoComplete="new-password"
            required
            value={formState.password}
            onChange={(event) =>
              setFormState((state) => ({ ...state, password: event.target.value }))
            }
            className="mt-1 block w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground shadow-sm outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/20"
            placeholder="••••••••"
          />
          <p className="mt-1 text-xs text-muted-foreground">Minimum 8 characters</p>
        </div>

        <div>
          <label htmlFor="confirmPassword" className="block text-sm font-medium text-foreground">
            Confirm Password
          </label>
          <input
            id="confirmPassword"
            name="confirmPassword"
            type="password"
            autoComplete="new-password"
            required
            value={formState.confirmPassword}
            onChange={(event) =>
              setFormState((state) => ({ ...state, confirmPassword: event.target.value }))
            }
            className="mt-1 block w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground shadow-sm outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/20"
            placeholder="••••••••"
          />
        </div>
      </div>

      {error ? (
        <div className="rounded-md bg-destructive/10 border border-destructive/20 p-4 animate-in fade-in slide-in-from-top-2">
          <div className="flex items-center gap-2">
            <AlertCircle className="h-5 w-5 text-destructive" />
            <p className="text-sm text-destructive" role="alert">
              {error}
            </p>
          </div>
        </div>
      ) : null}

      <button
        type="submit"
        disabled={isPending}
        className="flex w-full justify-center items-center rounded-md bg-primary px-3 py-2 text-sm font-semibold text-primary-foreground shadow-sm transition hover:bg-primary/90 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary disabled:cursor-not-allowed disabled:opacity-50"
      >
        {isPending ? (
          <>
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            Creating account...
          </>
        ) : (
          "Create Administrator Account"
        )}
      </button>

      <div className="relative">
        <div className="absolute inset-0 flex items-center">
          <div className="w-full border-t border-border" />
        </div>
        <div className="relative flex justify-center text-sm">
          <span className="bg-card px-2 text-muted-foreground">Or</span>
        </div>
      </div>

      <button
        type="button"
        onClick={() => setShowRestore(true)}
        className="flex w-full justify-center rounded-md border border-input bg-background px-3 py-2 text-sm font-semibold text-foreground shadow-sm transition hover:bg-accent hover:text-accent-foreground"
      >
        Restore from Backup
      </button>
    </form>
  );
}
