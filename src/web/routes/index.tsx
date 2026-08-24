import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { createFileRoute, redirect, useNavigate } from "@tanstack/react-router";
import { Clock3 } from "lucide-react";
import { useState } from "react";
import { z } from "zod";
import { forgotPasswordSchema, loginSchema } from "@core/contracts";
import { ApiError, call, rpc } from "../api/client";
import { authStateQuery, sessionQuery, useLogin } from "../api/session";
import { t } from "../i18n/it";
import { Alert, Button, Dialog, Field, Input } from "../ui/primitives";

export const Route = createFileRoute("/")({
  beforeLoad: async ({ context }) => {
    const [state, session] = await Promise.all([
      context.queryClient.ensureQueryData(authStateQuery),
      context.queryClient.ensureQueryData(sessionQuery),
    ]);
    if (state.needsSetup) throw redirect({ to: "/setup" });
    if (session) throw redirect({ to: "/calendario" });
  },
  validateSearch: z.object({
    expired: z.boolean().optional(),
    passwordChanged: z.boolean().optional(),
  }),
  component: LoginPage,
});

type LoginValues = z.infer<typeof loginSchema>;

function LoginPage() {
  const navigate = useNavigate();
  const search = Route.useSearch();
  const login = useLogin();
  const [forgotOpen, setForgotOpen] = useState(false);

  const form = useForm<LoginValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: "", password: "" },
  });

  const onSubmit = form.handleSubmit(async (values) => {
    try {
      await login.mutateAsync(values);
      await navigate({ to: "/calendario" });
    } catch (error) {
      form.setError("root", {
        message: error instanceof ApiError ? error.message : t.app.genericError,
      });
    }
  });

  return (
    <div className="grid min-h-dvh lg:grid-cols-2">
      <aside className="hidden flex-col justify-between bg-primary p-10 text-primary-foreground lg:flex">
        <div className="flex items-center gap-2 text-sm font-semibold">
          <Clock3 className="size-5" aria-hidden />
          Presenze
        </div>
        <p className="max-w-sm text-2xl font-semibold leading-snug tracking-tight">{t.auth.tagline}</p>
        <div />
      </aside>

      <main className="flex items-center justify-center p-6">
        <div className="w-full max-w-sm">
          <h1 className="text-xl font-semibold">{t.auth.signIn}</h1>
          <p className="mt-1 text-[13px] text-muted-foreground">{t.auth.tagline}</p>

          {search.expired ? (
            <Alert tone="warning" className="mt-4">
              {t.auth.sessionExpired}
            </Alert>
          ) : null}
          {search.passwordChanged ? (
            <Alert tone="success" className="mt-4">
              {t.auth.passwordChanged}
            </Alert>
          ) : null}

          <form onSubmit={onSubmit} className="mt-6 space-y-4" noValidate>
            <Field label={t.auth.email} error={form.formState.errors.email?.message}>
              {(props) => (
                <Input type="email" autoComplete="username" autoFocus {...props} {...form.register("email")} />
              )}
            </Field>

            <Field label={t.auth.password} error={form.formState.errors.password?.message}>
              {(props) => (
                <Input type="password" autoComplete="current-password" {...props} {...form.register("password")} />
              )}
            </Field>

            {form.formState.errors.root ? (
              <Alert tone="danger">{form.formState.errors.root.message}</Alert>
            ) : null}

            <Button type="submit" className="w-full" loading={form.formState.isSubmitting}>
              {t.auth.signIn}
            </Button>
          </form>

          <button
            type="button"
            onClick={() => setForgotOpen(true)}
            className="mt-4 text-[13px] text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
          >
            {t.auth.forgot}
          </button>

          <ForgotPasswordDialog open={forgotOpen} onOpenChange={setForgotOpen} />
        </div>
      </main>
    </div>
  );
}

/** A real dialog: the previous login screen hand-rolled its own modal here. */
function ForgotPasswordDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const [sent, setSent] = useState(false);
  const form = useForm<{ email: string }>({
    resolver: zodResolver(forgotPasswordSchema),
    defaultValues: { email: "" },
  });

  const onSubmit = form.handleSubmit(async (values) => {
    await call(rpc.auth["forgot-password"].$post({ json: values })).catch(() => null);
    // The answer is deliberately the same whether or not the address exists.
    setSent(true);
  });

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        onOpenChange(next);
        if (!next) {
          setSent(false);
          form.reset();
        }
      }}
      title={t.auth.forgotTitle}
      description={t.auth.forgotHint}
      footer={
        sent ? (
          <Button onClick={() => onOpenChange(false)}>{t.app.close}</Button>
        ) : (
          <>
            <Button variant="ghost" onClick={() => onOpenChange(false)}>
              {t.app.cancel}
            </Button>
            <Button onClick={onSubmit} loading={form.formState.isSubmitting}>
              {t.auth.send}
            </Button>
          </>
        )
      }
    >
      {sent ? (
        <Alert tone="success">{t.auth.forgotSent}</Alert>
      ) : (
        <Field label={t.auth.email} error={form.formState.errors.email?.message}>
          {(props) => <Input type="email" autoFocus {...props} {...form.register("email")} />}
        </Field>
      )}
    </Dialog>
  );
}
