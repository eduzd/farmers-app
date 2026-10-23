// Voice rooms on a locally run server with a throwaway database:
// who may start a room (admin setting + picked people), the setup page's options (stage seats,
// invited speakers/moderators, private, schedule, share to feed), the feed card, the stage and
// audience (raise hand, accept/reject, invite, take off stage, mute others, moderators, remove
// from room, stage seats), room chat, WebRTC relay rules, ending, and the restart clean-up.
//
//   node tests/check-voice-rooms.mjs
import { spawn } from "node:child_process";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import WebSocket from "ws";
import { PGlite } from "@electric-sql/pglite";

const PORT = 7000 + Math.floor(Math.random() * 800) + 100;
const BASE = `http://127.0.0.1:${PORT}`;
const WS_URL = `ws://127.0.0.1:${PORT}/ws/chat`;
const dataDir = mkdtempSync(join(tmpdir(), "vr-check-"));
let failed = 0;
let passed = 0;
const ok = (cond, label, extra) => {
  cond ? passed++ : failed++;
  console.log(`${cond ? "PASS" : "FAIL"}  ${label}${!cond && extra !== undefined ? "  -> " + JSON.stringify(extra).slice(0, 400) : ""}`);
};
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

let server;
let log = "";
async function start() {
  server = spawn("npx", ["tsx", "server/index.ts"], {
    env: { ...process.env, PORT: String(PORT), NODE_ENV: "development", DATA_DIR: dataDir, DATABASE_URL: "", FIREBASE_PROJECT_ID: "",
      PUSH_DISABLED: "1", ADMIN_EMAIL: "", JWT_SECRET: "vr-check-secret-0123456789abcdef0123456789abcdef" },
    stdio: ["ignore", "pipe", "pipe"], detached: true,
  });
  server.stdout.on("data", (d) => (log += d));
  server.stderr.on("data", (d) => (log += d));
  for (let i = 0; i < 480; i++) {
    try { const r = await fetch(`${BASE}/api/market/categories`); if (r.ok) return; } catch {}
    await sleep(500);
  }
  console.log(log.slice(-2000));
  throw new Error("server did not start");
}
async function stop() {
  try { process.kill(-server.pid, "SIGTERM"); } catch {}
  for (let i = 0; i < 40; i++) { try { await fetch(`${BASE}/api/market/categories`); } catch { break; } await sleep(250); }
  await sleep(800);
}
async function call(method, path, token, body) {
  const r = await fetch(BASE + path, { method, headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) }, body: body ? JSON.stringify(body) : undefined });
  let data = null; try { data = await r.json(); } catch {}
  return { status: r.status, data };
}
const stamp = Date.now().toString(36);
async function signup(tag) {
  const email = `${tag}-${stamp}@check.test`;
  const r = await call("POST", "/api/auth/signup", null, { email, password: "Check-pass-123", name: tag, username: `${tag}${stamp}`.slice(0, 20) });
  if (!r.data?.token) throw new Error("signup failed " + JSON.stringify(r));
  return { token: r.data.token, id: String(r.data.user.id), email, name: tag };
}
async function login(u) {
  const r = await call("POST", "/api/auth/login", null, { email: u.email, password: "Check-pass-123" });
  u.token = r.data?.token || u.token;
}

async function socket(user) {
  const ws = new WebSocket(WS_URL);
  const inbox = [];
  ws.on("message", (d) => { try { inbox.push(JSON.parse(d.toString())); } catch {} });
  await new Promise((res, rej) => { ws.on("open", res); ws.on("error", rej); });
  ws.send(JSON.stringify({ type: "auth", token: user.token }));
  for (let i = 0; i < 40 && !inbox.some((m) => m.type === "auth_success"); i++) await sleep(50);
  const s = {
    ws, inbox,
    send: (m) => ws.send(JSON.stringify(m)),
    async wait(pred, ms = 3000) {
      const t = Date.now();
      while (Date.now() - t < ms) {
        const i = inbox.findIndex(pred);
        if (i >= 0) return inbox.splice(i, 1)[0];
        await sleep(30);
      }
      return null;
    },
    lastState() {
      for (let i = inbox.length - 1; i >= 0; i--) if (inbox[i].type === "vr_state" || inbox[i].type === "vr_joined") return inbox[i].room;
      return null;
    },
  };
  return s;
}
const member = (room, id) => room?.members?.find((m) => m.userId === id);

