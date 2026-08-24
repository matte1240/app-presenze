import { queryOptions, useMutation, useQueryClient } from "@tanstack/react-query";
import { ApiError, call, download, rpc } from "./client";

export interface BackupFile {
  filename: string;
  sizeBytes: number;
  createdAt: string;
}

export const backupsQuery = queryOptions({
  queryKey: ["backups"],
  queryFn: () => call<{ backups: BackupFile[] }>(rpc.admin.backups.$get()),
  select: (data) => data.backups,
});

export function useCreateBackup() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => call<{ backup: BackupFile }>(rpc.admin.backups.$post()),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["backups"] }),
  });
}

export function downloadBackup(filename: string) {
  return download(rpc.admin.backups[":filename"].$get({ param: { filename } }), filename);
}

export function useRestoreBackup() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (file: File) => {
      // Sent as multipart rather than through the RPC client, which has no
      // notion of a file upload.
      const body = new FormData();
      body.append("file", file);
      const response = await fetch("/api/admin/backups/restore", { method: "POST", body });
      if (!response.ok) {
        const payload = (await response.json().catch(() => null)) as
          | { error?: { code?: string; message?: string } }
          | null;
        throw new ApiError(
          payload?.error?.code ?? "internal",
          payload?.error?.message ?? "Ripristino fallito",
          response.status,
        );
      }
      return (await response.json()) as { safetyCopy: string };
    },
    onSuccess: () => queryClient.invalidateQueries(),
  });
}

export function exportExcel(userIds: string[], month: string) {
  return download(rpc.reports.excel.$post({ json: { userIds, month } }), `presenze-${month}.xlsx`);
}
