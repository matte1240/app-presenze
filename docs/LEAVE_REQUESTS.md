# 🏖️ Leave Request System

Complete guide to the leave request management system in the Employee Hours Tracker.

## 📋 Overview

The leave request system allows employees to submit formal requests for time off, which administrators can approve or reject. Approved requests can automatically sync to Google Calendar and generate email notifications.

---

## 🎯 Features

- **Multiple Leave Types**: Vacation, sick days, permission, Permesso 104, paternity leave
- **Approval Workflow**: Pending → Approved/Rejected status flow
- **Google Calendar Integration**: Automatic event creation for approved requests
- **Email Notifications**: Alerts for status changes
- **Admin Dashboard**: Centralized view of all pending requests
- **Employee Self-Service**: View request history and status

---

## 📝 Leave Types

| Type | Italian Name | Description |
|------|--------------|-------------|
| `VACATION` | Ferie | Annual vacation days |
| `SICKNESS` | Malattia | Sick leave |
| `PERMISSION` | Permesso | General permission/personal leave |
| `PERMESSO_104` | Permesso 104 | Law 104 permission (disability care) |
| `PATERNITY` | Congedo di paternità | Paternity leave |

### Type-Specific Eligibility

- **Permesso 104**: Only available if user has `hasPermesso104 = true`
- **Paternity Leave**: Only available if user has `hasPaternityLeave = true`

Admins can configure these flags in user settings.

---

## 🔄 Request Workflow

### 1. Employee Submits Request

**Via UI:**
1. Navigate to **Dashboard > Requests**
2. Click "Request Leave"
3. Fill out the form:
   - Leave type
   - Start date
   - End date
   - Optional notes
4. Click "Submit"

**Via API:**
```bash
POST /api/requests
{
  "leaveType": "VACATION",
  "startDate": "2026-03-01",
  "endDate": "2026-03-07",
  "notes": "Spring vacation"
}
```

**Status:** Request created with `PENDING` status.

---

### 2. Admin Reviews Request

**Via UI:**
1. Navigate to **Admin Dashboard**
2. View "Pending Requests" widget
3. Or go to **Manage Requests** page
4. Review request details
5. Click "Approve" or "Reject"
6. Add optional admin notes

**Via API:**
```bash
PUT /api/requests/[id]
{
  "status": "APPROVED",
  "adminNotes": "Approved for requested dates"
}
```

---

### 3. Automatic Actions on Approval

When a request is **approved**, the system:

1. **Updates Request Status** to `APPROVED`
2. **Creates Google Calendar Event** (if configured):
   - Event title: `[Leave Type] - [Employee Name]`
   - Dates: Start to end date
   - Description: Includes notes and admin notes
3. **Sends Email Notification**:
   - To: Employee email
   - Subject: "Leave Request Approved"
   - Body: Details of approved request

---

### 4. Rejection Workflow

When a request is **rejected**:

1. **Updates Request Status** to `REJECTED`
2. **Sends Email Notification**:
   - To: Employee email
   - Subject: "Leave Request Rejected"
   - Body: Reason (admin notes) if provided
3. **No Calendar Event Created**

---

## 🗄️ Data Model

### LeaveRequest Schema

```prisma
model LeaveRequest {
  id          String   @id @default(cuid())
  userId      String
  user        User     @relation(fields: [userId], references: [id], onDelete: Cascade)
  leaveType   String   // VACATION, SICKNESS, PERMISSION, PERMESSO_104, PATERNITY
  startDate   DateTime
  endDate     DateTime
  status      String   @default("PENDING") // PENDING, APPROVED, REJECTED
  notes       String?  @db.Text
  adminNotes  String?  @db.Text
  googleEventId String? // For calendar sync
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt

  @@index([userId, status])
  @@index([status, createdAt])
}
```

### Key Fields

- **googleEventId**: Stores Google Calendar event ID for approved requests
- **status**: Current state (`PENDING`, `APPROVED`, `REJECTED`)
- **adminNotes**: Admin's comments (visible to employee)
- **notes**: Employee's reason for request

---

## 🗓️ Google Calendar Integration

### Setup

1. **Configure Environment Variables** (see [CONFIGURATION.md](CONFIGURATION.md)):
   ```env
   GOOGLE_CLIENT_EMAIL="service-account@project.iam.gserviceaccount.com"
   GOOGLE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n"
   GOOGLE_CALENDAR_ID="calendar-id@group.calendar.google.com"
   ```

2. **Create Service Account** in Google Cloud Console
3. **Enable Google Calendar API**
4. **Share Calendar** with service account email

### Event Details

When a request is approved, the calendar event includes:

