import { useQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { Database, Download, Upload } from "lucide-react";
import { useRef, useState } from "react";
import { formatDateIt, type LocalDate } from "@core/date";
import { ApiError } from "../../api/client";
import { backupsQuery, downloadBackup, useCreateBackup, useRestoreBackup } from "../../api/admin";
import { t } from "../../i18n/it";
import {
  Alert,
  Button,
  Card,
  CardHeader,
  Dialog,
  EmptyState,
  SkeletonRows,
  Table,
  TableWrapper,
  TBody,
  TD,
  TH,
  THead,
  TR,
  useToast,
} from "../../ui/primitives";

export const Route = createFileRoute("/_app/manutenzione")({ component: MaintenancePage });

const megabytes = (bytes: number) => `${(bytes / 1024 / 1024).toFixed(1)} MB`;

function MaintenancePage() {
  const toast = useToast();
  const backups = useQuery(backupsQuery);
  const create = useCreateBackup();
  const [restoreOpen, setRestoreOpen] = useState(false);

  return (
    <div className="space-y-4">
      <header>
        <h2 className="text-display font-semibold tracking-[-0.02em]">{t.maintenance.title}</h2>
        <p className="mt-0.5 text-label text-muted-foreground">{t.maintenance.subtitle}</p>
      </header>

      <Card>
        <CardHeader
          title={t.maintenance.backups}
          actions={
            <>
              <Button variant="outline" onClick={() => setRestoreOpen(true)}>
                <Upload aria-hidden />
                {t.maintenance.restore}
              </Button>
              <Button
                loading={create.isPending}
                onClick={async () => {
                  try {
                    await create.mutateAsync();
                    toast.success(t.maintenance.created);
                  } catch (error) {
                    toast.error(error instanceof ApiError ? error.message : t.app.genericError);
                  }
                }}
              >
                {t.maintenance.createBackup}
              </Button>
            </>
          }
        />

        {backups.isLoading ? (
          <div className="p-5">
            <SkeletonRows rows={3} />
          </div>
        ) : (backups.data ?? []).length === 0 ? (
          <EmptyState icon={Database} title={t.maintenance.empty} />
        ) : (
          <TableWrapper className="rounded-none border-0">
            <Table>
              <THead>
                <TR>
                  <TH>File</TH>
                  <TH>{t.maintenance.date}</TH>
                  <TH numeric>{t.maintenance.size}</TH>
                  <TH className="text-right">Azioni</TH>
                </TR>
              </THead>
              <TBody>
                {(backups.data ?? []).map((backup) => (
                  <TR key={backup.filename}>
                    <TD className="font-mono text-[12px]">{backup.filename}</TD>
                    <TD>{formatDateIt(backup.createdAt.slice(0, 10) as LocalDate)}</TD>
                    <TD numeric>{megabytes(backup.sizeBytes)}</TD>
                    <TD className="text-right">
                      <Button size="sm" variant="ghost" onClick={() => void downloadBackup(backup.filename)}>
                        <Download aria-hidden />
                        {t.maintenance.download}
                      </Button>
                    </TD>
                  </TR>
                ))}
              </TBody>
            </Table>
          </TableWrapper>
        )}
      </Card>

      <RestoreDialog open={restoreOpen} onOpenChange={setRestoreOpen} />
    </div>
  );
}

function RestoreDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const toast = useToast();
  const restore = useRestoreBackup();
  const inputRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);

  const submit = async () => {
    if (!file) return;
    try {
      const result = await restore.mutateAsync(file);
      toast.success(t.maintenance.restoreDone(result.safetyCopy));
      setFile(null);
      onOpenChange(false);
    } catch (error) {
      toast.error(error instanceof ApiError ? error.message : t.app.genericError);
    }
  };

  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      title={t.maintenance.restoreTitle}
      footer={
        <>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            {t.app.cancel}
          </Button>
          <Button variant="destructive" disabled={!file} loading={restore.isPending} onClick={submit}>
            {t.maintenance.restore}
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <Alert tone="warning">{t.maintenance.restoreWarning}</Alert>

        <input
          ref={inputRef}
          type="file"
          accept=".db"
          className="hidden"
          onChange={(event) => setFile(event.target.files?.[0] ?? null)}
        />

        <Button variant="outline" onClick={() => inputRef.current?.click()}>
          {t.maintenance.chooseFile}
        </Button>

        {file ? (
          <p className="mt-0.5 text-label text-muted-foreground">
            {file.name} — {megabytes(file.size)}
          </p>
        ) : null}
      </div>
    </Dialog>
  );
}
