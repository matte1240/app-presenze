import { useQuery } from "@tanstack/react-query";
import { createFileRoute, Link, redirect } from "@tanstack/react-router";
import { ArrowLeft, Download, LogIn, Trash2 } from "lucide-react";
import { useState } from "react";
import { ApiError } from "../../api/client";
import {
  organizationDeletionPreview,
  organizationDetailQuery,
  platformMeQuery,
  useDeleteOrganization,
  useImpersonate,
} from "../../api/platform";
import { t } from "../../i18n/it";
import {
  Badge,
  Button,
  buttonClasses,
  Card,
  CardHeader,
  ConfirmDialog,
  SkeletonRows,
  Table,
  TableWrapper,
  TBody,
  TD,
  TH,
  THead,
  TR,
  useToast,
} from "../../ui/primitives";

/**
 * Singular in the filename on purpose. `organizzazioni.$id.tsx` would be nested
 * under `organizzazioni.tsx`, which is exactly the trap that once made the
 * whole back office unreachable.
 */
export const Route = createFileRoute("/piattaforma/organizzazione/$id")({
  beforeLoad: async ({ context }) => {
    const me = await context.queryClient.ensureQueryData(platformMeQuery);
    if (!me) throw redirect({ to: "/piattaforma" });
  },
  component: OrganizationDetailPage,
});

const dateIt = (iso: string | null) =>
  iso ? new Date(iso).toLocaleDateString("it-IT", { day: "2-digit", month: "2-digit", year: "numeric" }) : "—";

function OrganizationDetailPage() {
  const { id } = Route.useParams();
  const toast = useToast();
  const { data, isLoading } = useQuery(organizationDetailQuery(id));
  const impersonate = useImpersonate();
  const remove = useDeleteOrganization();

  const [confirmDelete, setConfirmDelete] = useState(false);
  const [preview, setPreview] = useState<{ users: number; timeEntries: number } | null>(null);

  if (isLoading || !data) {
    return (
      <div className="mx-auto w-full max-w-[72rem] p-4 sm:px-6 sm:py-5">
        <SkeletonRows rows={5} />
      </div>
    );
  }

  const { organization, users, subscription, audit } = data;

  return (
    <div className="mx-auto w-full max-w-[72rem] space-y-4 p-4 sm:px-6 sm:py-5">
      <Link
        to="/piattaforma/organizzazioni"
        className="inline-flex items-center gap-1.5 text-label text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="size-3.5" aria-hidden />
        {t.platform.backToList}
      </Link>

      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-display font-semibold tracking-[-0.02em]">{organization.name}</h1>
          <p className="mt-0.5 font-mono text-label text-muted-foreground">{organization.slug}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button
            variant="outline"
            loading={impersonate.isPending}
            onClick={async () => {
              try {
                await impersonate.mutateAsync(organization.id);
              } catch (error) {
                toast.error(error instanceof ApiError ? error.message : t.app.genericError);
              }
            }}
          >
            <LogIn aria-hidden />
            {t.platform.impersonate}
          </Button>
          <a
            className={buttonClasses("outline")}
            href={`/api/platform/organizations/${organization.id}/export`}
          >
            <Download aria-hidden />
            {t.platform.export}
          </a>
          <Button
            variant="destructive"
            onClick={async () => {
              setPreview(await organizationDeletionPreview(organization.id).catch(() => null));
              setConfirmDelete(true);
            }}
          >
            <Trash2 aria-hidden />
            {t.platform.closeAccount}
          </Button>
        </div>
      </header>

      <Card>
        <CardHeader title={t.platform.summary} />
        <dl className="grid gap-px bg-border sm:grid-cols-2 lg:grid-cols-4">
          <Row label={t.billing.status}>
            <Badge tone={organization.status === "ACTIVE" ? "success" : "warning"}>
              {t.billing.statuses[organization.status]}
            </Badge>
          </Row>
          <Row label={t.billing.plan}>{organization.planName}</Row>
          <Row label={t.billing.seats}>
            {t.billing.seatsOf(organization.seatsUsed, organization.seatLimit)}
          </Row>
          <Row label={t.platform.expiry}>
            {dateIt(organization.trialEndsAt ?? subscription?.currentPeriodEnd ?? null)}
          </Row>
          <Row label={t.organization.timezone}>{organization.timezone}</Row>
          <Row label={t.organization.patronDays}>{organization.holidayPatronDays || "—"}</Row>
          <Row label={t.platform.customer}>{subscription?.stripeCustomerId ?? "—"}</Row>
          <Row label={t.platform.since}>{dateIt(organization.createdAt)}</Row>
        </dl>
      </Card>

      <Card>
        <CardHeader title={t.platform.people} />
        <TableWrapper className="rounded-none border-0">
          <Table>
            <THead>
              <TR>
                <TH>{t.users.name}</TH>
                <TH>{t.auth.email}</TH>
                <TH>{t.users.role}</TH>
              </TR>
            </THead>
            <TBody>
              {users.map((person) => (
                <TR key={person.id} className={person.deactivatedAt ? "opacity-60" : undefined}>
                  <TD className="font-medium">{person.name}</TD>
                  <TD>{person.email}</TD>
                  <TD>
                    {person.deactivatedAt ? (
                      <Badge tone="warning">{t.users.inactive}</Badge>
                    ) : (
                      <Badge tone={person.role === "ADMIN" ? "primary" : "neutral"}>
                        {t.users.roles[person.role]}
                      </Badge>
                    )}
                  </TD>
                </TR>
              ))}
            </TBody>
          </Table>
        </TableWrapper>
      </Card>

      {audit.length > 0 ? (
        <Card>
          <CardHeader title={t.platform.audit} />
          <TableWrapper className="rounded-none border-0">
            <Table>
              <THead>
                <TR>
                  <TH>{t.platform.when}</TH>
                  <TH>{t.platform.who}</TH>
                  <TH>{t.platform.what}</TH>
                </TR>
              </THead>
              <TBody>
                {audit.map((entry) => (
                  <TR key={entry.id}>
                    <TD className="whitespace-nowrap">
                      {new Date(entry.createdAt).toLocaleString("it-IT")}
                    </TD>
                    <TD>{entry.actorLabel ?? "—"}</TD>
                    <TD className="font-mono text-[12px]">{entry.action}</TD>
                  </TR>
                ))}
              </TBody>
            </Table>
          </TableWrapper>
        </Card>
      ) : null}

      <ConfirmDialog
        open={confirmDelete}
        onOpenChange={setConfirmDelete}
        title={t.platform.closeAccount}
        description={t.platform.closeAccountConfirm(
          organization.name,
          preview?.users ?? 0,
          preview?.timeEntries ?? 0,
        )}
        confirmLabel={t.platform.closeAccount}
        destructive
        loading={remove.isPending}
        onConfirm={async () => {
          try {
            await remove.mutateAsync(organization.id);
            toast.success(t.platform.accountClosed);
            window.location.assign("/piattaforma/organizzazioni");
          } catch (error) {
            toast.error(error instanceof ApiError ? error.message : t.app.genericError);
          }
        }}
      />
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
