# ⚙️ Configuration Guide

This guide covers the configuration of various system components.

## 📋 Table of Contents
- [Environment Variables](#-environment-variables)
- [Email Setup](#-email-setup-gmail)
- [Google Calendar Integration](#-google-calendar-integration)
- [Automated Backup System](#-automated-backup-system)
- [GitHub Secrets](#-github-secrets)
- [Inactivity Timeout](#️-inactivity-timeout)
- [Backup Strategy](#-backup-strategy)

---

## 🔧 Environment Variables

The application is configured via `.env` file. Two example files are provided:

- **`.env.example`** - For development with Docker
- **`.env.production.example`** - For production deployments

### Key Variables

| Variable | Description | Required | Default |
|----------|-------------|----------|---------|
| `DATABASE_URL` | PostgreSQL connection string | ✅ Yes | - |
| `NEXTAUTH_SECRET` | Secret for session encryption | ✅ Yes | Generate with `openssl rand -base64 32` |
| `NEXTAUTH_URL` | URL of the application | ✅ Yes | `http://localhost:3000` |
| `NODE_ENV` | Environment mode | ✅ Yes | `development` or `production` |
| `EMAIL_HOST` | SMTP server hostname | ❌ No | `smtp.gmail.com` |
| `EMAIL_PORT` | SMTP server port | ❌ No | `587` |
| `EMAIL_USER` | Email account username | ❌ No | - |
| `EMAIL_PASSWORD` | Email account password | ❌ No | - |
| `EMAIL_FROM` | From email address | ❌ No | - |
| `GOOGLE_CLIENT_EMAIL` | Service account email | ❌ No | - |
| `GOOGLE_PRIVATE_KEY` | Service account private key | ❌ No | - |
| `GOOGLE_CALENDAR_ID` | Target calendar ID | ❌ No | - |
| `BACKUP_CRON_SCHEDULE` | Cron expression for backups | ❌ No | `0 2 * * *` (2 AM daily) |

---

## 📧 Email Setup (Gmail)

The application uses Nodemailer with Gmail SMTP for sending emails (welcome, password reset, leave request notifications).

### Prerequisites
- Gmail account with 2FA enabled
- App Password generated

### Configuration Steps

1. **Generate an App Password**
   - Go to your Google Account: [Security > 2-Step Verification > App passwords](https://myaccount.google.com/apppasswords)
   - Select "Mail" and your device
   - Copy the generated 16-character password

2. **Update `.env` file**:
   ```env
   EMAIL_HOST=smtp.gmail.com
   EMAIL_PORT=587
   EMAIL_USER=your-email@gmail.com
   EMAIL_PASSWORD=your-16-char-app-password
   EMAIL_FROM=noreply@yourcompany.com
   ```

### Email Templates

The application includes pre-built email templates in `lib/email-templates/`:

- **`welcome-setup.ts`** - Sent to new users with temporary credentials
- **`password-reset-link.ts`** - Password reset emails with secure token links
- **`backup.ts`** - Database backup status notifications (success/failure)

All templates support HTML formatting with professional styling.

### Testing Emails

Test email functionality:
```bash
# In the app, use the password reset feature
# Or check logs when creating a new user
```

---

## 🗓️ Google Calendar Integration

Sync approved leave requests to a shared Google Calendar automatically.

### Prerequisites

1. **Google Cloud Project**
   - Create a project at [Google Cloud Console](https://console.cloud.google.com)
   - Enable Google Calendar API

2. **Service Account**
   - Navigate to "IAM & Admin > Service Accounts"
   - Create a service account
   - Generate a JSON key file

3. **Share Calendar**
   - Open Google Calendar
   - Create or select a calendar
   - Share it with the service account email (with "Make changes to events" permission)

### Configuration

1. **Extract credentials from the JSON key file**:
   - `client_email` → `GOOGLE_CLIENT_EMAIL`
   - `private_key` → `GOOGLE_PRIVATE_KEY`
   - Calendar ID (from calendar settings) → `GOOGLE_CALENDAR_ID`

2. **Update `.env`**:
   ```env
   GOOGLE_CLIENT_EMAIL="your-service-account@project-id.iam.gserviceaccount.com"
   GOOGLE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\nYourPrivateKeyHere\n-----END PRIVATE KEY-----\n"
   GOOGLE_CALENDAR_ID="your-calendar-id@group.calendar.google.com"
   ```

   **Important**: Keep the `\n` line breaks in the private key.

### How It Works

- When an admin **approves** a leave request, an event is created in Google Calendar
- Event includes: employee name, leave type, date range, and status
- If the calendar integration is not configured, requests work normally without sync

### Troubleshooting

- **401 Unauthorized**: Verify service account has calendar access
- **Key Format Error**: Ensure `GOOGLE_PRIVATE_KEY` includes `\n` characters
- **Calendar Not Found**: Double-check `GOOGLE_CALENDAR_ID`

---

## 💾 Automated Backup System

The application includes a built-in automated PostgreSQL backup system with email notifications.

### How It Works

- **Cron Scheduler**: Runs via Node.js `node-cron` in `instrumentation.ts` (Next.js instrumentation)
- **Backup Script**: `lib/db-backup.ts` handles backup creation and cleanup
- **Storage**: Backups saved to `/backups/database/` as timestamped SQL files
- **Email Alerts**: Notifications sent on success or failure

### Configuration

1. **Set Cron Schedule** in `.env`:
   ```env
   BACKUP_CRON_SCHEDULE="0 2 * * *"  # Daily at 2:00 AM
   ```

   Common schedules:
   - `0 2 * * *` - Daily at 2:00 AM
   - `0 2 * * 0` - Weekly on Sunday at 2:00 AM
   - `0 2 1 * *` - Monthly on the 1st at 2:00 AM

2. **Email Notifications**: Configure email settings (see [Email Setup](#-email-setup-gmail))

### Backup Retention

- **Default**: Last 30 days
- **Minimum**: 7 backups always kept
- **Cleanup**: Runs automatically after each backup

### Manual Operations

#### Create Backup
```bash
# From the host machine or within the app container
npm run backup:db
```

#### Restore Backup
```bash
npm run restore:db backups/database/backup-2026-02-12T19-45-51-280Z.sql
```

**⚠️ Warning**: This will overwrite the current database!

#### List Backups
```bash
ls -lh backups/database/
```

### Docker Volume Mapping

Ensure `docker-compose.yml` includes:
```yaml
volumes:
  - ./backups:/app/backups  # Persist backups on host
```

### Health Monitoring

Check backup system status:
```bash
# View application logs
docker compose logs app

# Check last backup
ls -lt backups/database/ | head -n 2
```

---

## 🔐 GitHub Secrets

For GitHub Actions (CI/CD), configure the following secrets in **Settings > Secrets and variables > Actions**:

### Email Secrets
- `EMAIL_HOST` - SMTP server (e.g., `smtp.gmail.com`)
- `EMAIL_PORT` - SMTP port (e.g., `587`)
- `EMAIL_USER` - Email account username
- `EMAIL_PASSWORD` - App password or SMTP password
- `EMAIL_FROM` - From email address

### Deployment Secrets (Staging)
- `STAGING_DATABASE_URL` - PostgreSQL connection string
- `STAGING_NEXTAUTH_SECRET` - Session encryption key
- `STAGING_NEXTAUTH_URL` - Application URL
- `STAGING_SSH_KEY` - Private SSH key for deployment
- `STAGING_USER` - SSH username
- `STAGING_IP` - Server IP address

### Deployment Secrets (Production)
- `PRODUCTION_DATABASE_URL`
- `PRODUCTION_NEXTAUTH_SECRET`
- `PRODUCTION_NEXTAUTH_URL`
- `PRODUCTION_SSH_KEY`
- `PRODUCTION_USER`
- `PRODUCTION_IP`

### Optional Secrets
- `GOOGLE_CLIENT_EMAIL` - For calendar integration
- `GOOGLE_PRIVATE_KEY` - Service account key
- `GOOGLE_CALENDAR_ID` - Target calendar

---

## ⏱️ Inactivity Timeout

The system enforces a **30-minute inactivity timeout** for enhanced security.

### How It Works

**Client-side Activity Tracking**:
- Custom hook `hooks/use-activity-tracker.ts` monitors user activity
- Tracks: mouse movement, keyboard input, scroll, and touch events
- Automatically extends session for active users
- Shows warning before logout when inactive

**Server-side Session Management**:
- NextAuth session `maxAge` set to 30 minutes in `lib/auth.ts`
- JWT token includes `lastActivity` timestamp
- Expired sessions redirect to login page

### Customization

To change the timeout duration:

1. **Update Server Session** in `lib/auth.ts`:
   ```typescript
   session: {
     strategy: "jwt",
     maxAge: 60 * 60, // 60 minutes in seconds
   }
   ```

2. **Update Client Tracker** in `hooks/use-activity-tracker.ts`:
   ```typescript
   const SIXTY_MINUTES = 60 * 60 * 1000; // 60 minutes in milliseconds
   const WARNING_TIME = 55 * 60 * 1000; // Warning at 55 minutes
   ```

3. **Adjust Warning Threshold**: Set `WARNING_TIME` to trigger alert before timeout (e.g., 5 minutes before)

### Disable Timeout (Not Recommended)

To disable for development:
```typescript
// In lib/auth.ts
session: {
  strategy: "jwt",
  maxAge: 30 * 24 * 60 * 60, // 30 days
}

// In use-activity-tracker.ts
// Comment out the useEffect that handles logout
```

---

## 📚 Additional Resources

- **[PWA Configuration](PWA.md)** - Progressive Web App setup
- **[Performance Optimizations](PERFORMANCE_OPTIMIZATIONS.md)** - Caching and speed improvements
- **[Deployment Guide](DEPLOYMENT.md)** - Production deployment steps
- **[Leave Requests](LEAVE_REQUESTS.md)** - Leave management workflow
- **[Working Schedules](WORKING_SCHEDULES.md)** - User schedule configuration
- **[Backup System](BACKUP_SYSTEM.md)** - Detailed backup procedures
