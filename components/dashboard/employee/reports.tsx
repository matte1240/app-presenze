"use client";

import { useState } from "react";
import { format } from "date-fns";
import { it } from "date-fns/locale";
import { Download, FileText } from "lucide-react";
import { downloadBlob } from "@/lib/utils/file-utils";
import { Card } from "@/components/ui/card";
import { Alert } from "@/components/ui/alert";
import { MonthPicker } from "@/components/ui/month-picker";
import { Spinner } from "@/components/ui/spinner";

type EmployeeReportsProps = {
  userId: string;
  userName: string;
  userEmail: string;
};

export default function UserReports({
  userId,
  userName,
  userEmail,
}: EmployeeReportsProps) {
  const [selectedMonth, setSelectedMonth] = useState(() => {
    const now = new Date();
    return `${now.getFullYear()}-${(now.getMonth() + 1).toString().padStart(2, "0")}`;
  });
  const [isExporting, setIsExporting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleExport = async () => {
    setIsExporting(true);
    setError(null);
    try {
      const response = await fetch("/api/export-excel", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          month: selectedMonth,
          userIds: [userId],
        }),
      });

      if (response.ok) {
        const blob = await response.blob();
        downloadBlob(blob, `ore_lavoro_${userName.replace(/\s+/g, "_")}_${selectedMonth}.xlsx`);
      } else {
        const data = await response.json();
        setError(data.error || "Errore nell'esportazione");
      }
    } catch (err) {
      console.error("Error exporting:", err);
      setError("Errore nell'esportazione");
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-8">
      {/* Month Selector */}
      <div className="mb-6">
        <Card>
          <label className="block text-sm font-medium text-foreground mb-3">
            Seleziona mese:
          </label>
          <div className="w-full sm:w-64">
            <MonthPicker value={selectedMonth} onChange={setSelectedMonth} />
          </div>
        </Card>
      </div>

      {/* Error Message */}
      {error && (
        <Alert variant="error" className="mb-6">{error}</Alert>
      )}

      {/* Export Section */}
      <Card>
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-lg font-semibold text-foreground flex items-center gap-2">
              <FileText className="w-5 h-5 text-muted-foreground" />
              Esporta Report
            </h2>
            <p className="text-sm text-muted-foreground mt-1">
              Scarica il report delle tue ore lavorate per {format(new Date(selectedMonth + "-15"), "MMMM yyyy", { locale: it })}
            </p>
          </div>
          <button
            onClick={handleExport}
            disabled={isExporting}
            className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-lg text-primary-foreground bg-primary hover:bg-primary/90 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary disabled:opacity-50 disabled:cursor-not-allowed transition-colors cursor-pointer"
          >
            {isExporting ? (
              <>
                <Spinner size="sm" className="mr-2" />
                Esportazione...
              </>
            ) : (
              <>
                <Download className="h-5 w-5 mr-2" />
                Scarica Excel
              </>
            )}
          </button>
        </div>

        {/* User Info */}
        <div className="border-t border-border pt-4">
          <dl className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <dt className="text-sm font-medium text-muted-foreground">Nome</dt>
              <dd className="mt-1 text-sm text-foreground">{userName}</dd>
            </div>
            <div>
              <dt className="text-sm font-medium text-muted-foreground">Email</dt>
              <dd className="mt-1 text-sm text-foreground">{userEmail}</dd>
            </div>
          </dl>
        </div>
      </Card>
    </div>
  );
}