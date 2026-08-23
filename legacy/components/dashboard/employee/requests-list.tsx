"use client";

import { useState, useEffect } from "react";
import { format } from "date-fns";
import { it } from "date-fns/locale";
import RequestLeaveModal from "./request-leave-modal";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/dialog";
import { EmptyState } from "@/components/ui/empty-state";
import { Select } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  TableToolbar,
  TableWrapper,
} from "@/components/ui/table";
import { useToast } from "@/components/ui/toast";
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
  const [pendingAction, setPendingAction] = useState<
    { id: string; status: "APPROVED" | "REJECTED" } | null
  >(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const toast = useToast();

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
    setPendingAction(null);
    try {
      const res = await fetch(`/api/requests/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });

      if (res.ok) {
        fetchRequests();
        toast({
          title:
            status === "APPROVED" ? "Richiesta approvata" : "Richiesta rifiutata",
          variant: "success",
        });
      } else {
        const msg = await res.text();
        toast({
          title: "Aggiornamento non riuscito",
          description: msg,
          variant: "error",
        });
      }
    } catch (error) {
      console.error("Error updating request", error);
      toast({ title: "Errore di connessione", variant: "error" });
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
    setDeletingId(null);
    try {
      const res = await fetch(`/api/requests/${id}`, {
        method: "DELETE",
      });

      if (res.ok) {
        fetchRequests();
        toast({ title: "Richiesta eliminata", variant: "success" });
      } else {
        toast({ title: "Eliminazione non riuscita", variant: "error" });
      }
    } catch (error) {
      console.error("Error deleting request", error);
      toast({ title: "Errore di connessione", variant: "error" });
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "APPROVED":
        return (
          <Badge variant="success">
            <CheckCircle2 className="size-3" />
            Approvata
          </Badge>
        );
      case "REJECTED":
        return (
          <Badge variant="danger">
            <XCircle className="size-3" />
            Rifiutata
          </Badge>
        );
      default:
        return (
          <Badge variant="warning">
            <Clock className="size-3" />
            In attesa
          </Badge>
        );
    }
  };

  const typeVariant = (type: string) =>
    type === "VACATION" ? "info" : type === "SICKNESS" ? "danger" : "warning";

  const getTypeLabel = (type: string) => {
    switch (type) {
      case "VACATION": return "Ferie";
      case "SICKNESS": return "Malattia";
      case "PERMESSO": return "Permesso";
      default: return type;
    }
  };

  const filterControl = (
    <div className="relative">
      <Filter className="pointer-events-none absolute left-3 top-1/2 z-10 size-4 -translate-y-1/2 text-muted-foreground" />
      <Select
        aria-label="Filtra per stato"
        value={filterStatus}
        onChange={(e) => setFilterStatus(e.target.value)}
        className="w-auto pl-9"
      >
        <option value="ALL">Tutti gli stati</option>
        <option value="PENDING">In attesa</option>
        <option value="APPROVED">Approvate</option>
        <option value="REJECTED">Rifiutate</option>
      </Select>
    </div>
  );

  return (
    <TableWrapper>
      <TableToolbar
        title="Richieste"
        description={
          isAdmin
            ? "Ferie e permessi richiesti dal team."
            : "Lo stato delle tue richieste di ferie e permessi."
        }
        actions={filterControl}
      />

      {isLoading ? (
        <div className="space-y-2 p-4">
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} className="h-12 w-full" />
          ))}
        </div>
      ) : requests.length === 0 ? (
        <EmptyState
          compact
          icon={<Clock />}
          title="Nessuna richiesta"
          description={
            filterStatus === "ALL"
              ? isAdmin
                ? "Quando il team richiederà ferie o permessi, le richieste compariranno qui."
                : "Non hai ancora inviato richieste di ferie o permessi."
              : "Nessuna richiesta corrisponde al filtro selezionato."
          }
        />
      ) : (
        <>
          {/* Desktop Table View */}
          <div className="hidden md:block">
            <Table>
              <TableHeader>
                <TableRow>
                  {isAdmin && <TableHead>Utente</TableHead>}
                  <TableHead>Tipo</TableHead>
                  <TableHead>Periodo</TableHead>
                  <TableHead>Stato</TableHead>
                  <TableHead>Motivazione</TableHead>
                  {isAdmin && <TableHead className="text-right">Azioni</TableHead>}
                </TableRow>
              </TableHeader>
              <TableBody>
                {requests.map((req) => (
                  <TableRow key={req.id}>
                    {isAdmin && (
                      <TableCell className="whitespace-nowrap text-[13px] font-medium">
                        {req.user.name || req.user.email}
                      </TableCell>
                    )}
                    <TableCell className="whitespace-nowrap">
                      <Badge dot variant={typeVariant(req.type)}>
                        {getTypeLabel(req.type)}
                      </Badge>
                    </TableCell>
                    <TableCell className="whitespace-nowrap text-[13px] text-muted-foreground">
                      <div className="flex flex-col">
                        <span>
                          {format(new Date(req.startDate), "d MMM", { locale: it })} -{" "}
                          {format(new Date(req.endDate), "d MMM yyyy", { locale: it })}
                        </span>
                        {req.type === "PERMESSO" && req.startTime && req.endTime && (
                          <span className="mt-0.5 text-xs text-muted-foreground/70">
                            {req.startTime} – {req.endTime}
                          </span>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="whitespace-nowrap">
                      {getStatusBadge(req.status)}
                    </TableCell>
                    <TableCell
                      className="max-w-xs truncate text-[13px] text-muted-foreground"
                      title={req.reason}
                    >
                      {req.reason || <span className="text-muted-foreground/50">—</span>}
                    </TableCell>
                    {isAdmin && (
                      <TableCell className="whitespace-nowrap text-right">
                        <div className="flex justify-end gap-1">
                          <Button
                            size="icon"
                            variant="ghost"
                            title="Modifica"
                            aria-label="Modifica richiesta"
                            onClick={() => startEdit(req)}
                          >
                            <Edit2 />
                          </Button>
                          {req.status === "PENDING" && (
                            <>
                              <Button
                                size="icon"
                                variant="ghost"
                                title="Approva"
                                aria-label="Approva richiesta"
                                className="hover:bg-success-subtle hover:text-success"
                                onClick={() =>
                                  setPendingAction({ id: req.id, status: "APPROVED" })
                                }
                              >
                                <Check />
                              </Button>
                              <Button
                                size="icon"
                                variant="ghost"
                                title="Rifiuta"
                                aria-label="Rifiuta richiesta"
                                className="hover:bg-destructive-subtle hover:text-destructive"
                                onClick={() =>
                                  setPendingAction({ id: req.id, status: "REJECTED" })
                                }
                              >
                                <X />
                              </Button>
                            </>
                          )}
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
                      </TableCell>
                    )}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>

          {/* Mobile Card View */}
          <div className="space-y-2 p-3 md:hidden">
            {requests.map((req) => (
              <div key={req.id} className="space-y-3 rounded-md border border-border p-3">
                <div className="flex items-start justify-between">
                  <div className="space-y-1">
                    {isAdmin && (
                      <p className="font-semibold text-foreground">
                        {req.user.name || req.user.email}
                      </p>
                    )}
                    <div className="flex items-center gap-2">
                      <Badge dot variant={typeVariant(req.type)}>
                        {getTypeLabel(req.type)}
                      </Badge>
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
                    <Button size="icon" variant="ghost" title="Modifica" onClick={() => startEdit(req)}>
                      <Edit2 />
                    </Button>
                    {req.status === "PENDING" && (
                      <>
                        <Button
                          size="icon"
                          variant="ghost"
                          title="Approva"
                          className="hover:bg-success-subtle hover:text-success"
                          onClick={() => setPendingAction({ id: req.id, status: "APPROVED" })}
                        >
                          <Check />
                        </Button>
                        <Button
                          size="icon"
                          variant="ghost"
                          title="Rifiuta"
                          className="hover:bg-destructive-subtle hover:text-destructive"
                          onClick={() => setPendingAction({ id: req.id, status: "REJECTED" })}
                        >
                          <X />
                        </Button>
                      </>
                    )}
                    <Button
                      size="icon"
                      variant="ghost"
                      title="Elimina"
                      className="hover:bg-destructive-subtle hover:text-destructive"
                      onClick={() => setDeletingId(req.id)}
                    >
                      <Trash2 />
                    </Button>
                  </div>
                )}
              </div>
            ))}
          </div>
        </>
      )}

      <RequestLeaveModal
        isOpen={isModalOpen}
        onClose={closeModal}
        editRequest={editingRequest}
      />

      <ConfirmDialog
        open={pendingAction !== null}
        onClose={() => setPendingAction(null)}
        onConfirm={() =>
          pendingAction && handleAction(pendingAction.id, pendingAction.status)
        }
        title={
          pendingAction?.status === "APPROVED"
            ? "Approvare la richiesta?"
            : "Rifiutare la richiesta?"
        }
        description={
          pendingAction?.status === "APPROVED"
            ? "Il dipendente riceve una notifica e le ore di assenza vengono registrate a calendario."
            : "Il dipendente riceve una notifica del rifiuto."
        }
        confirmLabel={pendingAction?.status === "APPROVED" ? "Approva" : "Rifiuta"}
        destructive={pendingAction?.status === "REJECTED"}
      />

      <ConfirmDialog
        open={deletingId !== null}
        onClose={() => setDeletingId(null)}
        onConfirm={() => deletingId && deleteRequest(deletingId)}
        title="Eliminare la richiesta?"
        description="La richiesta viene rimossa definitivamente."
        confirmLabel="Elimina"
        destructive
      />
    </TableWrapper>
  );
}
