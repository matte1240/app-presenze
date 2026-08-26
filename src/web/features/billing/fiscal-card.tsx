import { useQuery } from "@tanstack/react-query";
import { zodResolver } from "@hookform/resolvers/zod";
import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { billingProfileSchema } from "@core/contracts";
import { ApiError } from "../../api/client";
import { billingProfileQuery, useSaveBillingProfile, type BillingProfile } from "../../api/billing";
import { t } from "../../i18n/it";
import { Alert, Button, Card, CardBody, CardHeader, Field, Input, SkeletonRows, useToast } from "../../ui/primitives";

const EMPTY: BillingProfile = {
  legalName: "",
  addressLine: "",
  postalCode: "",
  city: "",
  province: "",
  country: "IT",
  vatNumber: "",
  taxCode: "",
  sdiCode: "",
  pec: "",
  billingEmail: "",
};

/**
 * Who to invoice, and where the invoice goes.
 *
 * The last two fields are the ones nobody thinks about until an invoice fails
 * to arrive: in Italy an electronic invoice is delivered to a recipient code or
 * a certified address, and without either it is issued into nothing. The schema
 * refuses to save an Italian profile that has neither.
 */
export function FiscalCard() {
  const toast = useToast();
  const { data, isLoading } = useQuery(billingProfileQuery);
  const save = useSaveBillingProfile();

  const form = useForm<BillingProfile>({
    resolver: zodResolver(billingProfileSchema),
    defaultValues: EMPTY,
  });

  const { reset } = form;
  useEffect(() => {
    if (data) {
      // Nulls become empty strings: an input bound to null is an
      // uncontrolled-component warning waiting to happen.
      reset({
        ...EMPTY,
        ...Object.fromEntries(Object.entries(data).map(([k, v]) => [k, v ?? ""])),
      } as BillingProfile);
    }
  }, [data, reset]);

  const onSubmit = form.handleSubmit(async (values) => {
    try {
      const result = await save.mutateAsync(values);
      toast.success(result.synced ? t.billing.profileSavedSynced : t.billing.profileSaved);
    } catch (error) {
      form.setError("root", {
        message: error instanceof ApiError ? error.message : t.app.genericError,
      });
    }
  });

  if (isLoading) {
    return (
      <Card>
        <CardHeader title={t.billing.fiscal} />
        <CardBody>
          <SkeletonRows rows={4} />
        </CardBody>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader title={t.billing.fiscal} />
      <CardBody>
        <form onSubmit={onSubmit} className="space-y-4" noValidate>
          <Field label={t.billing.legalName} required error={form.formState.errors.legalName?.message}>
            {(props) => <Input {...props} {...form.register("legalName")} />}
          </Field>

          <Field label={t.billing.address} required error={form.formState.errors.addressLine?.message}>
            {(props) => <Input {...props} {...form.register("addressLine")} />}
          </Field>

          <div className="grid gap-4 sm:grid-cols-3">
            <Field label={t.billing.postalCode} required error={form.formState.errors.postalCode?.message}>
              {(props) => <Input {...props} {...form.register("postalCode")} />}
            </Field>
            <Field label={t.billing.city} required error={form.formState.errors.city?.message}>
              {(props) => <Input {...props} {...form.register("city")} />}
            </Field>
            <Field label={t.billing.province} error={form.formState.errors.province?.message}>
              {(props) => <Input maxLength={4} {...props} {...form.register("province")} />}
            </Field>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <Field label={t.billing.vatNumber} error={form.formState.errors.vatNumber?.message}>
              {(props) => <Input inputMode="numeric" {...props} {...form.register("vatNumber")} />}
            </Field>
            <Field label={t.billing.taxCode} error={form.formState.errors.taxCode?.message}>
              {(props) => <Input {...props} {...form.register("taxCode")} />}
            </Field>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <Field
              label={t.billing.sdiCode}
              hint={t.billing.sdiHint}
              error={form.formState.errors.sdiCode?.message}
            >
              {(props) => <Input maxLength={7} {...props} {...form.register("sdiCode")} />}
            </Field>
            <Field label={t.billing.pec} error={form.formState.errors.pec?.message}>
              {(props) => <Input type="email" {...props} {...form.register("pec")} />}
            </Field>
          </div>

          <Field
            label={t.billing.billingEmail}
            hint={t.billing.billingEmailHint}
            error={form.formState.errors.billingEmail?.message}
          >
            {(props) => <Input type="email" {...props} {...form.register("billingEmail")} />}
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
