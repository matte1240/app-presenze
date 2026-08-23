"use client";

import { useState } from "react";
import { format } from "date-fns";
import { it } from "date-fns/locale";
import { Download, FileText } from "lucide-react";
import { downloadBlob } from "@/lib/utils/file-utils";
import { Card } from "@/components/ui/card";
import { Alert } from "@/components/ui/alert";
import { MonthPicker } from "@/components/ui/month-picker";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/input";
import { PageContainer, PageHeader } from "@/components/layout/page";

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

  const monthLabel = format(new Date(selectedMonth + "-15"), "MMMM yyyy", {
    locale: it,
  });

  return (
    <PageContainer>
      <PageHeader
        title="Report"
        description="Scarica in Excel il riepilogo delle tue ore."
      />

      {error && <Alert variant="error" className="mb-4">{error}</Alert>}

      <Card className="space-y-5">
        <div className="max-w-xs space-y-1.5">
          <Label>Mese</Label>
          <MonthPicker value={selectedMonth} onChange={setSelectedMonth} />
        </div>

        <div className="flex flex-wrap items-end justify-between gap-3 border-t border-border pt-4">
          <div className="min-w-0">
            <p className="flex items-center gap-2 text-sm font-medium text-foreground">
              <FileText className="size-4 text-muted-foreground" />
              Ore di {monthLabel}
            </p>
            <p className="mt-1 truncate text-[13px] text-muted-foreground">
              {userName} · {userEmail}
            </p>
          </div>
          <Button
            onClick={handleExport}
            loading={isExporting}
            icon={<Download />}
          >
            {isExporting ? "Esportazione…" : "Scarica Excel"}
          </Button>
        </div>
      </Card>
    </PageContainer>
  );
}