# 💾 Automated Backup System

Complete guide to the SQLite backup and restore system in the Employee Hours Tracker.

## 📋 Overview

The application includes a built-in automated backup system that:
- **Schedules** regular database backups via cron
- **Stores** timestamped SQLite database files
- **Cleans up** old backups automatically
- **Sends email alerts** on success or failure
- **Provides** manual backup/restore tools

---

## ✨ Features

- ⏰ **Automated Scheduling**: Cron-based backup execution
- 📧 **Email Notifications**: Success/failure alerts to admins
- 🗃️ **Retention Policy**: Configurable retention (default: 30 days, min 7 backups)
- 🔄 **One-Click Restore**: Simple restore from backup file
- 📊 **Health Monitoring**: Check backup status via logs
- 🐳 **Docker Compatible**: Works seamlessly in containerized environments

---

## 🏗️ Architecture

### Components

1. **`instrumentation.ts`** - Next.js instrumentation file
   - Initializes cron scheduler on app start
   - Runs in server-side only (`node` runtime)

2. **`lib/db-backup.ts`** - Backup logic
   - `performBackup()` - Runs `VACUUM INTO` and saves the snapshot
   - `uploadBackupToS3()` - Optional off-site copy
   - `sendBackupEmail()` - Sends status emails

3. **`backups/database/`** - Storage directory
   - Timestamped SQLite files (e.g., `backup-2026-02-12T19-45-51-280Z.db`)
   - Auto-created if doesn't exist

4. **`node-cron`** - Cron scheduler
   - Lightweight task scheduler for Node.js
   - Runs backup job at configured intervals

---

## 🔧 Configuration

### Environment Variables

Set in `.env`:

```env
# Backup Cron Schedule (default: daily at 2 AM)
BACKUP_CRON_SCHEDULE="0 2 * * *"

# Database file (required)
DATABASE_URL="file:/app/data/app.db"

# Email Alerts (optional but recommended)
EMAIL_HOST="smtp.gmail.com"
EMAIL_PORT="587"
EMAIL_USER="your-email@gmail.com"
EMAIL_PASSWORD="your-app-password"
EMAIL_FROM="noreply@yourcompany.com"
```

### Cron Schedule Examples

| Schedule | Description |
|----------|-------------|
| `0 2 * * *` | Daily at 2:00 AM |
| `0 */6 * * *` | Every 6 hours |
| `0 2 * * 0` | Weekly on Sunday at 2:00 AM |
| `0 2 1 * *` | Monthly on the 1st at 2:00 AM |
| `0 2 * * 1-5` | Weekdays only at 2:00 AM |

**Syntax:** `minute hour day month day-of-week`

---

## 🚀 How It Works

### Automatic Backup Flow

```mermaid
graph TD
    A[App Starts] --> B[instrumentation.ts loaded]
    B --> C[Cron scheduler initialized]
    C --> D{Cron schedule reached?}
    D -->|Yes| E[createBackup called]
    E --> F{Backup successful?}
    F -->|Yes| G[Save SQL file]
    G --> H[cleanupOldBackups]
    H --> I[Send success email]
    F -->|No| J[Send failure email]
    D -->|No| D
```

### Step-by-Step Process

1. **App Initialization**
   - Next.js calls `instrumentation.ts` on server start
   - Cron job is registered with schedule from `BACKUP_CRON_SCHEDULE`

2. **Scheduled Execution**
   - At the configured time, cron triggers `createBackup()`

3. **Backup Creation**
   ```ts
   // lib/db-backup.ts
   export async function performBackup() {
     const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
     const filename = `backup-${timestamp}.db`;

     // Consistent snapshot of the live database, no external tooling
     await prisma.$executeRawUnsafe(`VACUUM INTO '${backupPath}'`);

     // Optional off-site copy
     if (isS3Configured()) await uploadBackupToS3(backupPath, filename);
   }
   ```

4. **`VACUUM INTO` Execution**
   - Writes a consistent, defragmented copy of the database while the app keeps
     serving requests — no downtime and no database client binaries in the image
   - Outputs to `backups/database/backup-[timestamp].db`
   - The result is a normal SQLite database: open it with any SQLite tool

5. **Cleanup**
   - List all backup files
   - Delete files older than 30 days (keeping minimum 7)

