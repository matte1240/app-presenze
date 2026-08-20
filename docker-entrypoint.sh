#!/bin/sh
set -e

echo "🚀 Starting application entrypoint..."

# Fix ownership of mounted volumes (they may be created as root).
# /app/data holds the SQLite database file and its -wal / -shm sidecars.
chown -R nextjs:nodejs /app/data /app/logs /app/backups /app/public/uploads 2>/dev/null || true

# Run Prisma migrations. On SQLite a migration is applied inside a transaction
# and rolls back on failure, so there is no half-applied state to resolve.
echo "🔄 Running Prisma migrations..."
if npx prisma migrate deploy; then
    echo "✅ Migrations applied successfully."
else
    echo "❌ ERROR: Prisma migrations failed."
    exit 1
fi

# Execute the main command passed to the entrypoint (drop to nextjs user)
echo "🚀 Starting application: $@"
exec su-exec nextjs "$@"
