import { useQuery } from "@tanstack/react-query";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm, useWatch } from "react-hook-form";
import type { z } from "zod";
import { changePasswordSchema, updateProfileSchema } from "@core/contracts";
import { formatDateIt, type LocalDate } from "@core/date";
import { ApiError, call, rpc } from "../../api/client";
import type { CurrentUser } from "../../api/session";
import {
  mySessionsQuery,
  useCloseOtherSessions,
  useUpdateProfile,
  type ActiveSessionRow,
} from "../../api/organization";
import { t } from "../../i18n/it";
import {
  Alert,
  Avatar,
  Badge,
  Button,
  Card,
  CardBody,
  CardHeader,
  Field,
  Input,
  useToast,
} from "../../ui/primitives";

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
    <div className="space-y-4">
      <header>
        <h2 className="text-display font-semibold tracking-[-0.02em]">{t.profile.title}</h2>
        <p className="mt-0.5 text-label text-muted-foreground">{t.profile.subtitle}</p>
      </header>

      <div className="grid gap-4 lg:grid-cols-2">
        <IdentityCard user={user} />

        <Card>
          <CardHeader title={t.profile.missingDays} />
          <CardBody>
            {missing.isLoading ? (
              <p className="mt-0.5 text-label text-muted-foreground">{t.app.loading}</p>
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

      <SessionsCard />

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

type ProfileValues = z.infer<typeof updateProfileSchema>;

/**
 * Name and address, editable at last — until now nobody could correct their own
 * spelling, administrators included.
 */
function IdentityCard({ user }: { user: CurrentUser }) {
  const toast = useToast();
  const update = useUpdateProfile();

  const form = useForm<ProfileValues>({
    resolver: zodResolver(updateProfileSchema),
    defaultValues: { name: user.name, email: user.email, currentPassword: "" },
  });

  // The address is the key you sign in with, so the server asks for the current
  // password before changing it. The field appears only when it is needed.
  const emailChanged = useWatch({ control: form.control, name: "email" })?.toLowerCase() !== user.email;

  const onSubmit = form.handleSubmit(async (values) => {
    try {
      await update.mutateAsync(values);
      form.setValue("currentPassword", "");
      toast.success(t.profile.saved);
    } catch (error) {
      form.setError("root", {
        message: error instanceof ApiError ? error.message : t.app.genericError,
      });
    }
  });

  return (
    <Card>
      <CardBody className="space-y-4">
        <div className="flex items-center gap-4">
          <Avatar name={user.name} className="size-12 text-sm" />
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold">{user.name}</p>
            <div className="mt-2 flex flex-wrap gap-1.5">
              <Badge tone="primary">{t.users.roles[user.role]}</Badge>
              {user.canWorkSunday ? <Badge>{t.users.canWorkSunday}</Badge> : null}
              {user.has104 ? <Badge tone="info">{t.timesheet.leave104}</Badge> : null}
              {user.hasPaternity ? <Badge tone="info">{t.timesheet.paternity}</Badge> : null}
            </div>
          </div>
        </div>

        <form onSubmit={onSubmit} className="space-y-4" noValidate>
          <Field label={t.users.name} required error={form.formState.errors.name?.message}>
            {(props) => <Input {...props} {...form.register("name")} />}
          </Field>

          <Field label={t.auth.email} required error={form.formState.errors.email?.message}>
            {(props) => <Input type="email" {...props} {...form.register("email")} />}
          </Field>

          {emailChanged ? (
            <Field
              label={t.auth.currentPassword}
              hint={t.profile.emailNeedsPassword}
              error={form.formState.errors.currentPassword?.message}
            >
              {(props) => (
                <Input type="password" autoComplete="current-password" {...props} {...form.register("currentPassword")} />
              )}
            </Field>
          ) : null}

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

/** Somewhere to notice a sign-in you do not recognise, and end it. */
function SessionsCard() {
  const toast = useToast();
  const sessions = useQuery(mySessionsQuery);
  const closeOthers = useCloseOtherSessions();
  const others = (sessions.data ?? []).filter((s) => !s.current).length;

  return (
    <Card>
      <CardHeader
        title={t.profile.sessions}
        actions={
          others > 0 ? (
            <Button
              variant="outline"
              size="sm"
              loading={closeOthers.isPending}
              onClick={async () => {
                try {
                  const { closed } = await closeOthers.mutateAsync();
                  toast.success(t.profile.sessionsClosed(closed));
                } catch (error) {
                  toast.error(error instanceof ApiError ? error.message : t.app.genericError);
                }
              }}
            >
              {t.profile.closeOthers}
            </Button>
          ) : null
        }
      />
      <CardBody>
        {sessions.isLoading ? (
          <p className="text-label text-muted-foreground">{t.app.loading}</p>
        ) : (
          <ul className="space-y-2">
            {(sessions.data ?? []).map((row) => (
              <SessionRow key={row.id} row={row} />
            ))}
          </ul>
        )}
      </CardBody>
    </Card>
  );
}

function SessionRow({ row }: { row: ActiveSessionRow }) {
  return (
    <li className="flex flex-wrap items-center justify-between gap-2 text-[13px]">
      <span className="min-w-0 flex-1 truncate text-muted-foreground">
        {row.userAgent ?? t.profile.unknownDevice}
      </span>
      <span className="flex items-center gap-1.5">
        {row.impersonated ? <Badge tone="warning">{t.profile.support}</Badge> : null}
        {row.current ? <Badge tone="success">{t.profile.thisDevice}</Badge> : null}
        <span className="text-muted-foreground">
          {new Date(row.lastSeenAt).toLocaleString("it-IT")}
        </span>
      </span>
    </li>
  );
}
