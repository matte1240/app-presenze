import { useQuery } from "@tanstack/react-query";
import { createFileRoute, redirect } from "@tanstack/react-router";
import { Download, LogIn, Plus, ShieldCheck } from "lucide-react";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { ApiError } from "../../api/client";
import {
  exportOrganization,
  platformAuditQuery,
  platformMeQuery,
  platformOrganizationsQuery,
  useCreateOrganization,
  useImpersonate,
  usePlatformLogout,
  useUpdateOrganization,
  type OrgStatus,
  type PlanId,
  type PlatformOrganization,
} from "../../api/platform";
import { t } from "../../i18n/it";
import {
  Alert,
  Button,
  Card,
  CardHeader,
  Dialog,
  Field,
  Input,
  NativeSelect,
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

export const Route = createFileRoute("/piattaforma/organizzazioni")({
  beforeLoad: async ({ context }) => {
    const me = await context.queryClient.ensureQueryData(platformMeQuery);
    if (!me) throw redirect({ to: "/piattaforma" });
    return { admin: me.admin };
  },
  component: OrganizationsPage,
});

/** Also the order the statuses appear in the picker. */
const STATUS_TONE: Record<OrgStatus, "success" | "warning" | "danger" | "neutral"> = {
  TRIAL: "neutral",
  ACTIVE: "success",
  PAST_DUE: "warning",
  SUSPENDED: "danger",
  CANCELLED: "danger",
};

const dateIt = (iso: string | null) =>
  iso ? new Date(iso).toLocaleDateString("it-IT", { day: "2-digit", month: "2-digit", year: "numeric" }) : "—";

function OrganizationsPage() {
  const { admin } = Route.useRouteContext();
  const logout = usePlatformLogout();
  const { data, isLoading } = useQuery(platformOrganizationsQuery);
  const [createOpen, setCreateOpen] = useState(false);

  return (
    <div className="mx-auto w-full max-w-[88rem] space-y-4 p-4 sm:px-6 sm:py-5">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2 text-display font-semibold tracking-[-0.02em]">
            <ShieldCheck className="size-5 text-primary" aria-hidden />
            {t.platform.title}
          </h1>
          <p className="mt-0.5 text-label text-muted-foreground">{admin.email}</p>
        </div>
        <div className="flex gap-2">
          <Button onClick={() => setCreateOpen(true)}>
            <Plus aria-hidden />
            {t.platform.newOrganization}
          </Button>
          <Button variant="ghost" onClick={() => logout.mutate()}>
            {t.auth.signOut}
          </Button>
        </div>
      </header>

      <Card>
        <CardHeader title={t.platform.organizations} />
        {isLoading || !data ? (
          <div className="p-5">
            <SkeletonRows rows={4} />
          </div>
        ) : (
          <TableWrapper className="rounded-none border-0">
            <Table>
              <THead>
                <TR>
                  <TH>{t.platform.organization}</TH>
                  <TH>{t.billing.status}</TH>
                  <TH>{t.billing.plan}</TH>
                  <TH numeric>{t.billing.seats}</TH>
                  <TH>{t.platform.expiry}</TH>
                  <TH className="text-right">{t.platform.actions}</TH>
                </TR>
              </THead>
              <TBody>
                {data.organizations.map((organization) => (
                  <OrganizationRow key={organization.id} organization={organization} />
                ))}
              </TBody>
            </Table>
          </TableWrapper>
        )}
      </Card>

      <AuditCard />
      <CreateDialog open={createOpen} onOpenChange={setCreateOpen} />
    </div>
  );
}

function OrganizationRow({ organization }: { organization: PlatformOrganization }) {
  const toast = useToast();
  const update = useUpdateOrganization();
  const impersonate = useImpersonate();

  const run = async (patch: { plan?: PlanId; status?: OrgStatus }) => {
    try {
      await update.mutateAsync({ id: organization.id, ...patch });
      toast.success(t.platform.saved);
    } catch (error) {
      toast.error(error instanceof ApiError ? error.message : t.app.genericError);
    }
  };

  return (
    <TR>
      <TD>
        <div className="font-medium">{organization.name}</div>
        <div className="font-mono text-[12px] text-muted-foreground">{organization.slug}</div>
      </TD>
      <TD>
        {/* Editable in place: suspending or reinstating an account is the
            single most common thing to do from this table. */}
        <NativeSelect
          aria-label={t.billing.status}
          value={organization.status}
          disabled={update.isPending}
          onChange={(event) => void run({ status: event.target.value as OrgStatus })}
        >
          {(Object.keys(STATUS_TONE) as OrgStatus[]).map((status) => (
            <option key={status} value={status}>
              {t.billing.statuses[status]}
            </option>
          ))}
        </NativeSelect>
      </TD>
      <TD>
        <NativeSelect
          aria-label={t.billing.plan}
          value={organization.plan}
          disabled={update.isPending}
          onChange={(event) => void run({ plan: event.target.value as PlanId })}
        >
          {(["STARTER", "PRO", "BUSINESS"] as PlanId[]).map((plan) => (
            <option key={plan} value={plan}>
              {plan}
            </option>
          ))}
        </NativeSelect>
      </TD>
      <TD numeric>{t.billing.seatsOf(organization.seatsUsed, organization.seatLimit)}</TD>
      <TD>{dateIt(organization.trialEndsAt ?? organization.currentPeriodEnd)}</TD>
      <TD className="text-right">
        <div className="flex justify-end gap-1">
          <Button
            size="sm"
            variant="ghost"
            title={t.platform.impersonate}
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
          </Button>
          <Button
            size="sm"
            variant="ghost"
            title={t.platform.export}
            onClick={() => exportOrganization(organization)}
          >
            <Download aria-hidden />
          </Button>
        </div>
      </TD>
    </TR>
  );
}

function AuditCard() {
  const { data } = useQuery(platformAuditQuery);
  if (!data || data.entries.length === 0) return null;

  return (
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
            {data.entries.slice(0, 20).map((entry) => (
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
  );
}

function CreateDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const toast = useToast();
  const create = useCreateOrganization();
  const form = useForm<{ organizationName: string; adminName: string; adminEmail: string }>({
    defaultValues: { organizationName: "", adminName: "", adminEmail: "" },
  });

  const onSubmit = form.handleSubmit(async (values) => {
    try {
      const result = await create.mutateAsync(values);
      toast.success(result.invited ? t.platform.createdInvited : t.platform.createdNoEmail);
      form.reset();
      onOpenChange(false);
    } catch (error) {
      toast.error(error instanceof ApiError ? error.message : t.app.genericError);
    }
  });

  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      title={t.platform.newOrganization}
      description={t.platform.newOrganizationHint}
      footer={
        <>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            {t.app.cancel}
          </Button>
          <Button onClick={onSubmit} loading={form.formState.isSubmitting}>
            {t.app.confirm}
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <Field label={t.auth.organizationName}>
          {(props) => <Input autoFocus {...props} {...form.register("organizationName")} />}
        </Field>
        <Field label={t.platform.adminName}>
          {(props) => <Input {...props} {...form.register("adminName")} />}
        </Field>
        <Field label={t.platform.adminEmail}>
          {(props) => <Input type="email" {...props} {...form.register("adminEmail")} />}
        </Field>
        <Alert tone="info">{t.platform.inviteNotice}</Alert>
      </div>
    </Dialog>
  );
}