6. **Email Notification**
   - Send success or failure email to admin

---

## 📂 File Structure

### Backup Storage

```
employee-app/
└── backups/
    └── database/
        ├── backup-2026-02-10T02-00-00-000Z.db
        ├── backup-2026-02-11T02-00-00-000Z.db
        └── backup-2026-02-12T02-00-00-000Z.db
```

### Filename Format

**Pattern:** `backup-[ISO8601-timestamp].db`

**Example:** `backup-2026-02-12T19-45-51-280Z.db`

**Components:**
- `2026-02-12` - Date (YYYY-MM-DD)
- `T` - Time separator
- `19-45-51-280` - Time (HH-MM-SS-mmm)
- `Z` - UTC timezone

---

## 🛠️ Manual Operations

### Create Manual Backup

**Via the UI:** Dashboard → Gestione Server → **Crea Backup**.

**Via the API** (admin session required):
```bash
curl -X POST http://localhost:3000/api/admin/backups
```

**Directly with the sqlite3 CLI** (works on a running database thanks to WAL):
```bash
docker compose exec app sqlite3 /app/data/app.db \
  "VACUUM INTO '/app/backups/database/backup-manual.db'"
```

---

### Restore from Backup

⚠️ **WARNING:** This will **overwrite your entire database**. Make a backup first!

**Via the UI (recommended):** Dashboard → Gestione Server → **Ripristina Database**,
then upload a `.db` backup. The endpoint validates the SQLite header, swaps the
file atomically, drops the stale `-wal` / `-shm` sidecars and exits the process;
`restart: unless-stopped` brings the container back on the restored database.

**Manual restore (app stopped):**
```bash
# 1. Stop the application
npm run docker:down

# 2. Replace the database file on the volume, sidecars included
docker run --rm -v app-presenze_app_data:/data -v "$PWD:/backup" alpine sh -c \
  "cp /backup/backup-2026-02-12T19-45-51-280Z.db /data/app.db && rm -f /data/app.db-wal /data/app.db-shm"

# 3. Restart
npm run docker:up

# 4. Verify
curl http://localhost:3000/api/health
```

---

### List Backups

```bash
ls -lh backups/database/
```

**Output:**
```
-rw-r--r-- 1 user user 1.2M Feb 10 02:00 backup-2026-02-10T02-00-00-000Z.db
-rw-r--r-- 1 user user 1.3M Feb 11 02:00 backup-2026-02-11T02-00-00-000Z.db
-rw-r--r-- 1 user user 1.4M Feb 12 02:00 backup-2026-02-12T02-00-00-000Z.db
```

---

## 📧 Email Notifications

### Success Email

**Subject:** Database Backup Successful

**Body:**
```
Hello,

The automated database backup has completed successfully.

Details:
- Time: 2026-02-12 02:00:00 UTC
- File: backup-2026-02-12T02-00-00-000Z.db
- Size: 1.4 MB
- Location: /app/backups/database/

The backup is stored securely and can be used for disaster recovery.

Best regards,
Automated Backup System
```

---

### Failure Email

**Subject:** Database Backup Failed

**Body:**
```
ALERT: Database backup has FAILED.

Details:
- Time: 2026-02-12 02:00:00 UTC
- Error: Connection timeout to database
- Action Required: Check database connection and logs

Please investigate immediately to ensure data protection.

Best regards,
Automated Backup System
```

**Customization:** Edit templates in `lib/email-templates/backup.ts`

---

## 🐳 Docker Integration

### Volume Mapping

Ensure `docker-compose.yml` includes backup volume:

```yaml
services:
  app:
    volumes:
      - app_data:/app/data      # The SQLite database itself
      - ./backups:/app/backups  # Persist backups on host
```

**Benefits:**
- Backups survive container restarts
- Accessible from host machine
- Easy to copy to remote storage

---

### Backup from Running Container

```bash
# Create a backup inside the container
docker compose exec app sqlite3 /app/data/app.db \
  "VACUUM INTO '/app/backups/database/backup-manual.db'"

# Copy the backup to the host
docker compose cp app:/app/backups/database/backup-manual.db ./local-backup.db
```

---

## 📊 Monitoring & Health Checks

### Check Last Backup

