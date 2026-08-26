/**
 * Development seed: an administrator, an employee, and a fortnight of plausible
 * hours. Production never runs this — the first visit walks an administrator
 * through creating their own account.
 */
import { randomUUID } from "node:crypto";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import { addDays, todayIn, type LocalDate } from "@core/date";
import { isHoliday } from "@core/holidays";
import { isWorkingDate } from "@core/schedule";
import { span } from "@core/time";
import { computeDay, type DayInput } from "@core/timesheet";
import { hashPassword } from "../auth/password";
import { env, holidayConfig } from "../env";
import { createDefaultSchedules, weekScheduleOf } from "../services/schedules";
import { hourColumns } from "../services/timesheet";
import { closeDatabase, db } from "./client";
import { timeEntries, users } from "./schema";

const PEOPLE = [
  { name: "Admin", email: "admin@example.com", password: "Admin123!", role: "ADMIN" as const },
  { name: "Luca Bianchi", email: "luca@example.com", password: "Luca1234!", role: "EMPLOYEE" as const },
];

async function seed() {
  // Standalone entry point: the schema may not exist yet.
  await migrate(db, { migrationsFolder: "src/server/db/migrations" });

  const existing = await db.select().from(users).limit(1);
  if (existing.length > 0) {
    console.info("Il database contiene già degli utenti: seed saltato.");
    return;
  }

  const created: Array<{ id: string; role: string }> = [];
  for (const person of PEOPLE) {
    const id = randomUUID();
    await db.insert(users).values({
      id,
      name: person.name,
      email: person.email,
      passwordHash: await hashPassword(person.password),
      role: person.role,
    });
    await createDefaultSchedules(id);
    created.push({ id, role: person.role });
    console.info(`  ${person.role.padEnd(8)} ${person.email} / ${person.password}`);
  }

  const employee = created.find((c) => c.role === "EMPLOYEE")!;
  const week = await weekScheduleOf(employee.id);
  const today = todayIn(env.TZ);

  let filled = 0;
  for (let back = 1; back <= 14; back++) {
    const date = addDays(today, -back) as LocalDate;
    // Weekends would be booked entirely as overtime, which is correct but
    // makes for a nonsense demo employee.
    if (isHoliday(date, holidayConfig) || !isWorkingDate(week, date)) continue;

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

    const breakdown = computeDay(input, week, { holidays: holidayConfig });
    if (breakdown.worked === 0 && breakdown.leave === 0) continue;

    await db.insert(timeEntries).values({
      id: randomUUID(),
      userId: employee.id,
      workDate: date,
      kind: "work",
      morningStart: input.morning?.start ?? null,
      morningEnd: input.morning?.end ?? null,
      afternoonStart: input.afternoon?.start ?? null,
      afternoonEnd: input.afternoon?.end ?? null,
      createdBy: employee.id,
      ...hourColumns(breakdown),
    });
    filled += 1;
  }

  console.info(`Seed completato: ${created.length} utenti, ${filled} giornate.`);
}

try {
  await seed();
} finally {
  // A connection pool, unlike an open file, keeps the process alive.
  await closeDatabase();
}
