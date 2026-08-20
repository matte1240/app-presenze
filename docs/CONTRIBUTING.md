# 🤝 Contributing Guide

Thank you for contributing to the Employee Work Hours Tracker!

## 📋 Table of Contents
- [Getting Started](#getting-started)
- [Development Setup](#development-setup)
- [Branching Strategy](#branching-strategy)

---

## 🎯 Getting Started

### Prerequisites
- Node.js 20.19+
- Docker & Docker Compose
- Git

### Quick Setup
```bash
# 1. Clone repository
git clone https://github.com/YOUR_USERNAME/employee-app.git
cd employee-app

# 2. Install dependencies
npm install

# 3. Setup environment
cp .env.example .env
# Edit .env with your local database URL

# 4. Start database (Docker)
docker compose up postgres -d

# 5. Run migrations, generate client & seed data
npx prisma migrate dev
npx prisma generate
npx prisma db seed

# 6. Start dev server
npm run dev
```

---

## 🚀 Development Options

### 1. Local Development (Recommended)
Fastest feedback loop. Requires Node.js locally.
```bash
npm run dev
```

### 2. Docker Development
Environment identical to production.
```bash
npm run docker:dev
```

### Key Commands
| Command | Description |
|---------|-------------|
| `npm run lint` | Run ESLint |
| `npm run prisma:migrate` | Create/apply dev migrations |
| `npx prisma generate` | Regenerate Prisma client to `lib/generated/prisma/` |
| `npx prisma db seed` | Seed database (configured in `prisma.config.ts`) |

> **⚠️ Prisma v7 Note**: `prisma migrate dev` no longer auto-generates the client or auto-seeds. After creating a migration, run `npx prisma generate` explicitly. Seed with `npx prisma db seed`.

---

## 🌿 Branching Strategy

We follow a structured branching model:

```
dev (development)
  ↓ merge when ready
staging (pre-production)
  ↓ merge when tested
main (production)
  ↓ tag for release
v1.0.0 (release)
```

### Branches
- **`dev`**: Active development. Unstable. No auto-deploy.
- **`staging`**: Pre-production testing. Auto-deploys to Staging server.
- **`main`**: Production code. Stable. Auto-deploys to Production server.

### Workflow
1.  Create a feature branch from `dev`: `git checkout -b feat/my-feature dev`
2.  Commit changes.
3.  Open Pull Request to `dev`.
4.  After approval and merge to `dev`, merge `dev` to `staging` for testing.
5.  Finally, merge `staging` to `main` for production deployment.
