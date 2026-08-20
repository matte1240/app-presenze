"use client";

import { useState, useTransition, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Loader2, X, CheckCircle2, AlertCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import { RequestStatus } from "@/types/models";
import { TIME_OPTIONS } from "@/lib/utils/time-utils";

type RequestLeaveModalProps = {
  isOpen: boolean;
  onClose: () => void;
  editRequest?: {
    id: string;
    startDate: string;
    endDate: string;
    type: "VACATION" | "SICKNESS" | "PERMESSO";
    reason?: string;
    startTime?: string;
    endTime?: string;
    status: "PENDING" | "APPROVED" | "REJECTED";
  } | null;
};

export default function RequestLeaveModal({ isOpen, onClose, editRequest }: RequestLeaveModalProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const [formData, setFormData] = useState({
    startDate: "",
    endDate: "",
    type: "VACATION" as "VACATION" | "SICKNESS" | "PERMESSO",
    reason: "",
    startTime: "",
    endTime: "",
    status: "PENDING" as "PENDING" | "APPROVED" | "REJECTED",
  });

  // Update form when editRequest changes
  useEffect(() => {
    if (editRequest) {
      setFormData({
        startDate: editRequest.startDate.split('T')[0],
        endDate: editRequest.endDate.split('T')[0],
        type: editRequest.type,
        reason: editRequest.reason || "",
        startTime: editRequest.startTime || "",
        endTime: editRequest.endTime || "",
        status: editRequest.status,
      });
    } else {
      setFormData({
        startDate: "",
        endDate: "",
        type: "VACATION",
        reason: "",
        startTime: "",
        endTime: "",
        status: "PENDING",
      });
    }
  }, [editRequest, isOpen]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);

    startTransition(async () => {
      try {
        const url = editRequest ? `/api/requests/${editRequest.id}` : "/api/requests";
        const method = editRequest ? "PUT" : "POST";
        
        const res = await fetch(url, {
          method,
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(formData),
        });

        if (!res.ok) {
          const msg = await res.text();
          throw new Error(msg);
        }

        setSuccess(editRequest ? "Richiesta aggiornata con successo!" : "Richiesta inviata con successo!");
        setTimeout(() => {
          onClose();
          router.refresh();
        }, 1500);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Si è verificato un errore");
      }
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm p-4 animate-in fade-in duration-200">
      <div className="w-full max-w-md rounded-xl border border-border bg-card p-6 shadow-2xl animate-in zoom-in-95 duration-200">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-bold text-foreground">
            {editRequest ? "Modifica Richiesta" : "Richiedi Ferie/Permesso"}
          </h2>
          <button
            onClick={onClose}
            className="rounded-full p-1 text-muted-foreground hover:bg-accent hover:text-accent-foreground transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {error && (
          <div className="mb-4 rounded-lg border border-destructive/50 bg-destructive/10 p-3 flex items-center gap-2 text-sm text-destructive animate-in slide-in-from-top-2">
            <AlertCircle className="h-4 w-4" />
            {error}
          </div>
        )}

        {success && (
          <div className="mb-4 rounded-lg border border-emerald-500/50 bg-emerald-500/10 p-3 flex items-center gap-2 text-sm text-emerald-600 dark:text-emerald-400 animate-in slide-in-from-top-2">
            <CheckCircle2 className="h-4 w-4" />
            {success}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="text-sm font-medium text-foreground">
                Data Inizio
              </label>
              <input
                type="date"
                required
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                value={formData.startDate}
                onChange={(e) => {
                  const newStartDate = e.target.value;
                  setFormData((prev) => ({
                    ...prev,
                    startDate: newStartDate,
                    // If type is PERMESSO, force endDate to match startDate
                    endDate: prev.type === "PERMESSO" ? newStartDate : prev.endDate,
                  }));
                }}
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium text-foreground">
                Data Fine
              </label>
              <input
                type="date"
                required
                disabled={formData.type === "PERMESSO"}
                className={cn(
                  "flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50",
                  formData.type === "PERMESSO" && "bg-muted text-muted-foreground"
                )}
                value={formData.endDate}
                onChange={(e) =>
                  setFormData({ ...formData, endDate: e.target.value })
                }
              />
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium text-foreground">
              Tipo Richiesta
            </label>
            <select
              className="flex h-10 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 transition-all hover:bg-accent/50 cursor-pointer"
              value={formData.type}
              onChange={(e) => {
                const newType = e.target.value as "VACATION" | "PERMESSO";
                setFormData((prev) => ({
                  ...prev,
                  type: newType,
                  // If switching to PERMESSO, sync endDate with startDate
                  endDate: newType === "PERMESSO" ? prev.startDate : prev.endDate,
                }));
              }}
            >
              <option value="VACATION">Ferie</option>
              <option value="PERMESSO">Permesso</option>
            </select>
          </div>

          {formData.type === "PERMESSO" && (
            <div className="grid grid-cols-2 gap-4 animate-in fade-in slide-in-from-top-2">
              <div className="space-y-2">
                <label className="text-sm font-medium text-foreground">
                  Ora Inizio
                </label>
                <select
                  required
                  className="flex h-10 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 transition-all hover:bg-accent/50 cursor-pointer"
                  value={formData.startTime}
                  onChange={(e) =>
                    setFormData({ ...formData, startTime: e.target.value })
                  }
                >
                  <option value="">Seleziona orario</option>
                  {TIME_OPTIONS.map((time) => (
                    <option key={time} value={time}>
                      {time}
                    </option>
                  ))}
                </select>
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium text-foreground">
                  Ora Fine
                </label>
                <select
                  required
                  className="flex h-10 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 transition-all hover:bg-accent/50 cursor-pointer"
                  value={formData.endTime}
                  onChange={(e) =>
                    setFormData({ ...formData, endTime: e.target.value })
                  }
                >
                  <option value="">Seleziona orario</option>
                  {TIME_OPTIONS.map((time) => (
                    <option key={time} value={time}>
                      {time}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          )}

          {editRequest && (
            <div className="space-y-2">
              <label className="text-sm font-medium text-foreground">
                Stato
              </label>
              <select
                className="flex h-10 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 transition-all hover:bg-accent/50 cursor-pointer"
                value={formData.status}
                onChange={(e) =>
                  setFormData({ ...formData, status: e.target.value as RequestStatus })
                }
              >
                <option value="PENDING">In Attesa</option>
                <option value="APPROVED">Approvata</option>
                <option value="REJECTED">Rifiutata</option>
              </select>
            </div>
          )}

          <div className="space-y-2">
            <label className="text-sm font-medium text-foreground">
              Motivazione (opzionale)
            </label>
            <textarea
              className="flex min-h-[80px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 resize-none"
              rows={3}
              value={formData.reason}
              onChange={(e) =>
                setFormData({ ...formData, reason: e.target.value })
              }
              placeholder="Inserisci note aggiuntive..."
            />
          </div>

          <div className="mt-6 flex justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="inline-flex items-center justify-center rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 border border-input bg-background hover:bg-accent hover:text-accent-foreground h-10 px-4 py-2"
              disabled={isPending}
            >
              Annulla
            </button>
            <button
              type="submit"
              disabled={isPending}
              className="inline-flex items-center justify-center rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 bg-primary text-primary-foreground hover:bg-primary/90 h-10 px-4 py-2 shadow-sm"
            >
              {isPending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Salvataggio...
                </>
              ) : editRequest ? (
                "Salva Modifiche"
              ) : (
                "Invia Richiesta"
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
