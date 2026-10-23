// Shared helpers for server checks: throwaway local server with its own database.
import { spawn } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { PGlite } from "@electric-sql/pglite";

const PORT = 7000 + Math.floor(Math.random() * 900) + 50;
const BASE = `http://127.0.0.1:${PORT}`;
export const dataDir = mkdtempSync(join(tmpdir(), "harness-check-"));
export const counts = { failed: 0, passed: 0 };
export const ok = (cond, label, extra) => {
  if (cond) counts.passed++; else counts.failed++;
  console.log(`${cond ? "PASS" : "FAIL"}  ${label}${!cond && extra !== undefined ? "  -> " + JSON.stringify(extra).slice(0, 300) : ""}`);
};
export const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

let server;
export async function start() {
  server = spawn("npx", ["tsx", "server/index.ts"], {
    env: { ...process.env, PORT: String(PORT), NODE_ENV: "development", DATA_DIR: dataDir, DATABASE_URL: "", FIREBASE_PROJECT_ID: "",
      PUSH_DISABLED: "1", ADMIN_EMAIL: "", JWT_SECRET: "admin-check-secret-0123456789abcdef0123456789ab" },
    stdio: ["ignore", "pipe", "pipe"], detached: true,
  });
  let log = "";
  server.stdout.on("data", (d) => (log += d));
  server.stderr.on("data", (d) => (log += d));
  globalThis.__serverLog = () => log;
  for (let i = 0; i < 120; i++) {
    try { const r = await fetch(`${BASE}/api/market/categories`); if (r.ok) return; } catch {}
    await sleep(500);
  }
  console.log(log.slice(-2000));
  throw new Error("server did not start");
}
export async function stop() {
  try { process.kill(-server.pid, "SIGTERM"); } catch {}
  for (let i = 0; i < 40; i++) { try { await fetch(`${BASE}/api/market/categories`); } catch { break; } await sleep(250); }
  await sleep(800);
}
export async function call(method, path, token, body) {
  const r = await fetch(BASE + path, { method, headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) }, body: body ? JSON.stringify(body) : undefined });
  let data = null; try { data = await r.json(); } catch {}
  return { status: r.status, data };
}
const stamp = Date.now();
export async function signup(tag) {
  const r = await call("POST", "/api/auth/signup", null, { email: `${tag}-${stamp}@check.test`, password: "Check-pass-123", name: tag, username: `${tag}${stamp}`.slice(0, 20) });
  if (!r.data?.token) throw new Error("signup failed " + JSON.stringify(r));
  return { token: r.data.token, id: r.data.user.id, email: `${tag}-${stamp}@check.test` };
}
export async function login(u) {
  const r = await call("POST", "/api/auth/login", null, { email: u.email, password: "Check-pass-123" });
  return r.data?.token;
}


/** Starts a throwaway server, signs up the given accounts, makes the first one a super admin, logs them in. */
export async function setup(tags) {
  await start();
  const users = [];
  for (const t of tags) users.push(await signup(t));
  await stop();
  const pg = new PGlite(join(dataDir, "pglite"));
  await pg.query("UPDATE users SET is_super_admin = true WHERE id = $1", [users[0].id]);
  await pg.close();
  await start();
  for (const u of users) u.token = (await login(u)) || u.token;
  return users;
}
export async function finish(e) {
  if (e) { counts.failed++; console.log("ERROR", e?.stack || e); }
  if (counts.failed && globalThis.__serverLog) console.log("--- server errors ---\n" + globalThis.__serverLog().split("\n").filter((l) => /error|\[/i.test(l)).slice(-15).join("\n"));
  await stop();
  rmSync(dataDir, { recursive: true, force: true });
  console.log(`\n${counts.passed} passed, ${counts.failed} failed`);
  process.exit(counts.failed ? 1 : 0);
}
