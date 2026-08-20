"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import {
  RefreshCw,
  Shield,
  LogIn,
  Settings,
  Globe,
  Filter,
  ChevronLeft,
  ChevronRight,
  Download,
} from "lucide-react";
import { Spinner } from "@/components/ui/spinner";

type AuditCategory = "AUTH" | "ACCESS" | "ADMIN" | "SECURITY";

interface LogEntry {
  timestamp: string;
  category: AuditCategory;
  action: string;
  userId?: string;
  userName?: string | null;
  ip?: string;
  method?: string;
  path?: string;
  status?: number;
  durationMs?: number;
  details?: Record<string, unknown>;
}

const CATEGORY_CONFIG: Record<
  AuditCategory,
  { label: string; color: string; icon: typeof Shield }
> = {
  AUTH: { label: "Auth", color: "text-blue-600 bg-blue-100 dark:text-blue-400 dark:bg-blue-900/30", icon: LogIn },
  ACCESS: { label: "Access", color: "text-gray-600 bg-gray-100 dark:text-gray-400 dark:bg-gray-800/50", icon: Globe },
  ADMIN: { label: "Admin", color: "text-amber-600 bg-amber-100 dark:text-amber-400 dark:bg-amber-900/30", icon: Settings },
  SECURITY: { label: "Security", color: "text-red-600 bg-red-100 dark:text-red-400 dark:bg-red-900/30", icon: Shield },
};

const PAGE_SIZE = 50;

