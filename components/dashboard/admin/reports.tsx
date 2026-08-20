"use client";

import { useState, useTransition, useEffect } from "react";
import type { User, TimeEntryDTO } from "@/types/models";
import { Download } from "lucide-react";
import { cn } from "@/lib/utils";
import { downloadBlob } from "@/lib/utils/file-utils";
import { Card } from "@/components/ui/card";
import { Alert } from "@/components/ui/alert";
import { MonthPicker } from "@/components/ui/month-picker";
import { Spinner } from "@/components/ui/spinner";

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

  return (
    <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-8">
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-foreground">Esporta dati dipendenti</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          Seleziona i dipendenti e un mese per esportare le loro ore di lavoro. Verrà esportato in Excel.
        </p>
      </div>

      <Card>
        {/* Selettore mese */}
        <div className="mb-6">
          <label className="block text-sm font-semibold text-foreground mb-2">
            Seleziona mese
          </label>
          <div className="w-full max-w-xs">
            <MonthPicker value={selectedMonth} onChange={setSelectedMonth} />
          </div>
        </div>

        {/* User selection */}
        <div>
          <div className="mb-4 flex items-center justify-between">
            <h3 className="text-lg font-semibold text-foreground">Seleziona dipendenti</h3>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={handleSelectAll}
                className="text-sm font-medium text-primary hover:text-primary/80 transition cursor-pointer"
              >
                Seleziona tutti
              </button>
              <span className="text-muted-foreground">|</span>
              <button
                type="button"
                onClick={handleClearAll}
                className="text-sm font-medium text-muted-foreground hover:text-foreground transition cursor-pointer"
              >
                Deseleziona tutti
              </button>
            </div>
          </div>

          {isLoadingMonthHours ? (
            <div className="flex items-center justify-center py-12">
              <div className="text-center">
                <Spinner size="lg" />
                <p className="mt-4 text-sm text-muted-foreground">Caricamento ore...</p>
              </div>
            </div>
          ) : (
            <div className="space-y-2 max-h-96 overflow-y-auto pr-2">
              {usersWithMonthHours.map((user) => {
                const permessoVacation = user.permessoHours + user.vacationHours;
                return (
                  <label
                    key={user.id}
                    className={cn(
                      "flex items-center gap-3 rounded-lg border border-border p-4 cursor-pointer transition hover:bg-muted/50",
                      selectedUserIds.has(user.id) && "border-primary/50 bg-primary/5"
                    )}
                  >
                    <input
                      type="checkbox"
                      checked={selectedUserIds.has(user.id)}
                      onChange={() => handleToggleUser(user.id)}
                      className="h-5 w-5 rounded border-input text-primary focus:ring-2 focus:ring-primary/20 cursor-pointer"
                    />
                    <div className="flex-1">
                      <div className="font-semibold text-foreground">{user.name || user.email}</div>
                      {user.name && (
                        <div className="text-sm text-muted-foreground">{user.email}</div>
                      )}
                    </div>
                    <div className="text-right">
                      <div className="text-sm font-medium text-foreground">
                        {(user.regularHours + user.overtimeHours).toFixed(1)}h
                      </div>
                      {user.overtimeHours > 0 && (
                        <div className="text-xs text-orange-600 dark:text-orange-400">
                          +{user.overtimeHours.toFixed(1)}h straordinarie
                        </div>
                      )}
                      {permessoVacation > 0 && (
                        <div className="text-xs text-purple-600 dark:text-purple-400">
                          {permessoVacation.toFixed(1)}h permesso/ferie
                        </div>
                      )}
                      {user.sicknessHours > 0 && (
                        <div className="text-xs text-red-600 dark:text-red-400">
                          {user.sicknessHours.toFixed(1)}h malattia
                        </div>
                      )}
                    </div>
                  </label>
                );
              })}
              {usersWithMonthHours.length === 0 && (
                <div className="text-center py-8 text-muted-foreground">
                  Nessun dipendente trovato
                </div>
              )}
            </div>
          )}

          {selectedUserIds.size > 0 && (
            <div className="mt-6 flex items-center justify-between rounded-lg bg-primary/10 p-4 border border-primary/20">
              <div className="text-sm font-medium text-primary">
                {selectedUserIds.size} dipendente{selectedUserIds.size > 1 ? 'i' : ''} selezionat{selectedUserIds.size > 1 ? 'i' : 'o'}
              </div>
              <button
                type="button"
                onClick={handleExport}
                disabled={isExporting}
                className="rounded-lg bg-primary px-6 py-3 text-sm font-semibold text-primary-foreground shadow-md transition hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-50 flex items-center gap-2 cursor-pointer"
              >
                {isExporting ? <Spinner size="sm" /> : <Download className="h-5 w-5" />}
                {isExporting ? 'Esportazione...' : 'Esporta in Excel'}
              </button>
            </div>
          )}

          {error && (
            <Alert variant="error" className="mt-4">{error}</Alert>
          )}
        </div>
      </Card>
    </div>
  );
}