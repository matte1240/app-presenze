import "dotenv/config";
import { defineConfig } from "prisma/config";

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
    seed: "tsx prisma/seed.ts",
  },
  datasource: {
    // Use process.env with a fallback so `prisma generate` works in CI
    // without DATABASE_URL. The SQLite connector rejects an empty URL, so the
    // fallback points at the default local database file.
    url: process.env.DATABASE_URL ?? "file:./data/app.db",
  },
});
