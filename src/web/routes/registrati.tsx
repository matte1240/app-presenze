import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { createFileRoute, Link, redirect, useNavigate } from "@tanstack/react-router";
import { Clock3 } from "lucide-react";
import type { z } from "zod";
import { signupSchema } from "@core/contracts";
import { ApiError } from "../api/client";
import { authStateQuery, sessionQuery, useSignup } from "../api/session";
import { BrandPanel } from "../features/auth/brand-panel";
import { t } from "../i18n/it";
import { Alert, Button, Field, Input } from "../ui/primitives";

export const Route = createFileRoute("/registrati")({
  beforeLoad: async ({ context }) => {
    const [state, session] = await Promise.all([
      context.queryClient.ensureQueryData(authStateQuery),
      context.queryClient.ensureQueryData(sessionQuery),
    ]);
    if (session) throw redirect({ to: "/calendario" });
    // The server refuses too; this only saves the visitor a pointless form.
    if (!state.signupEnabled) throw redirect({ to: "/" });
    return { appName: state.appName };
  },
  component: SignupPage,
});

type SignupValues = z.infer<typeof signupSchema>;

function SignupPage() {
  const navigate = useNavigate();
  const { appName } = Route.useRouteContext();
  const signup = useSignup();

  const form = useForm<SignupValues>({
    resolver: zodResolver(signupSchema),
    defaultValues: { organizationName: "", name: "", email: "", password: "" },
  });

  const onSubmit = form.handleSubmit(async (values) => {
    try {
      await signup.mutateAsync(values);
      await navigate({ to: "/calendario" });
    } catch (error) {
      form.setError("root", {
        message: error instanceof ApiError ? error.message : t.app.genericError,
      });
    }
  });

  return (
    <div className="flex min-h-dvh bg-background">
      <BrandPanel className="hidden lg:flex lg:w-[46%]" companyName={appName} />

      <main className="flex flex-1 items-center justify-center px-5 py-10 sm:px-8">
        <div className="w-full max-w-[22rem]">
          <div className="mb-8 flex items-center justify-center gap-2 text-title font-semibold lg:hidden">
            <Clock3 className="size-6 text-primary" aria-hidden />
            {t.app.name}
          </div>

          <div className="mb-7">
            <h1 className="text-display font-semibold tracking-[-0.02em]">{t.auth.signupTitle}</h1>
            <p className="mt-1.5 text-body text-muted-foreground">{t.auth.signupHint}</p>
          </div>

          <form onSubmit={onSubmit} className="space-y-4" noValidate>
            <Field
              label={t.auth.organizationName}
              error={form.formState.errors.organizationName?.message}
            >
              {(props) => (
                <Input
                  autoFocus
                  autoComplete="organization"
                  {...props}
                  {...form.register("organizationName")}
                />
              )}
            </Field>

            <Field label={t.auth.yourName} error={form.formState.errors.name?.message}>
              {(props) => <Input autoComplete="name" {...props} {...form.register("name")} />}
            </Field>

            <Field label={t.auth.email} error={form.formState.errors.email?.message}>
              {(props) => (
                <Input type="email" autoComplete="username" {...props} {...form.register("email")} />
              )}
            </Field>

            <Field label={t.auth.password} error={form.formState.errors.password?.message}>
              {(props) => (
                <Input
                  type="password"
                  autoComplete="new-password"
                  {...props}
                  {...form.register("password")}
                />
              )}
            </Field>

            {form.formState.errors.root ? (
              <Alert tone="danger">{form.formState.errors.root.message}</Alert>
            ) : null}

            <Button type="submit" size="lg" className="w-full" loading={form.formState.isSubmitting}>
              {t.auth.signupAction}
            </Button>
          </form>

          <p className="mt-5 text-center text-label text-muted-foreground">
            {t.auth.alreadyRegistered}{" "}
            <Link to="/" className="text-primary underline-offset-4 hover:underline">
              {t.auth.signIn}
            </Link>
          </p>
        </div>
      </main>
    </div>
  );
}
