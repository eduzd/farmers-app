// Two-account check of chat on a locally run server: text messages, voice messages
// (upload, then the other account downloads exactly the same playable audio), live
// delivery over /ws/chat, in-app call set-up (ring, accept, WebRTC offer/answer/ICE
// relay, hang up), and reactions including super react arriving live.
//
//   node tests/check-chat.mjs
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
const dataDir = mkdtempSync(join(tmpdir(), "chat-check-"));
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
    JWT_SECRET: "chat-check-secret-0123456789abcdef0123456789abcd",
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

/** A signed-in /ws/chat socket that keeps every message it receives. */
async function socket(user) {
  const ws = new WebSocket(WS_URL);
  const inbox = [];
  ws.on("message", (d) => {
    try {
      inbox.push(JSON.parse(d.toString()));
    } catch {}
  });
  await new Promise((res, rej) => {
    ws.once("open", res);
    ws.once("error", rej);
  });
  ws.send(JSON.stringify({ type: "auth", token: user.token }));
  const s = { ws, inbox, send: (m) => ws.send(JSON.stringify(m)) };
  s.wait = async (pred, ms = 4000) => {
    const end = Date.now() + ms;
    while (Date.now() < end) {
      const hit = inbox.find(pred);
      if (hit) return hit;
      await sleep(50);
    }
    return null;
  };
  const authed = await s.wait((m) => m.type === "auth_success");
  if (!authed) throw new Error(`socket sign-in failed for ${user.name}`);
  return s;
}

/** A real, playable 1-second 8 kHz mono WAV (a 440 Hz tone). */
function toneWav() {
  const rate = 8000;
  const n = rate;
  const buf = Buffer.alloc(44 + n * 2);
  buf.write("RIFF", 0);
  buf.writeUInt32LE(36 + n * 2, 4);
  buf.write("WAVE", 8);
  buf.write("fmt ", 12);
  buf.writeUInt32LE(16, 16);
  buf.writeUInt16LE(1, 20);
  buf.writeUInt16LE(1, 22);
  buf.writeUInt32LE(rate, 24);
  buf.writeUInt32LE(rate * 2, 28);
  buf.writeUInt16LE(2, 32);
  buf.writeUInt16LE(16, 34);
  buf.write("data", 36);
  buf.writeUInt32LE(n * 2, 40);
  for (let i = 0; i < n; i++) buf.writeInt16LE(Math.round(Math.sin((2 * Math.PI * 440 * i) / rate) * 12000), 44 + i * 2);
  return buf;
}

