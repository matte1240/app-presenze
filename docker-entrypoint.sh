#!/bin/sh
set -e

echo "🚀 Starting application entrypoint..."

# Fix ownership of mounted volumes (they may be created as root)
chown -R nextjs:nodejs /app/logs /app/backups /app/public/uploads 2>/dev/null || true

# Run Prisma migrations (as nextjs user)
echo "🔄 Running Prisma migrations..."
LOG_FILE=$(mktemp)
if ! npx prisma migrate deploy > "$LOG_FILE" 2>&1; then
    cat "$LOG_FILE"
    echo "⚠️ Prisma migrations failed. Checking for failed migrations to resolve..."
    
    # Extract migration name from error log
    FAILED_MIGRATION=$(awk '/migration started at.*failed/ {print $2}' "$LOG_FILE" | tr -d '`')
    
    if [ -n "$FAILED_MIGRATION" ]; then
        echo "🔧 Found failed migration: $FAILED_MIGRATION. Attempting to roll back and retry..."
        if npx prisma migrate resolve --rolled-back "$FAILED_MIGRATION"; then
            echo "✅ Rolled back $FAILED_MIGRATION. Retrying deployment..."
            if npx prisma migrate deploy; then
                echo "✅ Migrations applied successfully on retry."
            else
                echo "❌ ERROR: Retry failed!"
                rm "$LOG_FILE"
                exit 1
            fi
        else
            echo "❌ ERROR: Could not resolve migration $FAILED_MIGRATION"
            rm "$LOG_FILE"
            exit 1
        fi
    else
        echo "❌ ERROR: Could not identify failed migration from logs."
        rm "$LOG_FILE"
        exit 1
    fi
else
    cat "$LOG_FILE"
    echo "✅ Migrations applied successfully."
fi
rm "$LOG_FILE"

# Execute the main command passed to the entrypoint (drop to nextjs user)
echo "🚀 Starting application: $@"
exec su-exec nextjs "$@"
