import { useQuery } from "@tanstack/react-query";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import type { z } from "zod";
import { changePasswordSchema } from "@core/contracts";
import { formatDateIt, type LocalDate } from "@core/date";
import { ApiError, call, rpc } from "../../api/client";
import { t } from "../../i18n/it";
import { Alert, Avatar, Badge, Button, Card, CardBody, CardHeader, Field, Input } from "../../ui/primitives";

export const Route = createFileRoute("/_app/profilo")({ component: ProfilePage });

type PasswordValues = z.infer<typeof changePasswordSchema>;

function ProfilePage() {
  const { user } = Route.useRouteContext();
  const navigate = useNavigate();

  const missing = useQuery({
    queryKey: ["missing-days"],
    queryFn: () =>
      call<{ editable: string[]; requiresAdmin: string[] }>(rpc.me["missing-days"].$get()),
  });

  const form = useForm<PasswordValues>({
    resolver: zodResolver(changePasswordSchema),
    defaultValues: { currentPassword: "", newPassword: "" },
  });

  const onSubmit = form.handleSubmit(async (values) => {
    try {
      await call(rpc.auth["change-password"].$post({ json: values }));
      // Changing the password revokes every session, this one included.
      await navigate({ to: "/", search: { passwordChanged: true } });
    } catch (error) {
      form.setError("root", { message: error instanceof ApiError ? error.message : t.app.genericError });
    }
  });

  const nothingMissing =
    (missing.data?.editable.length ?? 0) === 0 && (missing.data?.requiresAdmin.length ?? 0) === 0;

  return (
    <div className="space-y-5">
      <header>
        <h2 className="text-lg font-semibold">{t.profile.title}</h2>
        <p className="text-[13px] text-muted-foreground">{t.profile.subtitle}</p>
      </header>

      <div className="grid gap-5 lg:grid-cols-2">
        <Card>
          <CardBody className="flex items-center gap-4">
            <Avatar name={user.name} className="size-12 text-sm" />
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold">{user.name}</p>
              <p className="truncate text-[13px] text-muted-foreground">{user.email}</p>
              <div className="mt-2 flex flex-wrap gap-1.5">
                <Badge tone="primary">{t.users.roles[user.role]}</Badge>
                {user.canWorkSunday ? <Badge>{t.users.canWorkSunday}</Badge> : null}
                {user.has104 ? <Badge tone="info">{t.timesheet.leave104}</Badge> : null}
                {user.hasPaternity ? <Badge tone="info">{t.timesheet.paternity}</Badge> : null}
              </div>
            </div>
          </CardBody>
        </Card>

        <Card>
          <CardHeader title={t.profile.missingDays} />
          <CardBody>
            {missing.isLoading ? (
              <p className="text-[13px] text-muted-foreground">{t.app.loading}</p>
            ) : nothingMissing ? (
              <Alert tone="success">{t.profile.missingDaysNone}</Alert>
            ) : (
              <div className="space-y-3">
                {missing.data!.editable.length > 0 ? (
                  <div>
                    <p className="text-[13px] font-medium">{t.profile.missingEditable}</p>
                    <p className="mt-1 text-[13px] text-muted-foreground">
                      {missing.data!.editable.map((d) => formatDateIt(d as LocalDate)).join(", ")}
                    </p>
                  </div>
                ) : null}
                {missing.data!.requiresAdmin.length > 0 ? (
                  <div>
                    <p className="text-[13px] font-medium">{t.profile.missingLocked}</p>
                    <p className="mt-1 text-[13px] text-muted-foreground">
                      {missing.data!.requiresAdmin.map((d) => formatDateIt(d as LocalDate)).join(", ")}
                    </p>
                  </div>
                ) : null}
              </div>
            )}
          </CardBody>
        </Card>
      </div>

      <Card className="max-w-md">
        <CardHeader title={t.profile.changePassword} />
        <CardBody>
          <form onSubmit={onSubmit} className="space-y-4" noValidate>
            <Field label={t.auth.currentPassword} required error={form.formState.errors.currentPassword?.message}>
              {(props) => (
                <Input type="password" autoComplete="current-password" {...props} {...form.register("currentPassword")} />
              )}
            </Field>

            <Field label={t.auth.newPassword} required error={form.formState.errors.newPassword?.message}>
              {(props) => (
                <Input type="password" autoComplete="new-password" {...props} {...form.register("newPassword")} />
              )}
            </Field>

            {form.formState.errors.root ? <Alert tone="danger">{form.formState.errors.root.message}</Alert> : null}

            <Button type="submit" loading={form.formState.isSubmitting}>
              {t.app.save}
            </Button>
          </form>
        </CardBody>
      </Card>
    </div>
  );
}
