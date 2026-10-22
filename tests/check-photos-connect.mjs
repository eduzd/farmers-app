// Check of chat photos and the Connect expert directory on a locally run server.
//
//   node tests/check-photos-connect.mjs
//
// Starts its own server on a spare port with a throwaway database, then stops it.
import { spawn } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import WebSocket from "ws";

const PORT = 6000 + Math.floor(Math.random() * 900) + 100;
const BASE = `http://127.0.0.1:${PORT}`;
const WS_URL = `ws://127.0.0.1:${PORT}/ws/chat`;
const dataDir = mkdtempSync(join(tmpdir(), "pc-check-"));
let failed = 0;
let passed = 0;
const ok = (cond, label) => {
  if (cond) passed++;
  else failed++;
  console.log(`${cond ? "PASS" : "FAIL"}  ${label}`);
};
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const server = spawn("npx", ["tsx", "server/index.ts"], {
  env: {
    ...process.env,
    PORT: String(PORT),
    NODE_ENV: "development",
    DATA_DIR: dataDir,
    DATABASE_URL: "",
    FIREBASE_PROJECT_ID: "",
    PUSH_DISABLED: "1",
    JWT_SECRET: "pc-check-secret-0123456789abcdef0123456789abcd",
  },
  stdio: ["ignore", "pipe", "pipe"],
  detached: true,
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
  return { token: r.json.token, id: String(r.json.user.id), name: tag };
}


// A real 1x1 JPEG and PNG.
const JPEG = "/9j/4AAQSkZJRgABAQEASABIAAD/2wBDAP//////////////////////////////////////////////////////////////////////////////////////wgALCAABAAEBAREA/8QAFBABAAAAAAAAAAAAAAAAAAAAAP/aAAgBAQABPxA=";
const PNG = "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==";
const big = (b64) => b64 + ""; // keep as-is

try {
  let up = false;
  for (let i = 0; i < 90 && !up; i++) {
    await sleep(1000);
    try { up = (await fetch(`${BASE}/api/health`)).ok; } catch {}
  }
  if (!up) throw new Error("server did not start\n" + log.slice(-2000));
  const a = await signUp("ann");
  const b = await signUp("ben");
  const c = await signUp("cat");
  const d = await signUp("dan");

  // ---------- photos ----------
  // pad the tiny JPEG so it passes the 100-byte minimum (bytes after EOI are ignored by viewers)
  const jpegBuf = Buffer.concat([Buffer.from(JPEG, "base64"), Buffer.alloc(200, 0)]);
  const jpeg64 = jpegBuf.toString("base64");
  let r = await call("POST", `/api/dm/${b.id}/image`, a.token, { image: `data:image/jpeg;base64,${jpeg64}`, mime: "image/jpeg", width: 1600, height: 1200, clientId: "cid-photo-1" });
  ok(r.status === 200 && r.json?.kind === "image" && r.json?.mediaId, `Ann sends Ben a photo (${r.status})`);
  ok(r.json?.width === 1600 && r.json?.height === 1200 && !String(r.json?.content).includes("|"), "the photo keeps its size and a clean label");
  const mediaId = r.json?.mediaId;
  const again = await call("POST", `/api/dm/${b.id}/image`, a.token, { image: jpeg64, mime: "image/jpeg", clientId: "cid-photo-1" });
  ok(again.json?.id === r.json?.id, "retrying the same photo does not send it twice");
  let un = await call("GET", "/api/dm/unread", b.token);
  ok(un.json?.total >= 1, `Ben has an unread message before opening the chat (${un.json?.total})`);
  let page = await call("GET", `/api/dm/${a.id}/messages`, b.token);
  const got = (Array.isArray(page.json) ? page.json : page.json?.messages || []).find((m) => m.kind === "image");
  ok(got && got.mediaId === mediaId && got.width === 1600, "Ben sees the photo in the chat");
  let res = await fetch(`${BASE}/api/dm/media/${mediaId}`, { headers: { Authorization: `Bearer ${b.token}` } });
  let bytes = Buffer.from(await res.arrayBuffer());
  ok(res.status === 200 && res.headers.get("content-type")?.startsWith("image/jpeg") && bytes.equals(jpegBuf), "Ben downloads exactly the same photo");
  res = await fetch(`${BASE}/api/dm/media/${mediaId}`, { headers: { Authorization: `Bearer ${c.token}` } });
  ok(res.status === 404, `Cat (not in the chat) cannot download it (${res.status})`);
  res = await fetch(`${BASE}/api/dm/media/${mediaId}`);
  ok(res.status === 401, `nobody signed out can download it (${res.status})`);
  const threads = await call("GET", "/api/dm/threads", b.token);
  const th = (threads.json || []).find?.((t) => String(t.otherId ?? t.userId ?? t.id) === a.id) || (threads.json?.threads || []).find((t) => String(t.otherId ?? t.userId ?? t.id) === a.id) || (Array.isArray(threads.json) ? threads.json[0] : threads.json?.threads?.[0]);
  ok(th && /Photo/.test(th.lastMessage), `Ben's chat list shows "Photo" as the last message (${th?.lastMessage})`);
  r = await call("POST", `/api/dm/${b.id}/image`, a.token, { image: PNG, mime: "image/png", clientId: "cid-png" });
  ok(r.status === 400, `a too-small file is refused (${r.status})`);
  r = await call("POST", `/api/dm/${b.id}/image`, a.token, { image: Buffer.alloc(500, 65).toString("base64"), mime: "image/jpeg" });
  ok(r.status === 400, `a file that isn't a photo is refused (${r.status})`);
  r = await call("POST", `/api/dm/${b.id}/image`, a.token, { image: jpeg64, mime: "application/pdf" });
  ok(r.status === 400, `a non-photo type is refused (${r.status})`);
  r = await call("POST", `/api/dm/${b.id}/image`, null, { image: jpeg64, mime: "image/jpeg" });
  ok(r.status === 401, `sending a photo needs sign-in (${r.status})`);

  // ---------- unread ----------
  un = await call("GET", "/api/dm/unread", b.token);
  ok(un.json?.total === 0, `opening the chat clears Ben's unread count (${un.json?.total})`);

  // ---------- Connect ----------
  let list = await call("GET", "/api/connect/professionals", null);
  ok(list.status === 200 && Array.isArray(list.json?.professionals) && list.json.professionals.length === 0, "Connect is empty when nobody is an expert (no made-up people)");
  ok((list.json?.fields || []).some((f) => f.id === "fish" && f.labelBn), "specialties come with Bangla labels");
  r = await call("PUT", "/api/me/expert-profile", a.token, { field: "fish", title: "DVM" });
  ok(r.status === 403, `a farmer account can't list itself as an expert (${r.status})`);
  await call("PUT", "/api/me/profile", c.token, { role: "expert" });
  await call("PUT", "/api/me/profile", d.token, { role: "expert" });
  await call("PUT", "/api/me/profile", a.token, { role: "farmer" });
  r = await call("PUT", "/api/me/expert-profile", c.token, { field: "fish", title: "Fisheries officer", about: "Fish disease and water quality" });
  ok(r.status === 200 && r.json?.field === "fish", "Cat (expert) saves a fish-health specialty");
  r = await call("PUT", "/api/me/expert-profile", d.token, { field: "vet", title: "DVM" });
  list = await call("GET", "/api/connect/professionals", a.token);
  const ids = (list.json?.professionals || []).map((p) => p.id);
  ok(ids.includes(c.id) && ids.includes(d.id) && !ids.includes(a.id) && !ids.includes(b.id), "Connect lists exactly the two expert accounts, not farmers");
  const card = list.json.professionals.find((p) => p.id === c.id);
  ok(card && !("email" in card) && !("phone" in card) && card.title === "Fisheries officer", "a card shows public details only (no email or phone)");
  list = await call("GET", "/api/connect/professionals?field=vet", a.token);
  ok(list.json?.professionals?.length === 1 && list.json.professionals[0].id === d.id, "the specialty filter works");
  list = await call("GET", "/api/connect/professionals?q=water", a.token);
  ok(list.json?.professionals?.length === 1 && list.json.professionals[0].id === c.id, "search finds an expert by what they help with");
  list = await call("GET", "/api/connect/professionals", c.token);
  ok(!(list.json?.professionals || []).some((p) => p.id === c.id), "an expert doesn't see themself in the list");
  const me = await call("GET", "/api/me/expert-profile", c.token);
  ok(me.json?.isExpert === true && me.json?.field === "fish", "an expert can read back their Connect profile");
  r = await call("POST", `/api/dm/${c.id}/messages`, a.token, { content: "Hello doctor, my fish are sick", clientId: "cid-doc" });
  ok(r.status === 200, `Ann can message the expert from Connect (${r.status})`);

  // ---------- followers hear about new posts ----------
  const comms = await call("GET", "/api/communities", null);
  const commId = (comms.json || [])[0]?.id;
  r = await call("POST", `/api/follows/${c.id}`, a.token, {});
  ok(r.status === 200, `Ann follows Cat (${r.status})`);
  r = await call("POST", `/api/follows/${c.id}`, b.token, {});
  await call("POST", "/api/relations", b.token, { kind: "mute", targetId: c.id }); // Ben follows but muted Cat
  const before = await call("GET", "/api/me/notifications", a.token);
  const countNew = (j) => (Array.isArray(j) ? j : j?.notifications || []).filter((n) => n.type === "new_post").length;
  r = await call("POST", "/api/posts", c.token, { communityId: commId, content: "Water test before stocking fingerlings", media: [] });
  ok(r.status === 201 && r.json?.id, `Cat publishes a post (${r.status})`);
  await sleep(1500);
  const afterA = await call("GET", "/api/me/notifications", a.token);
  const newOnes = (Array.isArray(afterA.json) ? afterA.json : afterA.json?.notifications || []).filter((n) => n.type === "new_post");
  ok(countNew(afterA.json) === countNew(before.json) + 1, `Ann (a follower) gets a "new post" notification (${countNew(afterA.json)})`);
  const n0 = newOnes[0] || {};
  const nd = n0.data || n0.actionData || {};
  ok(/shared a new post/.test(n0.title || "") && String(nd.postId) === String(r.json?.id), "it names Cat and opens that post");
  const afterB = await call("GET", "/api/me/notifications", b.token);
  ok(countNew(afterB.json) === 0, "Ben, who muted Cat, is not notified");
  const afterD = await call("GET", "/api/me/notifications", d.token);
  ok(countNew(afterD.json) === 0, "Dan, who doesn't follow Cat, is not notified");
} catch (e) {
  failed++;
  console.log("FAIL  " + (e?.stack || e));
} finally {
  try { process.kill(-server.pid, "SIGTERM"); } catch {}
  rmSync(dataDir, { recursive: true, force: true });
  console.log(`\n${passed} passed, ${failed} failed`);
  process.exit(failed ? 1 : 0);
}
