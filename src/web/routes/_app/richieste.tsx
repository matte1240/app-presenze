import { useQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { ClipboardList, Plus } from "lucide-react";
import { useState } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm, useWatch } from "react-hook-form";
import { formatDateIt, type LocalDate } from "@core/date";
import { leaveRequestSchema, type LeaveStatus } from "@core/contracts";
import type { z } from "zod";
import { ApiError } from "../../api/client";
import {
  requestsQuery,
  useCreateRequest,
  useDeleteRequest,
  useReviewRequest,
  type LeaveRequest,
} from "../../api/requests";
import { t } from "../../i18n/it";
import {
  Badge,
  Button,
  ConfirmDialog,
  Dialog,
  EmptyState,
  Field,
  Input,
  NativeSelect,
  SkeletonRows,
  Table,
  TableWrapper,
  TBody,
  TD,
  TH,
  THead,
  TR,
  Textarea,
  useToast,
  type Tone,
} from "../../ui/primitives";

export const Route = createFileRoute("/_app/richieste")({ component: RequestsPage });

const STATUS_TONE: Record<LeaveStatus, Tone> = {
  PENDING: "warning",
  APPROVED: "success",
  REJECTED: "danger",
};

function RequestsPage() {
  const { user } = Route.useRouteContext();
  const isAdmin = user.role === "ADMIN";
  const toast = useToast();

  const requests = useQuery(requestsQuery());
  const review = useReviewRequest();
  const remove = useDeleteRequest();

  const [createOpen, setCreateOpen] = useState(false);
  const [toDelete, setToDelete] = useState<LeaveRequest | null>(null);

  const handleReview = async (request: LeaveRequest, status: "APPROVED" | "REJECTED") => {
    try {
      const result = await review.mutateAsync({ id: request.id, status });
      if (status === "APPROVED" && result.created > 0) toast.success(t.requests.materialized(result.created));
      else toast.success(t.requests.reviewed);
      if (result.conflicts.length > 0) toast.info(t.requests.conflicts(result.conflicts.length));
    } catch (error) {
      toast.error(error instanceof ApiError ? error.message : t.app.genericError);
    }
  };

  const handleDelete = async () => {
    if (!toDelete) return;
    try {
      await remove.mutateAsync(toDelete.id);
      toast.success(t.requests.removed);
      setToDelete(null);
    } catch (error) {
      toast.error(error instanceof ApiError ? error.message : t.app.genericError);
    }
  };

  return (
    <div className="space-y-5">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold">{t.requests.title}</h2>
          <p className="text-[13px] text-muted-foreground">
            {isAdmin ? t.requests.subtitleAdmin : t.requests.subtitleEmployee}
          </p>
        </div>
        <Button onClick={() => setCreateOpen(true)}>
          <Plus aria-hidden />
          {t.requests.new}
        </Button>
      </header>

      {requests.isLoading ? (
        <SkeletonRows rows={5} />
      ) : (requests.data ?? []).length === 0 ? (
        <EmptyState icon={ClipboardList} title={t.requests.empty} description={t.requests.emptyHint} />
      ) : (
        <TableWrapper>
          <Table>
            <THead>
              <TR>
                {isAdmin ? <TH>{t.requests.employee}</TH> : null}
                <TH>{t.requests.type}</TH>
                <TH>{t.requests.period}</TH>
                <TH>{t.requests.reason}</TH>
                <TH>Stato</TH>
                <TH className="text-right">Azioni</TH>
              </TR>
            </THead>
            <TBody>
              {(requests.data ?? []).map((request) => (
                <TR key={request.id}>
                  {isAdmin ? <TD className="font-medium">{request.user.name}</TD> : null}
                  <TD>{t.requests.types[request.type]}</TD>
                  <TD className="whitespace-nowrap">
                    {formatDateIt(request.startDate as LocalDate)}
                    {request.startDate === request.endDate ? "" : ` – ${formatDateIt(request.endDate as LocalDate)}`}
                    {request.startTime ? (
                      <span className="ml-1 text-muted-foreground">
                        {request.startTime}–{request.endTime}
                      </span>
                    ) : null}
                  </TD>
                  <TD className="max-w-52 truncate text-muted-foreground">{request.reason ?? "—"}</TD>
                  <TD>
                    <Badge tone={STATUS_TONE[request.status]} dot>
                      {t.requests.statuses[request.status]}
                    </Badge>
                  </TD>
                  <TD className="text-right">
                    {isAdmin ? (
                      <div className="flex justify-end gap-1">
                        {request.status !== "APPROVED" ? (
                          <Button size="sm" variant="outline" onClick={() => handleReview(request, "APPROVED")}>
                            {t.requests.approve}
                          </Button>
                        ) : null}
                        {request.status !== "REJECTED" ? (
                          <Button size="sm" variant="ghost" onClick={() => handleReview(request, "REJECTED")}>
                            {t.requests.reject}
                          </Button>
                        ) : null}
                        <Button
                          size="sm"
                          variant="ghost"
                          className="text-destructive"
                          onClick={() => setToDelete(request)}
                        >
                          {t.app.delete}
                        </Button>
                      </div>
                    ) : null}
                  </TD>
                </TR>
              ))}
            </TBody>
          </Table>
        </TableWrapper>
      )}

      <CreateRequestDialog open={createOpen} onOpenChange={setCreateOpen} />

      <ConfirmDialog
        open={toDelete !== null}
        onOpenChange={(open) => !open && setToDelete(null)}
        title={t.app.delete}
        description={t.requests.deleteConfirm}
        confirmLabel={t.app.delete}
        destructive
        loading={remove.isPending}
        onConfirm={handleDelete}
      />
    </div>
  );
}

function CreateRequestDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const toast = useToast();
  const create = useCreateRequest();

  // Three generics because the schema's `.default()` calls make several fields
  // optional going in and guaranteed coming out; the form edits the input
  // shape and the submit handler receives the parsed one.
  const form = useForm<
    z.input<typeof leaveRequestSchema>,
    unknown,
    z.output<typeof leaveRequestSchema>
  >({
    resolver: zodResolver(leaveRequestSchema),
    defaultValues: {
      type: "VACATION",
      startDate: "",
      endDate: "",
      startTime: null,
      endTime: null,
      reason: null,
    },
  });

  // `useWatch` rather than `form.watch`: the latter returns a fresh function
  // on every render, which defeats memoisation downstream.
  const type = useWatch({ control: form.control, name: "type" });
  const startDate = useWatch({ control: form.control, name: "startDate" });
  const hourly = type === "PERMESSO";

  const onSubmit = form.handleSubmit(async (values) => {
    try {
      await create.mutateAsync({
        ...values,
        endDate: hourly ? values.startDate : values.endDate,
        startTime: hourly ? values.startTime : null,
        endTime: hourly ? values.endTime : null,
        reason: values.reason?.trim() || null,
      });
      toast.success(t.requests.created);
      form.reset();
      onOpenChange(false);
    } catch (error) {
      form.setError("root", { message: error instanceof ApiError ? error.message : t.app.genericError });
    }
  });

  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      title={t.requests.new}
      footer={
        <>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            {t.app.cancel}
          </Button>
          <Button onClick={onSubmit} loading={form.formState.isSubmitting}>
            {t.app.save}
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <Field label={t.requests.type}>
          {(props) => (
            <NativeSelect {...props} {...form.register("type")}>
              {(["VACATION", "SICKNESS", "PERMESSO"] as const).map((value) => (
                <option key={value} value={value}>
                  {t.requests.types[value]}
                </option>
              ))}
            </NativeSelect>
          )}
        </Field>

        <div className="grid grid-cols-2 gap-3">
          <Field label={t.requests.startDate} required error={form.formState.errors.startDate?.message}>
            {(props) => <Input type="date" {...props} {...form.register("startDate")} />}
          </Field>

          {hourly ? (
            <Field label={t.requests.endDate} hint={t.requests.permessoHint}>
              {(props) => <Input type="date" disabled value={startDate} {...props} />}
            </Field>
          ) : (
            <Field label={t.requests.endDate} required error={form.formState.errors.endDate?.message}>
              {(props) => <Input type="date" {...props} {...form.register("endDate")} />}
            </Field>
          )}
        </div>

        {hourly ? (
          <div className="grid grid-cols-2 gap-3">
            <Field label={t.requests.startTime} required error={form.formState.errors.startTime?.message}>
              {(props) => <Input type="time" step={1800} {...props} {...form.register("startTime")} />}
            </Field>
            <Field label={t.requests.endTime} required error={form.formState.errors.endTime?.message}>
              {(props) => <Input type="time" step={1800} {...props} {...form.register("endTime")} />}
            </Field>
          </div>
        ) : null}

        <Field label={t.requests.reason} hint={t.requests.reasonHint}>
          {(props) => <Textarea {...props} {...form.register("reason")} />}
        </Field>

        {form.formState.errors.root ? (
          <p className="text-[13px] text-destructive">{form.formState.errors.root.message}</p>
        ) : null}
      </div>
    </Dialog>
  );
}
