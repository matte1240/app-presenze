import type { Prisma } from "@/lib/generated/prisma/client";

type Decimal = Prisma.Decimal;
import { endOfMonth, startOfMonth } from "date-fns";
import prisma from "@/lib/prisma";
import { getAuthSession } from "@/lib/auth";
import TimesheetCalendar from "@/components/dashboard/shared/timesheet-calendar";
import UserSelector from "@/components/dashboard/shared/user-selector";
import { serializeTimeEntry } from "@/lib/utils/serialization";

type PrismaEntry = {
  id: string;
  userId: string;
  workDate: Date;
  hoursWorked: Decimal;
  overtimeHours: Decimal;
  permessoHours: Decimal;
  vacationHours: Decimal;
  sicknessHours: Decimal;
  permesso104Hours: Decimal;
  paternityHours: Decimal;
  morningStart: string | null;
  morningEnd: string | null;
  afternoonStart: string | null;
  afternoonEnd: string | null;
  notes: string | null;
  medicalCertificate: string | null;
  createdAt: Date;
  updatedAt: Date;
};

type UserRow = {
  id: string;
  name: string | null;
  email: string;
  hasPermesso104: boolean;
  hasPaternityLeave: boolean;
};

export default async function CalendarPage({
  searchParams,
}: {
  searchParams: Promise<{ userId?: string }>;
}) {
  // Auth enforced by proxy.ts — session is guaranteed non-null here
  const session = (await getAuthSession())!;

  const now = new Date();
  const params = await searchParams;
  const isAdmin = session.user.role === "ADMIN";

  // Common query selection
  const querySelect = {
    id: true,
    userId: true,
    workDate: true,
    hoursWorked: true,
    overtimeHours: true,
    permessoHours: true,
    permesso104Hours: true,
    paternityHours: true,
    vacationHours: true,
    sicknessHours: true,
    morningStart: true,
    morningEnd: true,
    afternoonStart: true,
    afternoonEnd: true,
    notes: true,
    medicalCertificate: true,
    createdAt: true,
    updatedAt: true,
  };

  let users: UserRow[] = [];
  let targetUserId = session.user.id;
  let targetUserName = session.user.name ?? session.user.email;
  let targetUserFeatures = {
    hasPermesso104: session.user.hasPermesso104,
    hasPaternityLeave: session.user.hasPaternityLeave,
  };

  if (isAdmin) {
    // Get all users for the dropdown
    users = (await prisma.user.findMany({
      orderBy: { name: "asc" },
      select: {
        id: true,
        name: true,
        email: true,
        hasPermesso104: true,
        hasPaternityLeave: true,
      },
    })) as UserRow[];

    // Determine which user's calendar to show
    if (params.userId) {
      targetUserId = params.userId;
      const targetUser = users.find((u) => u.id === targetUserId);
      if (targetUser) {
        targetUserName = targetUser.name ?? targetUser.email;
        targetUserFeatures = {
          hasPermesso104: targetUser.hasPermesso104,
          hasPaternityLeave: targetUser.hasPaternityLeave,
        };
      }
    } else {
      const me = users.find((u) => u.id === session.user.id);
      if (me) {
        targetUserFeatures = {
          hasPermesso104: me.hasPermesso104,
          hasPaternityLeave: me.hasPaternityLeave,
        };
      }
    }
  }

  // Fetch entries for the target user
  const entries = (await prisma.timeEntry.findMany({
    where: {
      userId: targetUserId,
      workDate: {
        gte: startOfMonth(now),
        lte: endOfMonth(now),
      },
    },
    select: querySelect,
    orderBy: { workDate: "asc" },
  })) as PrismaEntry[];

  const plain = entries.map(serializeTimeEntry);

  return (
    <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-6">
      {isAdmin && (
        <UserSelector users={users} selectedUserId={targetUserId} />
      )}
      
      <TimesheetCalendar
        initialEntries={plain}
        userName={targetUserName}
        hideHeader={true}
        targetUserId={isAdmin ? targetUserId : undefined}
        userFeatures={targetUserFeatures}
        isAdmin={isAdmin}
      />
    </div>
  );
}
