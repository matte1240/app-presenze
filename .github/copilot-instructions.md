# Copilot Instructions for Presenze

## 📋 Project Overview

**Mission**: A comprehensive time tracking application for managing employee work hours, leave requests, and generating reports. Built for Italian companies with support for Italian holidays, labor regulations (Permesso 104, paternity leave), and customizable working schedules.

**Target Users**:
- **Employees**: Log daily work hours, submit leave requests, view personal reports
- **Administrators**: Manage users, approve requests, view company-wide analytics, configure system settings

---

## 🏗️ Architecture & Tech Stack

### Core Framework
- **Next.js 16** (App Router, React Server Components)
- **React 19** (Server & Client Components)
- **TypeScript** (Strict mode enabled)
- **Tailwind CSS v4** (Utility-first styling)

### Backend & Data
- **Prisma ORM v7** (Type-safe database access, Rust-free client with `@prisma/adapter-pg`)
- **SQLite** (embedded database, via Prisma + better-sqlite3)
- **NextAuth v4** (Credentials provider, JWT sessions, Prisma adapter)

### Prisma v7 Architecture
- **Generator**: `prisma-client` (not the legacy `prisma-client-js`)
- **Generated client**: `lib/generated/prisma/` (not in `node_modules`)
- **Driver adapter**: `@prisma/adapter-pg` (required in v7 — no built-in engine)
- **CLI config**: `prisma.config.ts` at project root (datasource URL, schema path, seed command)
- **ESM**: `"type": "module"` in `package.json`
- **Env loading**: `dotenv` must be imported explicitly (`import "dotenv/config"`)

### Key Integrations
- **`date-holidays`** - Italian public holiday calculation
- **`exceljs`** - Excel report generation
- **`nodemailer`** - Email notifications (welcome, password reset, leave approvals)
- **`node-cron`** - Automated database backups
- **`googleapis`** - Google Calendar sync for approved leave requests
- **`@ducanh2912/next-pwa`** - Progressive Web App support

### Development Tools
- **Docker & Docker Compose** - Containerized development and deployment
- **ESLint** - Code linting
- **Semantic Release** - Automated versioning
- **GitHub Actions** - CI/CD pipeline

---

## 🗄️ Data Models

### User
```prisma
model User {
  id                  String            @id @default(cuid())
  name                String
  email               String            @unique
  passwordHash        String
  role                String            @default("EMPLOYEE")  // EMPLOYEE | ADMIN
  tokenVersion        Int               @default(0)
  hasPermesso104      Boolean           @default(false)
  hasPaternityLeave   Boolean           @default(false)
  createdAt           DateTime          @default(now())
  updatedAt           DateTime          @updatedAt
  
  timeEntries         TimeEntry[]
  leaveRequests       LeaveRequest[]
  workingSchedules    WorkingSchedule[]
  accounts            Account[]
  sessions            Session[]
}
```

**Key Fields**:
- `role`: Role-based access control (EMPLOYEE, ADMIN)
- `tokenVersion`: Incremented to invalidate all user sessions on security events
- `hasPermesso104`: Enables Law 104 permission tracking (disability care leave)
- `hasPaternityLeave`: Enables paternity leave tracking
- `passwordHash`: bcrypt hashed password

---

### TimeEntry
```prisma
model TimeEntry {
  id                  String    @id @default(cuid())
  userId              String
  user                User      @relation(fields: [userId], references: [id], onDelete: Cascade)
  workDate            DateTime
  hoursWorked         Decimal   @default(0) @db.Decimal(5,2)
  overtimeHours       Decimal   @default(0) @db.Decimal(5,2)
  vacationHours       Decimal   @default(0) @db.Decimal(5,2)
  sicknessHours       Decimal   @default(0) @db.Decimal(5,2)
  permessoHours       Decimal   @default(0) @db.Decimal(5,2)
  permesso104Hours    Decimal   @default(0) @db.Decimal(5,2)
  paternityHours      Decimal   @default(0) @db.Decimal(5,2)
  morningStart        String?
  morningEnd          String?
  afternoonStart      String?
  afternoonEnd        String?
  notes               String?   @db.Text
  medicalCertificate  String?
  createdAt           DateTime  @default(now())
  updatedAt           DateTime  @updatedAt

  @@unique([userId, workDate], map: "user_workdate_unique")
  @@index([userId, workDate])
}
```

**Key Fields**:
- **Hours Fields**: All `Decimal` types - must be converted to `number` for JSON serialization
- **Shifts**: `morningStart/End`, `afternoonStart/End` in HH:MM format
- **Unique Constraint**: One entry per user per date
- **medicalCertificate**: File path for uploaded sick leave certificates

