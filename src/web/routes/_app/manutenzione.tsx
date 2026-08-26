import { createFileRoute } from "@tanstack/react-router";
import { Download } from "lucide-react";
import { useState } from "react";
import { downloadDataExport } from "../../api/admin";
import { ApiError } from "../../api/client";
import { t } from "../../i18n/it";
import { Alert, Button, Card, CardHeader, useToast } from "../../ui/primitives";

export const Route = createFileRoute("/_app/manutenzione")({ component: MaintenancePage });

function MaintenancePage() {
  const toast = useToast();
  const [busy, setBusy] = useState(false);

  const run = async () => {
    setBusy(true);
    try {
      await downloadDataExport();
      toast.success(t.maintenance.exportDone);
    } catch (error) {
      toast.error(error instanceof ApiError ? error.message : t.app.genericError);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-4">
      <header>
        <h2 className="text-display font-semibold tracking-[-0.02em]">{t.maintenance.title}</h2>
        <p className="mt-0.5 text-label text-muted-foreground">{t.maintenance.subtitle}</p>
      </header>

      <Card>
        <CardHeader
          title={t.maintenance.export}
          actions={
            <Button loading={busy} onClick={run}>
              <Download aria-hidden />
              {t.maintenance.exportAction}
            </Button>
          }
        />
        <div className="space-y-4 p-5">
          <p className="text-body text-muted-foreground">{t.maintenance.exportHint}</p>
          <Alert tone="info">{t.maintenance.backupNotice}</Alert>
        </div>
      </Card>
    </div>
  );
}
