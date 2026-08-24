import { useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { RefreshCw } from "lucide-react";
import { useMemo, useState } from "react";
import { z } from "zod";
import { monthOf, monthRange, todayIn, toYearMonth, type LocalDate } from "@core/date";
import { weekFrom, type WeekSchedule } from "@core/schedule";
import { ApiError } from "../../api/client";
import { requestsQuery } from "../../api/requests";
import {
  entriesQuery,
  scheduleQuery,
  useDeleteEntry,
  useRecalculateMonth,
  useSaveEntry,
} from "../../api/timesheet";
import { usersQuery } from "../../api/users";
import { DayDialog, type DayFormState } from "../../features/timesheet/day-dialog";
import { MonthGrid } from "../../features/timesheet/month-grid";
import { buildMonth, type DayCellModel } from "../../features/timesheet/view-model";
import { t } from "../../i18n/it";
import { Button, MonthPicker, NativeSelect, SkeletonRows, Stat, useToast } from "../../ui/primitives";

export const Route = createFileRoute("/_app/calendario")({
  validateSearch: z.object({
    month: z.string().optional(),
    userId: z.string().optional(),
  }),
  component: CalendarPage,
});

function CalendarPage() {
  const { user } = Route.useRouteContext();
  const search = Route.useSearch();
  const navigate = Route.useNavigate();
  const toast = useToast();
  const queryClient = useQueryClient();

  const today = todayIn(Intl.DateTimeFormat().resolvedOptions().timeZone) as LocalDate;
  const month = search.month ?? monthOf(today);
  const isAdmin = user.role === "ADMIN";
  const targetUserId = (isAdmin && search.userId) || user.id;

  const { from, to } = monthRange(toYearMonth(month));

  const entries = useQuery(entriesQuery(targetUserId, from, to));
  const requests = useQuery(requestsQuery({ userId: targetUserId }));
  const schedule = useQuery(scheduleQuery(isAdmin ? targetUserId : null));
  const people = useQuery({ ...usersQuery, enabled: isAdmin });

  const save = useSaveEntry();
  const remove = useDeleteEntry();
  const recalculate = useRecalculateMonth();

  const [selected, setSelected] = useState<DayCellModel | null>(null);

  // Whose hire date bounds the "missing day" markers: the person being viewed,
  // which for an admin is not necessarily themselves.
  const activeSince = useMemo(() => {
    const target = targetUserId === user.id
      ? user.createdAt
      : (people.data ?? []).find((p) => p.id === targetUserId)?.createdAt;
    return (target?.slice(0, 10) ?? null) as LocalDate | null;
  }, [targetUserId, user, people.data]);

  const week: WeekSchedule = useMemo(
    () => (schedule.data ? weekFrom(schedule.data.days) : {}),
    [schedule.data],
  );

  const model = useMemo(
    () =>
      buildMonth({
        month,
        entries: entries.data ?? [],
        requests: requests.data ?? [],
        week,
        role: user.role,
        flags: {
          canWorkSunday: schedule.data?.canWorkSunday ?? user.canWorkSunday,
          has104: user.has104,
          hasPaternity: user.hasPaternity,
        },
        today,
        activeSince,
      }),
    [month, entries.data, requests.data, week, user, schedule.data, today, activeSince],
  );

  const loading = entries.isLoading || schedule.isLoading;

  const handleSave = async (form: DayFormState) => {
    if (!selected) return;
    try {
      await save.mutateAsync({
        date: selected.date,
        kind: form.kind,
        morning: form.kind === "work" ? form.morning : null,
        afternoon: form.kind === "work" ? form.afternoon : null,
        morningOnLeave: form.kind === "work" && form.morningOnLeave,
        afternoonOnLeave: form.kind === "work" && form.afternoonOnLeave,
        use104: form.kind === "work" && form.use104,
        hours104Override: form.use104 ? form.hours104Override : null,
        notes: form.notes.trim() || null,
        medicalCertificate: form.medicalCertificate.trim() || null,
        ...(targetUserId === user.id ? {} : { userId: targetUserId }),
      });
      toast.success(t.timesheet.saved);
      setSelected(null);
    } catch (error) {
      toast.error(error instanceof ApiError ? error.message : t.app.genericError);
    }
  };

  const handleDelete = async () => {
    if (!selected?.entry) return;
    try {
      await remove.mutateAsync(selected.entry.id);
      toast.success(t.timesheet.deleted);
      setSelected(null);
    } catch (error) {
      toast.error(error instanceof ApiError ? error.message : t.app.genericError);
    }
  };

  const handleRecalculate = async () => {
    try {
      const result = await recalculate.mutateAsync({ userId: targetUserId, month });
      toast.success(t.timesheet.recalculated(result.changed, result.total));
      await queryClient.invalidateQueries({ queryKey: ["entries"] });
    } catch (error) {
      toast.error(error instanceof ApiError ? error.message : t.app.genericError);
    }
  };

  return (
    <div className="space-y-5">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold">{t.timesheet.title}</h2>
          <p className="text-[13px] text-muted-foreground">{t.timesheet.subtitle}</p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {isAdmin ? (
            <NativeSelect
              className="w-48"
              aria-label={t.timesheet.selectUser}
              value={targetUserId}
              onChange={(event) => navigate({ search: (prev) => ({ ...prev, userId: event.target.value }) })}
            >
              {(people.data ?? []).map((person) => (
                <option key={person.id} value={person.id}>
                  {person.name}
                </option>
              ))}
            </NativeSelect>
          ) : null}

          <MonthPicker
            value={month}
            monthNames={t.months}
            onChange={(next) => navigate({ search: (prev) => ({ ...prev, month: next }) })}
          />

          {isAdmin ? (
            <Button variant="outline" onClick={handleRecalculate} loading={recalculate.isPending}>
              <RefreshCw aria-hidden />
              {t.timesheet.recalculate}
            </Button>
          ) : null}
        </div>
      </header>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label={t.timesheet.regular} value={`${model.totals.regular}h`} loading={loading} tone="primary" />
        <Stat label={t.timesheet.overtime} value={`${model.totals.overtime}h`} loading={loading} tone="warning" />
        <Stat
          label={`${t.timesheet.leave} + ${t.timesheet.vacation}`}
          value={`${model.totals.leave + model.totals.leave104 + model.totals.vacation}h`}
          loading={loading}
          tone="info"
        />
        <Stat label={t.timesheet.sickness} value={`${model.totals.sickness}h`} loading={loading} />
      </div>

      {loading ? <SkeletonRows rows={6} /> : <MonthGrid weeks={model.weeks} onSelect={setSelected} />}

      {selected ? (
        <DayDialog
          key={selected.date}
          cell={selected}
          week={week}
          canUse104={user.has104 || isAdmin}
          canUsePaternity={user.hasPaternity || isAdmin}
          saving={save.isPending}
          deleting={remove.isPending}
          onClose={() => setSelected(null)}
          onSave={handleSave}
          onDelete={handleDelete}
        />
      ) : null}
    </div>
  );
}