let sa, sb, sc;
try {
  let up = false;
  for (let i = 0; i < 90 && !up; i++) {
    await sleep(1000);
    try {
      up = (await fetch(`${BASE}/api/health`)).ok;
    } catch {}
  }
  if (!up) throw new Error("server did not start\n" + log.slice(-2000));

  const a = await signUp("alice");
  const b = await signUp("bob");
  const c = await signUp("carol");
  sa = await socket(a);
  sb = await socket(b);
  sc = await socket(c);
  ok(true, "Alice, Bob and Carol each sign in to the live chat socket");

  // ---- Text messages ----
  const cid = `t${Date.now().toString(36)}abc`;
  let r = await call("POST", `/api/dm/${b.id}/messages`, a.token, { content: "Are the tomatoes ready?", clientId: cid });
  ok(r.status === 200 && r.json?.id && r.json.kind === "text", "Alice sends Bob a text message");
  const textId = r.json?.id;
  const live = await sb.wait((m) => m.type === "dm" && m.data?.id === textId);
  ok(live && live.data.content === "Are the tomatoes ready?" && live.data.isMe === false, "Bob gets it live on his socket straight away");
  r = await call("POST", `/api/dm/${b.id}/messages`, a.token, { content: "Are the tomatoes ready?", clientId: cid });
  ok(r.status === 200 && r.json?.id === textId, "Retrying the same send doesn't create a second message");
  r = await call("POST", `/api/dm/${a.id}/messages`, b.token, { content: "Yes, 50 kg today", clientId: `t${Date.now().toString(36)}xyz` });
  ok(r.status === 200, "Bob replies");
  const replyLive = await sa.wait((m) => m.type === "dm" && m.data?.content === "Yes, 50 kg today");
  ok(!!replyLive, "Alice gets Bob's reply live");
  r = await call("GET", `/api/dm/${a.id}/messages?withMeta=1`, b.token);
  const bobList = r.json?.messages || [];
  ok(bobList.length === 2 && bobList[0].content === "Are the tomatoes ready?" && bobList[1].content === "Yes, 50 kg today", "Bob's chat history has both messages in order");
  r = await call("GET", `/api/dm/threads`, a.token);
  ok(r.status === 200 && JSON.stringify(r.json).includes(b.id), "The chat shows in Alice's chat list");
  r = await call("GET", `/api/dm/${a.id}/messages`, c.token);
  ok(r.status === 200 && Array.isArray(r.json) && !r.json.some((m) => m.id === textId), "Carol can't read Alice and Bob's chat");
  ok(!sc.inbox.some((m) => m.type === "dm"), "Carol's socket never received their messages");
  r = await call("POST", `/api/dm/${b.id}/messages`, a.token, { content: "   " });
  ok(r.status === 400, "An empty message is refused");
  r = await call("POST", `/api/dm/${b.id}/messages`, null, { content: "hi" });
  ok(r.status === 401, "A signed-out send is refused");

  // ---- Voice messages ----
  const wav = toneWav();
  r = await call("POST", `/api/dm/${b.id}/voice`, a.token, {
    audio: `data:audio/wav;base64,${wav.toString("base64")}`,
    mime: "audio/wav",
    durationMs: 1000,
    clientId: `v${Date.now().toString(36)}abc`,
  });
  ok(r.status === 200 && r.json?.kind === "voice" && r.json.mediaId && r.json.durationMs === 1000, "Alice sends Bob a 1-second voice message");
  const voice = r.json || {};
  const vLive = await sb.wait((m) => m.type === "dm" && m.data?.kind === "voice");
  ok(vLive && vLive.data.mediaId === voice.mediaId, "Bob gets the voice message live");
  const media = await fetch(`${BASE}/api/dm/media/${voice.mediaId}`, { headers: { Authorization: `Bearer ${b.token}` } });
  const got = Buffer.from(await media.arrayBuffer());
  ok(media.status === 200 && media.headers.get("content-type") === "audio/wav", "Bob downloads the recording as audio/wav");
  ok(got.equals(wav), "Bob's copy is byte-for-byte the recording Alice made");
  ok(got.toString("ascii", 0, 4) === "RIFF" && got.toString("ascii", 8, 12) === "WAVE" && got.readUInt32LE(40) === 16000, "The file is a complete, playable WAV (1 second of sound)");
  const mine = await fetch(`${BASE}/api/dm/media/${voice.mediaId}`, { headers: { Authorization: `Bearer ${a.token}` } });
  ok(mine.status === 200, "Alice can play her own voice message too");
  const outsider = await fetch(`${BASE}/api/dm/media/${voice.mediaId}`, { headers: { Authorization: `Bearer ${c.token}` } });
  ok(outsider.status === 404, "Carol can't download it");
  const anon = await fetch(`${BASE}/api/dm/media/${voice.mediaId}`);
  ok(anon.status === 401, "A signed-out download is refused");
  // An m4a recording, the format the phone app records in
  const m4a = Buffer.concat([Buffer.from([0, 0, 0, 0x20]), Buffer.from("ftypM4A "), Buffer.alloc(600, 7)]);
  r = await call("POST", `/api/dm/${a.id}/voice`, b.token, { audio: m4a.toString("base64"), mime: "audio/m4a", durationMs: 2500, clientId: `v${Date.now().toString(36)}m4a` });
  ok(r.status === 200 && r.json?.kind === "voice", "Bob replies with a phone-style m4a voice message");
  const m4aBack = await fetch(`${BASE}/api/dm/media/${r.json?.mediaId}`, { headers: { Authorization: `Bearer ${a.token}` } });
  ok(m4aBack.status === 200 && Buffer.from(await m4aBack.arrayBuffer()).equals(m4a), "Alice gets Bob's m4a back unchanged");
  r = await call("POST", `/api/dm/${b.id}/voice`, a.token, { audio: "AAAA", mime: "audio/wav" });
  ok(r.status === 400, "A broken or too-short recording is refused with a clear error");
  r = await call("GET", `/api/dm/${b.id}/messages`, a.token);
  ok((r.json || []).filter((m) => m.kind === "voice").length === 2, "Both voice messages are in the chat history");

  // ---- Hold a message -> Reply: the quote is saved, so both people see it ----
  r = await call("POST", `/api/dm/${a.id}/messages`, b.token, { content: "Yes, all red", clientId: `q${Date.now().toString(36)}one`, replyToId: textId });
  const q1 = r.json;
  ok(r.status === 200 && q1?.replyTo?.id === textId && q1.replyTo.text === "Are the tomatoes ready?" && q1.replyTo.isMe === false, "Bob replies to Alice's message and the quote is saved", );
  const q1Live = await sa.wait((m) => m.type === "dm" && m.data?.id === q1?.id);
  ok(q1Live?.data?.replyTo?.id === textId && q1Live.data.replyTo.isMe === true && q1Live.data.isMe === false, "Alice gets the reply live with the quote of her own message (shown as You)");
  r = await call("GET", `/api/dm/${b.id}/messages?withMeta=1`, a.token);
  const aSees = (r.json?.messages || []).find((m) => m.id === q1?.id);
  ok(aSees?.replyTo?.text === "Are the tomatoes ready?" && aSees.replyTo.isMe === true, "Alice's chat history shows the quote");
  r = await call("GET", `/api/dm/${a.id}/messages?withMeta=1`, b.token);
  const bSees = (r.json?.messages || []).find((m) => m.id === q1?.id);
  ok(bSees?.replyTo?.text === "Are the tomatoes ready?" && bSees.replyTo.isMe === false, "Bob's chat history shows the quote too");
  r = await call("POST", `/api/dm/${b.id}/messages`, a.token, { content: "Lovely voice note", clientId: `q${Date.now().toString(36)}two`, replyToId: voice.id });
  ok(r.json?.replyTo?.kind === "voice" && r.json.replyTo.text === "Voice message" && r.json.replyTo.isMe === true, "Replying to a voice message quotes it as 'Voice message'");
  const cMsg = await call("POST", `/api/dm/${b.id}/messages`, c.token, { content: "Carol to Bob", clientId: `q${Date.now().toString(36)}car` });
  r = await call("POST", `/api/dm/${b.id}/messages`, a.token, { content: "sneaky", clientId: `q${Date.now().toString(36)}snk`, replyToId: cMsg.json?.id });
  ok(r.status === 200 && !r.json?.replyTo, "A message from another chat can't be quoted (sent without a quote)");
  const before = q1?.id;
  r = await call("POST", `/api/dm/${a.id}/messages`, b.token, { content: "Yes, all red", clientId: q1?.id?.replace(/^dm-/, ""), replyToId: textId });
  ok(r.json?.id === before && r.json?.replyTo?.id === textId, "Retrying a reply keeps its quote and doesn't duplicate it");

  // ---- In-app calls (set-up and relay; the sound itself needs two phones) ----
  r = await call("GET", "/api/calls/ice-servers", a.token);
  ok(r.status === 200 && Array.isArray(r.json?.iceServers) && JSON.stringify(r.json.iceServers).includes("stun:"), "The app can get the call connection servers");
  r = await call("GET", "/api/calls/ice-servers", null);
  ok(r.status === 401, "Connection servers need sign-in");
  sa.send({ type: "call_initiate", calleeId: b.id, clientRef: "ref1" });
  const ringing = await sa.wait((m) => m.type === "call_ringing" && m.clientRef === "ref1");
  ok(ringing && ringing.calleeOnline === true && ringing.calleeName === "bob", "Alice calls Bob and hears it ringing");
  const callId = ringing?.callId;
  const incoming = await sb.wait((m) => m.type === "incoming_call" && m.callId === callId);
  ok(incoming && incoming.callerId === a.id && incoming.callerName === "alice", "Bob's phone shows Alice's incoming call");
  sc.send({ type: "call_initiate", calleeId: b.id, clientRef: "ref2" });
  const busy = await sc.wait((m) => m.type === "call_failed" && m.clientRef === "ref2");
  ok(busy?.reason === "busy", "Carol calling Bob at the same time gets 'busy'");
  sc.send({ type: "call_accept", callId });
  await sleep(300);
  ok(!sa.inbox.some((m) => m.type === "call_accepted"), "Carol can't answer a call that isn't hers");
  sb.send({ type: "call_ack", callId });
  sb.send({ type: "call_accept", callId });
  ok(!!(await sa.wait((m) => m.type === "call_accepted" && m.callId === callId)), "Bob answers and Alice is told");
  sa.send({ type: "webrtc_offer", callId, targetUserId: b.id, offer: { type: "offer", sdp: "v=0 offer" } });
  const offer = await sb.wait((m) => m.type === "webrtc_offer");
  ok(offer?.offer?.sdp === "v=0 offer" && offer.fromUserId === a.id, "Alice's call offer reaches Bob");
  sb.send({ type: "webrtc_answer", callId, targetUserId: a.id, answer: { type: "answer", sdp: "v=0 answer" } });
  ok((await sa.wait((m) => m.type === "webrtc_answer"))?.answer?.sdp === "v=0 answer", "Bob's answer reaches Alice");
  sa.send({ type: "webrtc_ice_candidate", callId, candidate: { candidate: "candidate:1 1 udp 1 1.2.3.4 5000 typ host" } });
  sb.send({ type: "webrtc_ice_candidate", callId, candidate: { candidate: "candidate:2 1 udp 1 5.6.7.8 6000 typ host" } });
  ok(!!(await sb.wait((m) => m.type === "webrtc_ice_candidate")) && !!(await sa.wait((m) => m.type === "webrtc_ice_candidate")), "Network details pass both ways");
  sc.send({ type: "webrtc_offer", callId, offer: { type: "offer", sdp: "evil" } });
  await sleep(300);
  ok(!sb.inbox.some((m) => m.type === "webrtc_offer" && m.offer?.sdp === "evil") && !sc.inbox.some((m) => m.type?.startsWith("webrtc_")), "Carol can't break into the call");
  sb.send({ type: "call_end", callId });
  const endA = await sa.wait((m) => m.type === "call_ended" && m.callId === callId);
  ok(endA?.reason === "hangup", "Bob hangs up and Alice's call ends");
  sb.send({ type: "call_initiate", calleeId: a.id, clientRef: "ref3" });
  const ring2 = await sb.wait((m) => m.type === "call_ringing" && m.clientRef === "ref3");
  await sa.wait((m) => m.type === "incoming_call" && m.callId === ring2?.callId);
  sa.send({ type: "call_reject", callId: ring2?.callId });
  ok((await sb.wait((m) => m.type === "call_rejected" && m.callId === ring2?.callId))?.reason === "declined", "Alice declines Bob's call and Bob is told");
  sa.send({ type: "call_initiate", calleeId: a.id, clientRef: "ref4" });
  ok((await sa.wait((m) => m.type === "call_failed" && m.clientRef === "ref4"))?.reason === "invalid_user", "Calling yourself is refused");

  // ---- Reactions, including super react, arriving live ----
  r = await call("PUT", `/api/dm/messages/${textId}/reaction`, b.token, { emoji: "❤️", super: true });
  ok(r.status === 200 && r.json?.super === true, "Bob super-reacts ❤️ to Alice's message");
  const rxLive = await sa.wait((m) => m.type === "dm_reaction" && m.data?.emoji === "❤️");
  ok(rxLive && rxLive.data.super === true, "Alice sees Bob's super ❤️ live");
  r = await call("PUT", `/api/dm/messages/${voice.mediaId ? voice.id : textId}/reaction`, b.token, { emoji: "👍", super: false });
  ok(r.status === 200, "Bob can react 👍 to a voice message");
  r = await call("POST", "/api/dm/reactions", a.token, { ids: [textId, voice.id] });
  ok(Array.isArray(r.json) && r.json.length === 2, "Both reactions come back for Alice");
  ok(!sc.inbox.some((m) => m.type === "dm_reaction"), "Carol's socket never sees their reactions");
} catch (e) {
  failed++;
  console.log("FAIL  " + (e?.message || e));
} finally {
  for (const s of [sa, sb, sc]) try { s?.ws.close(); } catch {}
  try {
    process.kill(-server.pid, "SIGTERM");
  } catch {
    server.kill("SIGTERM");
  }
  await sleep(500);
  try {
    rmSync(dataDir, { recursive: true, force: true });
  } catch {}
  if (failed) console.log("\n--- server log tail ---\n" + log.slice(-1500));
  console.log(`\n${passed} passed, ${failed} failed`);
  process.exit(failed ? 1 : 0);
}
