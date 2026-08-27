import { download, rpc } from "./client";

/**
 * The database-level backup and restore are gone: with every customer's data
 * in one Postgres instance, an endpoint that replaces the whole database is
 * not a feature. What is left is the part that was always the administrator's
 * to have — their own data, as JSON.
 */
export function downloadDataExport() {
  const stamp = new Date().toISOString().slice(0, 10);
  return download(rpc.admin.export.$get(), `presenze-${stamp}.json`);
}

export function exportExcel(userIds: string[], month: string) {
  return download(rpc.reports.excel.$post({ json: { userIds, month } }), `presenze-${month}.xlsx`);
}
