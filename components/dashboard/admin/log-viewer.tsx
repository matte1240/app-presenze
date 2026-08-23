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
import { Badge, type BadgeProps } from "@/components/ui/badge";
import { Button, buttonClasses } from "@/components/ui/button";
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
} from "@/components/ui/table";

type BadgeVariant = NonNullable<BadgeProps["variant"]>;

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
  { label: string; variant: BadgeVariant; icon: typeof Shield }
> = {
  AUTH: { label: "Auth", variant: "info", icon: LogIn },
  ACCESS: { label: "Access", variant: "neutral", icon: Globe },
  ADMIN: { label: "Admin", variant: "warning", icon: Settings },
  SECURITY: { label: "Security", variant: "danger", icon: Shield },
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
      <div className="flex flex-wrap items-center gap-3 border-b border-border px-4 py-3">
        <div className="flex items-center gap-2">
          <Filter className="size-4 shrink-0 text-muted-foreground" />
          <Select
            aria-label="Filtra per categoria"
            value={category}
            onChange={(e) => {
              setCategory(e.target.value as AuditCategory | "");
              setPage(0);
            }}
            className="h-8 w-auto text-[13px]"
          >
            <option value="">Tutte le categorie</option>
            <option value="AUTH">Auth</option>
            <option value="ACCESS">Access</option>
            <option value="ADMIN">Admin</option>
            <option value="SECURITY">Security</option>
          </Select>
        </div>

        <label className="flex cursor-pointer select-none items-center gap-2 text-[13px] text-muted-foreground">
          <input
            type="checkbox"
            checked={autoRefresh}
            onChange={(e) => setAutoRefresh(e.target.checked)}
            className="size-4 cursor-pointer accent-[hsl(var(--primary))]"
          />
          Aggiorna ogni 10s
        </label>

        <div className="ml-auto flex items-center gap-1">
          <a
            href="/api/admin/logs?download=1"
            className={buttonClasses({ variant: "ghost", size: "sm" })}
          >
            <Download />
            Scarica
          </a>
          <Button
            size="sm"
            variant="ghost"
            onClick={fetchLogs}
            disabled={loading}
            icon={<RefreshCw className={loading ? "animate-spin" : undefined} />}
          >
            Aggiorna
          </Button>
        </div>
      </div>

      {loading && logs.length === 0 ? (
        <div className="space-y-2 p-4">
          {[0, 1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-8 w-full" />
          ))}
        </div>
      ) : logs.length === 0 ? (
        <EmptyState
          compact
          icon={<Shield />}
          title="Nessun log"
          description="Le operazioni di accesso e amministrazione compariranno qui."
        />
      ) : (
        <>
          <div className="scrollbar-slim overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Data e ora</TableHead>
                  <TableHead>Categoria</TableHead>
                  <TableHead>Azione</TableHead>
                  <TableHead>Dettagli</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {logs.map((entry, i) => {
                  const cfg = CATEGORY_CONFIG[entry.category] || CATEGORY_CONFIG.ACCESS;
                  const Icon = cfg.icon;
                  return (
                    <TableRow key={`${entry.timestamp}-${i}`}>
                      <TableCell className="whitespace-nowrap font-mono text-xs text-muted-foreground">
                        {formatTimestamp(entry.timestamp)}
                      </TableCell>
                      <TableCell className="whitespace-nowrap">
                        <Badge variant={cfg.variant}>
                          <Icon className="size-3" />
                          {cfg.label}
                        </Badge>
                      </TableCell>
                      <TableCell className="whitespace-nowrap text-[13px] font-medium">
                        {entry.action}
                      </TableCell>
                      <TableCell className="max-w-md truncate text-xs text-muted-foreground">
                        {formatDetails(entry)}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>

          {totalPages > 1 && (
            <div className="flex items-center justify-between border-t border-border px-4 py-3">
              <span className="text-xs text-muted-foreground">
                {total} log · pagina {page + 1} di {totalPages}
              </span>
              <div className="flex items-center gap-1">
                <Button
                  size="icon"
                  variant="outline"
                  aria-label="Pagina precedente"
                  onClick={() => setPage((p) => Math.max(0, p - 1))}
                  disabled={page === 0}
                >
                  <ChevronLeft />
                </Button>
                <Button
                  size="icon"
                  variant="outline"
                  aria-label="Pagina successiva"
                  onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
                  disabled={page >= totalPages - 1}
                >
                  <ChevronRight />
                </Button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
