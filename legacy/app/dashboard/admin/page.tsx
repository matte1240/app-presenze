import { getAuthSession } from "@/lib/auth";
import prisma from "@/lib/prisma";
import AdminOverview from "@/components/dashboard/admin/overview";
import PendingRequests from "@/components/dashboard/admin/pending-requests";
import StatsCard from "@/components/dashboard/shared/stats-card";
import { PageContainer, PageHeader, Section } from "@/components/layout/page";
import { getBranding } from "@/lib/branding";
import { Briefcase, CalendarDays, Clock, Users } from "lucide-react";
import type { User } from "@/types/models";

type UserAggregate = User & {
  regularHours: number;
  overtimeHours: number;
  permessoHours: number;
  sicknessHours: number;
  vacationHours: number;
  lastEntry?: string | null;
};

type UserRow = User;

export default async function AdminDashboardPage() {
  // Auth + admin role enforced by proxy.ts
  await getAuthSession();

  // Filter by current month only (to match calendar view)
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth() + 1;
  const firstDay = new Date(`${year}-${month.toString().padStart(2, '0')}-01T00:00:00.000Z`);
  const lastDay = new Date(year, month, 0).getDate();
  const lastDayDate = new Date(`${year}-${month.toString().padStart(2, '0')}-${lastDay}T23:59:59.999Z`);

  // Run all queries in parallel for better performance
  const [users, totals, lastEntries] = await Promise.all([
    prisma.user.findMany({
      orderBy: { createdAt: "asc" },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        image: true,
        createdAt: true,
      },
    }) as Promise<UserRow[]>,
    prisma.timeEntry.groupBy({
      by: ["userId"],
      _sum: { hoursWorked: true, overtimeHours: true, permessoHours: true, sicknessHours: true, vacationHours: true },
      where: {
        workDate: {
          gte: firstDay,
          lte: lastDayDate,
        },
      },
    }),
    prisma.timeEntry.groupBy({
      by: ["userId"],
      _max: { workDate: true },
    }),
  ]);

  const regularHoursMap = new Map<string, number>();
  const overtimeHoursMap = new Map<string, number>();
  const permessoHoursMap = new Map<string, number>();
  const sicknessHoursMap = new Map<string, number>();
  const vacationHoursMap = new Map<string, number>();

  for (const row of totals) {
    // hoursWorked already contains only regular hours (max 8 per day)
    regularHoursMap.set(row.userId, row._sum.hoursWorked ?? 0);
    overtimeHoursMap.set(row.userId, row._sum.overtimeHours ?? 0);
    permessoHoursMap.set(row.userId, row._sum.permessoHours ?? 0);
    sicknessHoursMap.set(row.userId, row._sum.sicknessHours ?? 0);
    vacationHoursMap.set(row.userId, row._sum.vacationHours ?? 0);
  }

  const lastEntryMap = new Map<string, string | null>();
  for (const row of lastEntries) {
    lastEntryMap.set(row.userId, row._max.workDate ? row._max.workDate.toISOString() : null);
  }

  const rows: UserAggregate[] = users.map((user) => ({
    ...user,
    regularHours: regularHoursMap.get(user.id) ?? 0,
    overtimeHours: overtimeHoursMap.get(user.id) ?? 0,
    permessoHours: permessoHoursMap.get(user.id) ?? 0,
    sicknessHours: sicknessHoursMap.get(user.id) ?? 0,
    vacationHours: vacationHoursMap.get(user.id) ?? 0,
    lastEntry: lastEntryMap.get(user.id) ?? null,
  }));

  // Team-wide figures for the header strip: an admin opening the dashboard
  // should see the state of the month before scanning individual rows.
  const teamTotals = rows.reduce(
    (acc, row) => ({
      worked: acc.worked + row.regularHours + row.overtimeHours,
      overtime: acc.overtime + row.overtimeHours,
      leave: acc.leave + row.permessoHours + row.vacationHours,
    }),
    { worked: 0, overtime: 0, leave: 0 }
  );

  const periodLabel = new Intl.DateTimeFormat(getBranding().app.locale, {
    month: "long",
    year: "numeric",
  }).format(now);

  return (
    <PageContainer width="wide" className="space-y-6">
      <PageHeader
        title="Panoramica"
        description={`Attività del team · ${periodLabel}`}
      />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatsCard
          title="Ore lavorate"
          value={teamTotals.worked.toFixed(1)}
          tone="primary"
          icon={<Clock />}
          hint="Totale del team questo mese"
        />
        <StatsCard
          title="Straordinario"
          value={teamTotals.overtime.toFixed(1)}
          tone="warning"
          icon={<Briefcase />}
          hint="Oltre l'orario contrattuale"
        />
        <StatsCard
          title="Permessi e ferie"
          value={teamTotals.leave.toFixed(1)}
          tone="info"
          icon={<CalendarDays />}
          hint="Ore di assenza approvate"
        />
        <StatsCard
          title="Persone"
          value={rows.length}
          tone="neutral"
          icon={<Users />}
          hint="Account attivi"
        />
      </div>

      <PendingRequests />

      <Section>
        <AdminOverview users={rows} periodLabel={`Ore di ${periodLabel}`} />
      </Section>
    </PageContainer>
  );
}
