import { useQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { Download } from "lucide-react";
import { useMemo, useState } from "react";
import { monthOf, monthRange, todayIn, toYearMonth, type LocalDate } from "@core/date";
import { roundHours } from "@core/time";
import { ApiError } from "../../api/client";
import { exportExcel } from "../../api/admin";
import { entriesQuery } from "../../api/timesheet";
import { usersQuery } from "../../api/users";
import { t } from "../../i18n/it";
import {
  Button,
  Card,
  CardHeader,
  Checkbox,
  MonthPicker,
  SkeletonRows,
  SummaryBar,
  Table,
  TableWrapper,
  TBody,
  TD,
  TH,
  THead,
  TR,
  useToast,
} from "../../ui/primitives";

export const Route = createFileRoute("/_app/report")({ component: ReportsPage });

function ReportsPage() {
  const { user } = Route.useRouteContext();
  const isAdmin = user.role === "ADMIN";
  const toast = useToast();

  const today = todayIn(Intl.DateTimeFormat().resolvedOptions().timeZone) as LocalDate;
  const [month, setMonth] = useState<string>(monthOf(today));
  const [selected, setSelected] = useState<string[]>(isAdmin ? [] : [user.id]);
  const [exporting, setExporting] = useState(false);

  const { from, to } = monthRange(toYearMonth(month));
  const people = useQuery({ ...usersQuery, enabled: isAdmin });

  // One request for the whole team; the server groups nothing, but neither does
  // it need to — a month of entries is small.
  const entries = useQuery(entriesQuery(isAdmin ? "all" : user.id, from, to));

  const rows = useMemo(() => {
    const list = isAdmin ? (people.data ?? []) : [{ id: user.id, name: user.name }];
    const byUser = new Map<string, { regular: number; overtime: number; leave: number; vacation: number; sickness: number }>();

    for (const entry of entries.data ?? []) {
      const acc = byUser.get(entry.userId) ?? { regular: 0, overtime: 0, leave: 0, vacation: 0, sickness: 0 };
      acc.regular += entry.regularHours;
      acc.overtime += entry.overtimeHours;
      acc.leave += entry.leaveHours + entry.leave104Hours;
      acc.vacation += entry.vacationHours;
      acc.sickness += entry.sicknessHours;
      byUser.set(entry.userId, acc);
    }

    return list.map((person) => {
      const acc = byUser.get(person.id) ?? { regular: 0, overtime: 0, leave: 0, vacation: 0, sickness: 0 };
      return {
        id: person.id,
        name: person.name,
        regular: roundHours(acc.regular),
        overtime: roundHours(acc.overtime),
        leave: roundHours(acc.leave),
        vacation: roundHours(acc.vacation),
        sickness: roundHours(acc.sickness),
      };
    });
  }, [entries.data, people.data, isAdmin, user]);

  const teamTotals = useMemo(
    () => ({
      regular: roundHours(rows.reduce((s, r) => s + r.regular, 0)),
      overtime: roundHours(rows.reduce((s, r) => s + r.overtime, 0)),
      leave: roundHours(rows.reduce((s, r) => s + r.leave + r.vacation, 0)),
    }),
    [rows],
  );

  const handleExport = async () => {
    const ids = isAdmin ? selected : [user.id];
    if (ids.length === 0) return toast.error(t.reports.noSelection);
    setExporting(true);
    try {
      await exportExcel(ids, month);
      toast.success(t.reports.exported);
    } catch (error) {
      toast.error(error instanceof ApiError ? error.message : t.app.genericError);
    } finally {
      setExporting(false);
    }
  };

  const allSelected = isAdmin && selected.length === (people.data ?? []).length && selected.length > 0;

  return (
    <div className="space-y-4">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-display font-semibold tracking-[-0.02em]">{t.reports.title}</h2>
          <p className="mt-0.5 text-label text-muted-foreground">{t.reports.subtitle}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <MonthPicker value={month} monthNames={t.months} onChange={setMonth} />
          <Button onClick={handleExport} loading={exporting}>
            <Download aria-hidden />
            {t.reports.exportExcel}
          </Button>
        </div>
      </header>

      <SummaryBar
        loading={entries.isLoading}
        metrics={[
          { key: "regular", label: t.timesheet.regular, value: `${teamTotals.regular}h`, lead: true },
          { key: "overtime", label: t.timesheet.overtime, value: `${teamTotals.overtime}h`, tone: "warning" },
          {
            key: "leave",
            label: `${t.timesheet.leave} + ${t.timesheet.vacation}`,
            value: `${teamTotals.leave}h`,
          },
        ]}
      />

      <Card>
        <CardHeader
          title={t.reports.team}
          actions={
            isAdmin ? (
              <Checkbox
                checked={allSelected}
                onCheckedChange={(checked) => setSelected(checked ? (people.data ?? []).map((p) => p.id) : [])}
                label={t.reports.selectAll}
              />
            ) : null
          }
        />

        {entries.isLoading ? (
          <div className="p-5">
            <SkeletonRows rows={4} />
          </div>
        ) : (
          <TableWrapper className="rounded-none border-0">
            <Table>
              <THead>
                <TR>
                  {isAdmin ? <TH className="w-10" /> : null}
                  <TH>{t.requests.employee}</TH>
                  <TH numeric>{t.timesheet.regular}</TH>
                  <TH numeric>{t.timesheet.overtime}</TH>
                  <TH numeric>{t.timesheet.leave}</TH>
                  <TH numeric>{t.timesheet.vacation}</TH>
                  <TH numeric>{t.timesheet.sickness}</TH>
                </TR>
              </THead>
              <TBody>
                {rows.map((row) => (
                  <TR key={row.id}>
                    {isAdmin ? (
                      <TD>
                        <Checkbox
                          checked={selected.includes(row.id)}
                          onCheckedChange={(checked) =>
                            setSelected((current) =>
                              checked ? [...current, row.id] : current.filter((id) => id !== row.id),
                            )
                          }
                          label=""
                        />
                      </TD>
                    ) : null}
                    <TD className="font-medium">{row.name}</TD>
                    <TD numeric>{row.regular}</TD>
                    <TD numeric>{row.overtime}</TD>
                    <TD numeric>{row.leave}</TD>
                    <TD numeric>{row.vacation}</TD>
                    <TD numeric>{row.sickness}</TD>
                  </TR>
                ))}
              </TBody>
            </Table>
          </TableWrapper>
        )}
      </Card>
    </div>
  );
}
