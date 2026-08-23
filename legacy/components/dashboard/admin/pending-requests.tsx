"use client";

import { useState, useEffect } from "react";
import { format } from "date-fns";
import { it } from "date-fns/locale";
import { 
  CheckCircle, 
  XCircle, 
  Edit, 
  Trash2, 
  Clock, 
  Calendar, 
  AlertCircle,
  Save,
  X
} from "lucide-react";
import { LeaveType } from "@/types/models";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Field, Input, Select, Textarea } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { ConfirmDialog } from "@/components/ui/dialog";
import { useToast } from "@/components/ui/toast";

type LeaveRequest = {
  id: string;
  userId: string;
  startDate: string;
  endDate: string;
  type: "VACATION" | "SICKNESS" | "PERMESSO";
  status: "PENDING" | "APPROVED" | "REJECTED";
  reason?: string;
  startTime?: string;
  endTime?: string;
  user: {
    name: string | null;
    email: string;
  };
};

export default function PendingRequests() {
  const [requests, setRequests] = useState<LeaveRequest[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<Partial<LeaveRequest>>({});
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const toast = useToast();

  const fetchRequests = async () => {
    try {
      const res = await fetch("/api/requests?status=PENDING");
      if (res.ok) {
        const data = await res.json();
        setRequests(data);
      }
    } catch (error) {
      console.error("Failed to fetch requests", error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchRequests();
  }, []);

  const handleAction = async (id: string, status: "APPROVED" | "REJECTED") => {
    try {
      const res = await fetch(`/api/requests/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });

      if (res.ok) {
        setRequests((prev) => prev.filter((req) => req.id !== id));
        toast({
          title: status === "APPROVED" ? "Richiesta approvata" : "Richiesta rifiutata",
          variant: "success",
        });
      } else {
        toast({ title: "Aggiornamento non riuscito", variant: "error" });
      }
    } catch (error) {
      console.error("Error updating request", error);
      toast({ title: "Errore di connessione", variant: "error" });
    }
  };

  const startEdit = (req: LeaveRequest) => {
    setEditingId(req.id);
    setEditForm({
      startDate: req.startDate.split('T')[0],
      endDate: req.endDate.split('T')[0],
      type: req.type,
      reason: req.reason,
      startTime: req.startTime,
      endTime: req.endTime,
    });
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditForm({});
  };

  const saveEdit = async (id: string) => {
    try {
      const res = await fetch(`/api/requests/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(editForm),
      });

      if (res.ok) {
        await fetchRequests();
        setEditingId(null);
        setEditForm({});
        toast({ title: "Richiesta aggiornata", variant: "success" });
      } else {
        const error = await res.text();
        toast({
          title: "Aggiornamento non riuscito",
          description: error,
          variant: "error",
        });
      }
    } catch (error) {
      console.error("Error updating request", error);
      toast({ title: "Errore di connessione", variant: "error" });
    }
  };

  const deleteRequest = async (id: string) => {
    
    try {
      const res = await fetch(`/api/requests/${id}`, {
        method: "DELETE",
      });

      if (res.ok) {
        setRequests((prev) => prev.filter((req) => req.id !== id));
        toast({ title: "Richiesta eliminata", variant: "success" });
      } else {
        toast({ title: "Eliminazione non riuscita", variant: "error" });
      }
    } catch (error) {
      console.error("Error deleting request", error);
      toast({ title: "Errore di connessione", variant: "error" });
    } finally {
      setDeletingId(null);
    }
  };

  // A skeleton in the panel's own shape, so the page does not jump when the
  // requests land — and so an admin with nothing pending never sees a spinner
  // flash before the panel disappears entirely.
  if (isLoading) {
    return (
      <Card className="space-y-3">
        <Skeleton className="h-4 w-40" />
        <Skeleton className="h-16 w-full" />
      </Card>
    );
  }
  
  if (requests.length === 0) return null;

  return (
    <Card>
      <div className="mb-4 flex items-center gap-2">
        <AlertCircle className="size-4 text-primary" />
        <h2 className="text-sm font-semibold text-foreground">
          Richieste in attesa
        </h2>
        <Badge variant="primary" className="ml-auto">
          {requests.length}
        </Badge>
      </div>

      <div className="space-y-2">
        {requests.map((req) => (
          <div
            key={req.id}
            className="rounded-md border border-border bg-muted/30 p-3"
          >
            {editingId === req.id ? (
              <div className="space-y-4 animate-in fade-in duration-200">
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <Field label="Data inizio">
                    {(field) => (
                      <Input
                        {...field}
                        type="date"
                        value={editForm.startDate || ""}
                        onChange={(e) =>
                          setEditForm({ ...editForm, startDate: e.target.value })
                        }
                      />
                    )}
                  </Field>
                  <Field label="Data fine">
                    {(field) => (
                      <Input
                        {...field}
                        type="date"
                        value={editForm.endDate || ""}
                        onChange={(e) =>
                          setEditForm({ ...editForm, endDate: e.target.value })
                        }
                        disabled={editForm.type === "PERMESSO"}
                      />
                    )}
                  </Field>
                </div>

                <Field label="Tipo">
                  {(field) => (
                    <Select
                      {...field}
                      value={editForm.type || ""}
                      onChange={(e) =>
                        setEditForm({
                          ...editForm,
                          type: e.target.value as LeaveType,
                          endDate: e.target.value === "PERMESSO" ? editForm.startDate : editForm.endDate
                        })
                      }
                    >
                      <option value="VACATION">Ferie</option>
                      <option value="PERMESSO">Permesso</option>
                      <option value="SICKNESS">Malattia</option>
                    </Select>
                  )}
                </Field>
                
                {editForm.type === "PERMESSO" && (
                  <div className="grid grid-cols-2 gap-3">
                    <Field label="Ora inizio">
                      {(field) => (
                        <Input
                          {...field}
                          type="time"
                          value={editForm.startTime || ""}
                          onChange={(e) =>
                            setEditForm({ ...editForm, startTime: e.target.value })
                          }
                        />
                      )}
                    </Field>
                    <Field label="Ora fine">
                      {(field) => (
                        <Input
                          {...field}
                          type="time"
                          value={editForm.endTime || ""}
                          onChange={(e) =>
                            setEditForm({ ...editForm, endTime: e.target.value })
                          }
                        />
                      )}
                    </Field>
                  </div>
                )}
                
                <Field label="Motivazione">
                  {(field) => (
                    <Textarea
                      {...field}
                      rows={2}
                      className="resize-none"
                      value={editForm.reason || ""}
                      onChange={(e) =>
                        setEditForm({ ...editForm, reason: e.target.value })
                      }
                    />
                  )}
                </Field>

                <div className="flex gap-2 pt-1">
                  <Button size="sm" icon={<Save />} onClick={() => saveEdit(req.id)}>
                    Salva
                  </Button>
                  <Button size="sm" variant="outline" icon={<X />} onClick={cancelEdit}>
                    Annulla
                  </Button>
                </div>
              </div>
            ) : (
              <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <p className="text-[13px] font-semibold text-foreground">
                      {req.user.name || req.user.email}
                    </p>
                    <Badge
                      dot
                      variant={
                        req.type === "VACATION"
                          ? "info"
                          : req.type === "SICKNESS"
                            ? "danger"
                            : "warning"
                      }
                    >
                      {req.type === "VACATION" ? "Ferie" : req.type === "SICKNESS" ? "Malattia" : "Permesso"}
                    </Badge>
                  </div>
                  
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Calendar className="h-3.5 w-3.5" />
                    <span>
                      {format(new Date(req.startDate), "d MMM", { locale: it })} -{" "}
                      {format(new Date(req.endDate), "d MMM yyyy", { locale: it })}
                    </span>
                    {req.type === "PERMESSO" && req.startTime && req.endTime && (
                      <>
                        <span className="text-muted-foreground/50">•</span>
                        <Clock className="h-3.5 w-3.5" />
                        <span>
                          {req.startTime} - {req.endTime}
                        </span>
                      </>
                    )}
                  </div>
                  
                  {req.reason && (
                    <p className="text-xs text-muted-foreground italic mt-1">
                      &quot;{req.reason}&quot;
                    </p>
                  )}
                </div>
                
                {/* Approve is the expected outcome, so it is the only filled
                    control; reject and delete step down accordingly. */}
                <div className="flex flex-wrap items-center gap-1.5">
                  <Button
                    size="sm"
                    icon={<CheckCircle />}
                    onClick={() => handleAction(req.id, "APPROVED")}
                  >
                    Approva
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    icon={<XCircle />}
                    onClick={() => handleAction(req.id, "REJECTED")}
                  >
                    Rifiuta
                  </Button>
                  <Button
                    size="icon"
                    variant="ghost"
                    title="Modifica"
                    aria-label="Modifica richiesta"
                    onClick={() => startEdit(req)}
                  >
                    <Edit />
                  </Button>
                  <Button
                    size="icon"
                    variant="ghost"
                    title="Elimina"
                    aria-label="Elimina richiesta"
                    className="hover:bg-destructive-subtle hover:text-destructive"
                    onClick={() => setDeletingId(req.id)}
                  >
                    <Trash2 />
                  </Button>
                </div>
              </div>
            )}
          </div>
        ))}
      </div>

      <ConfirmDialog
        open={deletingId !== null}
        onClose={() => setDeletingId(null)}
        onConfirm={() => deletingId && deleteRequest(deletingId)}
        title="Eliminare la richiesta?"
        description="La richiesta viene rimossa definitivamente e il dipendente non la vedrà più fra le sue."
        confirmLabel="Elimina"
        destructive
      />
    </Card>
  );
}
