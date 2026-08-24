import { zodResolver } from "@hookform/resolvers/zod";
import { createFileRoute, redirect, useNavigate } from "@tanstack/react-router";
import { Clock3 } from "lucide-react";
import { useForm } from "react-hook-form";
import { useQueryClient } from "@tanstack/react-query";
import type { z } from "zod";
import { setupSchema } from "@core/contracts";
import { ApiError, call, rpc } from "../api/client";
import { authStateQuery } from "../api/session";
import { t } from "../i18n/it";
import { Alert, Button, Field, Input } from "../ui/primitives";

export const Route = createFileRoute("/setup")({
  beforeLoad: async ({ context }) => {
    const state = await context.queryClient.ensureQueryData(authStateQuery);
    if (!state.needsSetup) throw redirect({ to: "/" });
  },
  component: SetupPage,
});

type SetupValues = z.infer<typeof setupSchema>;

function SetupPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const form = useForm<SetupValues>({
    resolver: zodResolver(setupSchema),
    defaultValues: { name: "", email: "", password: "" },
  });

  const onSubmit = form.handleSubmit(async (values) => {
    try {
      await call(rpc.auth.setup.$post({ json: values }));
      // Reset rather than invalidate: the route guards read through
      // `ensureQueryData`, which returns stale cache instead of refetching.
      await queryClient.resetQueries();
      await navigate({ to: "/calendario" });
    } catch (error) {
      form.setError("root", { message: error instanceof ApiError ? error.message : t.app.genericError });
    }
  });

  return (
    <main className="flex min-h-dvh items-center justify-center p-6">
      <div className="w-full max-w-sm">
        <div className="mb-6 flex items-center gap-2 text-sm font-semibold">
          <Clock3 className="size-5 text-primary" aria-hidden />
          Presenze
        </div>

        <h1 className="text-xl font-semibold">{t.setup.title}</h1>
        <p className="mt-1 text-[13px] text-muted-foreground">{t.setup.subtitle}</p>

        <form onSubmit={onSubmit} className="mt-6 space-y-4" noValidate>
          <Field label={t.setup.name} required error={form.formState.errors.name?.message}>
            {(props) => <Input autoFocus autoComplete="name" {...props} {...form.register("name")} />}
          </Field>

          <Field label={t.auth.email} required error={form.formState.errors.email?.message}>
            {(props) => <Input type="email" autoComplete="username" {...props} {...form.register("email")} />}
          </Field>

          <Field
            label={t.auth.password}
            required
            hint="Almeno 8 caratteri, con maiuscola, minuscola e numero."
            error={form.formState.errors.password?.message}
          >
            {(props) => (
              <Input type="password" autoComplete="new-password" {...props} {...form.register("password")} />
            )}
          </Field>

          {form.formState.errors.root ? <Alert tone="danger">{form.formState.errors.root.message}</Alert> : null}

          <Button type="submit" className="w-full" loading={form.formState.isSubmitting}>
            {t.setup.submit}
          </Button>
        </form>
      </div>
    </main>
  );
}
