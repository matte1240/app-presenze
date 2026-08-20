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
  HardDrive,
  ScrollText
} from "lucide-react";
import { downloadBlob } from "@/lib/utils/file-utils";
import { Card } from "@/components/ui/card";
import { Alert } from "@/components/ui/alert";
import { Spinner } from "@/components/ui/spinner";
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

    if (!file.name.endsWith(".sql")) {
      setError("Solo file .sql sono permessi");
      return;
    }

    const confirmed = window.confirm(
      `⚠️ ATTENZIONE: Il ripristino del database sovrascriverà tutti i dati attuali!\n\n` +
        `Vuoi davvero ripristinare il backup "${file.name}"?\n\n` +
        `Questa operazione non può essere annullata.`
    );

    if (!confirmed) {
      event.target.value = ""; // Reset file input
      return;
    }

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

      setSuccess(`Database ripristinato con successo da: ${file.name}`);
      await fetchBackups();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to restore backup");
      console.error("Error restoring backup:", err);
    } finally {
      setLoading(false);
      event.target.value = ""; // Reset file input
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
    <div className="min-h-screen bg-background py-8 px-4">
      <div className="max-w-6xl mx-auto">
        <Card>
          <div className="flex items-center gap-3 mb-6">
            <div className="p-2 bg-primary/10 rounded-lg">
              <Database className="w-6 h-6 text-primary" />
            </div>
            <h1 className="text-3xl font-bold text-foreground">
              Gestione Server
            </h1>
          </div>

          {/* Alerts */}
          {error && (
            <Alert variant="error" className="mb-6" title="Errore">{error}</Alert>
          )}

          {success && (
            <Alert variant="success" className="mb-6" title="Successo">{success}</Alert>
          )}

          {/* Actions */}
          <div className="mb-8 space-y-4">
            <h2 className="text-xl font-semibold text-foreground mb-4 flex items-center gap-2">
              <HardDrive className="w-5 h-5 text-muted-foreground" />
              Azioni Database
            </h2>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Create Backup */}
              <div className="border border-border rounded-xl p-6 bg-card hover:bg-muted/50 transition-colors">
                <h3 className="font-semibold text-foreground mb-2 flex items-center gap-2">
                  <Download className="w-4 h-4 text-primary" />
                  Crea Backup
                </h3>
                <p className="text-sm text-muted-foreground mb-4">
                  Crea un dump completo del database PostgreSQL
                </p>
                <button
                  onClick={handleCreateBackup}
                  disabled={loading}
                  className="w-full bg-primary hover:bg-primary/90 text-primary-foreground font-semibold py-2 px-4 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2 cursor-pointer"
                >
                  {loading ? <Spinner size="sm" /> : <Download className="w-4 h-4" />}
                  {loading ? "Creazione in corso..." : "Crea Backup"}
                </button>
              </div>

              {/* Restore Backup */}
              <div className="border border-border rounded-xl p-6 bg-card hover:bg-muted/50 transition-colors">
                <h3 className="font-semibold text-foreground mb-2 flex items-center gap-2">
                  <Upload className="w-4 h-4 text-destructive" />
                  Ripristina Database
                </h3>
                <p className="text-sm text-muted-foreground mb-4">
                  Carica un file .sql per ripristinare il database
                </p>
                <label className="block cursor-pointer">
                  <input
                    type="file"
                    accept=".sql"
                    onChange={handleRestoreBackup}
                    disabled={loading}
                    className="block w-full text-sm text-muted-foreground file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-semibold file:bg-destructive/10 file:text-destructive hover:file:bg-destructive/20 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
                  />
                </label>
                <p className="text-xs text-destructive mt-2 flex items-center gap-1">
                  <AlertTriangle className="w-3 h-3" />
                  Attenzione: questa operazione sovrascriverà tutti i dati!
                </p>
              </div>
            </div>
          </div>

          {/* Backups List */}
          <div>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-semibold text-foreground flex items-center gap-2">
                <FileText className="w-5 h-5 text-muted-foreground" />
                Backup Disponibili ({backups.length})
              </h2>
              <button
                onClick={fetchBackups}
                className="text-primary hover:text-primary/80 font-medium text-sm flex items-center gap-1 transition-colors cursor-pointer"
              >
                <RefreshCw className="w-4 h-4" />
                Aggiorna Lista
              </button>
            </div>

            {backups.length === 0 ? (
              <div className="text-center py-12 border-2 border-dashed border-border rounded-xl bg-muted/30">
                <Database className="w-12 h-12 text-muted-foreground mx-auto mb-3 opacity-50" />
                <p className="text-muted-foreground font-medium">Nessun backup disponibile</p>
                <p className="text-sm text-muted-foreground mt-1">
                  Crea il primo backup usando il pulsante sopra
                </p>
              </div>
            ) : (
              <div className="overflow-hidden rounded-xl border border-border bg-card">
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-border">
                    <thead className="bg-muted/50">
                      <tr>
                        <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                          Nome File
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                          Dimensione
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                          Data Creazione
                        </th>
                        <th className="px-6 py-3 text-right text-xs font-medium text-muted-foreground uppercase tracking-wider">
                          Azioni
                        </th>
                      </tr>
                    </thead>
                    <tbody className="bg-card divide-y divide-border">
                      {backups.map((backup) => (
                        <tr key={backup.filename} className="hover:bg-muted/50 transition-colors">
                          <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-foreground flex items-center gap-2">
                            <FileText className="w-4 h-4 text-muted-foreground" />
                            {backup.filename}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-muted-foreground">
                            {backup.sizeFormatted}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-muted-foreground">
                            {formatDate(backup.created)}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                            <button
                              onClick={() => handleDownloadBackup(backup.filename)}
                              className="text-primary hover:text-primary/80 transition-colors inline-flex items-center gap-1 cursor-pointer"
                            >
                              <Download className="w-4 h-4" />
                              Scarica
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        </Card>

        {/* Audit Logs */}
        <Card>
          <div className="flex items-center gap-3 mb-6">
            <div className="p-2 bg-primary/10 rounded-lg">
              <ScrollText className="w-6 h-6 text-primary" />
            </div>
            <h2 className="text-2xl font-bold text-foreground">
              Log di Audit
            </h2>
          </div>
          <LogViewer />
        </Card>
      </div>
    </div>
  );
}