---

### LeaveRequest
```prisma
model LeaveRequest {
  id              String    @id @default(cuid())
  userId          String
  user            User      @relation(fields: [userId], references: [id], onDelete: Cascade)
  leaveType       String    // VACATION | SICKNESS | PERMISSION | PERMESSO_104 | PATERNITY
  startDate       DateTime
  endDate         DateTime
  status          String    @default("PENDING")  // PENDING | APPROVED | REJECTED
  notes           String?   @db.Text
  adminNotes      String?   @db.Text
  googleEventId   String?
  createdAt       DateTime  @default(now())
  updatedAt       DateTime  @updatedAt

  @@index([userId, status])
  @@index([status, createdAt])
}
```

**Workflow**:
1. Employee submits request (status: PENDING)
2. Admin approves/rejects
3. On approval: Google Calendar event created (if configured), email sent
4. `googleEventId` stores calendar event ID for future reference

---

### WorkingSchedule
```prisma
model WorkingSchedule {
  id              String    @id @default(cuid())
  userId          String
  user            User      @relation(fields: [userId], references: [id], onDelete: Cascade)
  dayOfWeek       String    // MONDAY | TUESDAY | ... | SUNDAY
  morningStart    String?
  morningEnd      String?
  afternoonStart  String?
  afternoonEnd    String?
  canWorkSunday   Boolean   @default(false)
  useManualHours  Boolean   @default(false)
  createdAt       DateTime  @default(now())
  updatedAt       DateTime  @updatedAt

  @@unique([userId, dayOfWeek])
  @@index([userId])
}
```

**Purpose**: Per-user, per-day customizable work schedules
- Defines expected start/end times for each day
- `canWorkSunday`: Allows Sunday work entries (default: blocked)
- `useManualHours`: Disables automatic hour calculation

---

### NextAuth Models
- **Account**: OAuth provider accounts (if added in future)
- **Session**: Database sessions (currently using JWT strategy)
- **VerificationToken**: Password reset tokens

---

## 🔑 Key Components & Files

### Authentication & Middleware

**`lib/auth.ts`** - NextAuth configuration
```typescript
export const authOptions: NextAuthOptions = {
  // Type assertion needed: @next-auth/prisma-adapter types are not updated for Prisma v7
  adapter: PrismaAdapter(prisma as any),
  providers: [
    CredentialsProvider({
      credentials: { email: {}, password: {} },
      authorize: async (credentials) => {
        // Verify password with bcrypt.compare()
        // Check tokenVersion for session invalidation
        // Return user object with id, name, email, role
      }
    })
  ],
  session: {
    strategy: "jwt",
    maxAge: 30 * 60, // 30 minutes
  },
  callbacks: {
    jwt: ({ token, user }) => {
      // Add user.id and user.role to token
      // Include tokenVersion for security
    },
    session: ({ session, token }) => {
      // Add id and role to session.user
    }
  }
};

export function getAuthSession() {
  return getServerSession(authOptions);
}
```

**`lib/api-middleware.ts`** - API route helpers
```typescript
// Require valid session
export async function requireAuth(): Promise<Session> {
  const session = await getAuthSession();
  if (!session) throw new Error("Unauthorized");
  return session;
}

// Require admin role
export async function requireAdmin(): Promise<Session> {
  const session = await requireAuth();
  if (session.user.role !== "ADMIN") throw new Error("Forbidden");
  return session;
}

// Check if user is admin
export function isAdmin(session: Session): boolean {
  return session.user.role === "ADMIN";
}
```

---

### API Response Standardization

**`lib/api-responses.ts`** - Standardized response helpers
```typescript
export function successResponse(data: any, status = 200) {
  return NextResponse.json(data, { status });
}

export function errorResponse(message: string, status = 400) {
  return NextResponse.json({ error: message }, { status });
}

export function handleError(error: unknown) {
  console.error("API Error:", error);
  if (error instanceof Error) {
    return errorResponse(error.message, 500);
  }
  return errorResponse("Internal server error", 500);
}
```

---

### Data Serialization

