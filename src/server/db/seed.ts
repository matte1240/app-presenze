/**
 * Development seed: two companies, each with an administrator, an employee and
 * a fortnight of plausible hours.
 *
 * Two rather than one on purpose. A single seeded company cannot show you that
 * the isolation works, and a developer who has never seen a second tenant in
 * their local database will eventually write a query that assumes there is
 * only one. Production never runs this.
 */
import { randomUUID } from "node:crypto";
import { addDays, todayIn, type LocalDate } from "@core/date";
import { isHoliday } from "@core/holidays";
import { isWorkingDate } from "@core/schedule";
import { span } from "@core/time";
import { computeDay, type DayInput } from "@core/timesheet";
import { hashPassword } from "../auth/password";
import { holidayConfigOf } from "../env";
import { createOrganization } from "../services/organizations";
import { createDefaultSchedules, weekScheduleOf } from "../services/schedules";
import { hourColumns } from "../services/timesheet";
import { closeDatabase, db, platformDb } from "./client";
import { currentOrg } from "./context";
import { migrateDatabase } from "./migrate";
import { organizations } from "./platform-schema";
import { timeEntries, users } from "./schema";
import { runInTenant } from "./tenant";

interface Company {
  organization: string;
  plan: "STARTER" | "PRO" | "BUSINESS";
  admin: { name: string; email: string; password: string };
  employee: { name: string; email: string; password: string };
}

const COMPANIES: Company[] = [
  {
    organization: "Acme SRL",
    plan: "STARTER",
    admin: { name: "Admin", email: "admin@example.com", password: "Admin123!" },
    employee: { name: "Luca Bianchi", email: "luca@example.com", password: "Luca1234!" },
  },
  {
    organization: "Beta SPA",
    plan: "PRO",
    admin: { name: "Direzione", email: "admin@beta.example.com", password: "Beta1234!" },
    employee: { name: "Giulia Verdi", email: "giulia@beta.example.com", password: "Giulia12!" },
  },
];

/** A fortnight of worked days, so the calendar and the report have something to show. */
async function fillTimesheet(userId: string): Promise<number> {
  const holidays = holidayConfigOf(currentOrg().holidayPatronDays);
  const week = await weekScheduleOf(userId);
  const today = todayIn(currentOrg().timezone);

  let filled = 0;
  for (let back = 1; back <= 14; back++) {
    const date = addDays(today, -back) as LocalDate;
    // Weekends would be booked entirely as overtime, which is correct but
    // makes for a nonsense demo employee.
    if (isHoliday(date, holidays) || !isWorkingDate(week, date)) continue;

    const input: DayInput = {
      date,
      kind: "work",
      morning: span("08:00", "12:00"),
      // A short Friday, so the seeded month shows some leave and some overtime.
      afternoon: back % 5 === 0 ? span("14:00", "17:00") : span("14:00", "18:00"),
      morningOnLeave: false,
      afternoonOnLeave: false,
      use104: false,
      hours104Override: null,
      approvedLeave: null,
    };

    const breakdown = computeDay(input, week, { holidays });
    if (breakdown.worked === 0 && breakdown.leave === 0) continue;

    await db.insert(timeEntries).values({
      id: randomUUID(),
      organizationId: currentOrg().id,
      userId,
      workDate: date,
      kind: "work",
      morningStart: input.morning?.start ?? null,
      morningEnd: input.morning?.end ?? null,
      afternoonStart: input.afternoon?.start ?? null,
      afternoonEnd: input.afternoon?.end ?? null,
      createdBy: userId,
      ...hourColumns(breakdown),
    });
    filled += 1;
  }
  return filled;
}

async function seed() {
  // Standalone entry point: the schema may not exist yet.
  await migrateDatabase("src/server/db/migrations");

  const existing = await platformDb.select().from(organizations).limit(1);
  if (existing.length > 0) {
    console.info("Il database contiene già delle organizzazioni: seed saltato.");
    return;
  }

  let days = 0;
  for (const company of COMPANIES) {
    const { organization } = await createOrganization({
      organizationName: company.organization,
      adminName: company.admin.name,
      adminEmail: company.admin.email,
      adminPassword: company.admin.password,
      plan: company.plan,
    });

    console.info(`\n  ${organization.name} (${organization.slug}, piano ${organization.plan})`);
    console.info(`    ADMIN    ${company.admin.email} / ${company.admin.password}`);
    console.info(`    EMPLOYEE ${company.employee.email} / ${company.employee.password}`);

    await runInTenant(organization, async () => {
      const employeeId = randomUUID();
      await db.insert(users).values({
        id: employeeId,
        organizationId: organization.id,
        name: company.employee.name,
        email: company.employee.email,
        passwordHash: await hashPassword(company.employee.password),
        role: "EMPLOYEE",
      });
      await createDefaultSchedules(employeeId);
      days += await fillTimesheet(employeeId);
    });
  }

  console.info(`\nSeed completato: ${COMPANIES.length} organizzazioni, ${days} giornate.`);
}

try {
  await seed();
} finally {
  // A connection pool, unlike an open file, keeps the process alive.
  await closeDatabase();
}
