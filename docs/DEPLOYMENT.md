# 🚀 Deployment & Release Guide

This guide covers the complete deployment lifecycle, from Docker setup to production releases.

## 📋 Table of Contents
- [Docker Setup](#docker-setup)
- [Deployment Workflow](#deployment-workflow)
- [Release Process](#release-process)

---

## 🐳 Docker Setup

The application is containerized using Docker with:
- **Next.js 16** (Production build)
- **PostgreSQL 16** (Database)
- **Multi-stage build** for optimized images
- **Health checks** & **Persistent volumes**

### Prerequisites
- Docker Engine 24.0+
- Docker Compose 2.0+
- `.env` file configured (see `.env.example`)

### Quick Start
```bash
# Full deployment using helper script
./docker-deploy.sh deploy

# Or using npm scripts
npm run docker:deploy
```

### Useful Commands
| Command | Description |
|---------|-------------|
| `npm run docker:logs` | View container logs |
| `npm run docker:restart` | Restart containers |
| `npm run docker:down` | Stop and remove containers |
| `docker compose ps` | Check container status |

---

## 🚀 Deployment Workflow

The project uses **GitHub Actions** for CI/CD with two environments:

### Architecture
```
┌─────────────────┐
│   GitHub Repo   │
│                 │
│   dev branch    │ ─────► Build Docker :dev
│                 │
│ staging branch  │ ─────► Build + Deploy → 🟡 Staging Server
│                 │
│   main branch   │ ─────► Build + Deploy → 🟢 Production Server
└─────────────────┘
```

### Environments
1.  **Staging**: Deployed from `staging` branch. Used for final testing.
2.  **Production**: Deployed from `main` branch. Live environment.

### GitHub Actions Workflows
- **docker-build.yml**: Builds Docker image on push to `dev`/`main`.
- **deploy-staging.yml**: Deploys to Staging server on push to `staging`.
- **deploy-production.yml**: Deploys to Production server on push to `main`.

### Server Requirements
- Docker & Docker Compose installed
- SSH access configured for GitHub Actions
- Secrets configured in GitHub Repository Settings (see [Configuration Guide](./CONFIGURATION.md))

---

## 📦 Release Process

Releases are automated via GitHub Actions and Semantic Versioning.

### Workflow
1.  **Develop** on `dev` branch.
2.  **Test** on `staging` branch (merge `dev` -> `staging`).
3.  **Deploy** to `main` (merge `staging` -> `main`).
4.  **Release** by tagging `main`.

### Creating a Release
Releases must be created from the `main` branch.

```bash
# 1. Checkout main and pull latest
git checkout main
git pull origin main

# 2. Create and push tag
git tag -a v1.0.0 -m "Release v1.0.0"
git push origin v1.0.0
```

**Automated Actions:**
- Builds multi-platform Docker image
- Pushes to GitHub Container Registry (`ghcr.io`)
- Creates GitHub Release with auto-generated changelog

---

## 🔧 Troubleshooting

### "Bad Gateway" on Port 3000

If you encounter a "Bad Gateway" error when deploying with Docker (e.g., on Dockploy or similar platforms):

**Cause:** The Next.js standalone server must bind to `0.0.0.0` (all network interfaces) instead of `localhost` to be accessible from outside the container.

**Solution:** This is already configured in the current Dockerfile:
- `HOSTNAME=0.0.0.0` environment variable is set
- `start-server.sh` wrapper script ensures proper binding
- Logs show the host and port during startup

**Verification:**
```bash
# Check container logs for startup messages
docker logs <container-name>

# You should see:
# 🚀 Starting Next.js server...
# 📍 Host: 0.0.0.0
# 🔌 Port: 3000
```

**Testing locally:**
```bash
# Build and run the container
docker build -t employee-app .
docker run -p 3000:3000 \
  -e DATABASE_URL="your-db-url" \
  -e NEXTAUTH_SECRET="your-secret" \
  -e NEXTAUTH_URL="http://localhost:3000" \
  employee-app

# Access the app
curl http://localhost:3000/api/health
```

---

### PWA Not Installing

If the Progressive Web App (PWA) doesn't install on mobile devices:

**Causes:**
1. Missing or invalid SSL certificate (HTTPS required)
2. Incorrect `manifest.json` configuration
3. Service worker registration failure

**Solutions:**

1. **Ensure HTTPS in Production:**
   ```env
   # .env.production
   NEXTAUTH_URL="https://your-domain.com"  # Must be HTTPS
   ```

2. **Verify Manifest:**
   - Check `/public/manifest.json` is accessible
   - Validate at: https://manifest-validator.appspot.com/

3. **Check Service Worker:**
   ```bash
   # In browser DevTools > Application > Service Workers
   # Should show "Activated and running"
   ```

4. **Clear Cache:**
   ```bash
   # In browser
   DevTools > Application > Clear Storage > Clear site data
   ```

**Testing:**
```bash
# Check manifest accessibility
curl https://your-domain.com/manifest.json

# Verify service worker
curl https://your-domain.com/sw.js
```

---

### Database Connection Fails

**Error:** `ECONNREFUSED` or `Connection timeout`

**Solutions:**

1. **Check docker-compose service name:**
   ```yaml
   # In docker-compose.yml, DB service is named 'db'
   services:
     db:
       image: postgres:16
   ```

2. **Update DATABASE_URL:**
   ```env
   # When running in Docker network
   DATABASE_URL="postgresql://user:password@db:5432/dbname"
   #                                         ^^
   #                                    Service name, not 'localhost'
   ```

3. **Verify database is running:**
   ```bash
   docker compose ps
   # Should show 'db' service as 'Up'
   ```

---

### Backup System Not Running

**Issue:** No backup files created in `/backups/database/`

**Checks:**

1. **Verify cron schedule:**
   ```bash
   # Check logs for cron initialization
   docker compose logs app | grep -i "backup\|cron"
   ```

2. **Test manual backup:**
   ```bash
   docker compose exec app npm run backup:db
   ```

3. **Check volume mapping:**
   ```yaml
   # docker-compose.yml should have:
   volumes:
     - ./backups:/app/backups
   ```

4. **Verify email config** (if no email alerts):
   ```bash
   # Check EMAIL_* environment variables
   docker compose exec app env | grep EMAIL
   ```

---

## 📊 Health Monitoring

### Health Check Endpoint

The application includes a health check endpoint for monitoring:

**Endpoint:** `GET /api/health`

**Response (Healthy):**
```json
{
  "status": "ok",
  "timestamp": "2026-02-12T10:00:00.000Z",
  "database": "connected",
  "version": "0.7.0"
}
```

**Response (Unhealthy):**
```json
{
  "status": "error",
  "timestamp": "2026-02-12T10:00:00.000Z",
  "database": "disconnected",
  "error": "Connection timeout"
}
```

**Usage:**

1. **Docker Health Check:**
   ```yaml
   # docker-compose.yml
   healthcheck:
     test: ["CMD", "curl", "-f", "http://localhost:3000/api/health"]
     interval: 30s
     timeout: 10s
     retries: 3
   ```

2. **Monitoring Tools:**
   ```bash
   # UptimeRobot, Pingdom, etc.
   Monitor URL: https://your-domain.com/api/health
   Expected: status code 200, body contains "ok"
   ```

3. **Manual Check:**
   ```bash
   curl https://your-domain.com/api/health
   ```

---

## 🔄 Zero-Downtime Deployment

For production deployments with minimal downtime:

### Using Docker Compose

```bash
# 1. Pull latest code
git pull origin main

# 2. Build new image (old containers still running)
docker compose build

# 3. Start new containers (rolling update)
docker compose up -d --no-deps --build app

# 4. Old containers are replaced seamlessly
```

### Using Blue-Green Deployment

```bash
# Terminal 1: Run current version (blue)
docker compose -f docker-compose.blue.yml up

# Terminal 2: Start new version (green)
docker compose -f docker-compose.green.yml up

# Switch traffic (e.g., via nginx reverse proxy)
# Stop old version
docker compose -f docker-compose.blue.yml down
```

---

## 📚 Additional Resources

- **[Configuration Guide](CONFIGURATION.md)** - Environment variables and setup
- **[Backup System](BACKUP_SYSTEM.md)** - Backup and restore procedures
- **[PWA Guide](PWA.md)** - Progressive Web App configuration
- **[Performance Optimizations](PERFORMANCE_OPTIMIZATIONS.md)** - Caching and speed improvements

---

**Last Updated:** February 12, 2026  
**Version:** v0.7.0+
