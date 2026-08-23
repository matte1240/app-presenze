# ⏰ Working Schedules System

Comprehensive guide to the per-user, per-day working schedule configuration in the Employee Hours Tracker.

## 📋 Overview

The Working Schedules system allows administrators to configure customized work hours for each employee on a per-day basis. This enables flexible work arrangements, part-time schedules, and shift variations.

---

## ✨ Features

- **Per-Day Configuration**: Different schedules for Monday-Sunday
- **Morning/Afternoon Shifts**: Separate time ranges for shifts
- **Sunday Work Permission**: Optional Sunday work flag
- **Manual Hours Mode**: Bypass automatic hour calculations
- **Default Templates**: Quick setup with standard schedules
- **Bulk Updates**: Apply schedules to multiple users

---

## 🗄️ Data Model

### WorkingSchedule Schema

```prisma
model WorkingSchedule {
  id              String  @id @default(cuid())
  userId          String
  user            User    @relation(fields: [userId], references: [id], onDelete: Cascade)
  dayOfWeek       String  // MONDAY, TUESDAY, ..., SUNDAY
  morningStart    String? // HH:MM format (e.g., "08:00")
  morningEnd      String?
  afternoonStart  String?
  afternoonEnd    String?
  canWorkSunday   Boolean @default(false)
  useManualHours  Boolean @default(false)
  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt

  @@unique([userId, dayOfWeek])
  @@index([userId])
}
```

### Field Descriptions

| Field | Type | Description |
|-------|------|-------------|
| `dayOfWeek` | String | Day name (MONDAY-SUNDAY) |
| `morningStart` | String? | Morning shift start time (HH:MM) |
| `morningEnd` | String? | Morning shift end time (HH:MM) |
| `afternoonStart` | String? | Afternoon shift start time (HH:MM) |
| `afternoonEnd` | String? | Afternoon shift end time (HH:MM) |
| `canWorkSunday` | Boolean | Allow Sunday work entries |
| `useManualHours` | Boolean | Disable automatic hour calculation |

**Note:** All time fields are nullable to support non-working days or days off.

---

## 🎯 Use Cases

### 1. Standard Full-Time Schedule

**8:00-12:00, 13:00-17:00 (Monday-Friday)**

```json
{
  "MONDAY": {
    "morningStart": "08:00",
    "morningEnd": "12:00",
    "afternoonStart": "13:00",
    "afternoonEnd": "17:00"
  },
  "TUESDAY": { ... },
  "WEDNESDAY": { ... },
  "THURSDAY": { ... },
  "FRIDAY": { ... },
  "SATURDAY": null,
  "SUNDAY": null
}
```

**Total Hours/Day:** 8 hours (4 + 4)

---

### 2. Part-Time Schedule

**9:00-13:00 (Monday-Wednesday)**

```json
{
  "MONDAY": {
    "morningStart": "09:00",
    "morningEnd": "13:00",
    "afternoonStart": null,
    "afternoonEnd": null
  },
  "TUESDAY": { ... },
  "WEDNESDAY": { ... },
  "THURSDAY": null,
  "FRIDAY": null,
  "SATURDAY": null,
  "SUNDAY": null
}
```

**Total Hours/Day:** 4 hours

---

### 3. Flexible Schedule with Sunday

**Monday-Saturday work, Sunday optional**

```json
{
  "SUNDAY": {
    "morningStart": "10:00",
    "morningEnd": "14:00",
    "canWorkSunday": true
  }
}
```

When `canWorkSunday = true`, employees **can** log hours on Sunday.

---

### 4. Manual Hours Mode

**For employees with irregular schedules**

```json
{
  "MONDAY": {
    "useManualHours": true
  }
}
```

When `useManualHours = true`:
- Automatic hour calculation is **disabled**
- Employee manually enters `hoursWorked` in timesheet
- No validation against schedule times

---

## 🔄 How It Works

### 1. Admin Configures Schedule

**Via UI:**
1. Navigate to **Admin Dashboard > Manage Users**
2. Select a user
3. Click "Edit Schedule"
4. Configure each day:
   - Set morning/afternoon times
   - Enable Sunday work if needed
   - Toggle manual hours mode
5. Save changes

**Via API:**
```bash
POST /api/admin/users/[id]/schedule
{
  "schedules": [
    {
      "dayOfWeek": "MONDAY",
      "morningStart": "08:00",
      "morningEnd": "12:00",
      "afternoonStart": "13:00",
      "afternoonEnd": "17:00",
      "canWorkSunday": false,
      "useManualHours": false
    }
  ]
}
```

---

### 2. Employee Views Schedule

**Calendar Component:**
- Reads user's `WorkingSchedule` for current day
- Pre-fills time fields with default values
- Displays expected hours for the day

**Example:**
- **Day:** Monday
- **Schedule:** 08:00-12:00, 13:00-17:00
- **Auto-filled Times:**
  - Morning Start: 08:00
  - Morning End: 12:00
  - Afternoon Start: 13:00
  - Afternoon End: 17:00

---

### 3. Automatic Hour Calculation

**If `useManualHours = false`:**

The system calculates `hoursWorked` based on time entries:

```ts
// lib/utils/time-utils.ts
function calculateHours(morningStart, morningEnd, afternoonStart, afternoonEnd) {
  const morningHours = calculateDuration(morningStart, morningEnd);
  const afternoonHours = calculateDuration(afternoonStart, afternoonEnd);
  return morningHours + afternoonHours;
}
```

**Result:** `hoursWorked` field is auto-populated.

---

**If `useManualHours = true`:**

- Employee manually enters total hours
- No automatic calculation
- Useful for:
  - Irregular shifts
  - Commission-based work
  - Flexible remote work

