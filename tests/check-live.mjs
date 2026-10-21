// Live check against the deployed server: two fresh accounts exchange a text and a
// voice message (with live socket delivery), the voice file downloads byte-for-byte,
// outsiders are blocked, and the old sample rows are gone.
//   LIVE_URL=https://farmers-2ybg.onrender.com node tests/check-live.mjs
import WebSocket from "ws";

const BASE = process.env.LIVE_URL || "https://farmers-2ybg.onrender.com";
const WS_URL = BASE.replace("https://", "wss://").replace("http://", "ws://") + "/ws/chat";
let failed = 0;
let passed = 0;
const ok = (cond, label) => {
  if (cond) passed++;
  else failed++;
  console.log((cond ? "PASS" : "FAIL") + "  " + label);
};
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function call(method, path, token, body) {
  const headers = { "Content-Type": "application/json" };
  if (token) headers.Authorization = "Bearer " + token;
  const res = await fetch(BASE + path, { method, headers, body: body ? JSON.stringify(body) : undefined });
  let json = null;
  try { json = await res.json(); } catch {}
  return { status: res.status, json };
}

// The live site signs people in with Firebase. With FB_ADMIN_TOKEN (a Google access
// token for the Firebase project) this creates a verified throwaway Firebase user,
// signs it in, trades the Firebase token for the app's token, and deletes it at the end.
const FB_PROJECT = "farms-31bf9";
const FB_KEY = "AIzaSyDRAUJu7szUfeoPXMq_i-4fQTFOL6S3f0E";
const FB_ADMIN = process.env.FB_ADMIN_TOKEN;
const fbUids = [];
async function gpost(url, body, bearer) {
  const headers = { "Content-Type": "application/json" };
  if (bearer) headers.Authorization = "Bearer " + bearer;
  const res = await fetch(url, { method: "POST", headers, body: JSON.stringify(body) });
  return { status: res.status, json: await res.json().catch(() => null) };
}
async function signUp(tag) {
  const stamp = Date.now().toString(36) + Math.floor(Math.random() * 1000);
  const email = "livecheck-" + tag + "-" + stamp + "@check.test";
  const password = "Check-pass-" + stamp;
  const made = await gpost("https://identitytoolkit.googleapis.com/v1/projects/" + FB_PROJECT + "/accounts", { email, password, emailVerified: true, displayName: "Live check " + tag }, FB_ADMIN);
  if (!made.json || !made.json.localId) throw new Error("Firebase user create failed: " + made.status + " " + JSON.stringify(made.json));
  fbUids.push(made.json.localId);
  const si = await gpost("https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=" + FB_KEY, { email, password, returnSecureToken: true });
  if (!si.json || !si.json.idToken) throw new Error("Firebase sign-in failed: " + si.status + " " + JSON.stringify(si.json));
  const r = await call("POST", "/api/auth/firebase", null, { idToken: si.json.idToken, name: "Live check " + tag });
  if (!r.json || !r.json.token) throw new Error("app sign-in failed for " + tag + ": " + r.status + " " + JSON.stringify(r.json));
  return { token: r.json.token, id: String(r.json.user.id), name: tag };
}
async function cleanupFirebase() {
  if (!fbUids.length) return;
  const r = await gpost("https://identitytoolkit.googleapis.com/v1/projects/" + FB_PROJECT + "/accounts:batchDelete", { localIds: fbUids, force: true }, FB_ADMIN);
  console.log("Firebase test users deleted:", r.status === 200 ? fbUids.length : "failed " + r.status);
}

async function socket(user) {
  const ws = new WebSocket(WS_URL);
  const inbox = [];
  ws.on("message", (d) => { try { inbox.push(JSON.parse(String(d))); } catch {} });
  await new Promise((res, rej) => { ws.once("open", res); ws.once("error", rej); });
  ws.send(JSON.stringify({ type: "auth", token: user.token }));
  await sleep(1500);
  return {
    ws, inbox,
    async wait(pred, ms = 10000) {
      const end = Date.now() + ms;
      while (Date.now() < end) { const m = inbox.find(pred); if (m) return m; await sleep(100); }
      return null;
    },
  };
}

function toneWav() {
  const rate = 8000, n = rate;
  const buf = Buffer.alloc(44 + n * 2);
  buf.write("RIFF", 0); buf.writeUInt32LE(36 + n * 2, 4); buf.write("WAVE", 8); buf.write("fmt ", 12);
  buf.writeUInt32LE(16, 16); buf.writeUInt16LE(1, 20); buf.writeUInt16LE(1, 22); buf.writeUInt32LE(rate, 24);
  buf.writeUInt32LE(rate * 2, 28); buf.writeUInt16LE(2, 32); buf.writeUInt16LE(16, 34); buf.write("data", 36);
  buf.writeUInt32LE(n * 2, 40);
  for (let i = 0; i < n; i++) buf.writeInt16LE(Math.round(Math.sin((2 * Math.PI * 440 * i) / rate) * 8000), 44 + i * 2);
  return buf;
}