- **Summary**: `[VACATION] - John Doe`
- **Start Date**: Request start date (all-day event)
- **End Date**: Request end date (all-day event)
- **Description**:
  ```
  Employee: John Doe
  Type: Vacation
  Status: APPROVED
  Notes: Spring vacation
  Admin Notes: Approved for requested dates
  ```
- **Color**: Type-specific color coding (optional)

### Sync Behavior

- **Create**: On approval, if `googleEventId` is null
- **Update**: Not currently implemented (manual deletion required)
- **Delete**: Not automatic when request is deleted

---

## 📧 Email Notifications

### Approval Email

**Subject:** Leave Request Approved

**Body:**
```
Hello [Employee Name],

Your leave request has been APPROVED.

Details:
- Type: Vacation
- Dates: March 1, 2026 - March 7, 2026
- Admin Notes: Approved for requested dates

You can view your request history in the dashboard.

Best regards,
HR Team
```

### Rejection Email

**Subject:** Leave Request Rejected

**Body:**
```
Hello [Employee Name],

Your leave request has been REJECTED.

Details:
- Type: Vacation
- Dates: March 1, 2026 - March 7, 2026
- Reason: Overlaps with company-wide event

Please contact your manager for more information.

Best regards,
HR Team
```

**Note:** Email templates can be customized in `lib/email-templates/`.

---

## 👨‍💼 Admin Features

### Pending Requests Dashboard

Admins see a dedicated widget showing:
- Number of pending requests
- Quick preview of recent submissions
- Direct link to full requests manager

### Requests Management Page

Located at `/dashboard/admin/requests`, features:
- **Filterable list**: By status, employee, date range
- **Bulk actions**: Approve/reject multiple requests
- **Search**: Find specific requests
- **Export**: Generate reports

### User Leave Balance

*Future Feature*: Track remaining vacation days per user.

---

## 👤 Employee Features

### Request Submission

Simple form with date picker and leave type selector.

### Request History

View all submitted requests:
- Status indicators (pending, approved, rejected)
- Date ranges
- Admin notes for rejected requests

### Edit/Delete

- **Before Approval**: Can delete pending requests
- **After Approval**: Cannot delete (must contact admin)

---

## 🚨 Business Rules

### Date Validation

- **Start Date** must be today or future
- **End Date** must be >= start date
- **No Overlaps**: Cannot submit overlapping requests (validated server-side)

### Holidays

- Requests can include holidays
- Holiday days are counted in the total leave duration

### Permissions

- **Employees**: Can only view and manage their own requests
- **Admins**: Can view and manage all requests

---

## 🔧 API Endpoints

See [API_REFERENCE.md](API_REFERENCE.md) for complete details.

### Key Endpoints

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| `GET` | `/api/requests` | User | List requests (own or all if admin) |
| `POST` | `/api/requests` | User | Create new request |
| `PUT` | `/api/requests/[id]` | Admin | Approve/reject request |
| `DELETE` | `/api/requests/[id]` | User/Admin | Delete request |

---

## 🛠️ Customization

### Add New Leave Type

1. **Update Schema** (`prisma/schema.prisma`):
   ```prisma
   // Add to enum or validation
   ```

2. **Update Frontend Form** (`components/dashboard/employee/request-leave-modal.tsx`):
   ```tsx
   const leaveTypes = [
     { value: 'VACATION', label: 'Ferie' },
     { value: 'NEW_TYPE', label: 'New Type' },
   ];
   ```

3. **Update Validation** (`app/api/requests/route.ts`):
   ```ts
   const validTypes = ['VACATION', 'SICKNESS', 'PERMISSION', 'PERMESSO_104', 'PATERNITY', 'NEW_TYPE'];
   ```

4. **Run Migration**:
   ```bash
   npm run prisma:migrate
   ```

---

## 📊 Reporting

### Leave Summary Report

Generate Excel report with:
- Employee name
- Total vacation days used
- Total sick days
- Breakdown by leave type

**Export:** Use `/api/admin/reports/leave-summary?year=2026`

---

## 🐛 Troubleshooting

### Request Not Syncing to Calendar

**Check:**
1. Are Google Calendar env vars set?
2. Is the service account email shared on the calendar?
3. Check application logs for Google API errors

### Email Not Sent

**Check:**
1. Email configuration in `.env`
2. SMTP credentials are correct
3. Application logs for email errors

### Cannot Submit Request

**Check:**
1. User eligibility for leave type (Permesso 104, Paternity)
2. Date validation (no past dates, no overlaps)
3. Browser console for validation errors

---

## 📚 Related Documentation

- **[API Reference](API_REFERENCE.md)** - API endpoint details
- **[Configuration](CONFIGURATION.md)** - Google Calendar and email setup
- **[Working Schedules](WORKING_SCHEDULES.md)** - How schedules affect leave

---

**Last Updated:** February 12, 2026  
**Version:** v0.7.0+
