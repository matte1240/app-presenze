import { useQuery } from "@tanstack/react-query";
import { createFileRoute, Outlet, redirect, useRouterState } from "@tanstack/react-router";
import { ShieldCheck } from "lucide-react";
import { useForm } from "react-hook-form";
import { ApiError } from "../api/client";
import { platformMeQuery, usePlatformLogin } from "../api/platform";
import { t } from "../i18n/it";
import { Alert, Button, Field, Input } from "../ui/primitives";

export const Route = createFileRoute("/piattaforma")({
  beforeLoad: async ({ context, location }) => {
    const me = await context.queryClient.ensureQueryData(platformMeQuery);
    // Only the login page itself redirects onward: this route is also the
    // parent of `/piattaforma/organizzazioni`, whose beforeLoad runs after
    // this one on every visit, and redirecting there unconditionally would
    // send it right back to itself in an infinite loop.
    if (me && location.pathname === "/piattaforma") throw redirect({ to: "/piattaforma/organizzazioni" });
  },
  component: PlatformRoute,
});

/**
 * Doubles as the login page and as the layout for its children. Without this
 * split the login form's own JSX — which has no `<Outlet />` — would be all
 * that ever rendered, even once signed in and navigated to a child route.
 */
function PlatformRoute() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  return pathname === "/piattaforma" ? <PlatformLogin /> : <Outlet />;
}

function PlatformLogin() {
  const login = usePlatformLogin();
  const { refetch } = useQuery(platformMeQuery);
  const form = useForm<{ email: string; password: string }>({
    defaultValues: { email: "", password: "" },
  });

  const onSubmit = form.handleSubmit(async (values) => {
    try {
      await login.mutateAsync(values);
      await refetch();
      window.location.assign("/piattaforma/organizzazioni");
    } catch (error) {
      form.setError("root", {
        message: error instanceof ApiError ? error.message : t.app.genericError,
      });
    }
  });

  return (
    <main className="flex min-h-dvh items-center justify-center bg-background px-5 py-10">
      <div className="w-full max-w-[22rem]">
        <div className="mb-7 flex flex-col items-center gap-2 text-center">
          <ShieldCheck className="size-7 text-primary" aria-hidden />
          <h1 className="text-display font-semibold tracking-[-0.02em]">{t.platform.title}</h1>
          <p className="text-body text-muted-foreground">{t.platform.loginHint}</p>
        </div>

        <form onSubmit={onSubmit} className="space-y-4" noValidate>
          <Field label={t.auth.email}>
            {(props) => (
              <Input type="email" autoFocus autoComplete="username" {...props} {...form.register("email")} />
            )}
          </Field>
          <Field label={t.auth.password}>
            {(props) => (
              <Input
                type="password"
                autoComplete="current-password"
                {...props}
                {...form.register("password")}
              />
            )}
          </Field>

          {form.formState.errors.root ? (
            <Alert tone="danger">{form.formState.errors.root.message}</Alert>
          ) : null}

          <Button type="submit" size="lg" className="w-full" loading={form.formState.isSubmitting}>
            {t.auth.signIn}
          </Button>
        </form>
      </div>
    </main>
  );
}
