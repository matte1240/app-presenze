"use client";

import { useState, useEffect } from "react";
import { format } from "date-fns";
import { it } from "date-fns/locale";
import RequestLeaveModal from "./request-leave-modal";
import { cn } from "@/lib/utils";
import { 
  CheckCircle2, 
  XCircle, 
  Clock, 
  Edit2, 
  Trash2, 
  Check, 
  X,
  Filter
} from "lucide-react";

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

type RequestsListProps = {
  isAdmin: boolean;
};

export default function RequestsList({ isAdmin }: RequestsListProps) {
  const [requests, setRequests] = useState<LeaveRequest[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [filterStatus, setFilterStatus] = useState<string>("ALL");
  const [editingRequest, setEditingRequest] = useState<LeaveRequest | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);

  const fetchRequests = async () => {
    setIsLoading(true);
    try {
      let url = "/api/requests?";
      if (filterStatus !== "ALL") {
        url += `status=${filterStatus}&`;
      }
      // If not admin, the API automatically filters by current user
      // If admin, we can optionally filter by userId if provided (though for the main list we might want all)
      
      const res = await fetch(url);
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filterStatus]);

  const handleAction = async (id: string, status: "APPROVED" | "REJECTED") => {
    if (!confirm(`Sei sicuro di voler impostare lo stato a ${status}?`)) return;
    
    try {
      const res = await fetch(`/api/requests/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });

      if (res.ok) {
        // Refresh list
        fetchRequests();
      } else {
        const msg = await res.text();
        alert(`Errore: ${msg}`);
      }
    } catch (error) {
      console.error("Error updating request", error);
      alert("Errore di connessione");
    }
  };

  const startEdit = (req: LeaveRequest) => {
    setEditingRequest(req);
    setIsModalOpen(true);
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setEditingRequest(null);
  };

  const deleteRequest = async (id: string) => {
    if (!confirm("Sei sicuro di voler eliminare questa richiesta?")) return;
    
    try {
      const res = await fetch(`/api/requests/${id}`, {
        method: "DELETE",
      });

      if (res.ok) {
        fetchRequests();
      } else {
        alert("Errore nell'eliminazione");
      }
    } catch (error) {
      console.error("Error deleting request", error);
      alert("Errore di connessione");
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "APPROVED":
        return (
          <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-100 dark:bg-emerald-900/30 px-2.5 py-0.5 text-xs font-medium text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800">
            <CheckCircle2 className="h-3.5 w-3.5" />
            Approvata
          </span>
        );
      case "REJECTED":
        return (
          <span className="inline-flex items-center gap-1.5 rounded-full bg-destructive/10 px-2.5 py-0.5 text-xs font-medium text-destructive border border-destructive/20">
            <XCircle className="h-3.5 w-3.5" />
            Rifiutata
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1.5 rounded-full bg-yellow-100 dark:bg-yellow-900/30 px-2.5 py-0.5 text-xs font-medium text-yellow-700 dark:text-yellow-400 border border-yellow-200 dark:border-yellow-800">
            <Clock className="h-3.5 w-3.5" />
            In Attesa
          </span>
        );
    }
  };

  const getTypeLabel = (type: string) => {
    switch (type) {
      case "VACATION": return "Ferie";
      case "SICKNESS": return "Malattia";
      case "PERMESSO": return "Permesso";
      default: return type;
    }
  };

  return (
    <div className="overflow-hidden rounded-xl border border-border bg-card shadow-sm">
      <div className="px-6 py-4 border-b border-border flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 bg-muted/30">
        <div>
          <h2 className="text-lg font-semibold text-foreground">
            Gestione Richieste
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            {isAdmin
              ? "Gestisci le richieste di ferie e permessi dei dipendenti."
              : "Visualizza lo stato delle tue richieste di ferie e permessi."}
          </p>
        </div>
        <div className="relative">
          <Filter className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
            className="pl-9 pr-8 h-10 rounded-lg border border-input bg-background text-sm text-foreground shadow-sm transition-all hover:bg-accent/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 cursor-pointer"
          >
            <option value="ALL">Tutti gli stati</option>
            <option value="PENDING">In Attesa</option>
            <option value="APPROVED">Approvate</option>
            <option value="REJECTED">Rifiutate</option>
          </select>
        </div>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-12 text-muted-foreground">
          <div className="flex flex-col items-center gap-2">
            <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent"></div>
            <p className="text-sm">Caricamento richieste...</p>
          </div>
        </div>
      ) : requests.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
          <div className="rounded-full bg-muted p-4 mb-3">
            <Clock className="h-8 w-8 text-muted-foreground/50" />
          </div>
          <p className="text-sm font-medium">Nessuna richiesta trovata</p>
        </div>
      ) : (
        <div className="space-y-4 p-4">
          {/* Desktop Table View */}
          <div className="hidden md:block overflow-x-auto rounded-lg border border-border">
            <table className="min-w-full divide-y divide-border">
              <thead className="bg-muted/50">
                <tr>
                  {isAdmin && (
                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground">
                      Utente
                    </th>
                  )}
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground">
                    Tipo
                  </th>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground">
                    Periodo
                  </th>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground">
                    Stato
                  </th>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground">
                    Motivazione
                  </th>
                  {isAdmin && (
                    <th scope="col" className="px-6 py-3 text-right text-xs font-medium uppercase tracking-wider text-muted-foreground">
                      Azioni
                    </th>
                  )}
                </tr>
              </thead>
              <tbody className="divide-y divide-border bg-card">
                {requests.map((req) => (
                  <tr key={req.id} className="hover:bg-muted/30 transition-colors">
                    {isAdmin && (
                      <td className="whitespace-nowrap px-6 py-4">
                        <div className="flex items-center">
                          <div className="text-sm font-medium text-foreground">
                            {req.user.name || req.user.email}
                          </div>
                        </div>
                      </td>
                    )}
                    <td className="whitespace-nowrap px-6 py-4 text-sm text-muted-foreground">
                      {getTypeLabel(req.type)}
                    </td>
                    <td className="whitespace-nowrap px-6 py-4 text-sm text-muted-foreground">
                      <div className="flex flex-col">
                        <span>
                          {format(new Date(req.startDate), "d MMM", { locale: it })} -{" "}
                          {format(new Date(req.endDate), "d MMM yyyy", { locale: it })}
                        </span>
                        {req.type === "PERMESSO" && req.startTime && req.endTime && (
                          <span className="text-xs text-muted-foreground/70 mt-0.5">
                            {req.startTime} - {req.endTime}
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="whitespace-nowrap px-6 py-4">
                      {getStatusBadge(req.status)}
                    </td>
                    <td className="px-6 py-4 text-sm text-muted-foreground max-w-xs truncate" title={req.reason}>
                      {req.reason || "-"}
                    </td>
                    {isAdmin && (
                      <td className="whitespace-nowrap px-6 py-4 text-right text-sm font-medium">
                        <div className="flex justify-end gap-2">
                          <button
                            onClick={() => startEdit(req)}
                            className="p-1.5 text-muted-foreground hover:text-primary hover:bg-primary/10 rounded-md transition-colors"
                            title="Modifica"
                          >
                            <Edit2 className="h-4 w-4" />
                          </button>
                          {req.status === "PENDING" && (
                            <>
                              <button
                                onClick={() => handleAction(req.id, "APPROVED")}
                                className="p-1.5 text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50 dark:hover:bg-emerald-900/20 rounded-md transition-colors"
                                title="Approva"
                              >
                                <Check className="h-4 w-4" />
                              </button>
                              <button
                                onClick={() => handleAction(req.id, "REJECTED")}
                                className="p-1.5 text-destructive hover:text-destructive/80 hover:bg-destructive/10 rounded-md transition-colors"
                                title="Rifiuta"
                              >
                                <X className="h-4 w-4" />
                              </button>
                            </>
                          )}
                          <button
                            onClick={() => deleteRequest(req.id)}
                            className="p-1.5 text-muted-foreground hover:text-destructive hover:bg-destructive/10 rounded-md transition-colors"
                            title="Elimina"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Mobile Card View */}
          <div className="md:hidden space-y-4">
            {requests.map((req) => (
              <div key={req.id} className="rounded-lg border border-border bg-card p-4 shadow-sm space-y-3">
                <div className="flex items-start justify-between">
                  <div className="space-y-1">
                    {isAdmin && (
                      <p className="font-semibold text-foreground">
                        {req.user.name || req.user.email}
                      </p>
                    )}
                    <div className="flex items-center gap-2">
                      <span className={cn(
                        "inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium",
                        req.type === "VACATION" && "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400",
                        req.type === "SICKNESS" && "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400",
                        req.type === "PERMESSO" && "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400"
                      )}>
                        {getTypeLabel(req.type)}
                      </span>
                      {getStatusBadge(req.status)}
                    </div>
                  </div>
                </div>

                <div className="text-sm text-muted-foreground space-y-1">
                  <div className="flex items-center gap-2">
                    <Clock className="h-3.5 w-3.5" />
                    <span>
                      {format(new Date(req.startDate), "d MMM", { locale: it })} -{" "}
                      {format(new Date(req.endDate), "d MMM yyyy", { locale: it })}
                    </span>
                  </div>
                  {req.type === "PERMESSO" && req.startTime && req.endTime && (
                    <div className="flex items-center gap-2 pl-5.5">
                      <span className="text-xs">
                        {req.startTime} - {req.endTime}
                      </span>
                    </div>
                  )}
                  {req.reason && (
                    <p className="text-xs italic mt-2 border-l-2 border-muted pl-2">
                      &quot;{req.reason}&quot;
                    </p>
                  )}
                </div>

                {isAdmin && (
                  <div className="flex items-center justify-end gap-2 pt-2 border-t border-border mt-2">
                    <button
                      onClick={() => startEdit(req)}
                      className="p-2 text-muted-foreground hover:text-primary hover:bg-primary/10 rounded-md transition-colors"
                      title="Modifica"
                    >
                      <Edit2 className="h-4 w-4" />
                    </button>
                    {req.status === "PENDING" && (
                      <>
                        <button
                          onClick={() => handleAction(req.id, "APPROVED")}
                          className="p-2 text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50 dark:hover:bg-emerald-900/20 rounded-md transition-colors"
                          title="Approva"
                        >
                          <Check className="h-4 w-4" />
                        </button>
                        <button
                          onClick={() => handleAction(req.id, "REJECTED")}
                          className="p-2 text-destructive hover:text-destructive/80 hover:bg-destructive/10 rounded-md transition-colors"
                          title="Rifiuta"
                        >
                          <X className="h-4 w-4" />
                        </button>
                      </>
                    )}
                    <button
                      onClick={() => deleteRequest(req.id)}
                      className="p-2 text-muted-foreground hover:text-destructive hover:bg-destructive/10 rounded-md transition-colors"
                      title="Elimina"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      <RequestLeaveModal
        isOpen={isModalOpen}
        onClose={closeModal}
        editRequest={editingRequest}
      />
    </div>
  );
}
