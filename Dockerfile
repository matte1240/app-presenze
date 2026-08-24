# syntax=docker/dockerfile:1

# ── Production dependencies ────────────────────────────────────────────────
# Only three packages survive bundling: better-sqlite3 (a native addon),
# exceljs and nodemailer (dynamic requires). Everything else — React, the
# router, Tailwind — is a build-time concern and lives in devDependencies, so
# it never reaches the runtime image.
FROM node:22-bookworm-slim AS deps
WORKDIR /app
RUN apt-get update && apt-get install -y --no-install-recommends python3 make g++ \
    && rm -rf /var/lib/apt/lists/*
COPY package.json package-lock.json ./
RUN npm ci --omit=dev

# ── Build ──────────────────────────────────────────────────────────────────
FROM node:22-bookworm-slim AS build
WORKDIR /app
RUN apt-get update && apt-get install -y --no-install-recommends python3 make g++ \
    && rm -rf /var/lib/apt/lists/*
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
RUN npm run build

# ── Runtime ────────────────────────────────────────────────────────────────
FROM node:22-bookworm-slim AS runner
WORKDIR /app
ENV NODE_ENV=production \
    PORT=3000 \
    DATABASE_FILE=/app/data/app.db \
    BACKUP_DIR=/app/backups

COPY --from=deps  /app/node_modules ./node_modules
COPY --from=build /app/dist         ./dist
COPY package.json ./

# The database and the backups are the only writable state.
RUN mkdir -p /app/data /app/backups && chown -R node:node /app/data /app/backups
USER node
VOLUME ["/app/data", "/app/backups"]

EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:'+(process.env.PORT||3000)+'/api/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

CMD ["node", "dist/server/index.js"]