try {
  await start();
  const admin = await signup("boss");
  const expert = await signup("vet");
  const farmer = await signup("farmer");
  const picked = await signup("picked");
  const l1 = await signup("listen1");
  const l2 = await signup("listen2");
  await call("GET", "/api/voice-rooms/permission", farmer.token); // makes the voice room tables and profile columns
  await stop();
  const pg = new PGlite(join(dataDir, "pglite"));
  await pg.query("UPDATE users SET is_super_admin = true WHERE id = $1", [admin.id]);
  await pg.query("UPDATE users SET profile_role = 'expert' WHERE id = $1", [expert.id]);
  const com = (await pg.query("SELECT id FROM communities ORDER BY created_at LIMIT 1")).rows[0];
  await pg.close();
  await start();
  for (const u of [admin, expert, farmer, picked, l1, l2]) await login(u);
  let communityId = com?.id;
  if (!communityId) {
    const cs = await call("GET", "/api/communities", farmer.token);
    communityId = (Array.isArray(cs.data) ? cs.data : cs.data?.communities || [])[0]?.id;
  }
  ok(!!communityId, "there is a community to share rooms into", communityId);

  // ---------------- who may start a room
  let r = await call("GET", "/api/voice-rooms/permission", farmer.token);
  ok(r.status === 200 && r.data.canCreate === false && r.data.who === "experts", "by default a farmer can't start a room", r.data);
  r = await call("GET", "/api/voice-rooms/permission", expert.token);
  ok(r.data?.canCreate === true, "an expert can start a room by default", r.data);
  r = await call("GET", "/api/voice-rooms/permission", admin.token);
  ok(r.data?.canCreate === true, "an admin can always start a room");
  r = await call("POST", "/api/voice-rooms", farmer.token, { title: "Not allowed room" });
  ok(r.status === 403 && r.data?.code === "NOT_ALLOWED", "the server refuses a room from someone not allowed", r);

  const A = "/api/admin/manage/voice-rooms";
  r = await call("GET", A, farmer.token);
  ok(r.status === 403, "non-admins can't open the voice room permissions");
  r = await call("PUT", `${A}/hosts/${picked.id}`, admin.token);
  ok(r.status === 200 && r.data.hosts.some((h) => h.id === picked.id), "admin picks a person who may start rooms", r.data);
  r = await call("GET", "/api/voice-rooms/permission", picked.token);
  ok(r.data?.canCreate === true, "the picked person can now start rooms");
  r = await call("PUT", A, admin.token, { who: "selected" });
  ok(r.status === 200 && r.data.who === "selected", "admin switches to picked people only");
  r = await call("GET", "/api/voice-rooms/permission", expert.token);
  ok(r.data?.canCreate === false, "with 'picked people only', an expert who wasn't picked can't", r.data);
  r = await call("PUT", A, admin.token, { who: "everyone" });
  r = await call("GET", "/api/voice-rooms/permission", farmer.token);
  ok(r.data?.canCreate === true, "with 'everyone', a farmer can");
  r = await call("PUT", A, admin.token, { who: "nonsense" });
  ok(r.status === 400, "a made-up setting is refused");
  await call("PUT", A, admin.token, { who: "experts" });

  // ---------------- setup page: validation
  r = await call("POST", "/api/voice-rooms", expert.token, { title: "x" });
  ok(r.status === 400, "a room needs a name");
  r = await call("POST", "/api/voice-rooms", expert.token, { title: "Past room", scheduledFor: new Date(Date.now() - 3600e3).toISOString() });
  ok(r.status === 400, "a schedule in the past is refused");
  r = await call("POST", "/api/voice-rooms", expert.token, { title: "Bad share", shareToFeed: true, communityId: "nope" });
  ok(r.status === 400, "sharing needs a real community");

  // ---------------- not shared: no feed card
  r = await call("POST", "/api/voice-rooms", picked.token, { title: "Quiet room", description: "no card", shareToFeed: false, communityId });
  ok(r.status === 201 && r.data.status === "live" && r.data.postId === null, "a room started without the tick makes no feed post", r.data);
  const quietId = r.data.id;
  r = await call("POST", "/api/voice-rooms", picked.token, { title: "Second live room" });
  ok(r.status === 409 && r.data.roomId === quietId, "one live room per host at a time", r.data);
  await call("POST", `/api/voice-rooms/${quietId}/end`, picked.token);

  // ---------------- shared: one feed card
  r = await call("POST", "/api/voice-rooms", expert.token, {
    title: "Which fish feed is better?", description: "Talk about feed for tilapia", category: "fishery",
    shareToFeed: true, communityId, speakers: [l2.id], moderators: [], stageLimit: 8,
  });
  ok(r.status === 201 && r.data.status === "live" && !!r.data.postId, "a room started with the tick makes one feed post", r.data);
  const roomId = r.data.id;
  const postId = r.data.postId;
  const feed = await call("GET", `/api/posts?communityId=${encodeURIComponent(communityId)}`, farmer.token);
  const cardPosts = (feed.data || []).filter((p) => p.voiceRoom?.id === roomId);
  ok(cardPosts.length === 1 && cardPosts[0].voiceRoom.status === "live" && cardPosts[0].voiceRoom.title === "Which fish feed is better?" && cardPosts[0].voiceRoom.hostName === "vet",
    "the feed shows exactly one live card for that room with its details", cardPosts.map((p) => p.voiceRoom));
  const plain = (feed.data || []).filter((p) => !p.voiceRoom);
  ok(plain.every((p) => p.voiceRoom === undefined), "other posts carry no voice room");
  r = await call("GET", `/api/posts/${postId}`, farmer.token);
  ok(r.data?.voiceRoom?.id === roomId, "opening the post shows the card too");
  r = await call("GET", "/api/voice-rooms", farmer.token);
  ok(r.data?.rooms?.some((x) => x.id === roomId), "the room is in the live list");

  // ---------------- join, roles
  const H = await socket(expert);
  const F = await socket(farmer);
  const L1 = await socket(l1);
  const L2 = await socket(l2);
  const P = await socket(picked);
  H.send({ type: "vr_join", roomId });
  let j = await H.wait((m) => m.type === "vr_joined");
  ok(member(j?.room, expert.id)?.role === "host" && member(j?.room, expert.id)?.muted === false, "the host joins on stage, unmuted", j);
  ok(j?.room?.stageLimit === 8 && j?.room?.stageShown === 8, "the stage starts with 8 seats", j?.room);
  F.send({ type: "vr_join", roomId });
  j = await F.wait((m) => m.type === "vr_joined");
  ok(member(j?.room, farmer.id)?.role === "audience", "someone else joins the audience");
  L2.send({ type: "vr_join", roomId });
  j = await L2.wait((m) => m.type === "vr_joined");
  ok(member(j?.room, l2.id)?.role === "speaker" && member(j?.room, l2.id)?.muted === true, "a speaker picked on the setup page goes straight to the stage, muted");
  L1.send({ type: "vr_join", roomId });
  await L1.wait((m) => m.type === "vr_joined");
  P.send({ type: "vr_join", roomId });
  await P.wait((m) => m.type === "vr_joined");

  // ---------------- raise hand, reject, accept
  F.send({ type: "vr_accept", roomId, userId: l1.id });
  let e = await F.wait((m) => m.type === "vr_error");
  ok(e?.reason === "not_allowed", "the audience can't accept hands");
  F.send({ type: "vr_hand", roomId, up: true });
  let n = await H.wait((m) => m.type === "vr_hand_raised" && m.userId === farmer.id);
  ok(!!n, "the host is told a hand went up");
  await sleep(150);
  ok(member(H.lastState(), farmer.id)?.hand === true, "the raised hand shows in the room state");
  H.send({ type: "vr_reject", roomId, userId: farmer.id });
  n = await F.wait((m) => m.type === "vr_hand_declined");
  await sleep(150);
  ok(!!n && member(H.lastState(), farmer.id)?.hand === false, "the host declines: the hand goes down and they're told");
  H.send({ type: "vr_accept", roomId, userId: farmer.id });
  e = await H.wait((m) => m.type === "vr_error");
  ok(e?.reason === "no_request", "the host can't accept a hand that isn't raised");
  await sleep(1600);
  F.send({ type: "vr_hand", roomId, up: true });
  await H.wait((m) => m.type === "vr_hand_raised");
  H.send({ type: "vr_accept", roomId, userId: farmer.id });
  n = await F.wait((m) => m.type === "vr_on_stage");
  await sleep(150);
  let st = H.lastState();
  ok(!!n && member(st, farmer.id)?.role === "speaker" && member(st, farmer.id)?.muted === true, "the host accepts: they're a speaker, muted until they tap the mic");

  // ---------------- mute self / mute others
  F.send({ type: "vr_mute", roomId, muted: false });
  await sleep(150);
  ok(member(H.lastState(), farmer.id)?.muted === false, "a speaker unmutes their own mic");
  H.send({ type: "vr_mute", roomId, muted: true });
  await sleep(150);
  ok(member(H.lastState(), expert.id)?.muted === true, "the host mutes their own mic");
  H.send({ type: "vr_mute", roomId, muted: false });
  H.send({ type: "vr_host_mute", roomId, userId: farmer.id });
  n = await F.wait((m) => m.type === "vr_muted_by");
  await sleep(150);
  ok(!!n && member(H.lastState(), farmer.id)?.muted === true, "the host mutes another speaker");
  L1.send({ type: "vr_mute", roomId, muted: false });
  e = await L1.wait((m) => m.type === "vr_error");
  ok(e?.reason === "not_on_stage", "the audience has no mic to unmute");

  // ---------------- signal relay
  L1.send({ type: "vr_signal", roomId, userId: expert.id, key: "k1", data: { sdp: "x" } });
  n = await H.wait((m) => m.type === "vr_signal" && m.from === l1.id);
  ok(n?.data?.sdp === "x", "set-up messages go between a listener and someone on stage");
  L1.send({ type: "vr_signal", roomId, userId: picked.id, key: "k1", data: { sdp: "y" } });
  e = await L1.wait((m) => m.type === "vr_error");
  ok(e?.reason === "no_peer", "two listeners don't get connected to each other");

  // ---------------- invite to stage, take off stage
  H.send({ type: "vr_invite", roomId, userId: l1.id });
  n = await L1.wait((m) => m.type === "vr_invited");
  ok(!!n, "the host invites someone from the audience");
  L1.send({ type: "vr_invite_reply", roomId, accept: true });
  await sleep(200);
  ok(member(H.lastState(), l1.id)?.role === "speaker", "they say yes and come up to the stage");
  H.send({ type: "vr_to_audience", roomId, userId: l1.id });
  n = await L1.wait((m) => m.type === "vr_off_stage");
  await sleep(150);
  ok(!!n && member(H.lastState(), l1.id)?.role === "audience", "the host moves a speaker back to the audience");

  // ---------------- moderators
  H.send({ type: "vr_make_moderator", roomId, userId: farmer.id });
  n = await F.wait((m) => m.type === "vr_made_moderator");
  await sleep(150);
  ok(!!n && member(H.lastState(), farmer.id)?.role === "moderator", "the host makes a speaker a moderator");
  F.send({ type: "vr_make_moderator", roomId, userId: l2.id });
  e = await F.wait((m) => m.type === "vr_error");
  ok(e?.reason === "not_allowed", "only the host appoints moderators");
  F.send({ type: "vr_to_audience", roomId, userId: expert.id });
  e = await F.wait((m) => m.type === "vr_error");
  ok(!!e, "a moderator can't move the host off stage");
  F.send({ type: "vr_host_mute", roomId, userId: l2.id });
  await L2.wait((m) => m.type === "vr_muted_by");
  await sleep(150);
  ok(member(H.lastState(), l2.id)?.muted === true, "a moderator can mute a speaker");
  await sleep(1600);
  L1.send({ type: "vr_hand", roomId, up: true });
  n = await F.wait((m) => m.type === "vr_hand_raised" && m.userId === l1.id);
  ok(!!n, "moderators are told about raised hands too");
  F.send({ type: "vr_accept", roomId, userId: l1.id });
  await sleep(200);
  ok(member(H.lastState(), l1.id)?.role === "speaker", "a moderator accepts a raised hand");
  H.send({ type: "vr_remove_moderator", roomId, userId: farmer.id });
  await sleep(150);
  ok(member(H.lastState(), farmer.id)?.role === "speaker", "the host takes the moderator role back");

  // ---------------- stage seats
  H.send({ type: "vr_stage_limit", roomId, limit: 2 });
  e = await H.wait((m) => m.type === "vr_error");
  ok(e?.reason === "stage_has_more", "the stage can't shrink below the people on it", e);
  H.send({ type: "vr_stage_limit", roomId, limit: 12 });
  await sleep(150);
  ok(H.lastState()?.stageLimit === 12, "the host gives the stage more than 8 seats");
  H.send({ type: "vr_stage_limit", roomId, limit: 4 });
  await sleep(150);
  ok(H.lastState()?.stageLimit === 4, "the host sets the stage to the people on it now");
  P.send({ type: "vr_hand", roomId, up: true });
  await H.wait((m) => m.type === "vr_hand_raised" && m.userId === picked.id);
  F.send({ type: "vr_make_moderator", roomId, userId: farmer.id }); // ignored (not host)
  H.send({ type: "vr_accept", roomId, userId: picked.id });
  await sleep(200);
  st = H.lastState();
  ok(member(st, picked.id)?.role === "speaker" && st.stageLimit === 5, "when the stage is full, the host bringing someone up adds a seat", st?.stageLimit);

  // ---------------- chat
  L1.send({ type: "vr_to_audience", roomId });
  await sleep(100);
  L1.send({ type: "vr_chat", roomId, text: "Hello from the audience" });
  n = await H.wait((m) => m.type === "vr_chat_msg" && m.message.text === "Hello from the audience");
  ok(!!n && n.message.userId === l1.id, "an audience member writes in the room chat and everyone gets it");
  H.send({ type: "vr_chat_toggle", roomId, on: false });
  await sleep(150);
  L1.send({ type: "vr_chat", roomId, text: "still here?" });
  e = await L1.wait((m) => m.type === "vr_error" && m.request === "vr_chat");
  ok(e?.reason === "chat_off", "the host can turn the chat off for the audience");
  H.send({ type: "vr_chat_toggle", roomId, on: true });
  H.send({ type: "vr_chat_delete", roomId, messageId: n?.message?.id });
  n = await L1.wait((m) => m.type === "vr_chat_deleted");
  ok(!!n, "the host can take a chat message down");

  // ---------------- reactions
  L1.send({ type: "vr_react", roomId, emoji: "\u{1F44F}" });
  n = await H.wait((m) => m.type === "vr_reaction" && m.userId === l1.id);
  ok(n?.emoji === "\u{1F44F}", "an emoji reaction reaches everyone in the room");
  L1.send({ type: "vr_react", roomId, emoji: "<script>" });
  e = await L1.wait((m) => m.type === "vr_error" && m.request === "vr_react");
  ok(e?.reason === "unknown_reaction", "only the room's emoji are accepted");

  // ---------------- remove from room
  H.send({ type: "vr_remove", roomId, userId: l1.id });
  n = await L1.wait((m) => m.type === "vr_removed");
  await sleep(150);
  ok(!!n && !member(H.lastState(), l1.id), "the host removes someone from the room");
  L1.send({ type: "vr_join", roomId });
  e = await L1.wait((m) => m.type === "vr_error");
  ok(e?.reason === "removed", "a removed person can't come back in");

  // ---------------- private + scheduled
  r = await call("POST", "/api/voice-rooms", admin.token, { title: "Private board", isPrivate: true, shareToFeed: true, communityId, speakers: [picked.id] });
  ok(r.status === 201 && r.data.postId === null, "a private room is never posted to the feed", r.data);
  const privId = r.data.id;
  L2.send({ type: "vr_join", roomId: privId });
  e = await L2.wait((m) => m.type === "vr_error" && m.roomId === privId);
  ok(e?.reason === "private", "someone not invited can't join a private room");
  r = await call("GET", "/api/voice-rooms", l2.token);
  ok(!r.data.rooms.some((x) => x.id === privId), "a private room isn't listed for people not invited");
  await call("POST", `/api/voice-rooms/${privId}/end`, admin.token);

  const later = new Date(Date.now() + 2 * 3600e3).toISOString();
  r = await call("POST", "/api/voice-rooms", picked.token, { title: "Evening feed talk", scheduledFor: later, shareToFeed: true, communityId });
  ok(r.status === 201 && r.data.status === "scheduled" && !!r.data.postId, "a scheduled room is saved and posted", r.data);
  const schId = r.data.id;
  r = await call("GET", `/api/voice-rooms/${schId}`, farmer.token);
  ok(r.data?.status === "scheduled" && r.data?.scheduledFor, "its card says scheduled with the time");
  F.send({ type: "vr_join", roomId: schId });
  e = await F.wait((m) => m.type === "vr_error" && m.roomId === schId);
  ok(e?.reason === "not_started", "joining before it starts says it hasn't started");
  r = await call("POST", `/api/voice-rooms/${schId}/start`, farmer.token);
  ok(r.status === 403, "only its host can start it");
  r = await call("POST", `/api/voice-rooms/${schId}/start`, picked.token);
  ok(r.status === 200 && r.data.status === "live", "the host starts the scheduled room");
  await call("POST", `/api/voice-rooms/${schId}/end`, picked.token);

  // ---------------- end
  H.send({ type: "vr_end", roomId });
  n = await F.wait((m) => m.type === "vr_ended");
  ok(n?.reason === "host_ended", "the host ends the room and everyone is told");
  r = await call("GET", `/api/posts/${postId}`, farmer.token);
  ok(r.data?.voiceRoom?.status === "ended", "the feed card now says the room has ended", r.data?.voiceRoom);
  F.send({ type: "vr_join", roomId });
  e = await F.wait((m) => m.type === "vr_error" && m.request === "vr_join" && m.roomId === roomId);
  ok(e?.reason === "ended", "joining an ended room is refused cleanly");

  // ---------------- admin sees and ends live rooms; restart clean-up
  r = await call("POST", "/api/voice-rooms", expert.token, { title: "Left running" });
  const runId = r.data.id;
  r = await call("GET", A, admin.token);
  ok(r.data?.liveRooms?.some((x) => x.id === runId), "admin sees live rooms");
  r = await call("POST", "/api/voice-rooms", expert.token, { title: "Left running 2" });
  ok(r.status === 409, "(still one live room per host)");
  for (const s of [H, F, L1, L2, P]) s.ws.close();
  await stop();
  await start();
  r = await call("GET", `/api/voice-rooms/${runId}`, expert.token);
  ok(r.data?.status === "ended", "after a server restart, rooms that were live show as ended", r.data);
} catch (e) {
  failed++;
  console.log("FAIL  crashed:", e?.stack || e);
  console.log(log.slice(-3000));
} finally {
  await stop();
  if (failed) console.log(log.split("\n").filter((l) => /rror|ERR|voice-rooms/.test(l)).slice(-25).join("\n"));
  console.log(`\n${passed} passed, ${failed} failed`);
  process.exit(failed ? 1 : 0);
}
