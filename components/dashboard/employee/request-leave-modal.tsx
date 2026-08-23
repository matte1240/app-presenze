"use client";

import { useState, useTransition, useEffect } from "react";
import { useRouter } from "next/navigation";
import { RequestStatus } from "@/types/models";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { Field, Input, Select, Textarea } from "@/components/ui/input";
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
    <Dialog
      open={isOpen}
      onClose={onClose}
      title={editRequest ? "Modifica richiesta" : "Richiedi ferie o permesso"}
      footer={
        <>
          <Button variant="ghost" onClick={onClose} disabled={isPending}>
            Annulla
          </Button>
          <Button type="submit" form="leave-request-form" loading={isPending}>
            {isPending
              ? "Salvataggio…"
              : editRequest
                ? "Salva modifiche"
                : "Invia richiesta"}
          </Button>
        </>
      }
    >
      <form id="leave-request-form" onSubmit={handleSubmit} className="space-y-4">
        {error && <Alert variant="error">{error}</Alert>}
        {success && <Alert variant="success">{success}</Alert>}

        <Field label="Tipo di richiesta">
          {(field) => (
            <Select
              {...field}
              value={formData.type}
              onChange={(e) => {
                const newType = e.target.value as "VACATION" | "PERMESSO";
                setFormData((prev) => ({
                  ...prev,
                  type: newType,
                  // A permesso is a slice of a single day, so the end date
                  // follows the start date rather than being chosen.
                  endDate: newType === "PERMESSO" ? prev.startDate : prev.endDate,
                }));
              }}
            >
              <option value="VACATION">Ferie</option>
              <option value="PERMESSO">Permesso</option>
            </Select>
          )}
        </Field>

        <div className="grid grid-cols-2 gap-3">
          <Field label="Data inizio">
            {(field) => (
              <Input
                {...field}
                type="date"
                required
                value={formData.startDate}
                onChange={(e) => {
                  const newStartDate = e.target.value;
                  setFormData((prev) => ({
                    ...prev,
                    startDate: newStartDate,
                    endDate:
                      prev.type === "PERMESSO" ? newStartDate : prev.endDate,
                  }));
                }}
              />
            )}
          </Field>
          <Field
            label="Data fine"
            hint={
              formData.type === "PERMESSO" ? "Segue la data di inizio." : undefined
            }
          >
            {(field) => (
              <Input
                {...field}
                type="date"
                required
                disabled={formData.type === "PERMESSO"}
                value={formData.endDate}
                onChange={(e) =>
                  setFormData({ ...formData, endDate: e.target.value })
                }
              />
            )}
          </Field>
        </div>

        {formData.type === "PERMESSO" && (
          <div className="grid grid-cols-2 gap-3">
            <Field label="Ora inizio">
              {(field) => (
                <Select
                  {...field}
                  required
                  value={formData.startTime}
                  onChange={(e) =>
                    setFormData({ ...formData, startTime: e.target.value })
                  }
                >
                  <option value="">Seleziona</option>
                  {TIME_OPTIONS.map((time) => (
                    <option key={time} value={time}>
                      {time}
                    </option>
                  ))}
                </Select>
              )}
            </Field>
            <Field label="Ora fine">
              {(field) => (
                <Select
                  {...field}
                  required
                  value={formData.endTime}
                  onChange={(e) =>
                    setFormData({ ...formData, endTime: e.target.value })
                  }
                >
                  <option value="">Seleziona</option>
                  {TIME_OPTIONS.map((time) => (
                    <option key={time} value={time}>
                      {time}
                    </option>
                  ))}
                </Select>
              )}
            </Field>
          </div>
        )}

        {editRequest && (
          <Field label="Stato">
            {(field) => (
              <Select
                {...field}
                value={formData.status}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    status: e.target.value as RequestStatus,
                  })
                }
              >
                <option value="PENDING">In attesa</option>
                <option value="APPROVED">Approvata</option>
                <option value="REJECTED">Rifiutata</option>
              </Select>
            )}
          </Field>
        )}

        <Field label="Motivazione" hint="Facoltativa">
          {(field) => (
            <Textarea
              {...field}
              rows={3}
              className="resize-none"
              value={formData.reason}
              onChange={(e) =>
                setFormData({ ...formData, reason: e.target.value })
              }
              placeholder="Aggiungi una nota per chi approva…"
            />
          )}
        </Field>
      </form>
    </Dialog>
  );
}
