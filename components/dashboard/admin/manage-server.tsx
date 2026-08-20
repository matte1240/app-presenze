"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { 
  Database, 
  Download, 
  Upload, 
  RefreshCw, 
  AlertTriangle, 
  FileText,
} from "lucide-react";
import { downloadBlob } from "@/lib/utils/file-utils";
import { Card } from "@/components/ui/card";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/dialog";
import { EmptyState } from "@/components/ui/empty-state";
import { PageContainer, PageHeader, Section } from "@/components/layout/page";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  TableWrapper,
} from "@/components/ui/table";
import { LogViewer } from "@/components/dashboard/admin/log-viewer";

interface Backup {
  filename: string;
  size: number;
  sizeFormatted: string;
  created: string;
  modified: string;
}

export function ManageServer() {
  const router = useRouter();
  const [backups, setBackups] = useState<Backup[]>([]);
  const [pendingRestore, setPendingRestore] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const fetchBackups = useCallback(async () => {
    try {
      setError(null);
      const response = await fetch("/api/admin/backups");

      if (response.status === 401) {
        router.push("/");
        return;
      }

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to fetch backups");
      }

      setBackups(data.backups || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load backups");
      console.error("Error fetching backups:", err);
    }
  }, [router]);

  useEffect(() => {
    fetchBackups();
  }, [fetchBackups]);

  const handleCreateBackup = async () => {
    try {
      setLoading(true);
      setError(null);
      setSuccess(null);

      const response = await fetch("/api/admin/backups", {
        method: "POST",
      });

      if (response.status === 401) {
        router.push("/");
        return;
      }

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to create backup");
      }

      setSuccess(`Backup creato con successo: ${data.filename}`);
      await fetchBackups();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create backup");
      console.error("Error creating backup:", err);
    } finally {
      setLoading(false);
    }
  };

  const handleDownloadBackup = async (filename: string) => {
    try {
      setError(null);
      setSuccess(null);

      const response = await fetch(
        `/api/admin/backups?filename=${encodeURIComponent(filename)}`
      );

      if (response.status === 401) {
        router.push("/");
        return;
      }

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Failed to download backup");
      }

      // Download the blob
      const blob = await response.blob();
      downloadBlob(blob, filename);

      setSuccess(`Backup scaricato: ${filename}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to download backup");
      console.error("Error downloading backup:", err);
    }
  };

  const handleRestoreBackup = async (
    event: React.ChangeEvent<HTMLInputElement>
  ) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (!file.name.endsWith(".db")) {
      setError("Solo file .db sono permessi");
      return;
    }

    // Hold the file and let the confirmation dialog decide: a native
    // window.confirm cannot say what is about to be overwritten, and cannot be
    // styled to look like it belongs to the product.
    setPendingRestore(file);
    event.target.value = "";
  };

  const performRestore = async (file: File) => {
    setPendingRestore(null);

    try {
      setLoading(true);
      setError(null);
      setSuccess(null);

      const formData = new FormData();
      formData.append("file", file);

      const response = await fetch("/api/admin/backups/restore", {
        method: "POST",
        body: formData,
      });

      if (response.status === 401) {
        router.push("/");
        return;
      }

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to restore backup");
      }

      setSuccess(
        `Database ripristinato da: ${file.name}. L'applicazione si sta riavviando, ` +
          `ricarica la pagina tra qualche secondo.`
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to restore backup");
      console.error("Error restoring backup:", err);
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (isoString: string) => {
    return new Date(isoString).toLocaleString("it-IT", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  return (
    <PageContainer width="wide" className="space-y-6">
      <PageHeader
        title="Server"
        description="Backup del database e registro delle operazioni."
      />

      {error && <Alert variant="error" title="Errore">{error}</Alert>}
      {success && <Alert variant="success" title="Fatto">{success}</Alert>}

      <Section title="Backup del database">
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          <Card className="flex flex-col">
            <h3 className="flex items-center gap-2 text-sm font-semibold text-foreground">
              <Download className="size-4 text-muted-foreground" />
              Crea backup
            </h3>
            <p className="mt-1 flex-1 text-[13px] leading-relaxed text-muted-foreground">
              Snapshot consistente del database, eseguito senza fermare
              l&apos;applicazione.
            </p>
            <Button
              className="mt-4 w-full"
              onClick={handleCreateBackup}
              loading={loading}
              icon={<Download />}
            >
              {loading ? "Creazione…" : "Crea backup"}
            </Button>
          </Card>

          <Card className="flex flex-col">
            <h3 className="flex items-center gap-2 text-sm font-semibold text-foreground">
              <Upload className="size-4 text-muted-foreground" />
              Ripristina database
            </h3>
            <p className="mt-1 flex-1 text-[13px] leading-relaxed text-muted-foreground">
              Carica un file <code className="font-mono text-xs">.db</code>{" "}
              creato da un backup precedente.
            </p>
            <label className="mt-4 block cursor-pointer">
              <span className="sr-only">Seleziona un file di backup</span>
              <input
                type="file"
                accept=".db"
                onChange={handleRestoreBackup}
                disabled={loading}
                className="block w-full cursor-pointer text-[13px] text-muted-foreground file:mr-3 file:cursor-pointer file:rounded-md file:border file:border-border file:bg-card file:px-3 file:py-1.5 file:text-[13px] file:font-medium file:text-foreground hover:file:bg-accent disabled:cursor-not-allowed disabled:opacity-50"
              />
            </label>
            <p className="mt-2 flex items-center gap-1.5 text-xs text-destructive">
              <AlertTriangle className="size-3 shrink-0" />
              Sovrascrive tutti i dati e riavvia l&apos;applicazione.
            </p>
          </Card>
        </div>
      </Section>

      <Section
        title={`Backup disponibili (${backups.length})`}
        actions={
          <Button size="sm" variant="ghost" icon={<RefreshCw />} onClick={fetchBackups}>
            Aggiorna
          </Button>
        }
      >
        <TableWrapper>
          {backups.length === 0 ? (
            <EmptyState
              compact
              icon={<Database />}
              title="Nessun backup"
              description="Crea il primo backup per poter ripristinare i dati in caso di problemi."
              action={
                <Button size="sm" onClick={handleCreateBackup} loading={loading}>
                  Crea backup
                </Button>
              }
            />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>File</TableHead>
                  <TableHead>Dimensione</TableHead>
                  <TableHead>Creato</TableHead>
                  <TableHead className="text-right">Azioni</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {backups.map((backup) => (
                  <TableRow key={backup.filename}>
                    <TableCell className="whitespace-nowrap">
                      <span className="flex items-center gap-2 font-mono text-xs text-foreground">
                        <FileText className="size-3.5 shrink-0 text-muted-foreground" />
                        {backup.filename}
                      </span>
                    </TableCell>
                    <TableCell className="whitespace-nowrap text-[13px] text-muted-foreground">
                      {backup.sizeFormatted}
                    </TableCell>
                    <TableCell className="whitespace-nowrap text-[13px] text-muted-foreground">
                      {formatDate(backup.created)}
                    </TableCell>
                    <TableCell className="text-right">
                      <Button
                        size="sm"
                        variant="outline"
                        icon={<Download />}
                        onClick={() => handleDownloadBackup(backup.filename)}
                      >
                        Scarica
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </TableWrapper>
      </Section>

      <Section title="Log di audit">
        <Card noPadding>
          <LogViewer />
        </Card>
      </Section>

      <ConfirmDialog
        open={pendingRestore !== null}
        onClose={() => setPendingRestore(null)}
        onConfirm={() => pendingRestore && performRestore(pendingRestore)}
        title="Ripristinare il database?"
        description={
          pendingRestore
            ? `Tutti i dati attuali vengono sostituiti con il contenuto di "${pendingRestore.name}". L'applicazione si riavvia al termine e l'operazione non può essere annullata.`
            : undefined
        }
        confirmLabel="Ripristina"
        destructive
        loading={loading}
      />
    </PageContainer>
  );
}