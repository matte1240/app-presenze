import { useQuery } from "@tanstack/react-query";
import { createFileRoute, redirect } from "@tanstack/react-router";
import { Plus, Trash2 } from "lucide-react";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { ApiError } from "../../api/client";
import {
  platformAdminsQuery,
  platformMeQuery,
  useChangeOwnPassword,
  useCreateAdmin,
  useDeleteAdmin,
  type PlatformAdmin,
} from "../../api/platform";
import { t } from "../../i18n/it";
import {
  Alert,
  Badge,
  Button,
  Card,
  CardBody,
  CardHeader,
  ConfirmDialog,
  Dialog,
  Field,
  Input,
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

export const Route = createFileRoute("/piattaforma/amministratori")({
  beforeLoad: async ({ context }) => {
    const me = await context.queryClient.ensureQueryData(platformMeQuery);
    if (!me) throw redirect({ to: "/piattaforma" });
  },
  component: AdminsPage,
});

function AdminsPage() {
  const toast = useToast();
  const { data, isLoading } = useQuery(platformAdminsQuery);
  const remove = useDeleteAdmin();
  const [createOpen, setCreateOpen] = useState(false);
  const [toDelete, setToDelete] = useState<PlatformAdmin | null>(null);

  return (
    <div className="mx-auto w-full max-w-[60rem] space-y-4 p-4 sm:px-6 sm:py-5">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-display font-semibold tracking-[-0.02em]">{t.platform.admins}</h1>
          <p className="mt-0.5 text-label text-muted-foreground">{t.platform.adminsHint}</p>
        </div>
        <Button onClick={() => setCreateOpen(true)}>
          <Plus aria-hidden />
          {t.platform.newAdmin}
        </Button>
      </header>

      <Card>
        <CardHeader title={t.platform.admins} />
        {isLoading || !data ? (
          <div className="p-5">
            <SkeletonRows rows={3} />
          </div>
        ) : (
          <TableWrapper className="rounded-none border-0">
            <Table>
              <THead>
                <TR>
                  <TH>{t.users.name}</TH>
                  <TH>{t.auth.email}</TH>
                  <TH>{t.billing.status}</TH>
                  <TH className="text-right">{t.platform.actions}</TH>
                </TR>
              </THead>
              <TBody>
                {data.admins.map((admin) => (
                  <TR key={admin.id}>
                    <TD className="font-medium">{admin.name}</TD>
                    <TD>{admin.email}</TD>
                    <TD>
                      {admin.mustChangePassword ? (
                        <Badge tone="warning">{t.platform.pendingPassword}</Badge>
                      ) : (
                        <Badge tone="success">{t.platform.active}</Badge>
                      )}
                    </TD>
                    <TD className="text-right">
                      <Button
                        size="icon"
                        variant="ghost"
                        className="text-destructive"
                        title={t.app.delete}
                        aria-label={t.app.delete}
                        disabled={admin.id === data.me || data.admins.length === 1}
                        onClick={() => setToDelete(admin)}
                      >
                        <Trash2 aria-hidden />
                      </Button>
                    </TD>
                  </TR>
                ))}
              </TBody>
            </Table>
          </TableWrapper>
        )}
      </Card>

      <OwnPasswordCard />

      <CreateAdminDialog open={createOpen} onOpenChange={setCreateOpen} />

      <ConfirmDialog
        open={toDelete !== null}
        onOpenChange={(open) => !open && setToDelete(null)}
        title={t.app.delete}
        description={toDelete ? t.platform.deleteAdminConfirm(toDelete.email) : ""}
        confirmLabel={t.app.delete}
        destructive
        loading={remove.isPending}
        onConfirm={async () => {
          if (!toDelete) return;
          try {
            await remove.mutateAsync(toDelete.id);
            toast.success(t.platform.adminDeleted);
          } catch (error) {
            toast.error(error instanceof ApiError ? error.message : t.app.genericError);
          }
          setToDelete(null);
        }}
      />
    </div>
  );
}

/** Also the screen a locked account is sent to, which is why it stands alone. */
export function OwnPasswordCard({ forced = false }: { forced?: boolean }) {
  const toast = useToast();
  const change = useChangeOwnPassword();
  const form = useForm<{ currentPassword: string; newPassword: string }>({
    defaultValues: { currentPassword: "", newPassword: "" },
  });

  const onSubmit = form.handleSubmit(async (values) => {
    try {
      await change.mutateAsync(values);
      form.reset();
      toast.success(t.platform.passwordChanged);
      if (forced) window.location.assign("/piattaforma/organizzazioni");
    } catch (error) {
      form.setError("root", {
        message: error instanceof ApiError ? error.message : t.app.genericError,
      });
    }
  });

  return (
    <Card className="max-w-md">
      <CardHeader title={t.platform.myPassword} />
      <CardBody>
        <form onSubmit={onSubmit} className="space-y-4" noValidate>
          {forced ? <Alert tone="warning">{t.platform.mustChangeNotice}</Alert> : null}

          <Field label={t.auth.currentPassword} required>
            {(props) => (
              <Input type="password" autoComplete="current-password" {...props} {...form.register("currentPassword")} />
            )}
          </Field>
          <Field label={t.auth.newPassword} required>
            {(props) => (
              <Input type="password" autoComplete="new-password" {...props} {...form.register("newPassword")} />
            )}
          </Field>

          {form.formState.errors.root ? (
            <Alert tone="danger">{form.formState.errors.root.message}</Alert>
          ) : null}

          <Button type="submit" loading={form.formState.isSubmitting}>
            {t.app.save}
          </Button>
        </form>
      </CardBody>
    </Card>
  );
}

function CreateAdminDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const toast = useToast();
  const create = useCreateAdmin();
  const form = useForm<{ name: string; email: string; temporaryPassword: string }>({
    defaultValues: { name: "", email: "", temporaryPassword: "" },
  });

  const onSubmit = form.handleSubmit(async (values) => {
    try {
      await create.mutateAsync(values);
      form.reset();
      onOpenChange(false);
      toast.success(t.platform.adminCreated);
    } catch (error) {
      form.setError("root", {
        message: error instanceof ApiError ? error.message : t.app.genericError,
      });
    }
  });

  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      title={t.platform.newAdmin}
      description={t.platform.newAdminHint}
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
        <Field label={t.users.name} required>
          {(props) => <Input autoFocus {...props} {...form.register("name")} />}
        </Field>
        <Field label={t.auth.email} required>
          {(props) => <Input type="email" {...props} {...form.register("email")} />}
        </Field>
        <Field label={t.platform.temporaryPassword} hint={t.platform.temporaryPasswordHint} required>
          {(props) => <Input {...props} {...form.register("temporaryPassword")} />}
        </Field>

        {form.formState.errors.root ? (
          <Alert tone="danger">{form.formState.errors.root.message}</Alert>
        ) : null}
      </div>
    </Dialog>
  );
}
