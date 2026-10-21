import path from "path";
import fs from "fs";
import { drizzle as drizzlePg } from "drizzle-orm/postgres-js";
import { migrate as migratePg } from "drizzle-orm/postgres-js/migrator";
import { drizzle as drizzlePglite } from "drizzle-orm/pglite";
import { migrate as migratePglite } from "drizzle-orm/pglite/migrator";
import { PGlite } from "@electric-sql/pglite";
import postgres from "postgres";
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js";
import * as schema from "@shared/schema";
import { config } from "./config";

/**
 * Database:
 *  - DATABASE_URL set  -> real Postgres (Neon / Supabase free tier, Render, etc.)
 *  - not set           -> embedded Postgres (PGlite) stored in .data/pglite,
 *                         so the server runs with zero setup on any laptop.
 * Tables are created from ./migrations on start in both cases.
 */
const migrationsFolder = path.resolve(process.cwd(), "migrations");

let db: PostgresJsDatabase<typeof schema>;
let runMigrations: () => Promise<void>;

if (config.databaseUrl) {
  const client = postgres(config.databaseUrl, { max: 10 });
  db = drizzlePg(client, { schema });
  runMigrations = () => migratePg(db, { migrationsFolder });
  console.log("[db] Using Postgres from DATABASE_URL");
} else {
  const dir = path.join(config.dataDir, "pglite");
  fs.mkdirSync(dir, { recursive: true });
  const client = new PGlite(dir);
  const pgl = drizzlePglite(client, { schema });
  // Both drivers expose the same query builder; the routes only use that API.
  db = pgl as unknown as PostgresJsDatabase<typeof schema>;
  runMigrations = () => migratePglite(pgl, { migrationsFolder });
  console.log(`[db] DATABASE_URL not set - using embedded Postgres at ${dir}`);
}

async function migrateOnce() {
  if (!fs.existsSync(migrationsFolder)) {
    console.warn("[db] No migrations folder - run `npm run db:generate`");
    return;
  }
  await runMigrations();
  console.log("[db] Schema is up to date");
}

/** Resolves once tables exist. Code that queries at startup awaits this. */
export const dbReady: Promise<void> = migrateOnce();

export function initDatabase() {
  return dbReady;
}

export { db };