**`lib/utils/serialization.ts`** - **CRITICAL: Always use for Prisma Decimal conversion**
```typescript
import type { Prisma } from "@/lib/generated/prisma/client";

type Decimal = Prisma.Decimal;

// Convert Prisma Decimal to number
export function decimalToNumber(decimal: Decimal | null | undefined): number {
  if (decimal === null || decimal === undefined) return 0;
  return parseFloat(decimal.toString());
}

// Convert single TimeEntry (Prisma → JSON-safe DTO)
export function serializeTimeEntry(entry) {
  return {
    ...entry,
    workDate: entry.workDate.toISOString().split("T")[0],
    hoursWorked: decimalToNumber(entry.hoursWorked),
    overtimeHours: decimalToNumber(entry.overtimeHours),
    // ... all Decimal fields converted via decimalToNumber()
  };
}
```

**⚠️ ALWAYS USE** `serializeTimeEntry()` instead of manual `parseFloat()` conversions.

**⚠️ Decimal import in v7**: Use `import type { Prisma } from "@/lib/generated/prisma/client"` then `Prisma.Decimal`. The old `@prisma/client/runtime/library` path no longer exists.

---

### Utilities

| File | Purpose | Key Functions |
|------|---------|---------------|
| **`lib/utils/date-utils.ts`** | Date operations | `isItalianHoliday()`, `getMonthDateRange()`, `formatDateForDb()` |
| **`lib/utils/time-utils.ts`** | Time calculations | `calculateHours()`, `parseTimeToMinutes()`, `TIME_OPTIONS` |
| **`lib/utils/holiday-utils.ts`** | Italian holidays | `getItalianHolidays()`, `isHoliday()` |
| **`lib/utils/schedule-utils.ts`** | Schedule helpers (client-safe) | `getBaseHoursFromScheduleMap()`, `isWorkingDayFromScheduleMap()`, `schedulesToMap()`, `DEFAULT_SCHEDULE` |
| **`lib/utils/schedule-utils.server.ts`** | Schedule DB operations (server-only) | `getUserSchedules()`, `getBaseHoursForDate()`, `createDefaultSchedulesForUser()`, `upsertScheduleForDay()` |
| **`lib/utils/user-utils.ts`** | User operations | `generateTemporaryPassword()`, `validateUserRole()` |
| **`lib/db-backup.ts`** | Database backups | `createBackup()`, `cleanupOldBackups()` |
| **`lib/google-calendar.ts`** | Calendar sync | `createCalendarEvent()`, `updateCalendarEvent()` |
| **`lib/email.ts`** | Email sending | `sendEmail()`, `sendWelcomeEmail()`, `sendPasswordReset()` |

---

### Components Organization

```
components/
├── auth/
│   ├── login-form.tsx          # Credentials login UI
│   ├── logout-button.tsx       # Sign out button
│   ├── session-provider.tsx    # NextAuth SessionProvider wrapper
│   └── setup-form.tsx          # Initial admin setup
├── dashboard/
│   ├── admin/                  # Admin-only components
│   │   ├── overview.tsx
│   │   ├── reports.tsx
│   │   ├── pending-requests.tsx
│   │   └── user-schedule-editor.tsx
│   ├── employee/               # Employee-facing components
│   │   ├── profile.tsx
│   │   ├── reports.tsx
│   │   ├── request-leave-modal.tsx
│   │   └── requests-list.tsx
│   └── shared/                 # Shared components
│       ├── timesheet-calendar.tsx  # Main calendar component (200+ lines)
│       ├── stats-card.tsx
│       └── user-selector.tsx
├── features/
│   └── activity-tracker.tsx    # Inactivity timeout tracker
├── layout/
│   └── navbar.tsx              # Main navigation
└── ui/                         # Reusable UI primitives
    ├── alert.tsx
    ├── card.tsx
    ├── month-picker.tsx
    └── spinner.tsx
```

---

## 🔄 Common Workflows

### 1. Creating a New API Endpoint

**Pattern**:
```typescript
// app/api/resource/route.ts
import { requireAuth, requireAdmin } from "@/lib/api-middleware";
import { successResponse, errorResponse, handleError } from "@/lib/api-responses";
import { z } from "zod";
import prisma from "@/lib/prisma";

// Define Zod schema for validation
const createSchema = z.object({
  field: z.string().min(1),
  // ... other fields
});

export async function GET(request: Request) {
  try {
    // 1. Authenticate
    const session = await requireAuth();
    
    // 2. Parse query params
    const { searchParams } = new URL(request.url);
    const param = searchParams.get("param");
    
    // 3. Authorization check (example: employees see only their data)
    const userId = session.user.role === "ADMIN" 
      ? param  // Admin can query any user
      : session.user.id;  // Employee sees only own data
    
    // 4. Query database
    const data = await prisma.model.findMany({ where: { userId } });
    
    // 5. Return response
    return successResponse({ data });
  } catch (error) {
    return handleError(error);
  }
}

export async function POST(request: Request) {
  try {
    // Admin only
    const session = await requireAdmin();
    
    // Parse and validate body
    const body = await request.json();
    const validated = createSchema.parse(body);
    
    // Create resource
    const result = await prisma.model.create({ data: validated });
    
    return successResponse(result, 201);
  } catch (error) {
    return handleError(error);
  }
}
```

