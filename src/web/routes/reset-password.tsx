import { zodResolver } from "@hookform/resolvers/zod";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { passwordSchema } from "@core/contracts";
import { ApiError, call, rpc } from "../api/client";
import { t } from "../i18n/it";
import { Alert, Button, Field, Input } from "../ui/primitives";

export const Route = createFileRoute("/reset-password")({
  validateSearch: z.object({ token: z.string().optional() }),
  component: ResetPasswordPage,
});

const formSchema = z.object({ password: passwordSchema });

function ResetPasswordPage() {
  const { token } = Route.useSearch();
  const navigate = useNavigate();
  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: { password: "" },
  });

  const onSubmit = form.handleSubmit(async (values) => {
    if (!token) return;
    try {
      await call(rpc.auth["reset-password"].$post({ json: { token, password: values.password } }));
      await navigate({ to: "/", search: { passwordChanged: true } });
    } catch (error) {
      form.setError("root", { message: error instanceof ApiError ? error.message : t.app.genericError });
    }
  });

  return (
    <main className="flex min-h-dvh items-center justify-center p-6">
      <div className="w-full max-w-sm">
        <h1 className="text-xl font-semibold">{t.auth.resetTitle}</h1>

        {token ? (
          <form onSubmit={onSubmit} className="mt-6 space-y-4" noValidate>
            <Field
              label={t.auth.newPassword}
              required
              hint="Almeno 8 caratteri, con maiuscola, minuscola e numero."
              error={form.formState.errors.password?.message}
            >
              {(props) => (
                <Input type="password" autoFocus autoComplete="new-password" {...props} {...form.register("password")} />
              )}
            </Field>

            {form.formState.errors.root ? <Alert tone="danger">{form.formState.errors.root.message}</Alert> : null}

            <Button type="submit" className="w-full" loading={form.formState.isSubmitting}>
              {t.app.save}
            </Button>
          </form>
        ) : (
          <Alert tone="danger" className="mt-6">
            {t.auth.resetInvalid}
          </Alert>
        )}
      </div>
    </main>
  );
}
