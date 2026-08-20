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
  Loader2,
  Save,
  X
} from "lucide-react";
import { cn } from "@/lib/utils";
import { LeaveType } from "@/types/models";

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
      } else {
        alert("Failed to update request status");
      }
    } catch (error) {
      console.error("Error updating request", error);
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
      } else {
        const error = await res.text();
        alert(`Failed to update request: ${error}`);
      }
    } catch (error) {
      console.error("Error updating request", error);
      alert("Error updating request");
    }
  };

  const deleteRequest = async (id: string) => {
    if (!confirm("Sei sicuro di voler eliminare questa richiesta?")) return;
    
    try {
      const res = await fetch(`/api/requests/${id}`, {
        method: "DELETE",
      });

      if (res.ok) {
        setRequests((prev) => prev.filter((req) => req.id !== id));
      } else {
        alert("Failed to delete request");
      }
    } catch (error) {
      console.error("Error deleting request", error);
    }
  };

  if (isLoading) return (
    <div className="flex items-center justify-center p-8">
      <Loader2 className="h-8 w-8 animate-spin text-primary" />
    </div>
  );
  
  if (requests.length === 0) return null;

  return (
    <div className="rounded-xl border border-border bg-card p-5 shadow-sm animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="flex items-center gap-2 mb-4">
        <AlertCircle className="h-5 w-5 text-primary" />
        <h2 className="text-lg font-semibold text-foreground">
          Richieste in Attesa
        </h2>
        <span className="ml-auto rounded-full bg-primary/10 px-2.5 py-0.5 text-xs font-medium text-primary">
          {requests.length}
        </span>
      </div>
      
      <div className="space-y-3">
        {requests.map((req) => (
          <div
            key={req.id}
            className="rounded-lg border border-border bg-muted/30 p-3 transition-all hover:bg-muted/50"
          >
            {editingId === req.id ? (
              <div className="space-y-4 animate-in fade-in duration-200">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-xs font-medium text-muted-foreground">
                      Data Inizio
                    </label>
                    <input
                      type="date"
                      className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                      value={editForm.startDate || ""}
                      onChange={(e) =>
                        setEditForm({ ...editForm, startDate: e.target.value })
                      }
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs font-medium text-muted-foreground">
                      Data Fine
                    </label>
                    <input
                      type="date"
                      className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
                      value={editForm.endDate || ""}
                      onChange={(e) =>
                        setEditForm({ ...editForm, endDate: e.target.value })
                      }
                      disabled={editForm.type === "PERMESSO"}
                    />
                  </div>
                </div>
                
                <div className="space-y-2">
                  <label className="text-xs font-medium text-muted-foreground">
                    Tipo
                  </label>
                  <select
                    className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
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
                  </select>
                </div>
                
                {editForm.type === "PERMESSO" && (
                  <div className="grid grid-cols-2 gap-4 animate-in slide-in-from-top-2">
                    <div className="space-y-2">
                      <label className="text-xs font-medium text-muted-foreground">
                        Ora Inizio
                      </label>
                      <input
                        type="time"
                        className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                        value={editForm.startTime || ""}
                        onChange={(e) =>
                          setEditForm({ ...editForm, startTime: e.target.value })
                        }
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-xs font-medium text-muted-foreground">
                        Ora Fine
                      </label>
                      <input
                        type="time"
                        className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                        value={editForm.endTime || ""}
                        onChange={(e) =>
                          setEditForm({ ...editForm, endTime: e.target.value })
                        }
                      />
                    </div>
                  </div>
                )}
                
                <div className="space-y-2">
                  <label className="text-xs font-medium text-muted-foreground">
                    Motivazione
                  </label>
                  <textarea
                    className="flex min-h-[60px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50 resize-none"
                    rows={2}
                    value={editForm.reason || ""}
                    onChange={(e) =>
                      setEditForm({ ...editForm, reason: e.target.value })
                    }
                  />
                </div>
                
                <div className="flex gap-2 pt-2">
                  <button
                    onClick={() => saveEdit(req.id)}
                    className="inline-flex items-center justify-center rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 bg-primary text-primary-foreground hover:bg-primary/90 h-9 px-4 py-2"
                  >
                    <Save className="mr-2 h-4 w-4" />
                    Salva
                  </button>
                  <button
                    onClick={cancelEdit}
                    className="inline-flex items-center justify-center rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 border border-input bg-background hover:bg-accent hover:text-accent-foreground h-9 px-4 py-2"
                  >
                    <X className="mr-2 h-4 w-4" />
                    Annulla
                  </button>
                </div>
              </div>
            ) : (
              <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <p className="font-semibold text-foreground">
                      {req.user.name || req.user.email}
                    </p>
                    <span className={cn(
                      "inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium",
                      req.type === "VACATION" && "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400",
                      req.type === "SICKNESS" && "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400",
                      req.type === "PERMESSO" && "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400"
                    )}>
                      {req.type === "VACATION" ? "Ferie" : req.type === "SICKNESS" ? "Malattia" : "Permesso"}
                    </span>
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
                
                <div className="flex flex-wrap gap-2">
                  <button
                    onClick={() => startEdit(req)}
                    className="inline-flex items-center justify-center rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 border border-input bg-background hover:bg-accent hover:text-accent-foreground h-8 w-8 p-0"
                    title="Modifica"
                  >
                    <Edit className="h-4 w-4" />
                  </button>
                  <button
                    onClick={() => handleAction(req.id, "APPROVED")}
                    className="inline-flex items-center justify-center rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 bg-emerald-100 text-emerald-700 hover:bg-emerald-200 dark:bg-emerald-900/30 dark:text-emerald-400 dark:hover:bg-emerald-900/50 h-8 px-3"
                    title="Approva"
                  >
                    <CheckCircle className="mr-1.5 h-4 w-4" />
                    Approva
                  </button>
                  <button
                    onClick={() => handleAction(req.id, "REJECTED")}
                    className="inline-flex items-center justify-center rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 bg-rose-100 text-rose-700 hover:bg-rose-200 dark:bg-rose-900/30 dark:text-rose-400 dark:hover:bg-rose-900/50 h-8 px-3"
                    title="Rifiuta"
                  >
                    <XCircle className="mr-1.5 h-4 w-4" />
                    Rifiuta
                  </button>
                  <button
                    onClick={() => deleteRequest(req.id)}
                    className="inline-flex items-center justify-center rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 border border-destructive/30 bg-destructive/10 text-destructive hover:bg-destructive/20 h-8 w-8 p-0"
                    title="Elimina"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
