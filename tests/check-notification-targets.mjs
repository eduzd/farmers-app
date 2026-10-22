// Notification deep-link check (server/notificationTargets.ts): where each notification opens,
// on a locally run server with a throwaway database. No real pushes (PUSH_DISABLED).
//   node tests/check-notification-targets.mjs
import { spawn } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { PGlite } from "@electric-sql/pglite";

const PORT = 7000 + Math.floor(Math.random() * 900) + 50;
const BASE = `http://127.0.0.1:${PORT}`;
const dataDir = mkdtempSync(join(tmpdir(), "notif-target-check-"));
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
      PUSH_DISABLED: "1", ADMIN_EMAIL: "", JWT_SECRET: "notif-target-check-secret-0123456789abcdef0123456789ab" },
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

const target = (token, id) => call("GET", `/api/me/notifications/${encodeURIComponent(id)}/target`, token);
const latest = async (token, type) => {
  const r = await call("GET", "/api/me/notifications", token);
  return (r.data?.notifications || r.data || []).find((n) => n.type === type);
};

try {
  await start();
  const admin = await signup("boss");
  const ann = await signup("ann");
  const bob = await signup("bob");
  const cat = await signup("cat");

  // ---- real notifications made by the app ----
  const comm = await call("GET", "/api/communities", ann.token);
  const communityId = (Array.isArray(comm.data) ? comm.data : comm.data?.communities || [])[0]?.id;
  const post = await call("POST", "/api/posts", ann.token, { communityId, content: "My rice field" });
  ok(post.status === 201 || post.status === 200, "ann posts", post);
  const postId = post.data?.id || post.data?.post?.id;
  const cm = await call("POST", `/api/posts/${postId}/comments`, bob.token, { body: "Looks great" });
  ok(cm.status === 201, "bob comments", cm);
  const commentId = String(cm.data?.id);
  await call("POST", `/api/posts/${postId}/like`, bob.token);
  await call("POST", `/api/follows/${ann.id}`, bob.token);
  await call("POST", `/api/dm/${ann.id}/messages`, bob.token, { content: "hi ann" });
  await sleep(500);

  const nComment = await latest(ann.token, "comment");
  ok(!!nComment, "comment notification saved");
  const tc = await target(ann.token, nComment.id);
  ok(tc.status === 200 && tc.data.status === "ok" && tc.data.target.screen === "PostDetail" && tc.data.target.params.postId === postId && tc.data.target.params.commentId === commentId,
    "comment notification -> that post, at that comment", tc.data);
  ok(tc.data.notification?.id === nComment.id && tc.data.notification.title, "target returns the notification's own title", tc.data);

  const nLike = await latest(ann.token, "like");
  const tl = nLike ? await target(ann.token, nLike.id) : null;
  ok(tl && tl.data.target?.screen === "PostDetail" && tl.data.target.params.postId === postId && !tl.data.target.params.commentId, "like -> that post", tl?.data);

  const nFollow = await latest(ann.token, "follow");
  const tf = nFollow ? await target(ann.token, nFollow.id) : null;
  ok(tf && tf.data.target?.screen === "UserProfile" && tf.data.target.params.user?.id === bob.id && tf.data.target.params.user?.name === "bob", "new follower -> follower's profile", tf?.data);

  const nMsg = await latest(ann.token, "message");
  const tm = nMsg ? await target(ann.token, nMsg.id) : null;
  ok(tm && tm.data.target?.screen === "Chat" && tm.data.target.params.userId === bob.id && tm.data.target.params.userName === "bob", "message -> that chat", tm?.data);

  // ---- privacy and sign-in ----
  const other = await target(cat.token, nComment.id);
  ok(other.status === 404, `someone else's notification -> 404 (${other.status})`);
  const anon = await call("GET", `/api/me/notifications/${nComment.id}/target`);
  ok(anon.status === 401, `signed out -> 401 (${anon.status})`);
  const junk = await target(ann.token, "../../etc");
  ok(junk.status === 404, `bad id -> 404 (${junk.status})`);

  // ---- orders, notices, Support: add rows straight to the throwaway database ----
  await stop();
  const pg = new PGlite(join(dataDir, "pglite"));
  await pg.query("UPDATE users SET is_super_admin = true WHERE id = $1", [admin.id]);
  await pg.query("INSERT INTO shop_orders (id, user_id, seller_ids, status) VALUES ('ord-1', $1, $2, 'confirmed')", [ann.id, bob.id]);
  const add = (id, user, type, data) =>
    pg.query("INSERT INTO app_notifications (id, user_id, type, title, body, data) VALUES ($1, $2, $3, $4, $5, $6)", [id, user, type, `T ${type}`, `B ${type}`, JSON.stringify(data)]);
  await add("n-ord-buyer", ann.id, "order", { orderId: "ord-1", role: "buyer" });
  await add("n-ord-seller", bob.id, "order", { orderId: "ord-1", role: "seller" });
  await add("n-ord-cat", cat.id, "order", { orderId: "ord-1", role: "buyer" });
  await add("n-ord-admin", admin.id, "order", { orderId: "ord-1" });
  await add("n-ord-gone", ann.id, "order", { orderId: "ord-404" });
  await add("n-ord-bad", ann.id, "order", { orderId: "<script>" });
  await add("n-warn", ann.id, "warning", { screen: "Home" });
  await add("n-mod", ann.id, "moderation", { itemId: "x" });
  await add("n-official", ann.id, "official", { screen: "OfficialChat", account: "safety" });
  await add("n-support-user", ann.id, "support", { screen: "Support" });
  await add("n-support-admin", admin.id, "support", { screen: "AdminSupport", supportThreadId: ann.id });
  await add("n-support-fake", ann.id, "support", { screen: "AdminSupport", supportThreadId: ann.id });
  await add("n-evil", ann.id, "mystery", { screen: "AdminApp", url: "javascript:alert(1)" });
  await add("n-reminder", ann.id, "reminder", { diaryId: "d1" });
  await add("n-old-comment", ann.id, "comment", { postId });
  await add("n-gone-user", ann.id, "follow", { userId: "nobody-here" });
  // Bob's comment is deleted.
  await pg.query("DELETE FROM post_comments WHERE id::text = $1", [commentId]);
  await pg.close();
  await start();
  for (const u of [admin, ann, bob, cat]) u.token = (await login(u)) || u.token;

  const ob = await target(ann.token, "n-ord-buyer");
  ok(ob.data.status === "ok" && ob.data.target.screen === "OrderDetail" && ob.data.target.params.orderId === "ord-1", "order update -> that order (buyer)", ob.data);
  const os = await target(bob.token, "n-ord-seller");
  ok(os.data.status === "ok" && os.data.target.params?.orderId === "ord-1", "order update -> that order (seller)", os.data);
  const oa = await target(admin.token, "n-ord-admin");
  ok(oa.data.status === "ok" && oa.data.target.params?.orderId === "ord-1", "order -> admin may open it", oa.data);
  const oc = await target(cat.token, "n-ord-cat");
  ok(oc.data.status === "forbidden" && oc.data.what === "order" && !oc.data.target, "someone else's order -> refused", oc.data);
  const og = await target(ann.token, "n-ord-gone");
  ok(og.data.status === "missing" && og.data.what === "order", "deleted order -> 'not found'", og.data);
  const obad = await target(ann.token, "n-ord-bad");
  ok(obad.data.status === "missing", "unsafe order id -> 'not found'", obad.data);

  const cg = await target(ann.token, nComment.id);
  ok(cg.data.status === "missing" && cg.data.what === "comment" && cg.data.target?.screen === "PostDetail" && cg.data.target.params.commentMissing === true,
    "deleted comment -> its post, with 'comment removed'", cg.data);
  const oldc = await target(ann.token, "n-old-comment");
  ok(oldc.data.status === "ok" && oldc.data.target.params.toComments === true, "older comment notification -> post at its comments", oldc.data);

  for (const id of ["n-warn", "n-mod"]) {
    const r = await target(ann.token, id);
    ok(r.data.status === "ok" && r.data.target.screen === "Notice" && r.data.notification.body, `${id} -> full message page`, r.data);
  }
  const of = await target(ann.token, "n-official");
  ok(of.data.target?.screen === "OfficialChat" && of.data.target.params.account === "safety", "official -> that official account's chat", of.data);
  const su = await target(ann.token, "n-support-user");
  ok(su.data.target?.screen === "SupportChat", "Support reply -> Support chat", su.data);
  const sa = await target(admin.token, "n-support-admin");
  ok(sa.data.target?.screen === "AdminApp" && sa.data.target.params.openThread === ann.id, "new Support message -> admin opens that conversation", sa.data);
  const sf = await target(ann.token, "n-support-fake");
  ok(sf.data.status === "forbidden" && sf.data.what === "admin", "non-admin can't be sent into the admin app", sf.data);
  const ev = await target(ann.token, "n-evil");
  ok(ev.data.target?.screen === "Notice", "unknown type with a screen in its data -> just the message, not that screen", ev.data);
  const rm = await target(ann.token, "n-reminder");
  ok(rm.data.target?.screen === "FarmDiary", "reminder -> farm diary", rm.data);
  const gu = await target(ann.token, "n-gone-user");
  ok(gu.data.status === "missing" && gu.data.what === "user", "deleted account -> 'not found'", gu.data);

  // Unread stays as it was: opening the target doesn't mark anything read by itself.
  const list = await call("GET", "/api/me/notifications", ann.token);
  const ns = list.data?.notifications || list.data || [];
  const w = ns.find((n) => n.id === "n-warn");
  ok(w && !(w.isRead || w.read || w.readAt), "looking up a target doesn't mark it read", w);
  await call("POST", "/api/me/notifications/read", ann.token, { ids: ["n-warn"] });
  const list2 = await call("GET", "/api/me/notifications", ann.token);
  const w2 = (list2.data?.notifications || list2.data || []).find((n) => n.id === "n-warn");
  const others = (list2.data?.notifications || list2.data || []).filter((n) => n.id !== "n-warn" && !(n.isRead || n.read || n.readAt));
  ok(w2 && (w2.isRead || w2.read || w2.readAt) && others.length > 3, "marking one read leaves the rest unread", { w2, others: others.length });

  // Post deleted by its author.
  const del = await call("DELETE", `/api/posts/${postId}`, ann.token);
  ok(del.status === 200 || del.status === 204, "ann deletes the post", del);
  const pg2 = await target(ann.token, nLike.id);
  ok(pg2.data.status === "missing" && pg2.data.what === "post", "deleted post -> 'post removed'", pg2.data);
} catch (e) {
  failed++;
  console.log("FAIL  crashed:", e?.stack || e?.message);
} finally {
  await stop();
  rmSync(dataDir, { recursive: true, force: true });
  console.log(`\n${passed} passed, ${failed} failed`);
  process.exit(failed ? 1 : 0);
}
