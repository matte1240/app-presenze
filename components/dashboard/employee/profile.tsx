"use client";

import { useState, useTransition } from "react";
import { format } from "date-fns";
import { it } from "date-fns/locale";
import type { User } from "@/types/models";
import { 
  Shield,
  User as UserIcon
} from "lucide-react";
import { Card } from "@/components/ui/card";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/input";
import { PageContainer, PageHeader } from "@/components/layout/page";

type EmployeeProfileProps = {
  user: User;
};

export default function EmployeeProfile({ user }: EmployeeProfileProps) {
  const [isEditingPassword, setIsEditingPassword] = useState(false);
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [isUpdating, startUpdating] = useTransition();

  const handlePasswordChange = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);

    if (newPassword !== confirmPassword) {
      setError("Le password non corrispondono");
      return;
    }

    if (newPassword.length < 8) {
      setError("La password deve essere lunga almeno 8 caratteri");
      return;
    }

    startUpdating(async () => {
      try {
        const response = await fetch(`/api/users/${user.id}/reset-password`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ newPassword }),
        });

        const data = await response.json();

        if (!response.ok) {
          setError(data.error || "Errore nel cambio password");
          return;
        }

        setSuccess("Password cambiata con successo!");
        setIsEditingPassword(false);
        setNewPassword("");
        setConfirmPassword("");
      } catch (err) {
        console.error(err);
        setError("Errore imprevisto");
      }
    });
  };

  return (
    <PageContainer className="max-w-3xl">
      <PageHeader title="Profilo" description="I tuoi dati e la tua password." />

      {/* Identity strip. The old header used a 8rem gradient band with a 8rem
          avatar hanging off it — a lot of chrome for four fields. */}
      <div className="mb-4 flex items-center gap-4 rounded-lg border border-border bg-card p-4 shadow-elevation-1">
        <span className="flex size-14 shrink-0 items-center justify-center rounded-full bg-muted text-xl font-semibold text-muted-foreground">
          {(user.name || user.email).charAt(0).toUpperCase()}
        </span>
        <div className="min-w-0">
          <h2 className="truncate text-base font-semibold tracking-tight text-foreground">
            {user.name || "Senza nome"}
          </h2>
          <p className="truncate text-[13px] text-muted-foreground">{user.email}</p>
          <Badge
            variant={user.role === "ADMIN" ? "primary" : "neutral"}
            className="mt-1.5"
          >
            {user.role === "ADMIN" ? "Amministratore" : "Dipendente"}
          </Badge>
        </div>
      </div>

      {success && <Alert variant="success" className="mb-4">{success}</Alert>}
      {error && <Alert variant="error" className="mb-4">{error}</Alert>}

      <Card className="mb-4">
        <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold text-foreground">
          <UserIcon className="size-4 text-muted-foreground" />
          Informazioni profilo
        </h3>
        <dl className="grid grid-cols-1 gap-x-6 gap-y-3 sm:grid-cols-2">
          <InfoRow label="Nome completo" value={user.name || "—"} />
          <InfoRow label="Email" value={user.email} />
          <InfoRow
            label="Ruolo"
            value={user.role === "ADMIN" ? "Amministratore" : "Dipendente"}
          />
          <InfoRow
            label="Data registrazione"
            value={format(new Date(user.createdAt), "d MMMM yyyy", { locale: it })}
          />
        </dl>
      </Card>

      <Card>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h3 className="flex items-center gap-2 text-sm font-semibold text-foreground">
              <Shield className="size-4 text-muted-foreground" />
              Sicurezza
            </h3>
            <p className="mt-1 text-[13px] text-muted-foreground">
              {isEditingPassword
                ? "Scegli una password di almeno 8 caratteri."
                : "La password è configurata."}
            </p>
          </div>
          {!isEditingPassword && (
            <Button variant="outline" onClick={() => setIsEditingPassword(true)}>
              Cambia password
            </Button>
          )}
        </div>

        {isEditingPassword && (
          <form
            onSubmit={handlePasswordChange}
            className="mt-4 space-y-3 border-t border-border pt-4"
          >
            <Field label="Nuova password" htmlFor="newPassword">
              {(field) => (
                <Input
                  {...field}
                  type="password"
                  required
                  minLength={8}
                  autoComplete="new-password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="Minimo 8 caratteri"
                />
              )}
            </Field>

            <Field label="Conferma password" htmlFor="confirmPassword">
              {(field) => (
                <Input
                  {...field}
                  type="password"
                  required
                  minLength={8}
                  autoComplete="new-password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Ripeti la password"
                />
              )}
            </Field>

            <div className="flex gap-2 pt-1">
              <Button type="submit" loading={isUpdating}>
                {isUpdating ? "Salvataggio…" : "Salva password"}
              </Button>
              <Button
                type="button"
                variant="ghost"
                onClick={() => {
                  setIsEditingPassword(false);
                  setNewPassword("");
                  setConfirmPassword("");
                  setError(null);
                }}
              >
                Annulla
              </Button>
            </div>
          </form>
        )}
      </Card>
    </PageContainer>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="mt-0.5 text-[13px] text-foreground">{value}</dd>
    </div>
  );
}
