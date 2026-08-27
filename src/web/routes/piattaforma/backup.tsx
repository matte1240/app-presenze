import { useQuery } from "@tanstack/react-query";
import { createFileRoute, redirect } from "@tanstack/react-router";
import { DatabaseBackup, Download, Plus, Trash2 } from "lucide-react";
import { useState } from "react";
import { ApiError } from "../../api/client";
import {
  downloadBackup,
  platformBackupsQuery,
  platformMeQuery,
  useCreateBackup,
  useDeleteBackup,
  usePruneBackups,
  useRestoreBackup,
  type StoredBackup,
} from "../../api/platform";
import { t } from "../../i18n/it";
import {
  Alert,
  Button,
  Card,
  CardHeader,
  ConfirmDialog,
  Dialog,
  EmptyState,
  Field,
  Input,
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

export const Route = createFileRoute("/piattaforma/backup")({
  beforeLoad: async ({ context }) => {
    const me = await context.queryClient.ensureQueryData(platformMeQuery);
    if (!me) throw redirect({ to: "/piattaforma" });
  },
  component: BackupPage,
});

/** `it-IT` has no built-in byte formatter, and this is the one place in the app that shows a size. */
function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  const units = ["KB", "MB", "GB", "TB"];
  let value = bytes / 1024;
  let unit = 0;
  while (value >= 1024 && unit < units.length - 1) {
    value /= 1024;
    unit += 1;
  }
  return `${value.toFixed(value < 10 ? 1 : 0)} ${units[unit]}`;
}

function BackupPage() {
  const toast = useToast();
  const { data, isLoading } = useQuery(platformBackupsQuery);
  const createBackup = useCreateBackup();
  const prune = usePruneBackups();
  const remove = useDeleteBackup();
  const [toDelete, setToDelete] = useState<StoredBackup | null>(null);
  const [toRestore, setToRestore] = useState<StoredBackup | null>(null);

  return (
    <div className="mx-auto w-full max-w-[60rem] space-y-4 p-4 sm:px-6 sm:py-5">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-display font-semibold tracking-[-0.02em]">{t.platform.backups}</h1>
          <p className="mt-0.5 text-label text-muted-foreground">{t.platform.backupsHint}</p>
        </div>
        {data?.enabled ? (
          <div className="flex gap-2">
            <Button
              variant="outline"
              loading={prune.isPending}
              onClick={async () => {
                try {
                  const result = await prune.mutateAsync();
                  toast.success(t.platform.pruned(result.removed.length));
                } catch (error) {
                  toast.error(error instanceof ApiError ? error.message : t.app.genericError);
                }
              }}
            >
              {t.platform.pruneNow}
            </Button>
            <Button
              loading={createBackup.isPending}
              onClick={async () => {
                try {
                  await createBackup.mutateAsync();
                  toast.success(t.platform.backupCreated);
                } catch (error) {
                  toast.error(error instanceof ApiError ? error.message : t.app.genericError);
                }
              }}
            >
              <Plus aria-hidden />
              {t.platform.newBackup}
            </Button>
          </div>
        ) : null}
      </header>

      {isLoading || !data ? (
        <Card>
          <div className="p-5">
            <SkeletonRows rows={3} />
          </div>
        </Card>
      ) : !data.enabled ? (
        <Alert tone="warning">{t.platform.backupsNotConfigured}</Alert>
      ) : (
        <>
          <p className="text-micro text-muted-foreground">
            {t.platform.backupsSchedule(data.cronExpression, data.retentionDays, data.minCount)}
          </p>

          <Card>
            <CardHeader title={t.platform.all} />
            {data.backups.length === 0 ? (
              <EmptyState icon={DatabaseBackup} title={t.platform.noBackups} />
            ) : (
              <TableWrapper className="rounded-none border-0">
                <Table>
                  <THead>
                    <TR>
                      <TH>{t.platform.filename}</TH>
                      <TH>{t.platform.size}</TH>
                      <TH>{t.platform.created}</TH>
                      <TH className="text-right">{t.platform.actions}</TH>
                    </TR>
                  </THead>
                  <TBody>
                    {data.backups.map((backup) => (
                      <TR key={backup.filename}>
                        <TD className="font-mono text-[12px]">{backup.filename}</TD>
                        <TD>{formatBytes(backup.sizeBytes)}</TD>
                        <TD className="whitespace-nowrap">
                          {new Date(backup.lastModified).toLocaleString("it-IT")}
                        </TD>
                        <TD className="text-right">
                          <div className="flex justify-end gap-1">
                            <Button
                              size="icon"
                              variant="ghost"
                              title={t.platform.download}
                              aria-label={t.platform.download}
                              onClick={() => downloadBackup(backup.filename)}
                            >
                              <Download aria-hidden />
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => setToRestore(backup)}
                            >
                              {t.platform.restore}
                            </Button>
                            <Button
                              size="icon"
                              variant="ghost"
                              className="text-destructive"
                              title={t.platform.deleteBackup}
                              aria-label={t.platform.deleteBackup}
                              onClick={() => setToDelete(backup)}
                            >
                              <Trash2 aria-hidden />
                            </Button>
                          </div>
                        </TD>
                      </TR>
                    ))}
                  </TBody>
                </Table>
              </TableWrapper>
            )}
          </Card>
        </>
      )}

      <ConfirmDialog
        open={toDelete !== null}
        onOpenChange={(open) => !open && setToDelete(null)}
        title={t.platform.deleteBackup}
        description={toDelete ? t.platform.deleteBackupConfirm(toDelete.filename) : ""}
        confirmLabel={t.platform.deleteBackup}
        destructive
        loading={remove.isPending}
        onConfirm={async () => {
          if (!toDelete) return;
          try {
            await remove.mutateAsync(toDelete.filename);
            toast.success(t.platform.backupDeleted);
          } catch (error) {
            toast.error(error instanceof ApiError ? error.message : t.app.genericError);
          }
          setToDelete(null);
        }}
      />

      <RestoreDialog backup={toRestore} onOpenChange={(open) => !open && setToRestore(null)} />
    </div>
  );
}

function RestoreDialog({
  backup,
  onOpenChange,
}: {
  backup: StoredBackup | null;
  onOpenChange: (open: boolean) => void;
}) {
  const toast = useToast();
  const restore = useRestoreBackup();
  const [typed, setTyped] = useState("");

  const matches = backup !== null && typed === backup.filename;

  return (
    <Dialog
      open={backup !== null}
      onOpenChange={(open) => {
        if (!open) setTyped("");
        onOpenChange(open);
      }}
      title={backup ? t.platform.restoreTitle(backup.filename) : ""}
      footer={
        <>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            {t.app.cancel}
          </Button>
          <Button
            variant="destructive"
            disabled={!matches}
            loading={restore.isPending}
            onClick={async () => {
              if (!backup) return;
              try {
                const result = await restore.mutateAsync(backup.filename);
                toast.success(t.platform.restoreDone(result.safetyBackup));
                setTyped("");
                onOpenChange(false);
              } catch (error) {
                toast.error(error instanceof ApiError ? error.message : t.app.genericError);
              }
            }}
          >
            {t.platform.restore}
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <Alert tone="danger">{t.platform.restoreWarning}</Alert>
        <Field label={t.platform.restoreTypeToConfirm} required>
          {(props) => (
            <Input
              {...props}
              autoFocus
              autoComplete="off"
              value={typed}
              onChange={(event) => setTyped(event.target.value)}
              placeholder={backup?.filename}
            />
          )}
        </Field>
      </div>
    </Dialog>
  );
}
