// Notification settings check (Settings > Notifications: on/off + Vibration).
// Runs the server locally with a throwaway database and a fake Expo push service,
// then checks what the server sends to each phone:
//  - new phones: pushes on the vibrating "default" channel (old behaviour)
//  - vibrate=false: pushes on the "quiet" channel (no vibration), still sent
//  - notify=false: nothing sent to that phone
//  - re-saving the token without the settings (old app / plain sign-in) keeps them
//  - one phone's setting doesn't touch the user's other phones
//
//   node tests/check-push-prefs.mjs
import { spawn } from "node:child_process";
import { createServer } from "node:http";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const PORT = 7000 + Math.floor(Math.random() * 900) + 50;
const PUSH_PORT = PORT + 1;
const BASE = `http://127.0.0.1:${PORT}`;
const dataDir = mkdtempSync(join(tmpdir(), "push-check-"));
let failed = 0, passed = 0;
const ok = (cond, label, extra) => {
  if (cond) passed++; else failed++;
  console.log(`${cond ? "PASS" : "FAIL"}  ${label}${!cond && extra !== undefined ? "  -> " + JSON.stringify(extra).slice(0, 400) : ""}`);
};
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// Fake Expo push service: records every message the server sends.
const sent = [];
const fake = createServer((req, res) => {
  let b = "";
  req.on("data", (d) => (b += d));
  req.on("end", () => {
    try { for (const m of JSON.parse(b)) sent.push(m); } catch {}
    const n = (() => { try { return JSON.parse(b).length; } catch { return 0; } })();
    res.setHeader("Content-Type", "application/json");
    res.end(JSON.stringify({ data: Array.from({ length: n }, () => ({ status: "ok", id: "x" })) }));
  });
});
await new Promise((r) => fake.listen(PUSH_PORT, "127.0.0.1", r));

let server;
async function start() {
  server = spawn("npx", ["tsx", "server/index.ts"], {
    env: { ...process.env, PORT: String(PORT), NODE_ENV: "development", DATA_DIR: dataDir, DATABASE_URL: "", FIREBASE_PROJECT_ID: "",
      PUSH_DISABLED: "", EXPO_PUSH_URL: `http://127.0.0.1:${PUSH_PORT}/push`, ADMIN_EMAIL: "",
      JWT_SECRET: "push-check-secret-0123456789abcdef0123456789abcd" },
    stdio: ["ignore", "pipe", "pipe"], detached: true,
  });
  let log = "";
  server.stdout.on("data", (d) => (log += d));
  server.stderr.on("data", (d) => (log += d));
  for (let i = 0; i < 120; i++) {
    try { const r = await fetch(`${BASE}/api/market/categories`); if (r.ok) return; } catch {}
    await sleep(500);
  }
  console.log(log.slice(-2000));
  throw new Error("server did not start");
}
async function call(method, path, token, body) {
  const r = await fetch(BASE + path, { method, headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) }, body: body ? JSON.stringify(body) : undefined });
  let data = null; try { data = await r.json(); } catch {}
  return { status: r.status, data };
}
const stamp = Date.now();
async function signup(tag) {
  const r = await call("POST", "/api/auth/signup", null, { email: `${tag}-${stamp}@check.test`, password: "Check-pass-123", name: tag, username: `${tag}${stamp}`.slice(0, 20) });
  if (!r.data?.token) throw new Error("signup failed " + JSON.stringify(r));
  return { token: r.data.token, id: r.data.user.id };
}
const PHONE_A = "ExponentPushToken[phoneAAAAAAAAAAAAAAAAAA]";
const PHONE_B = "ExponentPushToken[phoneBBBBBBBBBBBBBBBBBB]";

// Bob sends Ann a message -> notify() -> push to Ann's phones. Returns what went out.
let n = 0;
async function pushToAnn(ann, bob) {
  const before = sent.length;
  const r = await call("POST", `/api/dm/${ann.id}/messages`, bob.token, { content: `hello ${++n}` });
  if (r.status >= 300) throw new Error("send failed " + JSON.stringify(r));
  for (let i = 0; i < 40; i++) { await sleep(150); if (sent.length > before) break; }
  await sleep(400);
  return sent.slice(before);
}
const byPhone = (msgs) => Object.fromEntries(msgs.map((m) => [m.to, m]));

