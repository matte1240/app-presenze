"use client";

import { useState, useTransition, useEffect } from "react";
import type { User, TimeEntryDTO } from "@/types/models";
import { Download } from "lucide-react";
import { cn } from "@/lib/utils";
import { downloadBlob } from "@/lib/utils/file-utils";
import { Card } from "@/components/ui/card";
import { Alert } from "@/components/ui/alert";
import { MonthPicker } from "@/components/ui/month-picker";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { Label } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { PageContainer, PageHeader } from "@/components/layout/page";

type UserWithHours = User & {
  regularHours: number;
  overtimeHours: number;
  permessoHours: number;
  sicknessHours: number;
  vacationHours: number;
};

type ExportDataProps = {
  users: User[];
};

export default function AdminReports({ users }: ExportDataProps) {
  const [selectedMonth, setSelectedMonth] = useState(() => {
    const now = new Date();
    return `${now.getFullYear()}-${(now.getMonth() + 1).toString().padStart(2, '0')}`;
  });
  const [selectedUserIds, setSelectedUserIds] = useState<Set<string>>(new Set());
  const [usersWithMonthHours, setUsersWithMonthHours] = useState<UserWithHours[]>([]);
  const [isLoadingMonthHours, setIsLoadingMonthHours] = useState(false);
  const [isExporting, startExporting] = useTransition();
  const [error, setError] = useState<string | null>(null);

  // Fetch users with hours for selected month
  useEffect(() => {
    const fetchMonthHours = async () => {
      setIsLoadingMonthHours(true);
      try {
        const [year, month] = selectedMonth.split('-');
        const from = `${year}-${month}-01`;
        const lastDay = new Date(parseInt(year), parseInt(month), 0).getDate();
        const to = `${year}-${month}-${String(lastDay).padStart(2, '0')}`;

        const response = await fetch(`/api/hours?userId=all&from=${from}&to=${to}`);
        if (response.ok) {
          const entries = await response.json();

          // Calculate hours per user for the selected month using a more efficient single-pass aggregation
          const hoursMap = new Map<string, {
            regular: number;
            overtime: number;
            permesso: number;
            sickness: number;
            vacation: number;
          }>();

          entries.forEach((entry: TimeEntryDTO) => {
            // Skip if userId is missing
            if (!entry.userId) return;

            const current = hoursMap.get(entry.userId) || {
              regular: 0,
              overtime: 0,
              permesso: 0,
              sickness: 0,
              vacation: 0,
            };

            // Accumulate all hours in a single pass
            current.regular += entry.hoursWorked || 0;
            current.overtime += entry.overtimeHours || 0;
            current.permesso += entry.permessoHours || 0;
            current.sickness += entry.sicknessHours || 0;
            current.vacation += entry.vacationHours || 0;

            hoursMap.set(entry.userId, current);
          });

          // Update users with month-specific hours
          const updatedUsers = users.map(user => {
            const hours = hoursMap.get(user.id);
            return {
              ...user,
              regularHours: hours?.regular || 0,
              overtimeHours: hours?.overtime || 0,
              permessoHours: hours?.permesso || 0,
              sicknessHours: hours?.sickness || 0,
              vacationHours: hours?.vacation || 0,
            };
          });

          setUsersWithMonthHours(updatedUsers);
        }
      } catch (err) {
        console.error("Errore durante il caricamento delle ore:", err);
        setError("Errore nel caricamento delle ore per il mese selezionato");
      } finally {
        setIsLoadingMonthHours(false);
      }
    };

    fetchMonthHours();
  }, [selectedMonth, users]);

  const handleExport = async () => {
    startExporting(async () => {
      setError(null);
      try {
        const response = await fetch('/api/export-excel', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            userIds: Array.from(selectedUserIds),
            month: selectedMonth,
          }),
        });

        if (!response.ok) {
          throw new Error('Esportazione fallita');
        }

        const blob = await response.blob();
        downloadBlob(blob, `hours_export_${selectedMonth}.xlsx`);
      } catch (err) {
        console.error('Errore durante l\'esportazione:', err);
        setError('Errore durante l\'esportazione. Riprova per favore.');
      }
    });
  };

  const handleSelectAll = () => {
    setSelectedUserIds(new Set(usersWithMonthHours.map(u => u.id)));
  };

  const handleClearAll = () => {
    setSelectedUserIds(new Set());
  };

  const handleToggleUser = (userId: string) => {
    const newSet = new Set(selectedUserIds);
    if (newSet.has(userId)) {
      newSet.delete(userId);
    } else {
      newSet.add(userId);
    }
    setSelectedUserIds(newSet);
  };

  // Totali rimossi perché le card riepilogative sono state eliminate

  const selectionCount = selectedUserIds.size;

  return (
    <PageContainer>
      <PageHeader
        title="Report"
        description="Seleziona un mese e i dipendenti da includere nell'esportazione Excel."
      />

      <Card className="space-y-5">
        <div className="max-w-xs space-y-1.5">
          <Label>Mese</Label>
          <MonthPicker value={selectedMonth} onChange={setSelectedMonth} />
        </div>

        <div>
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <h3 className="text-sm font-semibold text-foreground">Dipendenti</h3>
            <div className="flex items-center gap-1">
              <Button size="sm" variant="ghost" onClick={handleSelectAll}>
                Seleziona tutti
              </Button>
              <Button size="sm" variant="ghost" onClick={handleClearAll}>
                Deseleziona
              </Button>
            </div>
          </div>

          {isLoadingMonthHours ? (
            <div className="space-y-2">
              {[0, 1, 2].map((i) => (
                <Skeleton key={i} className="h-14 w-full" />
              ))}
            </div>
          ) : usersWithMonthHours.length === 0 ? (
            <EmptyState
              compact
              icon={<Download />}
              title="Nessun dipendente"
              description="Non ci sono dipendenti da esportare per il mese selezionato."
            />
          ) : (
            <div className="scrollbar-slim max-h-96 space-y-1.5 overflow-y-auto pr-1">
              {usersWithMonthHours.map((user) => {
                const permessoVacation = user.permessoHours + user.vacationHours;
                const selected = selectedUserIds.has(user.id);
                return (
                  <label
                    key={user.id}
                    className={cn(
                      "flex cursor-pointer items-center gap-3 rounded-md border p-3 transition-colors",
                      selected
                        ? "border-primary/40 bg-primary/5"
                        : "border-border hover:bg-accent/40"
                    )}
                  >
                    <input
                      type="checkbox"
                      checked={selected}
                      onChange={() => handleToggleUser(user.id)}
                      className="size-4 shrink-0 cursor-pointer accent-[hsl(var(--primary))]"
                    />
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-[13px] font-medium text-foreground">
                        {user.name || user.email}
                      </div>
                      {user.name && (
                        <div className="truncate text-xs text-muted-foreground">
                          {user.email}
                        </div>
                      )}
                    </div>
                    {/* The breakdown is secondary to the total, so it sits in
                        one muted line instead of a stack of coloured ones. */}
                    <div className="shrink-0 text-right">
                      <div className="text-[13px] font-medium tabular-nums text-foreground">
                        {(user.regularHours + user.overtimeHours).toFixed(1)}h
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {[
                          user.overtimeHours > 0
                            ? `+${user.overtimeHours.toFixed(1)} str.`
                            : null,
                          permessoVacation > 0
                            ? `${permessoVacation.toFixed(1)} perm.`
                            : null,
                          user.sicknessHours > 0
                            ? `${user.sicknessHours.toFixed(1)} mal.`
                            : null,
                        ]
                          .filter(Boolean)
                          .join(" · ") || "—"}
                      </div>
                    </div>
                  </label>
                );
              })}
            </div>
          )}

          {selectionCount > 0 && (
            <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-md border border-border bg-muted/40 p-3">
              <span className="text-[13px] text-muted-foreground">
                {selectionCount} dipendent{selectionCount > 1 ? "i" : "e"} selezionat
                {selectionCount > 1 ? "i" : "o"}
              </span>
              <Button
                onClick={handleExport}
                loading={isExporting}
                icon={<Download />}
              >
                {isExporting ? "Esportazione…" : "Esporta in Excel"}
              </Button>
            </div>
          )}

          {error && <Alert variant="error" className="mt-4">{error}</Alert>}
        </div>
      </Card>
    </PageContainer>
  );
}