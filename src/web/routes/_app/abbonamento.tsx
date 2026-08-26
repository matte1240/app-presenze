import { useQuery } from "@tanstack/react-query";
import { createFileRoute, redirect } from "@tanstack/react-router";
import { Check } from "lucide-react";
import { z } from "zod";
import { billingQuery, useCheckout, usePortal, type BillingState } from "../../api/billing";
import { ApiError } from "../../api/client";
import { FiscalCard } from "../../features/billing/fiscal-card";
import { InvoiceList } from "../../features/billing/invoice-list";
import { t } from "../../i18n/it";
import { cn } from "../../ui/cn";
import { Alert, Badge, Button, Card, CardHeader, SkeletonRows, useToast } from "../../ui/primitives";

export const Route = createFileRoute("/_app/abbonamento")({
  beforeLoad: ({ context }) => {
    if (context.user.role !== "ADMIN") throw redirect({ to: "/calendario" });
  },
  validateSearch: z.object({ checkout: z.enum(["ok", "annullato"]).optional() }),
  component: BillingPage,
});

const dateIt = (iso: string | null) =>
  iso
    ? new Date(iso).toLocaleDateString("it-IT", { day: "numeric", month: "long", year: "numeric" })
    : "—";

function BillingPage() {
  const search = Route.useSearch();
  const { data, isLoading } = useQuery(billingQuery);

  return (
    <div className="space-y-4">
      <header>
        <h2 className="text-display font-semibold tracking-[-0.02em]">{t.billing.title}</h2>
        <p className="mt-0.5 text-label text-muted-foreground">{t.billing.subtitle}</p>
      </header>

      {/* Stripe redirects back here; the webhook may land a moment later, so
          the confirmation is worded as a receipt, not as a new state. */}
      {search.checkout === "ok" ? <Alert tone="success">{t.billing.checkoutDone}</Alert> : null}
      {search.checkout === "annullato" ? (
        <Alert tone="info">{t.billing.checkoutCancelled}</Alert>
      ) : null}

      {isLoading || !data ? (
        <Card>
          <div className="p-5">
            <SkeletonRows rows={4} />
          </div>
        </Card>
      ) : (
        <>
          <CurrentPlan data={data} />
          {/* The plan, the seats and the invoicing details are real whether or
              not online payment is switched on; only the plan picker and the
              invoice list depend on Stripe. */}
          {data.stripeEnabled ? <PlanGrid data={data} /> : <Alert tone="info">{t.billing.notConfigured}</Alert>}
          <FiscalCard />
          {data.stripeEnabled ? <InvoiceList /> : null}
        </>
      )}
    </div>
  );
}

function CurrentPlan({ data }: { data: BillingState }) {
  const toast = useToast();
  const portal = usePortal();
  const { organization } = data;

  return (
    <Card>
      <CardHeader
        title={organization.name}
        actions={
          data.stripeEnabled ? (
            <Button
              variant="outline"
              loading={portal.isPending}
              onClick={async () => {
                try {
                  await portal.mutateAsync();
                } catch (error) {
                  toast.error(error instanceof ApiError ? error.message : t.app.genericError);
                }
              }}
            >
              {t.billing.manage}
            </Button>
          ) : null
        }
      />
      <dl className="grid gap-px bg-border sm:grid-cols-2 lg:grid-cols-4">
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
          {dateIt(organization.status === "TRIAL" ? organization.trialEndsAt : data.currentPeriodEnd)}
        </Row>
      </dl>

      {data.cancelAtPeriodEnd ? (
        <div className="border-t border-border p-5">
          <Alert tone="warning">{t.billing.cancelling(dateIt(data.currentPeriodEnd))}</Alert>
        </div>
      ) : null}
    </Card>
  );
}

function PlanGrid({ data }: { data: BillingState }) {
  const toast = useToast();
  const checkout = useCheckout();
  const current = data.organization.plan;

  return (
    <Card>
      <CardHeader title={t.billing.choosePlan} />
      <div className="grid gap-4 p-5 sm:grid-cols-3">
        {data.plans.map((plan) => {
          const isCurrent = plan.id === current;
          const tooSmall =
            plan.maxEmployees !== null && data.organization.seatsUsed > plan.maxEmployees;

          return (
            <div
              key={plan.id}
              className={cn(
                "flex flex-col gap-3 rounded-md border p-4",
                isCurrent ? "border-primary bg-primary/5" : "border-border",
              )}
            >
              <div className="flex items-center justify-between">
                <span className="text-body font-semibold">{plan.name}</span>
                {isCurrent ? <Check className="size-4 text-primary" aria-hidden /> : null}
              </div>

              <p className="text-label text-muted-foreground">
                {plan.maxEmployees === null
                  ? t.billing.unlimitedPeople
                  : t.billing.upToPeople(plan.maxEmployees)}
              </p>

              <Button
                className="mt-auto"
                variant={isCurrent ? "outline" : "primary"}
                disabled={isCurrent || !plan.purchasable || tooSmall}
                loading={checkout.isPending && checkout.variables === plan.id}
                onClick={async () => {
                  try {
                    await checkout.mutateAsync(plan.id);
                  } catch (error) {
                    toast.error(error instanceof ApiError ? error.message : t.app.genericError);
                  }
                }}
              >
                {isCurrent
                  ? t.billing.currentPlan
                  : tooSmall
                    ? t.billing.tooSmall
                    : t.billing.switchTo(plan.name)}
              </Button>
            </div>
          );
        })}
      </div>
    </Card>
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
