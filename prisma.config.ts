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
    // without DATABASE_URL (it doesn't need a real connection).
    url: process.env.DATABASE_URL ?? "",
  },
});
