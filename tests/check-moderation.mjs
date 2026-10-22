// Moderation / official page / ads / search check (see server/moderationRoutes.ts).
// Based on the admin app backend check on a locally run server with a throwaway database:
// admin-only access, categories reaching the public market list, shop / products / orders
// management, and Help -> admin support chat with replies and strict conversation access.
//
//   node tests/check-admin-app.mjs
//
// The admin account is made the normal way (sign up), then promoted straight in the
// throwaway database while the server is stopped. There is no test back door in the server.
import { spawn } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { PGlite } from "@electric-sql/pglite";

const PORT = 7000 + Math.floor(Math.random() * 900) + 50;
const BASE = `http://127.0.0.1:${PORT}`;
const dataDir = mkdtempSync(join(tmpdir(), "admin-check-"));
let failed = 0, passed = 0;
const ok = (cond, label, extra) => {
  if (cond) passed++; else failed++;
  console.log(`${cond ? "PASS" : "FAIL"}  ${label}${!cond && extra !== undefined ? "  -> " + JSON.stringify(extra).slice(0, 300) : ""}`);
};
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

let server;
async function start() {
  server = spawn("npx", ["tsx", "server/index.ts"], {
    env: { ...process.env, PORT: String(PORT), NODE_ENV: "development", DATA_DIR: dataDir, DATABASE_URL: "", FIREBASE_PROJECT_ID: "",
      PUSH_DISABLED: "1", ADMIN_EMAIL: "", JWT_SECRET: "admin-check-secret-0123456789abcdef0123456789ab" },
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
const stamp = Date.now();
async function signup(tag) {
  const r = await call("POST", "/api/auth/signup", null, { email: `${tag}-${stamp}@check.test`, password: "Check-pass-123", name: tag, username: `${tag}${stamp}`.slice(0, 20) });
  if (!r.data?.token) throw new Error("signup failed " + JSON.stringify(r));
  return { token: r.data.token, id: r.data.user.id, email: `${tag}-${stamp}@check.test` };
}
async function login(u) {
  const r = await call("POST", "/api/auth/login", null, { email: u.email, password: "Check-pass-123" });
  return r.data?.token;
}


try {
  await start();
  const admin = await signup("boss");
  const ann = await signup("ann");
  const bob = await signup("bob");
  const cat = await signup("cat");
  await stop();
  const pg = new PGlite(join(dataDir, "pglite"));
  await pg.query("UPDATE users SET is_super_admin = true WHERE id = $1", [admin.id]);
  await pg.close();
  await start();
  admin.token = (await login(admin)) || admin.token;

  // ---- admin only ----
  for (const [m, p] of [["GET", `/users/${bob.id}/moderation`], ["PUT", `/users/${bob.id}/restrictions`], ["POST", `/users/${bob.id}/ban`], ["DELETE", `/users/${bob.id}`], ["POST", "/official"], ["GET", "/ads"], ["GET", "/search?q=bo"]]) {
    const r = await call(m, `/api/admin/manage${p}`, ann.token, m === "GET" ? undefined : { message: true, body: "x", confirm: "x" });
    ok(r.status === 403, `non-admin refused ${m} ${p} (${r.status})`);
  }

  // ---- restrictions are enforced by the server ----
  const comm = await call("GET", "/api/communities", bob.token);
  const communityId = (Array.isArray(comm.data) ? comm.data : comm.data?.communities || [])[0]?.id;
  const before = await call("POST", `/api/dm/${ann.id}/messages`, bob.token, { content: "hi ann" });
  ok(before.status === 200 || before.status === 201, "bob can message before restriction", before);
  const postBefore = await call("POST", "/api/posts", bob.token, { communityId, content: "Hello farmers" });
  ok(postBefore.status !== 403, `bob can post before restriction (${postBefore.status})`, postBefore);
  const self = await call("PUT", `/api/admin/manage/users/${admin.id}/restrictions`, admin.token, { message: true });
  ok(self.status === 400, "admin can't restrict own account");
  const r1 = await call("PUT", `/api/admin/manage/users/${bob.id}/restrictions`, admin.token, { message: true, post: true, days: 7, reason: "Spam" });
  ok(r1.status === 200 && r1.data.restrictions.message && r1.data.restrictions.post && r1.data.restrictions.until, "admin restricts bob (message + post, 7 days)", r1);
  const dm = await call("POST", `/api/dm/${ann.id}/messages`, bob.token, { content: "spam" });
  ok(dm.status === 403 && dm.data.code === "RESTRICTED" && dm.data.restriction === "message", "restricted bob can't send a message", dm);
  const img = await call("POST", `/api/dm/${ann.id}/image`, bob.token, { image: "x" });
  ok(img.status === 403 && img.data.code === "RESTRICTED", "restricted bob can't send a photo either");
  const post = await call("POST", "/api/posts", bob.token, { communityId, content: "spam post" });
  ok(post.status === 403 && post.data.restriction === "post", "restricted bob can't post in the community", post);
  const q = await call("POST", "/api/community/questions", bob.token, { title: "spam?" });
  ok(q.status === 403 && q.data.restriction === "post", "restricted bob can't post a question");
  const sup = await call("POST", "/api/support/messages", bob.token, { body: "Why am I restricted?" });
  ok(sup.status === 201, "restricted bob can still write to Support", sup);
  const read = await call("GET", `/api/dm/${ann.id}/messages`, bob.token);
  ok(read.status === 200, "restricted bob can still read his chats");
  const annDm = await call("POST", `/api/dm/${bob.id}/messages`, ann.token, { content: "hi bob" });
  ok(annDm.status === 200 || annDm.status === 201, "others are not affected");
  const notes = await call("GET", "/api/me/notifications", bob.token);
  const nl = Array.isArray(notes.data) ? notes.data : notes.data?.notifications || [];
  ok(nl.some((n) => n.type === "moderation"), "bob is told about the limits");
  const list = await call("GET", "/api/admin/manage/users?filter=restricted", admin.token);
  ok(list.data.some((u) => u.id === bob.id && u.status === "restricted"), "restricted filter lists bob");
  const mod = await call("GET", `/api/admin/manage/users/${bob.id}/moderation`, admin.token);
  ok(mod.status === 200 && mod.data.restricted && mod.data.counts.messagesSent >= 1, "moderation summary", mod);
  const lift = await call("PUT", `/api/admin/manage/users/${bob.id}/restrictions`, admin.token, {});
  const after = await call("POST", `/api/dm/${ann.id}/messages`, bob.token, { content: "sorry" });
  ok(lift.status === 200 && !lift.data.restricted && (after.status === 200 || after.status === 201), "lifting restrictions lets bob message again", after);
  await call("PUT", `/api/admin/manage/users/${bob.id}/restrictions`, admin.token, { sell: true, buy: true });
  const sell = await call("POST", "/api/seller/products", bob.token, { name: "x", price: 5 });
  const buy = await call("POST", "/api/shop-orders", bob.token, { items: [] });
  ok(sell.data?.restriction === "sell" && buy.data?.restriction === "buy", "sell / buy restrictions block selling and ordering");
  await call("PUT", `/api/admin/manage/users/${bob.id}/restrictions`, admin.token, {});

  // ---- temporary ban ----
  const early = await call("POST", `/api/admin/manage/users/${bob.id}/ban`, admin.token, { reason: "Abuse", days: 3 });
  ok(early.status === 409 && early.data.code === "WARN_FIRST", "a ban needs a warning first", early);
  const warn = await call("POST", `/api/admin/manage/users/${bob.id}/warn`, admin.token, { reason: "Spam in comments" });
  ok(warn.status === 201 && warn.data.warnings === 1, "admin warns bob", warn);
  const offi = await call("GET", "/api/official/messages", bob.token);
  ok(offi.status === 200 && offi.data.messages.some((m) => /Spam in comments/.test(m.body)), "the warning shows in bob's Farmers Official chat", offi);
  const msg = await call("POST", `/api/admin/manage/users/${bob.id}/message`, admin.token, { title: "Hello", body: "Your shop looks great" });
  const offi2 = await call("GET", "/api/official/messages", bob.token);
  ok(msg.status === 201 && offi2.data.messages.some((m) => m.body === "Your shop looks great"), "a profile message lands in bob's Farmers Official chat");
  const modv = await call("GET", `/api/admin/manage/users/${bob.id}/moderation`, admin.token);
  ok(modv.data.warnings?.length === 1 && modv.data.activity?.some((a) => a.action === "WARN_USER"), "the profile lists warnings and admin activity", modv.data);
  const ban = await call("POST", `/api/admin/manage/users/${bob.id}/ban`, admin.token, { reason: "Abuse", days: 3 });
  ok(ban.status === 200 && ban.data.banned && ban.data.bannedUntil, "admin bans bob for 3 days", ban);
  const banned = await call("GET", "/api/me/notifications", bob.token);
  ok(banned.status === 403 && banned.data.code === "BANNED", "banned bob is locked out");
  const lg = await call("POST", "/api/auth/login", null, { email: bob.email, password: "Check-pass-123" });
  ok(lg.status === 403, "banned bob can't sign in");
  const ub = await call("POST", `/api/admin/manage/users/${bob.id}/unban`, admin.token);
  ok(ub.status === 200 && !ub.data.banned && (await login(bob)), "unban lets bob sign in again");

  // ---- official page ----
  const o0 = await call("GET", "/api/official/summary", ann.token);
  ok(o0.status === 200 && o0.data.unread === 0 && o0.data.name === "Farmers Official", "official page starts empty");
  const spoof = await call("POST", "/api/admin/manage/official", ann.token, { body: "fake official" });
  ok(spoof.status === 403, "users can't send as the official page");
  const all = await call("POST", "/api/admin/manage/official", admin.token, { title: "Eid offer", body: "20% off fish feed this week" });
  ok(all.status === 201 && all.data.recipients >= 3, "admin sends an official message to everyone", all);
  const one = await call("POST", "/api/admin/manage/official", admin.token, { body: "Your shop is approved", target: cat.email });
  ok(one.status === 201 && one.data.recipients === 1, "admin sends an official message to one person", one);
  const sa = await call("GET", "/api/official/summary", ann.token);
  const sc = await call("GET", "/api/official/summary", cat.token);
  ok(sa.data.unread === 1 && sc.data.unread === 2 && sc.data.last.body === "Your shop is approved", "unread counts: everyone 1, cat 2", [sa.data, sc.data]);
  const ma = await call("GET", "/api/official/messages", ann.token);
  ok(ma.data.messages.length === 1 && !ma.data.messages.some((m) => m.body.includes("approved")), "ann doesn't see cat's private message");
  const sa2 = await call("GET", "/api/official/summary", ann.token);
  ok(sa2.data.unread === 0, "opening the official chat marks it read");
  const an = await call("GET", "/api/me/notifications", ann.token);
  const anl = Array.isArray(an.data) ? an.data : an.data?.notifications || [];
  ok(anl.some((n) => n.type === "official"), "official message also lands in the bell");
  const reply = await call("POST", "/api/official/messages", ann.token, { body: "reply" });
  ok(reply.status === 404 || reply.status === 405, `nobody can reply into the official page (${reply.status})`);
  const ol = await call("GET", "/api/admin/manage/official", admin.token);
  ok(ol.data.length >= 2 && ol.data.some((m) => m.targetUserId === bob.id) && ol.data.some((m) => m.targetUserId === cat.id), "admin sees sent official messages");
  await call("DELETE", `/api/admin/manage/official/${one.data.message.id}`, admin.token);
  const sc2 = await call("GET", "/api/official/messages", cat.token);
  ok(sc2.data.messages.length === 1, "deleting an official message removes it");

  // ---- ads ----
  const bad = await call("POST", "/api/admin/manage/ads", admin.token, { titleEn: "x", color1: "red" });
  ok(bad.status === 400, "bad colour refused");
  const ad = await call("POST", "/api/admin/manage/ads", admin.token, { titleEn: "Fish feed sale", titleBn: "মাছের খাদ্যে ছাড়", subtitleEn: "20% off", ctaEn: "Shop now", placement: "connect", linkType: "category", linkTarget: "feed" });
  const ad2 = await call("POST", "/api/admin/manage/ads", admin.token, { titleEn: "Home only", placement: "home" });
  ok(ad.status === 201 && ad2.status === 201, "admin creates ads", ad);
  let pubAds = await call("GET", "/api/ads?placement=connect", null);
  ok(pubAds.data.length === 1 && pubAds.data[0].titleBn === "মাছের খাদ্যে ছাড়", "connect shows only its ad");
  await call("PUT", `/api/admin/manage/ads/${ad.data.id}`, admin.token, { active: false });
  pubAds = await call("GET", "/api/ads?placement=connect", null);
  ok(pubAds.data.length === 0, "hidden ad disappears");
  await call("PUT", `/api/admin/manage/ads/${ad.data.id}`, admin.token, { active: true, endsAt: "2020-01-01" });
  pubAds = await call("GET", "/api/ads?placement=connect", null);
  ok(pubAds.data.length === 0, "ended ad disappears");
  const del = await call("DELETE", `/api/admin/manage/ads/${ad2.data.id}`, admin.token);
  ok(del.status === 200, "admin deletes an ad");

  // ---- search ----
  const s = await call("GET", `/api/admin/manage/search?q=bob`, admin.token);
  ok(s.status === 200 && s.data.users.some((u) => u.id === bob.id) && s.data.support.some((t) => t.userName), "search finds bob and his support chat", s.data);

  // ---- admin photo reply ----
  const threads = await call("GET", "/api/admin/manage/support/threads", admin.token);
  const th = threads.data.find((t) => t.userId === bob.id);
  const png = Buffer.concat([Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==", "base64"), Buffer.alloc(200)]).toString("base64");
  const ph = await call("POST", `/api/admin/manage/support/threads/${th.id}/photo`, admin.token, { image: png, mime: "image/png", width: 1, height: 1 });
  ok(ph.status === 201 && ph.data.message.kind === "image" && ph.data.message.fromAdmin, "admin replies with a photo", ph);
  const bt = await call("GET", "/api/support/thread", bob.token);
  const pm = bt.data.messages.find((m) => m.kind === "image" && m.fromAdmin);
  const media = pm ? await fetch(`${BASE}/api/support/media/${pm.mediaId}`, { headers: { Authorization: `Bearer ${bob.token}` } }) : null;
  const media2 = pm ? await fetch(`${BASE}/api/support/media/${pm.mediaId}`, { headers: { Authorization: `Bearer ${ann.token}` } }) : null;
  ok(media?.status === 200 && (media2?.status === 403 || media2?.status === 404), "bob opens the admin photo, ann can't", [media?.status, media2?.status]);

  const voice = Buffer.concat([Buffer.from("000000186674797069736f6d", "hex"), Buffer.alloc(600, 7)]).toString("base64");
  const vc = await call("POST", `/api/admin/manage/support/threads/${th.id}/voice`, admin.token, { audio: voice, mime: "audio/mp4", durationMs: 3200, clientId: "v-1" });
  const vc2 = await call("POST", `/api/admin/manage/support/threads/${th.id}/voice`, admin.token, { audio: voice, mime: "audio/mp4", durationMs: 3200, clientId: "v-1" });
  ok(vc.status === 201 && vc.data.message.kind === "voice" && vc.data.message.durationMs === 3200 && vc2.status === 200 && vc2.data.message.id === vc.data.message.id, "admin sends a voice message (retry doesn't duplicate)", [vc, vc2.status]);
  const nv = await call("POST", `/api/admin/manage/support/threads/${th.id}/voice`, ann.token, { audio: voice, mime: "audio/mp4" });
  ok(nv.status === 403, "non-admin can't send as support");
  const bt2 = await call("GET", "/api/support/thread", bob.token);
  const vm = bt2.data.messages.find((m) => m.kind === "voice" && m.fromAdmin);
  const va = vm ? await fetch(`${BASE}/api/support/media/${vm.mediaId}`, { headers: { Authorization: `Bearer ${bob.token}` } }) : null;
  ok(va?.status === 200 && va.headers.get("content-type") === "audio/mp4", "bob gets and plays the admin voice message", [va?.status, bt2.data.thread]);
  const tx = await call("POST", `/api/admin/manage/support/threads/${th.id}/reply`, admin.token, { body: "We sent you the details", clientId: "t-1" });
  const tx2 = await call("POST", `/api/admin/manage/support/threads/${th.id}/reply`, admin.token, { body: "We sent you the details", clientId: "t-1" });
  ok(tx.status === 201 && tx2.data.message.id === tx.data.message.id, "text reply retry doesn't duplicate");

  // ---- delete account ----
  const noConfirm = await call("DELETE", `/api/admin/manage/users/${bob.id}`, admin.token, { confirm: "wrong" });
  ok(noConfirm.status === 400 && noConfirm.data.code === "CONFIRM", "delete needs the username or email typed");
  const delAdmin = await call("DELETE", `/api/admin/manage/users/${admin.id}`, admin.token, { confirm: admin.email });
  ok(delAdmin.status === 400, "admin can't delete own account");
  const gone = await call("DELETE", `/api/admin/manage/users/${bob.id}`, admin.token, { confirm: bob.email });
  ok(gone.status === 200 && gone.data.deleted, "admin deletes bob's account", gone);
  const gl = await call("POST", "/api/auth/login", null, { email: bob.email, password: "Check-pass-123" });
  ok(gl.status !== 200 || !gl.data?.token, `deleted bob can't sign in (${gl.status})`);
  const gt = await call("GET", "/api/me/notifications", bob.token);
  ok(gt.status === 401 || gt.status === 403 || gt.status === 404, `deleted bob's old token stops working (${gt.status})`);
  const ul = await call("GET", "/api/admin/manage/users", admin.token);
  ok(!ul.data.some((u) => u.id === bob.id), "deleted bob is gone from the user list");
  const ac = await call("GET", `/api/dm/${bob.id}/messages`, ann.token);
  ok(!(ac.data?.messages || ac.data || []).length || ac.status !== 200, "bob's messages are removed");
} catch (e) {
  failed++;
  console.log("FAIL  crashed:", e?.stack || e?.message);
} finally {
  await stop();
  rmSync(dataDir, { recursive: true, force: true });
  console.log(`\n${passed} passed, ${failed} failed`);
  process.exit(failed ? 1 : 0);
}
