import { useQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { zodResolver } from "@hookform/resolvers/zod";
import { CalendarClock, KeyRound, Mail, Plus, Trash2 } from "lucide-react";
import { useState } from "react";
import { useForm, useWatch, type Control, type UseFormSetValue } from "react-hook-form";
import { createUserSchema } from "@core/contracts";
import type { z } from "zod";
import { ApiError } from "../../api/client";
import { scheduleQuery } from "../../api/timesheet";
import {
  usersQuery,
  useCreateUser,
  useDeleteUser,
  useRemindUser,
  useResetUserPassword,
  useSaveSchedule,
  useUpdateUser,
  type ManagedUser,
} from "../../api/users";
import { ScheduleEditor } from "../../features/users/schedule-editor";
import { t } from "../../i18n/it";
import {
  Avatar,
  Badge,
  Button,
  Checkbox,
  ConfirmDialog,
  Dialog,
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
  useToast,
} from "../../ui/primitives";

export const Route = createFileRoute("/_app/utenti")({ component: UsersPage });

function UsersPage() {
  const { user: currentUser } = Route.useRouteContext();
  const toast = useToast();
  const users = useQuery(usersQuery);

  const [createOpen, setCreateOpen] = useState(false);
  const [editing, setEditing] = useState<ManagedUser | null>(null);
  const [scheduleFor, setScheduleFor] = useState<ManagedUser | null>(null);
  const [toDelete, setToDelete] = useState<ManagedUser | null>(null);

  const remove = useDeleteUser();
  const reset = useResetUserPassword();
  const remind = useRemindUser();

  const guard = async (action: () => Promise<unknown>, success: string) => {
    try {
      await action();
      toast.success(success);
    } catch (error) {
      toast.error(error instanceof ApiError ? error.message : t.app.genericError);
    }
  };

  return (
    <div className="space-y-5">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold">{t.users.title}</h2>
          <p className="text-[13px] text-muted-foreground">{t.users.subtitle}</p>
        </div>
        <Button onClick={() => setCreateOpen(true)}>
          <Plus aria-hidden />
          {t.users.new}
        </Button>
      </header>

      {users.isLoading ? (
        <SkeletonRows rows={5} />
      ) : (
        <TableWrapper>
          <Table>
            <THead>
              <TR>
                <TH>{t.users.name}</TH>
                <TH>{t.users.role}</TH>
                <TH>Diritti</TH>
                <TH numeric>{t.timesheet.regular}</TH>
                <TH numeric>{t.timesheet.overtime}</TH>
                <TH className="text-right">Azioni</TH>
              </TR>
            </THead>
            <TBody>
              {(users.data ?? []).map((person) => (
                <TR key={person.id}>
                  <TD>
                    <button
                      type="button"
                      onClick={() => setEditing(person)}
                      className="flex items-center gap-2.5 text-left"
                    >
                      <Avatar name={person.name} />
                      <span className="min-w-0">
                        <span className="block truncate text-[13px] font-medium">{person.name}</span>
                        <span className="block truncate text-[12px] text-muted-foreground">{person.email}</span>
                      </span>
                    </button>
                  </TD>
                  <TD>
                    <Badge tone={person.role === "ADMIN" ? "primary" : "neutral"}>
                      {t.users.roles[person.role]}
                    </Badge>
                  </TD>
                  <TD>
                    <div className="flex flex-wrap gap-1">
                      {person.canWorkSunday ? <Badge>Domenica</Badge> : null}
                      {person.has104 ? <Badge tone="info">104</Badge> : null}
                      {person.hasPaternity ? <Badge tone="info">Paternità</Badge> : null}
                    </div>
                  </TD>
                  <TD numeric>{person.regularHours ?? 0}</TD>
                  <TD numeric>{person.overtimeHours ?? 0}</TD>
                  <TD className="text-right">
                    <div className="flex justify-end gap-0.5">
                      <Button
                        size="icon"
                        variant="ghost"
                        title={t.users.schedule}
                        onClick={() => setScheduleFor(person)}
                      >
                        <CalendarClock aria-hidden />
                      </Button>
                      <Button
                        size="icon"
                        variant="ghost"
                        title={t.users.resetByEmail}
                        onClick={() =>
                          guard(() => reset.mutateAsync({ id: person.id }), t.users.resetSent)
                        }
                      >
                        <KeyRound aria-hidden />
                      </Button>
                      <Button
                        size="icon"
                        variant="ghost"
                        title={t.users.remind}
                        onClick={async () => {
                          try {
                            const result = await remind.mutateAsync(person.id);
                            toast.success(result.sent ? t.users.reminded : t.users.nothingToRemind);
                          } catch (error) {
                            toast.error(error instanceof ApiError ? error.message : t.app.genericError);
                          }
                        }}
                      >
                        <Mail aria-hidden />
                      </Button>
                      <Button
                        size="icon"
                        variant="ghost"
                        className="text-destructive"
                        title={t.app.delete}
                        disabled={person.id === currentUser.id}
                        onClick={() => setToDelete(person)}
                      >
                        <Trash2 aria-hidden />
                      </Button>
                    </div>
                  </TD>
                </TR>
              ))}
            </TBody>
          </Table>
        </TableWrapper>
      )}

      <CreateUserDialog open={createOpen} onOpenChange={setCreateOpen} />
      {editing ? <EditUserDialog user={editing} onClose={() => setEditing(null)} /> : null}
      {scheduleFor ? <ScheduleDialog user={scheduleFor} onClose={() => setScheduleFor(null)} /> : null}

      <ConfirmDialog
        open={toDelete !== null}
        onOpenChange={(open) => !open && setToDelete(null)}
        title={t.app.delete}
        description={toDelete ? t.users.deleteConfirm(toDelete.name) : ""}
        confirmLabel={t.app.delete}
        destructive
        loading={remove.isPending}
        onConfirm={async () => {
          if (!toDelete) return;
          await guard(() => remove.mutateAsync(toDelete.id), t.users.removed);
          setToDelete(null);
        }}
      />
    </div>
  );
}

function CreateUserDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const toast = useToast();
  const create = useCreateUser();

  const form = useForm<
    z.input<typeof createUserSchema>,
    unknown,
    z.output<typeof createUserSchema>
  >({
    resolver: zodResolver(createUserSchema),
    defaultValues: {
      name: "",
      email: "",
      role: "EMPLOYEE",
      canWorkSunday: false,
      has104: false,
      hasPaternity: false,
    },
  });

  const onSubmit = form.handleSubmit(async (values) => {
    try {
      const result = await create.mutateAsync({
        ...values,
        password: values.password?.trim() ? values.password : undefined,
      });
      toast.success(result.invited ? t.users.invited : t.users.created);
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
      title={t.users.new}
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
        <Field label={t.users.name} required error={form.formState.errors.name?.message}>
          {(props) => <Input autoFocus {...props} {...form.register("name")} />}
        </Field>

        <Field label={t.auth.email} required error={form.formState.errors.email?.message}>
          {(props) => <Input type="email" {...props} {...form.register("email")} />}
        </Field>

        <Field label={t.users.role}>
          {(props) => (
            <NativeSelect {...props} {...form.register("role")}>
              <option value="EMPLOYEE">{t.users.roles.EMPLOYEE}</option>
              <option value="ADMIN">{t.users.roles.ADMIN}</option>
            </NativeSelect>
          )}
        </Field>

        <Field label={t.users.passwordOptional} error={form.formState.errors.password?.message}>
          {(props) => <Input type="password" autoComplete="new-password" {...props} {...form.register("password")} />}
        </Field>

        <FlagCheckboxes control={form.control} setValue={form.setValue} />

        {form.formState.errors.root ? (
          <p className="text-[13px] text-destructive">{form.formState.errors.root.message}</p>
        ) : null}
      </div>
    </Dialog>
  );
}

interface UserFlagFields {
  canWorkSunday?: boolean;
  has104?: boolean;
  hasPaternity?: boolean;
}

const FLAGS = [
  { name: "canWorkSunday", label: t.users.canWorkSunday, hint: t.users.canWorkSundayHint },
  { name: "has104", label: t.users.has104, hint: t.users.has104Hint },
  { name: "hasPaternity", label: t.users.hasPaternity, hint: t.users.hasPaternityHint },
] as const;

/**
 * The create and edit dialogs differ in every field but these three, so the
 * block is shared and typed on just the part both forms have in common.
 */
function FlagCheckboxes<T extends UserFlagFields>({
  control,
  setValue,
}: {
  control: Control<T>;
  setValue: UseFormSetValue<T>;
}) {
  const values = useWatch({ control });

  return (
    <div className="space-y-3 rounded-md border border-border p-3">
      {FLAGS.map((flag) => (
        <Checkbox
          key={flag.name}
          checked={Boolean((values as UserFlagFields)[flag.name])}
          onCheckedChange={(checked) =>
            setValue(flag.name as never, checked as never, { shouldDirty: true })
          }
          label={flag.label}
          hint={flag.hint}
        />
      ))}
    </div>
  );
}

function EditUserDialog({ user, onClose }: { user: ManagedUser; onClose: () => void }) {
  const toast = useToast();
  const update = useUpdateUser();

  const form = useForm({
    defaultValues: {
      name: user.name,
      email: user.email,
      role: user.role,
      canWorkSunday: user.canWorkSunday,
      has104: user.has104,
      hasPaternity: user.hasPaternity,
    },
  });

  const onSubmit = form.handleSubmit(async (values) => {
    try {
      await update.mutateAsync({ id: user.id, ...values });
      toast.success(t.users.updated);
      onClose();
    } catch (error) {
      form.setError("root", { message: error instanceof ApiError ? error.message : t.app.genericError });
    }
  });

  return (
    <Dialog
      open
      onOpenChange={(open) => !open && onClose()}
      title={t.app.edit}
      description={user.email}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            {t.app.cancel}
          </Button>
          <Button onClick={onSubmit} loading={form.formState.isSubmitting}>
            {t.app.save}
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <Field label={t.users.name} required>
          {(props) => <Input {...props} {...form.register("name")} />}
        </Field>

        <Field label={t.auth.email} required>
          {(props) => <Input type="email" {...props} {...form.register("email")} />}
        </Field>

        <Field label={t.users.role}>
          {(props) => (
            <NativeSelect {...props} {...form.register("role")}>
              <option value="EMPLOYEE">{t.users.roles.EMPLOYEE}</option>
              <option value="ADMIN">{t.users.roles.ADMIN}</option>
            </NativeSelect>
          )}
        </Field>

        <FlagCheckboxes control={form.control} setValue={form.setValue} />

        {form.formState.errors.root ? (
          <p className="text-[13px] text-destructive">{form.formState.errors.root.message}</p>
        ) : null}
      </div>
    </Dialog>
  );
}

function ScheduleDialog({ user, onClose }: { user: ManagedUser; onClose: () => void }) {
  const toast = useToast();
  const schedule = useQuery(scheduleQuery(user.id));
  const save = useSaveSchedule();

  if (!schedule.data) return null;

  return (
    <ScheduleEditor
      open
      userName={user.name}
      days={schedule.data.days}
      canWorkSunday={schedule.data.canWorkSunday}
      saving={save.isPending}
      onClose={onClose}
      onSave={async (days, canWorkSunday) => {
        try {
          await save.mutateAsync({ id: user.id, days, canWorkSunday });
          toast.success(t.users.scheduleSaved);
          onClose();
        } catch (error) {
          toast.error(error instanceof ApiError ? error.message : t.app.genericError);
        }
      }}
    />
  );
}