---

### 2. Server Component Data Fetching

**Pattern**:
```typescript
// app/dashboard/page.tsx
import { getAuthSession } from "@/lib/auth";
import { redirect } from "next/navigation";
import { serializeTimeEntries } from "@/lib/utils/serialization";
import prisma from "@/lib/prisma";

export default async function DashboardPage() {
  // 1. Check authentication
  const session = await getAuthSession();
  if (!session) redirect("/");
  
  // 2. Fetch data
  const entries = await prisma.timeEntry.findMany({
    where: { userId: session.user.id },
    orderBy: { workDate: "desc" },
    take: 10,
  });
  
  // 3. Serialize Prisma objects to DTOs
  const serialized = serializeTimeEntries(entries);
  
  // 4. Pass to client component
  return <ClientComponent entries={serialized} />;
}
```

**⚠️ Key Rules**:
- Always serialize Prisma `Decimal` types before passing to client components
- Use `redirect()` for authentication, not try/catch
- Convert dates to ISO strings: `workDate.toISOString().split("T")[0]`

---

### 3. Client Component Patterns

**Pattern**:
```typescript
"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

export function ClientComponent({ entries }) {
  const [isPending, startTransition] = useTransition();
  const router = useRouter();
  
  async function handleAction() {
    startTransition(async () => {
      const res = await fetch("/api/endpoint", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ data }),
      });
      
      if (res.status === 401) {
        // Redirect to login on auth error
        router.push("/");
        return;
      }
      
      if (!res.ok) {
        const error = await res.json();
        alert(error.error);
        return;
      }
      
      // Refresh server component data
      router.refresh();
    });
  }
  
  return <button onClick={handleAction} disabled={isPending}>...</button>;
}
```

**Key Patterns**:
- Use `useTransition()` for mutations to keep UI responsive
- Handle 401 errors with redirect to login
- Use `router.refresh()` to revalidate server components
- Store DTOs (serialized data) in state, never Prisma objects

---

## 📝 Critical Commands

| Command | Description |
|---------|-------------|
| `npm run dev` | Start development server |
| `npm run build` | Production build |
| `npm run start` | Start production server |
| `npm run docker:up` | Start full stack in Docker |
| `npm run docker:build` | Rebuild and start Docker stack |
| `npm run docker:down` | Stop Docker containers |
| `npm run prisma:migrate` | Create dev migration (⚠️ run `prisma generate` after) |
| `npm run prisma:deploy` | Apply migrations in production |
| `npm run prisma:seed` | Seed database (`npx prisma db seed`) |
| `npx prisma generate` | Regenerate client to `lib/generated/prisma/` |

### ⚠️ Prisma v7 Migration Workflow Changes
- `prisma migrate dev` **no longer auto-generates** the client → run `npx prisma generate` after
- `prisma migrate dev` **no longer auto-seeds** → run `npx prisma db seed` explicitly
- Seed script is configured in `prisma.config.ts` (not `package.json`)
- CLI reads database URL from `prisma.config.ts` (not `schema.prisma`)

---

## 🔐 Role-Based Access Control (RBAC)

### EMPLOYEE Permissions
- **View/Edit**: Own time entries only
- **Date Restrictions**: 
  - Can edit entries in **current month only**
  - Cannot log future dates
  - Cannot log hours on holidays (unless configured per user)
- **Entry Types**: Normal work, Ferie (Vacation), Malattia (Sickness), Permesso, Permesso 104*, Paternity*
- **Leave Requests**: Submit, view own requests
- **Reports**: Personal reports and statistics

_*Only if `hasPermesso104` or `hasPaternityLeave` flags are enabled_

### ADMIN Permissions
- **Full Access**: Query and modify any user's data via `userId` param
- **User Management**: Create, edit, delete users, reset passwords
- **Leave Approvals**: Approve/reject leave requests, sync to calendar
- **Settings**: Manage holidays, working schedules, system configuration
- **Reports**: Company-wide analytics, export Excel reports

---

## 🛠️ Development Best Practices

