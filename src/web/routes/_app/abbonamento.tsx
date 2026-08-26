import { createFileRoute, redirect } from "@tanstack/react-router";
import { useSession } from "../../api/session";
import { t } from "../../i18n/it";
import { Badge, Card, CardHeader, SkeletonRows } from "../../ui/primitives";

export const Route = createFileRoute("/_app/abbonamento")({
  beforeLoad: ({ context }) => {
    if (context.user.role !== "ADMIN") throw redirect({ to: "/calendario" });
  },
  component: BillingPage,
});

const dateIt = (iso: string | null) =>
  iso ? new Date(iso).toLocaleDateString("it-IT", { day: "numeric", month: "long", year: "numeric" }) : "—";

function BillingPage() {
  const { data: session } = useSession();
  const organization = session?.organization;

  return (
    <div className="space-y-4">
      <header>
        <h2 className="text-display font-semibold tracking-[-0.02em]">{t.billing.title}</h2>
        <p className="mt-0.5 text-label text-muted-foreground">{t.billing.subtitle}</p>
      </header>

      <Card>
        <CardHeader title={organization?.name ?? ""} />
        {!organization ? (
          <div className="p-5">
            <SkeletonRows rows={3} />
          </div>
        ) : (
          <dl className="grid gap-px bg-border sm:grid-cols-2">
            <Row label={t.billing.plan}>{organization.planName}</Row>
            <Row label={t.billing.status}>
              <Badge tone={organization.access === "full" ? "success" : "danger"}>
                {t.billing.statuses[organization.status]}
              </Badge>
            </Row>
            <Row label={t.billing.seats}>
              {t.billing.seatsOf(organization.seatsUsed, organization.seatLimit)}
            </Row>
            <Row label={organization.status === "TRIAL" ? t.billing.trialEndsOn : t.billing.renewsOn}>
              {dateIt(organization.trialEndsAt)}
            </Row>
          </dl>
        )}
      </Card>
    </div>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="bg-surface px-5 py-4">
      <dt className="text-label text-muted-foreground">{label}</dt>
      <dd className="mt-1 text-body font-medium">{children}</dd>
    </div>
  );
}
