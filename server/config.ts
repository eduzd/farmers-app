import "dotenv/config";
import crypto from "crypto";
import fs from "fs";
import path from "path";

const isProd = process.env.NODE_ENV === "production";
const dataDir = path.resolve(process.cwd(), process.env.DATA_DIR || ".data");

/**
 * JWT secret shared by every route file (auth, community, admin).
 * The original app used three different fallback secrets, so a token from
 * /api/auth failed on /api/communities unless JWT_SECRET was set.
 * In development a random secret is generated once and kept in .data/.
 */
function resolveJwtSecret(): string {
  if (process.env.JWT_SECRET) return process.env.JWT_SECRET;
  if (isProd) {
    throw new Error("JWT_SECRET must be set in production (any long random string).");
  }
  fs.mkdirSync(dataDir, { recursive: true });
  const file = path.join(dataDir, "dev-jwt-secret");
  if (fs.existsSync(file)) return fs.readFileSync(file, "utf-8").trim();
  const secret = crypto.randomBytes(32).toString("hex");
  fs.writeFileSync(file, secret);
  console.warn("[config] JWT_SECRET not set - using a generated development secret in .data/dev-jwt-secret");
  return secret;
}

export const config = {
  isProd,
  dataDir,
  port: parseInt(process.env.PORT || "5000", 10),
  jwtSecret: resolveJwtSecret(),
  /** Email that becomes super admin on signup. Leave empty to disable. */
  adminEmail: (process.env.ADMIN_EMAIL || "").trim(),
  adminPassword: process.env.ADMIN_PASSWORD || "",
  databaseUrl: process.env.DATABASE_URL || "",
  /**
   * Firebase project whose ID tokens the server accepts (public value).
   * Set FIREBASE_PROJECT_ID="" to turn Firebase sign-in off and the old
   * server-side signup back on.
   */
  firebaseProjectId: (process.env.FIREBASE_PROJECT_ID ?? "farms-31bf9").trim(),
  /** Extra allowed browser origins, comma separated. */
  corsOrigins: (process.env.CORS_ORIGINS || "")
    .split(",")
    .map((o) => o.trim())
    .filter(Boolean),
};