const listOf = (j) => (Array.isArray(j) ? j : (j && (j.items || j.data)) || []);

try {
  const h = await call("GET", "/api/health");
  console.log("health:", JSON.stringify(h.json));
  const a = await signUp("alice");
  const b = await signUp("bob");
  const c = await signUp("carol");
  ok(true, "Three fresh accounts signed in on the live site (through Firebase)");
  const sb = await socket(b);

  const t1 = "Live check: are the tomatoes ready?";
  const t2 = "Live check: yes, 50 kg today";
  let r = await call("POST", "/api/dm/" + b.id + "/messages", a.token, { content: t1, clientId: "L" + Date.now().toString(36) + "a" });
  ok(r.status === 200 && r.json && r.json.id, "Alice sends Bob a text message");
  const live = await sb.wait((m) => m.type === "dm" && m.data && m.data.content === t1);
  ok(!!live, "Bob receives it instantly over the live connection");
  r = await call("POST", "/api/dm/" + a.id + "/messages", b.token, { content: t2, clientId: "L" + Date.now().toString(36) + "b" });
  ok(r.status === 200, "Bob replies");
  r = await call("GET", "/api/dm/" + b.id + "/messages", a.token);
  const texts = listOf(r.json).map((m) => m.content);
  ok(texts.includes(t1) && texts.includes(t2), "Both messages are in Alice's chat history");
  r = await call("GET", "/api/dm/" + a.id + "/messages", c.token);
  ok(!listOf(r.json).some((m) => String(m.content || "").startsWith("Live check")), "Carol can't see their chat");

  const wav = toneWav();
  r = await call("POST", "/api/dm/" + b.id + "/voice", a.token, {
    audio: "data:audio/wav;base64," + wav.toString("base64"), mime: "audio/wav", durationMs: 1000,
    clientId: "V" + Date.now().toString(36) + "a",
  });
  ok(r.status === 200 && r.json && r.json.kind === "voice" && r.json.mediaId, "Alice sends Bob a 1-second voice message");
  const voice = r.json || {};
  const vLive = await sb.wait((m) => m.type === "dm" && m.data && m.data.kind === "voice");
  ok(vLive && vLive.data.mediaId === voice.mediaId, "Bob gets the voice message live");
  const media = await fetch(BASE + "/api/dm/media/" + voice.mediaId, { headers: { Authorization: "Bearer " + b.token } });
  const got = Buffer.from(await media.arrayBuffer());
  ok(media.status === 200 && media.headers.get("content-type") === "audio/wav", "Bob downloads it as audio/wav");
  ok(got.equals(wav), "Bob's copy is byte-for-byte the original (" + got.length + " of " + wav.length + " bytes)");
  const m4a = Buffer.concat([Buffer.from([0, 0, 0, 0x20]), Buffer.from("ftypM4A "), Buffer.alloc(600, 7)]);
  r = await call("POST", "/api/dm/" + a.id + "/voice", b.token, { audio: m4a.toString("base64"), mime: "audio/m4a", durationMs: 2500, clientId: "V" + Date.now().toString(36) + "b" });
  ok(r.status === 200 && r.json && r.json.kind === "voice", "Bob replies with a phone-style m4a voice message");
  const back = await fetch(BASE + "/api/dm/media/" + (r.json && r.json.mediaId), { headers: { Authorization: "Bearer " + a.token } });
  ok(back.status === 200 && Buffer.from(await back.arrayBuffer()).equals(m4a), "Alice gets Bob's m4a back unchanged");
  const outsider = await fetch(BASE + "/api/dm/media/" + voice.mediaId, { headers: { Authorization: "Bearer " + c.token } });
  ok(outsider.status === 404 || outsider.status === 403, "Carol can't download the voice message");
  const anon = await fetch(BASE + "/api/dm/media/" + voice.mediaId);
  ok(anon.status === 401, "A signed-out download is refused");
  sb.ws.close();

  for (const [base, kinds] of [["/api/catalog/", ["experts", "events", "listings"]], ["/api/community/", ["polls", "questions", "rfqs"]]]) {
    for (const kind of kinds) {
      r = await call("GET", base + kind, a.token);
      const list = listOf(r.json);
      const seeds = list.filter((x) => String(x.id || "").includes("-seed-"));
      ok(r.status === 200 && seeds.length === 0, "No sample " + kind + " on the live site (" + list.length + " real rows, status " + r.status + ")");
    }
  }
  const page = await fetch(BASE + "/");
  const html = await page.text();
  const m = html.match(/index-[0-9a-f]+[.]js/);
  console.log("web bundle:", m && m[0]);
  ok(page.status === 200 && !!m, "The web app loads");
} catch (e) {
  failed++;
  console.log("FAIL  " + ((e && e.stack) || e));
}
await cleanupFirebase().catch((e) => console.log("cleanup failed", e));
console.log("\n" + passed + " passed, " + failed + " failed");
process.exit(failed ? 1 : 0);
