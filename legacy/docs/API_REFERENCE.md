# 📡 API Reference

Complete documentation for all API endpoints in the Employee Hours Tracker application.

## 🔐 Authentication

All endpoints (except `/api/auth/*` and `/api/setup`) require authentication via NextAuth session cookie.

### Session Required

Most endpoints use the `requireAuth()` middleware from `lib/api-middleware.ts`:
- Returns `401 Unauthorized` if no valid session
- Injects `session` object with `user.id` and `user.role`

### Admin Required

Admin-only endpoints use the `requireAdmin()` middleware:
- Returns `401 Unauthorized` if no valid session
- Returns `403 Forbidden` if user role is not `ADMIN`

---

## 📚 Table of Contents

- [Authentication Endpoints](#authentication-endpoints)
- [User Endpoints](#user-endpoints)
- [Time Entry Endpoints](#time-entry-endpoints)
- [Leave Request Endpoints](#leave-request-endpoints)
- [Admin Endpoints](#admin-endpoints)
- [System Endpoints](#system-endpoints)

---

## 🔑 Authentication Endpoints

### POST `/api/auth/callback/credentials`

**NextAuth credential login endpoint.**

**Request Body:**
```json
{
  "email": "user@example.com",
  "password": "Password123!"
}
```

**Response:**
- `200 OK` - Sets session cookie
- `401 Unauthorized` - Invalid credentials

---

### POST `/api/auth/forgot-password`

**Request password reset email.**

**Request Body:**
```json
{
  "email": "user@example.com"
}
```

**Response:**
```json
{
  "message": "If that email exists, a reset link has been sent"
}
```

**Note:** Always returns success to prevent email enumeration.

---

### POST `/api/auth/reset-password`

**Complete password reset with token.**

**Request Body:**
```json
{
  "token": "reset-token-from-email",
  "password": "NewPassword123!"
}
```

**Response:**
- `200 OK` - Password updated successfully
- `400 Bad Request` - Invalid or expired token
- `422 Unprocessable Entity` - Validation error

---

### GET `/api/auth/signout`

**Sign out and clear session.**

**Response:**
- Redirects to `/`

---

## 👤 User Endpoints

### GET `/api/users/me`

**Get current user profile.**

**Auth:** Session required

**Response:**
```json
{
  "id": "user-id",
  "name": "John Doe",
  "email": "john@example.com",
  "role": "EMPLOYEE",
  "hasPermesso104": false,
  "hasPaternityLeave": false
}
```

---

### GET `/api/users/me/schedule`

**Get current user's working schedule.**

**Auth:** Session required

**Query Parameters:**
- None

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

### GET `/api/users`

**List all users (Admin only).**

**Auth:** Admin required

**Response:**
```json
{
  "users": [
    {
      "id": "user-id",
      "name": "John Doe",
      "email": "john@example.com",
      "role": "EMPLOYEE",
      "hasPermesso104": false,
      "hasPaternityLeave": false
    }
  ]
}
```

---

### POST `/api/users`

**Create a new user (Admin only).**

**Auth:** Admin required

**Request Body:**
```json
{
  "name": "Jane Smith",
  "email": "jane@example.com",
  "role": "EMPLOYEE",
  "hasPermesso104": false,
  "hasPaternityLeave": false
}
```

**Response:**
```json
{
  "id": "new-user-id",
  "name": "Jane Smith",
  "email": "jane@example.com",
  "temporaryPassword": "GeneratedPass123!"
}
```

**Note:** Sends welcome email with temporary password if email is configured.

---

### PUT `/api/users/[id]`

**Update user details (Admin only).**

**Auth:** Admin required

**Request Body:**
```json
{
  "name": "Updated Name",
  "email": "newemail@example.com",
  "role": "ADMIN",
  "hasPermesso104": true,
  "hasPaternityLeave": false
}
```

**Response:**
- `200 OK` - User updated
- `404 Not Found` - User doesn't exist

---

### DELETE `/api/users/[id]`

**Delete user (Admin only).**

**Auth:** Admin required

**Response:**
- `200 OK` - User deleted
- `404 Not Found` - User doesn't exist

---

### POST `/api/users/[id]/reset-password`

**Reset user password (Admin only).**

**Auth:** Admin required

**Response:**
```json
{
  "message": "Password reset email sent",
  "temporaryPassword": "NewPass123!" // Only in dev mode
}
```

---

## ⏰ Time Entry Endpoints

### GET `/api/hours`

**Get time entries for a specific month.**

**Auth:** Session required

**Query Parameters:**
- `month` (required): Format `YYYY-MM` (e.g., `2026-02`)
- `userId` (optional, admin only): User ID to query

**Response:**
```json
{
  "entries": [
    {
      "id": "entry-id",
      "workDate": "2026-02-12",
      "hoursWorked": 8.0,
      "overtimeHours": 0.0,
      "vacationHours": 0.0,
      "sicknessHours": 0.0,
      "permessoHours": 0.0,
      "permesso104Hours": 0.0,
      "paternityHours": 0.0,
      "morningStart": "08:00",
      "morningEnd": "12:00",
      "afternoonStart": "13:00",
      "afternoonEnd": "17:00",
      "notes": "Regular workday",
      "medicalCertificate": null
    }
  ]
}
```

---

### POST `/api/hours`

**Create or update a time entry.**

**Auth:** Session required

**Request Body:**
```json
{
  "workDate": "2026-02-12",
  "hoursWorked": 8.0,
  "overtimeHours": 0.0,
  "vacationHours": 0.0,
  "sicknessHours": 0.0,
  "permessoHours": 0.0,
  "permesso104Hours": 0.0,
  "paternityHours": 0.0,
  "morningStart": "08:00",
  "morningEnd": "12:00",
  "afternoonStart": "13:00",
  "afternoonEnd": "17:00",
  "notes": "Optional notes",
  "medicalCertificate": "uploads/cert-123.pdf"
}
```

**Response:**
- `200 OK` - Entry updated
- `201 Created` - New entry created

**Notes:**
- Employees can only create entries for their own account
- Employees cannot create future entries or entries on holidays (unless configured)

---

### DELETE `/api/hours/[id]`

**Delete a time entry.**

**Auth:** Session required

**Response:**
- `200 OK` - Entry deleted
- `403 Forbidden` - Not authorized
- `404 Not Found` - Entry doesn't exist

---

## 🏖️ Leave Request Endpoints

### GET `/api/requests`

**Get leave requests.**

**Auth:** Session required

**Query Parameters:**
- `status` (optional): `PENDING`, `APPROVED`, `REJECTED`
- `userId` (optional, admin only): Filter by user

**Response:**
```json
{
  "requests": [
    {
      "id": "request-id",
      "userId": "user-id",
      "userName": "John Doe",
      "leaveType": "VACATION",
      "startDate": "2026-02-15",
      "endDate": "2026-02-20",
      "status": "PENDING",
      "notes": "Family vacation",
      "createdAt": "2026-02-12T10:00:00Z"
    }
  ]
}
```

---

### POST `/api/requests`

**Create a leave request.**

**Auth:** Session required

**Request Body:**
```json
{
  "leaveType": "VACATION",
  "startDate": "2026-02-15",
  "endDate": "2026-02-20",
  "notes": "Family vacation"
}
```

**Leave Types:**
- `VACATION` - Ferie
- `SICKNESS` - Malattia
- `PERMISSION` - Permesso
- `PERMESSO_104` - Permesso 104
- `PATERNITY` - Congedo di paternità

**Response:**
- `201 Created` - Request submitted
- `400 Bad Request` - Invalid dates or type

---

### PUT `/api/requests/[id]`

**Update leave request status (Admin only).**

**Auth:** Admin required

**Request Body:**
```json
{
  "status": "APPROVED",
  "adminNotes": "Approved for dates requested"
}
```

**Response:**
- `200 OK` - Status updated
- `404 Not Found` - Request doesn't exist

**Side Effects:**
- If approved and Google Calendar is configured, creates calendar event
- Sends email notification to employee

---

### DELETE `/api/requests/[id]`

**Delete own leave request.**

**Auth:** Session required

**Response:**
- `200 OK` - Request deleted
- `403 Forbidden` - Not your request or already processed

---

## 👨‍💼 Admin Endpoints

### GET `/api/admin/stats`

**Get dashboard statistics.**

**Auth:** Admin required

**Query Parameters:**
- `month` (required): Format `YYYY-MM`

**Response:**
```json
{
  "totalHours": 1280.5,
  "totalOvertime": 45.0,
  "totalVacation": 80.0,
  "totalSickness": 16.0,
  "activeEmployees": 15,
  "pendingRequests": 3,
  "topPerformers": [
    {
      "userName": "John Doe",
      "totalHours": 168.0
    }
  ]
}
```

---

### GET `/api/admin/users/[id]/schedule`

**Get user's working schedule (Admin only).**

**Auth:** Admin required

**Response:**
```json
{
  "schedules": [...]
}
```

---

### POST `/api/admin/users/[id]/schedule`

**Update user's working schedule (Admin only).**

**Auth:** Admin required

**Request Body:**
```json
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

**Response:**
- `200 OK` - Schedule updated

---

## 🛠️ System Endpoints

### GET `/api/health`

**Health check endpoint.**

**Auth:** None

**Response:**
```json
{
  "status": "ok",
  "timestamp": "2026-02-12T10:00:00Z",
  "database": "connected"
}
```

---

### GET `/api/export-excel`

**Export time entries to Excel.**

**Auth:** Session required (Admin recommended)

**Query Parameters:**
- `month` (required): Format `YYYY-MM`
- `userId` (optional): Filter by user

**Response:**
- `200 OK` - Excel file download
- `Content-Type: application/vnd.openxmlformats-officedocument.spreadsheetml.sheet`

---

### POST `/api/uploads`

**Upload medical certificate.**

**Auth:** Session required

**Request:**
- `Content-Type: multipart/form-data`
- Field: `file` (PDF or image)

**Response:**
```json
{
  "filePath": "uploads/cert-1707737000000-document.pdf"
}
```

**Note:** Files stored in `public/uploads/` directory.

---

## 🔄 Setup Endpoint

### GET `/api/setup`

**Check if initial setup is complete.**

**Auth:** None

**Response:**
```json
{
  "isSetupComplete": false
}
```

---

### POST `/api/setup`

**Complete initial admin setup.**

**Auth:** None (Only works if no users exist)

**Request Body:**
```json
{
  "name": "Admin User",
  "email": "admin@example.com",
  "password": "SecurePassword123!"
}
```

**Response:**
- `201 Created` - Admin user created
- `400 Bad Request` - Setup already complete

---

## 📋 Error Responses

All endpoints use standardized error format from `lib/api-responses.ts`:

```json
{
  "error": "Error message",
  "code": "ERROR_CODE",
  "details": {} // Optional additional info
}
```

### Common Error Codes

| Status | Code | Description |
|--------|------|-------------|
| `400` | `VALIDATION_ERROR` | Invalid request data |
| `401` | `UNAUTHORIZED` | No valid session |
| `403` | `FORBIDDEN` | Insufficient permissions |
| `404` | `NOT_FOUND` | Resource doesn't exist |
| `409` | `CONFLICT` | Duplicate entry |
| `422` | `UNPROCESSABLE_ENTITY` | Semantic validation error |
| `500` | `INTERNAL_ERROR` | Server error |

---

## 🧪 Testing

Use tools like **Postman**, **Insomnia**, or **curl** to test endpoints.

### Example: Get Time Entries

```bash
curl -X GET 'http://localhost:3000/api/hours?month=2026-02' \
  -H 'Cookie: next-auth.session-token=YOUR_SESSION_TOKEN'
```

### Example: Create Leave Request

```bash
curl -X POST 'http://localhost:3000/api/requests' \
  -H 'Content-Type: application/json' \
  -H 'Cookie: next-auth.session-token=YOUR_SESSION_TOKEN' \
  -d '{
    "leaveType": "VACATION",
    "startDate": "2026-03-01",
    "endDate": "2026-03-07",
    "notes": "Spring break"
  }'
```

---

**Last Updated:** February 12, 2026  
**API Version:** v0.7.0+