---

### 4. Validation Rules

When saving a time entry:

1. **Sunday Check**:
   ```ts
   if (dayOfWeek === 'SUNDAY' && !schedule.canWorkSunday) {
     throw new Error('Sunday work not permitted for this user');
   }
   ```

2. **Time Range Check** (if not manual mode):
   ```ts
   if (!schedule.useManualHours) {
     validateTimesAgainstSchedule(entry, schedule);
   }
   ```

3. **Past Date Check**:
   - Employees can edit past dates **within current month**
   - Cannot edit dates older than current month

---

## 👨‍💼 Admin Operations

### View All User Schedules

Navigate to **Manage Users > [User] > View Schedule**.

Displays:
- Weekly schedule grid
- Total expected hours per week
- Days off highlighted

### Bulk Schedule Assignment

*Future Feature*: Apply a template schedule to multiple employees at once.

### Schedule History

*Future Feature*: Track schedule changes over time (audit log).

---

## 🔧 API Endpoints

### GET `/api/users/me/schedule`

**Get current user's schedule.**

**Auth:** User session

**Response:**
```json
{
  "schedules": [
    {
      "id": "schedule-id",
      "dayOfWeek": "MONDAY",
      "morningStart": "08:00",
      "morningEnd": "12:00",
      "afternoonStart": "13:00",
      "afternoonEnd": "17:00",
      "canWorkSunday": false,
      "useManualHours": false
    }
  ]
}
```

---

### GET `/api/admin/users/[id]/schedule`

**Get any user's schedule (Admin only).**

**Auth:** Admin session

**Response:** Same as above

---

### POST `/api/admin/users/[id]/schedule`

**Update user schedule (Admin only).**

**Auth:** Admin session

**Request Body:**
```json
{
  "schedules": [
    {
      "dayOfWeek": "MONDAY",
      "morningStart": "09:00",
      "morningEnd": "13:00",
      "afternoonStart": null,
      "afternoonEnd": null,
      "canWorkSunday": false,
      "useManualHours": false
    }
  ]
}
```

**Behavior:**
- **Upsert**: Creates or updates existing schedule for the day
- **Validation**: Ensures time format is HH:MM
- **Cascade**: Deletes removed days (if not included in request)

---

## 🛠️ Default Schedules

### Standard 8-Hour Day

```ts
// lib/utils/schedule-utils.ts (client-safe, no DB imports)
export const DEFAULT_SCHEDULE = {
  morningStart: '08:00',
  morningEnd: '12:00',
  afternoonStart: '13:00',
  afternoonEnd: '17:00',
};
```

Applied to new users automatically unless customized.

> **Note:** Schedule utilities are split into two files:
> - **`schedule-utils.ts`** — Pure functions safe for client components (`getBaseHoursFromScheduleMap`, `isWorkingDayFromScheduleMap`, `schedulesToMap`, constants)
> - **`schedule-utils.server.ts`** — Server-only functions that access the database (`getUserSchedules`, `getBaseHoursForDate`, `createDefaultSchedulesForUser`, `upsertScheduleForDay`, `updateUserSchedules`)

---

### Template Library

Common templates available for quick setup:

| Template | Hours/Day | Days | Description |
|----------|-----------|------|-------------|
| **Full-Time** | 8 | Mon-Fri | Standard office hours |
| **Part-Time** | 4 | Mon-Wed | Morning only |
| **Retail** | 8 | Tue-Sat | Weekend coverage |
| **Flex** | Variable | Mon-Fri | Manual hours mode |

---

## 📊 Reporting

### Expected vs Actual Hours

Generate reports comparing:
- **Expected Hours**: Based on schedule (e.g., 40 hours/week)
- **Actual Hours**: Sum of `hoursWorked` entries
- **Variance**: Difference (overtime or undertime)

**Export:** Use `/api/admin/reports/hours-variance?userId=...&month=2026-02`

---

## 🚨 Edge Cases

### No Schedule Defined

**Behavior:**
- Falls back to `DEFAULT_SCHEDULE`
- Warning shown to admin in dashboard

### Partial Week Schedule

**Example:** User works Mon-Wed only

- Thu-Sun entries are **blocked** in calendar
- System shows "Day off" for unscheduled days

### Schedule Change Mid-Month

**Current Behavior:**
- New schedule applies **immediately**
- Past entries are **not** recalculated

**Best Practice:**
- Schedule changes take effect at month start
- Notify employees before changes

---

## 🔒 Security & Permissions

### Who Can Edit Schedules?

- **Employees**: Read-only access to own schedule
- **Admins**: Full CRUD access to all schedules

### Audit Trail

*Future Feature*: Log all schedule changes with:
- Who made the change
- When it was changed
- Before/after values

---

## 🧪 Testing Schedules

### Via UI

1. Create a test user
2. Assign a custom schedule
3. Log in as that user
4. Navigate to calendar and verify:
   - Pre-filled times match schedule
   - Sunday is blocked/enabled correctly
   - Manual hours mode works as expected

### Via API

```bash
# Create schedule
curl -X POST 'http://localhost:3000/api/admin/users/USER_ID/schedule' \
  -H 'Content-Type: application/json' \
  -d '{"schedules": [...]}'

# Verify
curl -X GET 'http://localhost:3000/api/users/me/schedule' \
  -H 'Cookie: session-token'
```

---

## 📚 Related Documentation

- **[API Reference](API_REFERENCE.md)** - Schedule API endpoints
- **[Configuration](CONFIGURATION.md)** - System-wide settings
- **[Leave Requests](LEAVE_REQUESTS.md)** - How schedules affect leave

---

**Last Updated:** February 12, 2026  
**Version:** v0.7.0+
