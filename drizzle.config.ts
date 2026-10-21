import "dotenv/config";
import { defineConfig } from "drizzle-kit";

// `npm run db:generate` only needs the schema; `npm run db:push` needs DATABASE_URL.
export default defineConfig({
  out: "./migrations",
  schema: "./shared/schema.ts",
  dialect: "postgresql",
  dbCredentials: {
    url: process.env.DATABASE_URL || "postgres://localhost:5432/farmers",
  },
});