try {
  await start();
  const ann = await signup("ann");
  const bob = await signup("bob");

  // Phone A registers like the current app (no settings sent) and phone B like the new app.
  ok((await call("POST", "/api/me/push-tokens", ann.token, { token: PHONE_A, platform: "android" })).status === 200, "phone A token saved (no settings = old app)");
  ok((await call("POST", "/api/me/push-tokens", ann.token, { token: PHONE_B, platform: "android", notify: true, vibrate: true })).status === 200, "phone B token saved with settings");
  let list = (await call("GET", "/api/me/push-tokens", ann.token)).data?.tokens || [];
  ok(list.length === 2 && list.every((t) => t.notify === true && t.vibrate === true), "defaults: notifications on, vibration on", list);

  let got = byPhone(await pushToAnn(ann, bob));
  ok(got[PHONE_A]?.channelId === "default" && got[PHONE_B]?.channelId === "default", "by default both phones get the vibrating channel", got);
  ok(got[PHONE_A]?.sound === "default", "sound still on", got[PHONE_A]);

  // Phone B turns vibration off.
  ok((await call("POST", "/api/me/push-tokens", ann.token, { token: PHONE_B, platform: "android", notify: true, vibrate: false })).status === 200, "phone B: vibration off saved");
  got = byPhone(await pushToAnn(ann, bob));
  ok(got[PHONE_B]?.channelId === "quiet", "vibration off -> push still sent, on the quiet (no vibration) channel", got[PHONE_B]);
  ok(got[PHONE_B]?.sound === "default" && !!got[PHONE_B]?.title, "vibration off keeps the notification (title + sound)", got[PHONE_B]);
  ok(got[PHONE_A]?.channelId === "default", "phone A is not affected by phone B's setting", got[PHONE_A]);

  // Re-saving the token without settings (e.g. app start / sign-in from an older app) keeps them.
  await call("POST", "/api/me/push-tokens", ann.token, { token: PHONE_B, platform: "android" });
  got = byPhone(await pushToAnn(ann, bob));
  ok(got[PHONE_B]?.channelId === "quiet", "setting survives a token re-save without settings", got[PHONE_B]);

  // Bad values are ignored, not saved.
  await call("POST", "/api/me/push-tokens", ann.token, { token: PHONE_B, platform: "android", vibrate: "yes" });
  list = (await call("GET", "/api/me/push-tokens", ann.token)).data?.tokens || [];
  ok(list.find((t) => t.token.startsWith(PHONE_B.slice(0, 20)))?.vibrate === false, "non-boolean vibrate ignored", list);

  // Phone B turns notifications off entirely.
  await call("POST", "/api/me/push-tokens", ann.token, { token: PHONE_B, platform: "android", notify: false, vibrate: false });
  got = byPhone(await pushToAnn(ann, bob));
  ok(!got[PHONE_B] && !!got[PHONE_A], "notifications off -> nothing sent to that phone, other phone still gets it", Object.keys(got));

  // Back on, vibration on again.
  await call("POST", "/api/me/push-tokens", ann.token, { token: PHONE_B, platform: "android", notify: true, vibrate: true });
  got = byPhone(await pushToAnn(ann, bob));
  ok(got[PHONE_B]?.channelId === "default", "turning vibration back on -> vibrating channel again", got[PHONE_B]);

  // Only your own settings: Bob can't change Ann's phone by claiming her token? A token belongs
  // to whoever registers it on that device, so test that the user id is never taken from the body.
  const r = await call("POST", "/api/me/push-tokens", bob.token, { token: "ExponentPushToken[bobphoneCCCCCCCCCCCC]", userId: ann.id, vibrate: false });
  ok(r.status === 403, "can't save settings for another account", r);
  ok((await call("POST", "/api/me/push-tokens", null, { token: PHONE_A, vibrate: false })).status === 401, "signed-out request refused");
} catch (e) {
  failed++;
  console.log("FAIL  crashed:", e?.message || e);
} finally {
  try { process.kill(-server.pid, "SIGTERM"); } catch {}
  fake.close();
  console.log(`\n${passed} passed, ${failed} failed`);
  process.exit(failed ? 1 : 0);
}
