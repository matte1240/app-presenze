import { useQuery } from "@tanstack/react-query";
import { zodResolver } from "@hookform/resolvers/zod";
import { createFileRoute, redirect } from "@tanstack/react-router";
import { useEffect } from "react";
import { useForm } from "react-hook-form";
import type { z } from "zod";
import { organizationSettingsSchema } from "@core/contracts";
import { ApiError } from "../../api/client";
import { organizationQuery, useSaveOrganization } from "../../api/organization";
import { t } from "../../i18n/it";
import {
  Alert,
  Button,
  Card,
  CardBody,
  CardHeader,
  Field,
  Input,
  NativeSelect,
  SkeletonRows,
  useToast,
} from "../../ui/primitives";

export const Route = createFileRoute("/_app/organizzazione")({
  beforeLoad: ({ context }) => {
    if (context.user.role !== "ADMIN") throw redirect({ to: "/calendario" });
  },
  component: OrganizationPage,
});

type Values = z.infer<typeof organizationSettingsSchema>;

/**
 * Asked of the platform rather than kept as a list of our own, which would be
 * wrong within a year. Narrowed to Europe: this is Italian labour law software,
 * and a picker with six hundred entries helps nobody.
 */
const TIMEZONES = (
  Intl.supportedValuesOf?.("timeZone") ?? ["Europe/Rome"]
).filter((zone) => zone.startsWith("Europe/"));

function OrganizationPage() {
  const toast = useToast();
  const { data, isLoading } = useQuery(organizationQuery);
  const save = useSaveOrganization();

  const form = useForm<Values>({
    resolver: zodResolver(organizationSettingsSchema),
    // A string throughout, never null: an input bound to null is both an
    // uncontrolled-component warning and, if anything calls a string method on
    // it, a blank page.
    defaultValues: { name: "", companyName: "", timezone: "Europe/Rome", holidayPatronDays: "" },
  });

  const { reset } = form;
  useEffect(() => {
    if (data) {
      reset({
        name: data.name,
        companyName: data.companyName ?? "",
        timezone: data.timezone,
        holidayPatronDays: data.holidayPatronDays,
      });
    }
  }, [data, reset]);

  const onSubmit = form.handleSubmit(async (values) => {
    try {
      await save.mutateAsync({ ...values, companyName: values.companyName?.trim() || null });
      toast.success(t.organization.saved);
    } catch (error) {
      form.setError("root", {
        message: error instanceof ApiError ? error.message : t.app.genericError,
      });
    }
  });

  return (
    <div className="space-y-4">
      <header>
        <h2 className="text-display font-semibold tracking-[-0.02em]">{t.organization.title}</h2>
        <p className="mt-0.5 text-label text-muted-foreground">{t.organization.subtitle}</p>
      </header>

      <Card className="max-w-2xl">
        <CardHeader title={t.organization.details} />
        <CardBody>
          {isLoading ? (
            <SkeletonRows rows={4} />
          ) : (
            <form onSubmit={onSubmit} className="space-y-4" noValidate>
              <Field label={t.organization.name} required error={form.formState.errors.name?.message}>
                {(props) => <Input {...props} {...form.register("name")} />}
              </Field>

              <Field
                label={t.organization.companyName}
                hint={t.organization.companyNameHint}
                error={form.formState.errors.companyName?.message}
              >
                {(props) => <Input {...props} {...form.register("companyName")} />}
              </Field>

              <Field
                label={t.organization.timezone}
                hint={t.organization.timezoneHint}
                error={form.formState.errors.timezone?.message}
              >
                {(props) => (
                  <NativeSelect {...props} {...form.register("timezone")}>
                    {TIMEZONES.map((zone) => (
                      <option key={zone} value={zone}>
                        {zone}
                      </option>
                    ))}
                  </NativeSelect>
                )}
              </Field>

              <Field
                label={t.organization.patronDays}
                hint={t.organization.patronDaysHint}
                error={form.formState.errors.holidayPatronDays?.message}
              >
                {(props) => <Input placeholder="06-24, 12-07" {...props} {...form.register("holidayPatronDays")} />}
              </Field>

              {form.formState.errors.root ? (
                <Alert tone="danger">{form.formState.errors.root.message}</Alert>
              ) : null}

              {/* Changing the calendar changes how days are classified from now
                  on. Days already saved keep the numbers they were saved with
                  until somebody replays them, which is a deliberate property of
                  the engine and not something to do silently behind a form. */}
              <Alert tone="info">{t.organization.recalcNotice}</Alert>

              <Button type="submit" loading={form.formState.isSubmitting}>
                {t.app.save}
              </Button>
            </form>
          )}
        </CardBody>
      </Card>
    </div>
  );
}
