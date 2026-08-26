import { defineConfig } from "drizzle-kit";

export default defineConfig({
  // Both halves: the tenant tables and the control plane that owns them.
  schema: ["./src/server/db/schema.ts", "./src/server/db/platform-schema.ts"],
  out: "./src/server/db/migrations",
  dialect: "postgresql",
  dbCredentials: {
    url: process.env.DATABASE_URL ?? "postgres://postgres@localhost:5432/presenze",
  },
});