### 1. Decimal Handling
**❌ NEVER DO THIS:**
```typescript
const dto = {
  hoursWorked: parseFloat(entry.hoursWorked.toString()),
  overtimeHours: parseFloat(entry.overtimeHours.toString()),
  // ... repeated 7 times
};
```

**✅ ALWAYS DO THIS:**
```typescript
import { serializeTimeEntry } from "@/lib/utils/serialization";
const dto = serializeTimeEntry(entry);
```

---

### 2. Date Handling
**Use `date-fns` for date manipulation:**
```typescript
import { startOfMonth, endOfMonth, format } from "date-fns";

// Convert Date to DB format
function formatDateForDb(date: Date): string {
  return date.toISOString().split("T")[0];  // "2026-02-12"
}

// Parse query param month
function getMonthDateRange(monthStr: string) {
  const [year, month] = monthStr.split("-").map(Number);
  const start = new Date(year, month - 1, 1);
  return {
    start: formatDateForDb(start),
    end: formatDateForDb(endOfMonth(start)),
  };
}
```

**⚠️ Timezone Awareness**: Store dates in UTC, handle Italian timezone for holiday calculations.

---

### 3. Validation with Zod
**Keep schemas in sync with Prisma models:**
```typescript
import { z } from "zod";

const timeEntrySchema = z.object({
  workDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  hoursWorked: z.number().min(0).max(24),
  overtimeHours: z.number().min(0),
  // ... match TimeEntry model fields
});
```

---

### 4. Import Consistency
**Standardize on named imports for bcrypt:**
```typescript
// ✅ Correct
import { hash, compare } from "bcryptjs";

// ❌ Avoid
import bcrypt from "bcryptjs";
```

---

### 5. Error Handling
**Prefer standardized error responses:**
```typescript
import { handleError } from "@/lib/api-responses";

export async function GET() {
  try {
    // ... logic
  } catch (error) {
    return handleError(error);  // Logs error and returns 500
  }
}
```

---

### 6. Icons
**Use `lucide-react` for all icons:**
```typescript
import { Calendar, User, LogOut } from "lucide-react";
<Calendar className="w-4 h-4" />
```

---

## 🧪 Testing Patterns

### Manual Testing Checklist
- [ ] Login as employee, verify calendar loads
- [ ] Log hours for today, verify saves correctly
- [ ] Login as admin, view employee data
- [ ] Approve leave request, check Google Calendar sync (if configured)
- [ ] Test inactivity timeout (30 minutes)
- [ ] Create user, verify welcome email sent (if configured)

### Database Seeding
```bash
npm run prisma:seed
```
Creates:
- Admin user: `admin@example.com` / `Admin123!`
- Employee user: `employee@example.com` / `Employee123!`

---

## 📚 Additional Resources

- **[API Reference](docs/API_REFERENCE.md)** - Complete endpoint documentation
- **[Configuration](docs/CONFIGURATION.md)** - Environment setup, email, Google Calendar
- **[Leave Requests](docs/LEAVE_REQUESTS.md)** - Leave management workflow
- **[Working Schedules](docs/WORKING_SCHEDULES.md)** - Schedule configuration
- **[Backup System](docs/BACKUP_SYSTEM.md)** - Database backup procedures
- **[Deployment](docs/DEPLOYMENT.md)** - Production deployment guide
- **[PWA](docs/PWA.md)** - Progressive Web App features

---

## 🚨 Common Pitfalls

1. **Forgetting to serialize Decimals** → Use `serializeTimeEntry()`
2. **Hardcoding localhost URLs** → Use `process.env.NEXTAUTH_URL`
3. **Mixing bcrypt import styles** → Use named imports
4. **Not checking role in API routes** → Use `requireAdmin()` for admin endpoints
5. **Passing Prisma objects to client components** → Serialize first
6. **Ignoring timezone for holidays** → Use `date-holidays` with IT locale
7. **Importing from `@prisma/client`** → Use `@/lib/generated/prisma/client` instead (v7 generates locally)
8. **Importing Decimal from `@prisma/client/runtime/library`** → Use `import type { Prisma } from "@/lib/generated/prisma/client"` then `Prisma.Decimal`
9. **Importing server-only utils in client components** → `schedule-utils.ts` is client-safe; use `schedule-utils.server.ts` for DB operations
10. **Forgetting `prisma generate` after `migrate dev`** → v7 no longer auto-generates the client
11. **Missing `dotenv` in standalone scripts** → Add `import "dotenv/config"` at top (e.g., seed.ts)

---

**Last Updated**: March 5, 2026  
**Version**: 0.7.0+ (Prisma v7)  
**Maintainer**: Development Team
