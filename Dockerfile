# syntax=docker/dockerfile:1

# ── Production dependencies ────────────────────────────────────────────────
# Only three packages survive bundling: postgres, exceljs and nodemailer.
# Everything else — React, the router, Tailwind — is a build-time concern and
# lives in devDependencies, so it never reaches the runtime image. Nothing
# compiles any more: the SQLite addon was the only reason this stage needed a
# C toolchain.
FROM node:22-bookworm-slim AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --omit=dev

# ── Build ──────────────────────────────────────────────────────────────────
FROM node:22-bookworm-slim AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
RUN npm run build

# ── Runtime ────────────────────────────────────────────────────────────────
FROM node:22-bookworm-slim AS runner
WORKDIR /app
ENV NODE_ENV=production \
    PORT=3000

# The one thing that isn't pure JavaScript: whole-database backups shell out to
# the real `pg_dump`/`pg_restore` rather than reimplementing either. Installed
# at major version 17 to match `postgres:17-alpine` in docker-compose.yml —
# pg_dump does not officially support dumping from a server newer than itself,
# so this has to track whatever version the database service runs, not
# Debian's own default.
RUN apt-get update \
    && apt-get install -y --no-install-recommends curl ca-certificates gnupg postgresql-common \
    && /usr/share/postgresql-common/pgdg/apt.postgresql.org.sh -y \
    && apt-get install -y --no-install-recommends postgresql-client-17 \
    && apt-get purge -y --auto-remove curl gnupg \
    && rm -rf /var/lib/apt/lists/*

COPY --from=deps  /app/node_modules ./node_modules
COPY --from=build /app/dist         ./dist
COPY package.json ./

# All state lives in Postgres and, for backups, in object storage; the
# container itself is disposable.
USER node

EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:'+(process.env.PORT||3000)+'/api/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

CMD ["node", "dist/server/index.js"]