export function LogViewer() {
  const router = useRouter();
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [category, setCategory] = useState<AuditCategory | "">("");
  const [page, setPage] = useState(0);
  const [autoRefresh, setAutoRefresh] = useState(false);

  const fetchLogs = useCallback(async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      if (category) params.set("category", category);
      params.set("limit", String(PAGE_SIZE));
      params.set("offset", String(page * PAGE_SIZE));

      const res = await fetch(`/api/admin/logs?${params}`);

      if (res.status === 401) {
        router.push("/");
        return;
      }

      if (!res.ok) throw new Error("Failed to fetch logs");

      const data = await res.json();
      setLogs(data.logs || []);
      setTotal(data.total || 0);
    } catch (err) {
      console.error("Error fetching logs:", err);
    } finally {
      setLoading(false);
    }
  }, [category, page, router]);

  useEffect(() => {
    fetchLogs();
  }, [fetchLogs]);

  useEffect(() => {
    if (!autoRefresh) return;
    const interval = setInterval(fetchLogs, 10000);
    return () => clearInterval(interval);
  }, [autoRefresh, fetchLogs]);

  const totalPages = Math.ceil(total / PAGE_SIZE);

  const formatTimestamp = (ts: string) => {
    return new Date(ts).toLocaleString("it-IT", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });
  };

  const formatDetails = (entry: LogEntry) => {
    const parts: string[] = [];
    if (entry.method && entry.path) parts.push(`${entry.method} ${entry.path}`);
    if (entry.status) parts.push(`${entry.status}`);
    if (entry.durationMs !== undefined) parts.push(`${entry.durationMs}ms`);
    if (entry.userName) parts.push(`utente: ${entry.userName}`);
    else if (entry.userId) parts.push(`user: ${entry.userId.slice(0, 8)}…`);
    if (entry.ip) parts.push(`ip: ${entry.ip}`);
    if (entry.details) {
      const { targetUserId, targetUserName, newUserId, newUserName, ...rest } = entry.details as Record<string, unknown>;
      if (targetUserName) parts.push(`target: ${targetUserName}`);
      else if (targetUserId) parts.push(`target: ${(targetUserId as string).slice(0, 8)}…`);
      if (newUserName) parts.push(`nuovo utente: ${newUserName}`);
      else if (newUserId) parts.push(`nuovo utente: ${(newUserId as string).slice(0, 8)}…`);
      const detailStr = Object.entries(rest)
        .filter(([k]) => k !== "editedBy" && k !== "createdBy")
        .map(([k, v]) => `${k}: ${typeof v === "object" ? JSON.stringify(v) : v}`)
        .join(", ");
      if (detailStr) parts.push(detailStr);
    }
    return parts.join(" · ");
  };

  return (
    <div>
      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-3 mb-4">
        {/* Category Filter */}
        <div className="flex items-center gap-2">
          <Filter className="w-4 h-4 text-muted-foreground" />
          <select
            value={category}
            onChange={(e) => {
              setCategory(e.target.value as AuditCategory | "");
              setPage(0);
            }}
            className="text-sm border border-border rounded-lg px-3 py-1.5 bg-card text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50"
          >
            <option value="">Tutte le categorie</option>
            <option value="AUTH">Auth</option>
            <option value="ACCESS">Access</option>
            <option value="ADMIN">Admin</option>
            <option value="SECURITY">Security</option>
          </select>
        </div>

        {/* Auto-refresh toggle */}
        <label className="flex items-center gap-2 text-sm text-muted-foreground cursor-pointer select-none">
          <input
            type="checkbox"
            checked={autoRefresh}
            onChange={(e) => setAutoRefresh(e.target.checked)}
            className="rounded border-border"
          />
          Auto-refresh (10s)
        </label>

        {/* Refresh button */}
        <div className="ml-auto flex items-center gap-3">
          <a
            href="/api/admin/logs?download=1"
            className="text-muted-foreground hover:text-foreground font-medium text-sm flex items-center gap-1 transition-colors cursor-pointer"
          >
            <Download className="w-4 h-4" />
            Scarica
          </a>
          <button
            onClick={fetchLogs}
            disabled={loading}
            className="text-primary hover:text-primary/80 font-medium text-sm flex items-center gap-1 transition-colors cursor-pointer"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
            Aggiorna
          </button>
        </div>
      </div>

      {/* Log List */}
      {loading && logs.length === 0 ? (
        <div className="flex justify-center py-12">
          <Spinner />
        </div>
      ) : logs.length === 0 ? (
        <div className="text-center py-12 border-2 border-dashed border-border rounded-xl bg-muted/30">
          <Shield className="w-12 h-12 text-muted-foreground mx-auto mb-3 opacity-50" />
          <p className="text-muted-foreground font-medium">Nessun log disponibile</p>
          <p className="text-sm text-muted-foreground mt-1">
            I log appariranno qui quando ci saranno attività
          </p>
        </div>
      ) : (
        <>
          <div className="overflow-hidden rounded-xl border border-border bg-card">
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-border">
                <thead className="bg-muted/50">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                      Data/Ora
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                      Categoria
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                      Azione
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                      Dettagli
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-card divide-y divide-border">
                  {logs.map((entry, i) => {
                    const cfg = CATEGORY_CONFIG[entry.category] || CATEGORY_CONFIG.ACCESS;
                    const Icon = cfg.icon;
                    return (
                      <tr key={`${entry.timestamp}-${i}`} className="hover:bg-muted/50 transition-colors">
                        <td className="px-4 py-3 whitespace-nowrap text-xs text-muted-foreground font-mono">
                          {formatTimestamp(entry.timestamp)}
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap">
                          <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${cfg.color}`}>
                            <Icon className="w-3 h-3" />
                            {cfg.label}
                          </span>
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap text-sm font-medium text-foreground">
                          {entry.action}
                        </td>
                        <td className="px-4 py-3 text-xs text-muted-foreground max-w-md truncate">
                          {formatDetails(entry)}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between mt-4">
              <span className="text-sm text-muted-foreground">
                {total} log totali · Pagina {page + 1} di {totalPages}
              </span>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setPage((p) => Math.max(0, p - 1))}
                  disabled={page === 0}
                  className="p-1.5 rounded-lg border border-border hover:bg-muted disabled:opacity-30 disabled:cursor-not-allowed transition-colors cursor-pointer"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <button
                  onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
                  disabled={page >= totalPages - 1}
                  className="p-1.5 rounded-lg border border-border hover:bg-muted disabled:opacity-30 disabled:cursor-not-allowed transition-colors cursor-pointer"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