```bash
# List most recent backup
ls -lt backups/database/ | head -n 2

# Show age of last backup
stat -c %y backups/database/$(ls -t backups/database/ | head -1)
```

---

### Application Logs

View backup execution logs:

```bash
# Via Docker
docker compose logs app | grep -i backup

# Output example:
# [2026-02-12T02:00:00.000Z] Starting automated backup...
# [2026-02-12T02:00:05.123Z] Backup created: backup-2026-02-12T02-00-00-000Z.db
# [2026-02-12T02:00:05.456Z] Cleanup removed 3 old backups
# [2026-02-12T02:00:06.789Z] Backup email sent successfully
```

---

### Health Endpoint

**Future Feature:** `/api/health/backup`

```json
{
  "lastBackup": "2026-02-12T02:00:00.000Z",
  "lastBackupSize": "1.4 MB",
  "backupCount": 30,
  "oldestBackup": "2026-01-13T02:00:00.000Z",
  "nextScheduled": "2026-02-13T02:00:00.000Z"
}
```

---

## 🔒 Security Best Practices

### 1. Protect Backup Files

```bash
# Set restrictive permissions
chmod 600 backups/database/*.db

# Restrict directory access
chmod 700 backups/database/
```

---

### 2. Encrypt Backups (Optional)

```bash
# Encrypt backup
gpg --symmetric --cipher-algo AES256 backup.db

# Decrypt for restore
gpg --decrypt backup.db.gpg > backup.db
```

---

### 3. Off-Site Storage

**Sync to cloud storage:**

```bash
# AWS S3
aws s3 sync backups/database/ s3://your-bucket/backups/

# Google Cloud
gsutil rsync -r backups/database/ gs://your-bucket/backups/

# rsync to remote server
rsync -avz backups/database/ user@remote:/backups/
```

**Automate with cron:**
```bash
# Daily sync to S3 at 3 AM
0 3 * * * aws s3 sync /path/to/backups/database/ s3://bucket/backups/
```

---

## 🚨 Disaster Recovery

### Recovery Scenarios

#### Scenario 1: Accidental Data Deletion

1. Identify when deletion occurred
2. Select backup from before incident
3. Restore backup to staging environment
4. Export only needed data
5. Import to production

---

#### Scenario 2: Database Corruption

1. Stop application immediately
2. Restore latest backup
3. Verify data integrity
4. Restart application
5. Monitor for issues

---

#### Scenario 3: Complete Server Failure

1. Deploy new server with Docker
2. Copy backup files to new server
3. Update `.env` with new database credentials
4. Restore backup
5. Start application

---

### Recovery Time Objective (RTO)

**Expected RTO:** ~15 minutes for full restore

**Factors:**
- Backup file size
- Database server performance
- Network speed (if remote restore)

---

## 🔧 Troubleshooting

### Backup Fails with "Permission Denied"

**Solution:**
```bash
# Fix directory permissions
chmod 755 backups/database/

# Fix ownership
chown -R $(whoami):$(whoami) backups/
```

---

### "cannot VACUUM INTO an existing file"

`VACUUM INTO` refuses to overwrite. Backups are named with a millisecond
timestamp so this only happens if a file with the same name already exists —
delete or rename it and run the backup again.

---

### "attempt to write a readonly database"

The app user cannot write to the database directory. The WAL journal needs to
create `app.db-wal` and `app.db-shm` *next to* the database, so the directory
itself must be writable, not just the file:

```bash
docker compose exec app ls -la /app/data
docker compose exec -u root app chown -R nextjs:nodejs /app/data
```

---

### Email Not Sent

**Check:**
1. Email config in `.env`
2. SMTP credentials are correct
3. Application logs: `docker compose logs app | grep email`

---

### Backup Too Large

`VACUUM INTO` already produces a defragmented copy, so a backup is usually
smaller than the live database.

**Solutions:**
1. **Compress backups:**
   ```bash
   gzip -k backups/database/backup-*.db
   ```

2. **Increase retention cleanup frequency**

---

## 📚 Related Documentation

- **[Configuration](CONFIGURATION.md)** - Email and environment setup
- **[Deployment](DEPLOYMENT.md)** - Production deployment with backups
- **[API Reference](API_REFERENCE.md)** - System health endpoints

---

**Last Updated:** February 12, 2026  
**Version:** v0.7.0+
