// Code-level check that chat reactions (normal and tap-and-hold super) are saved
// on the server and come back for both people, and that nobody else can see or set them.
//
//   node tests/check-reactions.mjs
//
// Starts its own server on a spare port with a throwaway database, then stops it.
import { spawn } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const PORT = 5000 + Math.floor(Math.random() * 900) + 100;
const BASE = `http://127.0.0.1:${PORT}`;
const dataDir = mkdtempSync(join(tmpdir(), "rx-check-"));
let failed = 0;
let passed = 0;
const ok = (cond, label) => {
  if (cond) passed++;
  else failed++;
  console.log(`${cond ? "PASS" : "FAIL"}  ${label}`);
};

const server = spawn("npx", ["tsx", "server/index.ts"], {
  env: {
    ...process.env,
    PORT: String(PORT),
    NODE_ENV: "development",
    DATA_DIR: dataDir,
    DATABASE_URL: "",
    FIREBASE_PROJECT_ID: "",
    PUSH_DISABLED: "1",
    JWT_SECRET: "reaction-check-secret-0123456789abcdef0123456789",
  },
  stdio: ["ignore", "pipe", "pipe"],
  detached: true, // own process group, so the whole npx -> tsx -> node chain can be stopped
});
let log = "";
server.stdout.on("data", (d) => (log += d));
server.stderr.on("data", (d) => (log += d));

async function call(method, path, token, body) {
  const res = await fetch(BASE + path, {
    method,
    headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  let json = null;
  try {
    json = await res.json();
  } catch {}
  return { status: res.status, json };
}

async function signUp(tag) {
  const stamp = Date.now().toString(36);
  const r = await call("POST", "/api/auth/signup", null, {
    email: `${tag}-${stamp}@check.test`,
    password: "Check-pass-123",
    name: tag,
    username: `${tag}_${stamp}`,
  });
  if (!r.json?.token) throw new Error(`sign-up failed for ${tag}: ${r.status} ${JSON.stringify(r.json)}`);
  return { token: r.json.token, id: String(r.json.user.id) };
}

try {
  let up = false;
  for (let i = 0; i < 90 && !up; i++) {
    await new Promise((r) => setTimeout(r, 1000));
    try {
      up = (await fetch(`${BASE}/api/health`)).ok;
    } catch {}
  }
  if (!up) throw new Error("server did not start\n" + log.slice(-2000));

  const a = await signUp("alice");
  const b = await signUp("bob");
  const c = await signUp("carol");

  const sent = await call("POST", `/api/dm/${b.id}/messages`, a.token, { content: "Tomatoes ready?", clientId: `c-${Date.now()}` });
  ok(sent.status === 200 && sent.json?.id, "Alice sends Bob a message");
  const mid = sent.json.id;

  // Bob reacts normally
  let r = await call("PUT", `/api/dm/messages/${mid}/reaction`, b.token, { emoji: "👍", super: false });
  ok(r.status === 200 && r.json?.emoji === "👍" && r.json?.super === false, "Bob's 👍 is saved");

  // Alice tap-and-holds for a super reaction
  r = await call("PUT", `/api/dm/messages/${mid}/reaction`, a.token, { emoji: "❤️", super: true });
  ok(r.status === 200 && r.json?.emoji === "❤️" && r.json?.super === true, "Alice's super ❤️ is saved");

  // Both people get both reactions back
  for (const [who, u] of [["Alice", a], ["Bob", b]]) {
    r = await call("POST", "/api/dm/reactions", u.token, { ids: [mid] });
    const list = Array.isArray(r.json) ? r.json : [];
    const fromA = list.find((x) => x.userId === a.id);
    const fromB = list.find((x) => x.userId === b.id);
    ok(
      r.status === 200 && fromA?.emoji === "❤️" && fromA?.super === true && fromB?.emoji === "👍" && fromB?.super === false,
      `${who} sees super ❤️ from Alice and 👍 from Bob`,
    );
  }

  // Changing a reaction replaces it (one per person)
  r = await call("PUT", `/api/dm/messages/${mid}/reaction`, b.token, { emoji: "😂", super: true });
  r = await call("POST", "/api/dm/reactions", a.token, { ids: [mid] });
  const bobNow = (r.json || []).filter((x) => x.userId === b.id);
  ok(bobNow.length === 1 && bobNow[0].emoji === "😂" && bobNow[0].super === true, "Bob's change to super 😂 replaces his 👍");

  // Removing
  r = await call("DELETE", `/api/dm/messages/${mid}/reaction`, b.token);
  ok(r.status === 200 && r.json?.emoji === null, "Bob removes his reaction");
  r = await call("POST", "/api/dm/reactions", a.token, { ids: [mid] });
  ok((r.json || []).length === 1 && r.json[0].userId === a.id, "Only Alice's reaction is left");

  // Outsiders and bad input
  r = await call("PUT", `/api/dm/messages/${mid}/reaction`, c.token, { emoji: "😡", super: false });
  ok(r.status === 404, "Carol (not in the chat) can't react");
  r = await call("POST", "/api/dm/reactions", c.token, { ids: [mid] });
  ok(r.status === 200 && Array.isArray(r.json) && r.json.length === 0, "Carol can't see the chat's reactions");
  r = await call("PUT", `/api/dm/messages/${mid}/reaction`, a.token, { emoji: "🍅", super: false });
  ok(r.status === 400, "An emoji that isn't in the menu is refused");
  r = await call("PUT", `/api/dm/messages/${mid}/reaction`, null, { emoji: "👍", super: false });
  ok(r.status === 401, "Signed-out request is refused");
} catch (e) {
  failed++;
  console.log("FAIL  " + (e?.message || e));
} finally {
  try {
    process.kill(-server.pid, "SIGTERM");
  } catch {
    server.kill("SIGTERM");
  }
  await new Promise((r) => setTimeout(r, 500));
  try {
    rmSync(dataDir, { recursive: true, force: true });
  } catch {}
  console.log(`\n${passed} passed, ${failed} failed`);
  process.exit(failed ? 1 : 0);
}
