# ========================================
# Multi-stage Dockerfile for Next.js 16
# ========================================

# Stage 1: Production-only dependencies (no devDependencies)
FROM node:25-alpine AS prod-deps
WORKDIR /app

COPY package.json package-lock.json* ./
COPY prisma ./prisma
COPY prisma.config.ts ./

# Install only production dependencies
RUN npm ci --omit=dev && npm cache clean --force

# Stage 2: Builder
FROM node:25-alpine AS builder
WORKDIR /app

COPY package.json package-lock.json* ./
COPY prisma ./prisma
COPY prisma.config.ts ./

# Install ALL dependencies (needed to compile)
RUN npm install && npm cache clean --force

COPY . .

# Generate Prisma Client (Prisma is already installed)
RUN npx prisma generate

# Build Next.js application
# This will create an optimized production build
ENV NEXT_TELEMETRY_DISABLED=1
RUN npm run build

# Stage 4: Runner
FROM node:25-alpine AS runner
WORKDIR /app

# Install PostgreSQL client tools for backup/restore
RUN apk add --no-cache postgresql16-client openssl libc6-compat su-exec

# Set to production environment
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

# Create a non-root user
RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

# Copy entrypoint script (as root before switching users)
COPY docker-entrypoint.sh /usr/local/bin/docker-entrypoint.sh
RUN chmod +x /usr/local/bin/docker-entrypoint.sh

# Copy necessary files from builder
COPY --from=builder --chown=nextjs:nodejs /app/public ./public
COPY --from=builder /app/package.json ./package.json

# Copy production-only dependencies (no devDependencies)
COPY --from=prod-deps --chown=nextjs:nodejs /app/node_modules ./node_modules

# Copy built application
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

# Copy Prisma schema, migrations, and config
COPY --from=builder --chown=nextjs:nodejs /app/prisma ./prisma
COPY --from=builder --chown=nextjs:nodejs /app/prisma.config.ts ./prisma.config.ts

# Create directories for logs and backups
RUN mkdir -p /app/logs /app/backups/database && \
    chown -R nextjs:nodejs /app/logs /app/backups

# Entrypoint runs as root to fix volume permissions, then drops to nextjs
# USER nextjs  -- handled by entrypoint via su-exec

# Expose port
EXPOSE 3000

# Set hostname and port for Next.js standalone server
ENV HOSTNAME=0.0.0.0
ENV PORT=3000

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
    CMD node -e "import('http').then(h => h.default.get('http://localhost:3000/api/auth/session', r => {process.exit(r.statusCode === 200 ? 0 : 1)}))"

# Set entrypoint and default command
ENTRYPOINT ["docker-entrypoint.sh"]
CMD ["node", "server.js"]
