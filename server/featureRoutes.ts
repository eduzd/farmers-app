import type { Express, Request, Response, NextFunction } from "express";
import express from "express";
import jwt from "jsonwebtoken";
import crypto from "crypto";
import fs from "fs";
import path from "path";
import { sql } from "drizzle-orm";
import { db, dbReady } from "./db";
import { config } from "./config";
import { sendPush } from "./push";

/**
 * Pass 4 features (all stored in the same database as the rest of the app):
 *  Notifications   GET /api/me/notifications, POST /api/me/notifications/read {ids?|all}, DELETE /api/me/notifications/:id
 *  Favorites       GET /api/me/favorites, POST /api/me/favorites {itemId, data} (toggle), DELETE /api/me/favorites/:itemId
 *  Reviews         GET /api/reviews/:targetId, POST /api/reviews/:targetId {rating, comment, targetOwnerId?}
 *  Follows         GET /api/follows/:userId, POST /api/follows/:userId (toggle)
 *  Orders          GET /api/me/orders, GET /api/me/sales, PUT /api/orders/:id/status {status}
 *  Wallet          GET /api/me/wallet  (transactions from real orders and sales)
 *  Uploads         POST /api/uploads {dataUrl} -> {url}; files served from /uploads
 *  Community       GET/POST /api/community/:kind (polls|questions|rfqs|diary), PUT/DELETE /api/community/:kind/:id
 *                  POST /api/community/polls/:id/vote, /questions/:id/upvote, /questions/:id/answers, /rfqs/:id/bids
 *  Price alerts    GET/POST /api/me/price-alerts, DELETE /api/me/price-alerts/:id, POST /api/me/price-alerts/check {prices}
 */

const rows = (r: any): any[] => (Array.isArray(r) ? r : r?.rows || []);
const iso = (v: any) => {
  if (!v) return null;
  if (v instanceof Date) return v.toISOString();
  const s = String(v);
  return new Date(/[zZ]|[+-]\d\d:?\d\d$/.test(s) ? s : s.replace(" ", "T") + "Z").toISOString();
};
const J = (v: any) => (typeof v === "string" ? JSON.parse(v) : v);

let ready: Promise<void> | null = null;
export function ensureFeatures() {
  if (!ready) {
    ready = (async () => {
      await dbReady;
      const q = (s: any) => db.execute(s);
      await q(sql`CREATE TABLE IF NOT EXISTS app_notifications (
        id varchar PRIMARY KEY, user_id varchar NOT NULL, type varchar NOT NULL, title text NOT NULL, body text,
        data jsonb, read_at timestamp, created_at timestamp NOT NULL DEFAULT now())`);
      await q(sql`CREATE INDEX IF NOT EXISTS app_notifications_user_idx ON app_notifications (user_id, created_at)`);
      await q(sql`CREATE TABLE IF NOT EXISTS favorites (
        user_id varchar NOT NULL, item_id varchar NOT NULL, data jsonb, created_at timestamp NOT NULL DEFAULT now(),
        PRIMARY KEY (user_id, item_id))`);
      await q(sql`CREATE TABLE IF NOT EXISTS item_reviews (
        id varchar PRIMARY KEY, target_id varchar NOT NULL, target_owner_id varchar, user_id varchar NOT NULL,
        rating integer NOT NULL, comment text, created_at timestamp NOT NULL DEFAULT now())`);
      await q(sql`CREATE UNIQUE INDEX IF NOT EXISTS item_reviews_target_user_idx ON item_reviews (target_id, user_id)`);
      await q(sql`CREATE TABLE IF NOT EXISTS follows (
        follower_id varchar NOT NULL, followee_id varchar NOT NULL, created_at timestamp NOT NULL DEFAULT now(),
        PRIMARY KEY (follower_id, followee_id))`);
      await q(sql`CREATE TABLE IF NOT EXISTS shop_orders (
        id varchar PRIMARY KEY, user_id varchar, total numeric NOT NULL DEFAULT 0, item_count integer NOT NULL DEFAULT 0,
        payment_method varchar, data jsonb, created_at timestamp NOT NULL DEFAULT now())`);
      await q(sql`ALTER TABLE shop_orders ADD COLUMN IF NOT EXISTS status varchar NOT NULL DEFAULT 'pending'`);
      await q(sql`ALTER TABLE shop_orders ADD COLUMN IF NOT EXISTS seller_ids text NOT NULL DEFAULT ''`);
      await q(sql`ALTER TABLE shop_orders ADD COLUMN IF NOT EXISTS address jsonb`);
      await q(sql`ALTER TABLE shop_orders ADD COLUMN IF NOT EXISTS history jsonb`);
      await q(sql`ALTER TABLE shop_orders ADD COLUMN IF NOT EXISTS updated_at timestamp`);
      await q(sql`CREATE TABLE IF NOT EXISTS community_items (
        id varchar PRIMARY KEY, kind varchar NOT NULL, data jsonb NOT NULL, owner_id varchar,
        created_at timestamp NOT NULL DEFAULT now(), updated_at timestamp NOT NULL DEFAULT now())`);
      await q(sql`CREATE INDEX IF NOT EXISTS community_items_kind_idx ON community_items (kind, created_at)`);
      await q(sql`CREATE TABLE IF NOT EXISTS user_price_alerts (
        id varchar PRIMARY KEY, user_id varchar NOT NULL, product text NOT NULL, condition varchar NOT NULL,
        target numeric NOT NULL, active boolean NOT NULL DEFAULT true, triggered_at timestamp,
        created_at timestamp NOT NULL DEFAULT now())`);
      // Remove the sample polls, questions and requests older versions inserted (ids "<kind>-seed-<n>", no owner).
      for (const kind of ["polls", "questions", "rfqs"]) {
        await q(sql`DELETE FROM community_items WHERE kind = ${kind} AND owner_id IS NULL AND id LIKE ${kind + "-seed-%"}`);
      }
    })().catch((e) => {
      ready = null;
      throw e;
    });
  }
  return ready;
}

function userFrom(req: Request): string | null {
  const h = req.headers.authorization;
  if (!h || !h.startsWith("Bearer ")) return null;
  try {
    return (jwt.verify(h.slice(7), config.jwtSecret) as any).userId || null;
  } catch {
    return null;
  }
}

function auth(req: Request, res: Response, next: NextFunction) {
  const uid = userFrom(req);
  if (!uid) return res.status(401).json({ error: "Please log in first" });
  (req as any).uid = uid;
  next();
}

async function isSuperAdmin(uid: string) {
  const r = rows(await db.execute(sql`SELECT is_super_admin FROM users WHERE id = ${uid} LIMIT 1`));
  return !!r[0]?.is_super_admin;
}

export async function publicUser(uid: string | null) {
  if (!uid) return null;
  const r = rows(await db.execute(sql`SELECT id, username, name, avatar, role, verified FROM users WHERE id = ${uid} LIMIT 1`));
  if (!r[0]) return null;
  const name = r[0].name || r[0].username || "User";
  return { id: r[0].id, username: r[0].username, name, avatar: r[0].avatar || null, role: r[0].role || "user", verified: !!r[0].verified, initials: name.trim().slice(0, 2).toUpperCase() };
}

/** Create an in-app notification for a user (never throws). */
export async function notify(userId: string | null | undefined, type: string, title: string, body: string, data: any = {}) {
  // Company shops (run by the admins) have no account to notify; admins see their orders in the dashboard.
  if (!userId || userId.startsWith("company-")) return;
  try {
    await ensureFeatures();
    const id = `n-${Date.now()}-${crypto.randomBytes(4).toString("hex")}`;
    await db.execute(sql`INSERT INTO app_notifications (id, user_id, type, title, body, data)
      VALUES (${id}, ${userId}, ${type}, ${title.slice(0, 200)}, ${body.slice(0, 500)}, ${JSON.stringify(data)}::jsonb)`);
    // Also send it to the user's phones (fire and forget).
    void sendPush(userId, title, body, { ...data, type, notificationId: id });
  } catch (e: any) {
    console.error("[notify]", e?.message);
  }
}

const ORDER_STATUSES = ["pending", "confirmed", "processing", "shipped", "delivered", "cancelled"];
const NEXT: Record<string, string[]> = {
  pending: ["confirmed", "cancelled"],
  confirmed: ["processing", "shipped", "cancelled"],
  processing: ["shipped", "cancelled"],
  shipped: ["delivered"],
  delivered: [],
  cancelled: [],
};

function orderOut(r: any) {
  return {
    id: r.id,
    buyerId: r.user_id,
    sellerIds: String(r.seller_ids || "").split(",").filter(Boolean),
    total: Number(r.total),
    itemCount: Number(r.item_count),
    paymentMethod: r.payment_method,
    items: J(r.data) || [],
    status: r.status || "pending",
    shippingAddress: J(r.address) || null,
    checkout: J(r.checkout) || null,
    // Admin notes are private: never sent to the buyer or seller.
    history: (J(r.history) || [{ status: "pending", at: iso(r.created_at) }]).map(({ note, adminNote, ...h }: any) => h),
    createdAt: iso(r.created_at),
    updatedAt: iso(r.updated_at || r.created_at),
  };
}

/** Called by POST /api/shop-orders after the order row is written. */
export async function onOrderCreated(orderId: string, buyerId: string | null, items: any[], address: any) {
  try {
    await ensureFeatures();
    const sellers = new Set<string>();
    for (const it of items || []) {
      const pid = String(it?.productId || "");
      if (!pid) continue;
      const r = rows(await db.execute(sql`SELECT owner_id FROM catalog_items WHERE id = ${pid} LIMIT 1`));
      if (r[0]?.owner_id) sellers.add(r[0].owner_id);
      else if (it?.sellerId) sellers.add(String(it.sellerId));
    }
    const history = [{ status: "pending", at: new Date().toISOString() }];
    await db.execute(sql`UPDATE shop_orders SET seller_ids = ${[...sellers].join(",")}, address = ${JSON.stringify(address || null)}::jsonb,
      history = ${JSON.stringify(history)}::jsonb, updated_at = now() WHERE id = ${orderId}`);
    const buyer = await publicUser(buyerId);
    for (const s of sellers) {
      if (s === buyerId) continue;
      await notify(s, "order", "New order", `${buyer?.name || "A buyer"} ordered ${items.length} item(s). Order ${orderId}`, { orderId, role: "seller" });
    }
    if (buyerId) await notify(buyerId, "order", "Order placed", `Your order ${orderId} was placed. We'll let you know when the seller confirms it.`, { orderId, role: "buyer" });
  } catch (e: any) {
    console.error("[orders] created hook", e?.message);
  }
}

const COMMUNITY_KINDS = ["polls", "questions", "rfqs", "diary"] as const;
type CKind = (typeof COMMUNITY_KINDS)[number];
const ckOk = (k: string): k is CKind => (COMMUNITY_KINDS as readonly string[]).includes(k);
const REQUIRED: Record<CKind, string> = { polls: "question", questions: "question", rfqs: "title", diary: "title" };

function clean(body: any) {
  const o: any = {};
  for (const [k, v] of Object.entries(body || {})) {
    if (["id", "ownerId", "createdAt", "voters", "upvoters", "bids", "answerList"].includes(k)) continue;
    if (v === null || ["string", "number", "boolean"].includes(typeof v)) o[k] = typeof v === "string" ? v.slice(0, 4000) : v;
    else if (typeof v === "object") o[k] = v;
  }
  return o;
}

/** Per-user view: hide voter lists, mark what this user did. */
function communityOut(r: any, uid: string | null) {
  const d: any = { ...J(r.data) };
  const voters: Record<string, string> = d.voters || {};
  const upvoters: string[] = d.upvoters || [];
  const bids: any[] = d.bids || [];
  delete d.voters;
  delete d.upvoters;
  const isOwner = !!uid && r.owner_id === uid;
  if (r.kind === "polls") d.votedOptionId = (uid && voters[uid]) || null;
  if (r.kind === "questions") d.isUpvoted = !!uid && upvoters.includes(uid);
  if (r.kind === "rfqs") {
    d.bids = isOwner ? bids : bids.filter((b) => b.userId === uid);
    d.myBid = bids.find((b) => b.userId === uid) || null;
  }
  return { ...d, id: r.id, ownerId: r.owner_id || null, isMine: isOwner, createdAtIso: iso(r.created_at) };
}

async function getItem(kind: string, id: string) {
  const r = rows(await db.execute(sql`SELECT * FROM community_items WHERE kind = ${kind} AND id = ${id}`));
  return r[0] || null;
}
async function saveData(id: string, data: any) {
  await db.execute(sql`UPDATE community_items SET data = ${JSON.stringify(data)}::jsonb, updated_at = now() WHERE id = ${id}`);
}

/** Turn due diary reminders into notifications. */
async function fireDueReminders(uid: string) {
  const r = rows(await db.execute(sql`SELECT * FROM community_items WHERE kind = 'diary' AND owner_id = ${uid}`));
  const now = Date.now();
  for (const row of r) {
    const d = J(row.data);
    if (!d.remindAt || d.reminded) continue;
    const t = Date.parse(d.remindAt);
    if (!isFinite(t) || t > now) continue;
    d.reminded = true;
    await saveData(row.id, d);
    await notify(uid, "reminder", `Reminder: ${d.title}`, String(d.content || "").slice(0, 160), { diaryId: row.id });
  }
}

export function registerFeatureRoutes(app: Express) {
  ensureFeatures().catch((e) => console.error("[features] setup failed:", e?.message || e));

  const uploadDir = path.join(config.dataDir, "uploads");
  fs.mkdirSync(uploadDir, { recursive: true });
  app.use("/uploads", express.static(uploadDir, { maxAge: "7d" }));

  const wrap = (name: string, fn: (req: Request, res: Response) => Promise<any>) => async (req: Request, res: Response) => {
    try {
      await ensureFeatures();
      await fn(req, res);
    } catch (e: any) {
      console.error(`[${name}]`, e?.message || e);
      if (!res.headersSent) res.status(500).json({ error: "Something went wrong, please try again" });
    }
  };

  // ---------- uploads ----------
  app.post("/api/uploads", auth, wrap("upload", async (req, res) => {
    const m = /^data:(image\/(png|jpe?g|webp|gif));base64,(.+)$/s.exec(String(req.body?.dataUrl || ""));
    if (!m) return res.status(400).json({ error: "Send an image (PNG, JPG, WEBP or GIF)" });
    const buf = Buffer.from(m[3], "base64");
    if (buf.length > 8 * 1024 * 1024) return res.status(413).json({ error: "Image is larger than 8 MB" });
    const ext = m[2] === "jpeg" ? "jpg" : m[2];
    const name = `${crypto.randomUUID()}.${ext}`;
    fs.writeFileSync(path.join(uploadDir, name), buf);
    res.status(201).json({ url: `/uploads/${name}`, size: buf.length });
  }));

  // ---------- notifications ----------
  app.get("/api/me/notifications", auth, wrap("notifications", async (req, res) => {
    const uid = (req as any).uid;
    await fireDueReminders(uid);
    const r = rows(await db.execute(sql`SELECT * FROM app_notifications WHERE user_id = ${uid} ORDER BY created_at DESC LIMIT 200`));
    const list = r.map((n) => ({ id: n.id, type: n.type, title: n.title, body: n.body, data: J(n.data) || {}, read: !!n.read_at, createdAt: iso(n.created_at) }));
    res.json({ notifications: list, unread: list.filter((n) => !n.read).length });
  }));
  // Just the number of unread notifications, for the badge on the bell.
  app.get("/api/me/notifications/unread-count", auth, wrap("notifications", async (req, res) => {
    const uid = (req as any).uid;
    await fireDueReminders(uid);
    const r = rows(await db.execute(sql`SELECT count(*)::int AS n FROM app_notifications WHERE user_id = ${uid} AND read_at IS NULL`));
    res.json({ unread: Number(r[0]?.n) || 0 });
  }));
  app.post("/api/me/notifications/read", auth, wrap("notifications", async (req, res) => {
    const uid = (req as any).uid;
    const ids: string[] = Array.isArray(req.body?.ids) ? req.body.ids.map(String) : [];
    if (req.body?.all || !ids.length) await db.execute(sql`UPDATE app_notifications SET read_at = now() WHERE user_id = ${uid} AND read_at IS NULL`);
    else for (const id of ids) await db.execute(sql`UPDATE app_notifications SET read_at = now() WHERE user_id = ${uid} AND id = ${id}`);
    res.json({ success: true });
  }));
  app.delete("/api/me/notifications/:id", auth, wrap("notifications", async (req, res) => {
    await db.execute(sql`DELETE FROM app_notifications WHERE user_id = ${(req as any).uid} AND id = ${req.params.id}`);
    res.json({ success: true });
  }));

  // ---------- favorites ----------
  app.get("/api/me/favorites", auth, wrap("favorites", async (req, res) => {
    const r = rows(await db.execute(sql`SELECT * FROM favorites WHERE user_id = ${(req as any).uid} ORDER BY created_at DESC`));
    res.json(r.map((f) => ({ ...(J(f.data) || {}), itemId: f.item_id, addedAt: iso(f.created_at) })));
  }));
  app.post("/api/me/favorites", auth, wrap("favorites", async (req, res) => {
    const uid = (req as any).uid;
    const itemId = String(req.body?.itemId || "").slice(0, 120);
    if (!itemId) return res.status(400).json({ error: "itemId is required" });
    const ex = rows(await db.execute(sql`SELECT 1 FROM favorites WHERE user_id = ${uid} AND item_id = ${itemId}`));
    if (ex.length && req.body?.force !== true) {
      await db.execute(sql`DELETE FROM favorites WHERE user_id = ${uid} AND item_id = ${itemId}`);
      return res.json({ favorite: false, itemId });
    }
    await db.execute(sql`INSERT INTO favorites (user_id, item_id, data) VALUES (${uid}, ${itemId}, ${JSON.stringify(clean(req.body?.data || {}))}::jsonb)
      ON CONFLICT (user_id, item_id) DO NOTHING`);
    res.json({ favorite: true, itemId });
  }));
  app.delete("/api/me/favorites/:itemId", auth, wrap("favorites", async (req, res) => {
    await db.execute(sql`DELETE FROM favorites WHERE user_id = ${(req as any).uid} AND item_id = ${req.params.itemId}`);
    res.json({ favorite: false });
  }));

  // ---------- reviews ----------
  app.get("/api/reviews/:targetId", wrap("reviews", async (req, res) => {
    const r = rows(await db.execute(sql`SELECT r.*, u.name, u.username FROM item_reviews r LEFT JOIN users u ON u.id = r.user_id
      WHERE r.target_id = ${req.params.targetId} ORDER BY r.created_at DESC LIMIT 200`));
    const list = r.map((x) => ({ id: x.id, userId: x.user_id, userName: x.name || x.username || "User", rating: Number(x.rating), comment: x.comment || "", createdAt: iso(x.created_at) }));
    const avg = list.length ? list.reduce((s, x) => s + x.rating, 0) / list.length : 0;
    res.json({ reviews: list, count: list.length, average: Math.round(avg * 10) / 10 });
  }));
  app.post("/api/reviews/:targetId", auth, wrap("reviews", async (req, res) => {
    const uid = (req as any).uid;
    const rating = Math.round(Number(req.body?.rating));
    if (!(rating >= 1 && rating <= 5)) return res.status(400).json({ error: "Rating must be 1 to 5 stars" });
    const targetId = req.params.targetId.slice(0, 120);
    let owner: string | null = req.body?.targetOwnerId ? String(req.body.targetOwnerId) : null;
    const cat = rows(await db.execute(sql`SELECT owner_id FROM catalog_items WHERE id = ${targetId} LIMIT 1`));
    if (cat[0]?.owner_id) owner = cat[0].owner_id;
    if (owner === uid) return res.status(400).json({ error: "You can't review your own listing" });
    const comment = String(req.body?.comment || "").slice(0, 1000);
    const id = `rv-${crypto.randomUUID()}`;
    await db.execute(sql`INSERT INTO item_reviews (id, target_id, target_owner_id, user_id, rating, comment) VALUES (${id}, ${targetId}, ${owner}, ${uid}, ${rating}, ${comment})
      ON CONFLICT (target_id, user_id) DO UPDATE SET rating = ${rating}, comment = ${comment}, created_at = now()`);
    const me = await publicUser(uid);
    await notify(owner, "review", "New review", `${me?.name || "Someone"} rated ${req.body?.targetName || "your listing"} ${rating} star(s)`, { targetId });
    res.status(201).json({ success: true });
  }));
  app.get("/api/sellers/:userId/rating", wrap("reviews", async (req, res) => {
    const r = rows(await db.execute(sql`SELECT coalesce(avg(rating),0) AS a, count(*)::int AS n FROM item_reviews WHERE target_owner_id = ${req.params.userId}`));
    res.json({ average: Math.round(Number(r[0]?.a || 0) * 10) / 10, count: Number(r[0]?.n || 0) });
  }));

  // ---------- follows ----------
  app.get("/api/follows/:userId", wrap("follows", async (req, res) => {
    const uid = userFrom(req);
    const target = req.params.userId === "me" ? uid : req.params.userId;
    if (!target) return res.status(401).json({ error: "Please log in first" });
    const fl = rows(await db.execute(sql`SELECT u.id, u.name, u.username, u.avatar, u.role, u.verified FROM follows f JOIN users u ON u.id = f.follower_id WHERE f.followee_id = ${target} ORDER BY f.created_at DESC`));
    const fg = rows(await db.execute(sql`SELECT u.id, u.name, u.username, u.avatar, u.role, u.verified FROM follows f JOIN users u ON u.id = f.followee_id WHERE f.follower_id = ${target} ORDER BY f.created_at DESC`));
    const map = (u: any) => ({ id: u.id, name: u.name || u.username, username: u.username, avatar: u.avatar, role: u.role, verified: !!u.verified });
    res.json({
      followers: fl.map(map),
      following: fg.map(map),
      followerCount: fl.length,
      followingCount: fg.length,
      isFollowing: !!uid && fl.some((u) => u.id === uid),
    });
  }));
  app.post("/api/follows/:userId", auth, wrap("follows", async (req, res) => {
    const uid = (req as any).uid;
    const target = req.params.userId;
    if (target === uid) return res.status(400).json({ error: "You can't follow yourself" });
    const u = await publicUser(target);
    if (!u) return res.status(404).json({ error: "That user doesn't have an account yet" });
    const ex = rows(await db.execute(sql`SELECT 1 FROM follows WHERE follower_id = ${uid} AND followee_id = ${target}`));
    if (ex.length) {
      await db.execute(sql`DELETE FROM follows WHERE follower_id = ${uid} AND followee_id = ${target}`);
      return res.json({ following: false });
    }
    await db.execute(sql`INSERT INTO follows (follower_id, followee_id) VALUES (${uid}, ${target}) ON CONFLICT DO NOTHING`);
    const me = await publicUser(uid);
    await notify(target, "follow", "New follower", `${me?.name || "Someone"} started following you`, { userId: uid, userName: me?.name || "" });
    res.json({ following: true });
  }));

  // ---------- orders ----------
  app.get("/api/me/orders", auth, wrap("orders", async (req, res) => {
    const r = rows(await db.execute(sql`SELECT * FROM shop_orders WHERE user_id = ${(req as any).uid} ORDER BY created_at DESC LIMIT 200`));
    res.json(r.map(orderOut));
  }));
  app.get("/api/me/sales", auth, wrap("orders", async (req, res) => {
    const uid = (req as any).uid;
    const r = rows(await db.execute(sql`SELECT * FROM shop_orders WHERE (',' || seller_ids || ',') LIKE ${"%," + uid + ",%"} ORDER BY created_at DESC LIMIT 200`));
    const out = [] as any[];
    for (const o of r.map(orderOut)) out.push({ ...o, buyer: await publicUser(o.buyerId) });
    res.json(out);
  }));
  app.get("/api/orders/:id", auth, wrap("orders", async (req, res) => {
    const uid = (req as any).uid;
    const r = rows(await db.execute(sql`SELECT * FROM shop_orders WHERE id = ${req.params.id}`));
    if (!r[0]) return res.status(404).json({ error: "Order not found" });
    const o = orderOut(r[0]);
    if (o.buyerId !== uid && !o.sellerIds.includes(uid) && !(await isSuperAdmin(uid))) return res.status(403).json({ error: "Not your order" });
    res.json(o);
  }));
  app.put("/api/orders/:id/status", auth, wrap("orders", async (req, res) => {
    const uid = (req as any).uid;
    const status = String(req.body?.status || "");
    if (!ORDER_STATUSES.includes(status)) return res.status(400).json({ error: "Unknown status" });
    const r = rows(await db.execute(sql`SELECT * FROM shop_orders WHERE id = ${req.params.id}`));
    if (!r[0]) return res.status(404).json({ error: "Order not found" });
    const o = orderOut(r[0]);
    const isSeller = o.sellerIds.includes(uid);
    const isBuyer = o.buyerId === uid;
    const admin = !isSeller && !isBuyer ? await isSuperAdmin(uid) : false;
    if (!isSeller && !isBuyer && !admin) return res.status(403).json({ error: "Only the buyer or seller can update this order" });
    if (isBuyer && !isSeller && !admin && !(status === "cancelled" && o.status === "pending")) {
      return res.status(403).json({ error: "Buyers can only cancel an order before the seller confirms it" });
    }
    if (!(NEXT[o.status] || []).includes(status)) return res.status(409).json({ error: `Can't change a ${o.status} order to ${status}` });
    const history = [...o.history, { status, at: new Date().toISOString(), by: uid }];
    await db.execute(sql`UPDATE shop_orders SET status = ${status}, history = ${JSON.stringify(history)}::jsonb, updated_at = now() WHERE id = ${o.id}`);
    const label: Record<string, string> = { confirmed: "confirmed", processing: "being prepared", shipped: "shipped", delivered: "delivered", cancelled: "cancelled" };
    if (isBuyer && !isSeller) {
      for (const s of o.sellerIds) await notify(s, "order", "Order cancelled", `The buyer cancelled order ${o.id}`, { orderId: o.id, role: "seller" });
    } else {
      await notify(o.buyerId, "order", `Order ${label[status] || status}`, `Your order ${o.id} is now ${label[status] || status}.`, { orderId: o.id, role: "buyer", status });
    }
    res.json({ ...o, status, history });
  }));

  // ---------- wallet ----------
  app.get("/api/me/wallet", auth, wrap("wallet", async (req, res) => {
    const uid = (req as any).uid;
    const buys = rows(await db.execute(sql`SELECT * FROM shop_orders WHERE user_id = ${uid} ORDER BY created_at DESC LIMIT 100`)).map(orderOut);
    const sales = rows(await db.execute(sql`SELECT * FROM shop_orders WHERE (',' || seller_ids || ',') LIKE ${"%," + uid + ",%"} ORDER BY created_at DESC LIMIT 100`)).map(orderOut);
    const tx: any[] = [];
    for (const o of buys) if (o.status !== "cancelled") tx.push({ id: `b-${o.id}`, type: "debit", amount: o.total, title: `Order ${o.id}`, method: o.paymentMethod, status: o.status, date: o.createdAt });
    for (const o of sales) if (o.status !== "cancelled") {
      const mine = o.items.filter((i: any) => true);
      const amount = mine.reduce((s: number, i: any) => s + Number(i.price || 0) * Number(i.quantity || 1), 0) || o.total;
      tx.push({ id: `s-${o.id}`, type: "credit", amount, title: `Sale ${o.id}`, method: o.paymentMethod, status: o.status, date: o.createdAt });
    }
    tx.sort((a, b) => String(b.date).localeCompare(String(a.date)));
    const income = tx.filter((t) => t.type === "credit" && t.status === "delivered").reduce((s, t) => s + t.amount, 0);
    const pendingIncome = tx.filter((t) => t.type === "credit" && t.status !== "delivered").reduce((s, t) => s + t.amount, 0);
    const spent = tx.filter((t) => t.type === "debit").reduce((s, t) => s + t.amount, 0);
    res.json({ transactions: tx, income, pendingIncome, spent, balance: income });
  }));

  // ---------- price alerts ----------
  app.get("/api/me/price-alerts", auth, wrap("alerts", async (req, res) => {
    const r = rows(await db.execute(sql`SELECT * FROM user_price_alerts WHERE user_id = ${(req as any).uid} ORDER BY created_at DESC`));
    res.json(r.map((a) => ({ id: a.id, product: a.product, condition: a.condition, target: Number(a.target), active: !!a.active, triggeredAt: iso(a.triggered_at), createdAt: iso(a.created_at) })));
  }));
  app.post("/api/me/price-alerts", auth, wrap("alerts", async (req, res) => {
    const product = String(req.body?.product || "").trim().slice(0, 100);
    const target = Number(req.body?.target);
    const condition = req.body?.condition === "above" ? "above" : "below";
    if (!product || !(target > 0)) return res.status(400).json({ error: "Product and a target price are required" });
    const id = `pa-${crypto.randomUUID()}`;
    await db.execute(sql`INSERT INTO user_price_alerts (id, user_id, product, condition, target) VALUES (${id}, ${(req as any).uid}, ${product}, ${condition}, ${target})`);
    res.status(201).json({ id, product, condition, target, active: true });
  }));
  app.put("/api/me/price-alerts/:id", auth, wrap("alerts", async (req, res) => {
    await db.execute(sql`UPDATE user_price_alerts SET active = ${!!req.body?.active}, triggered_at = NULL WHERE id = ${req.params.id} AND user_id = ${(req as any).uid}`);
    res.json({ success: true });
  }));
  app.delete("/api/me/price-alerts/:id", auth, wrap("alerts", async (req, res) => {
    await db.execute(sql`DELETE FROM user_price_alerts WHERE id = ${req.params.id} AND user_id = ${(req as any).uid}`);
    res.json({ success: true });
  }));
  /** Compare the user's active alerts with current prices {name: price}; triggered alerts become notifications. */
  app.post("/api/me/price-alerts/check", auth, wrap("alerts", async (req, res) => {
    const uid = (req as any).uid;
    const prices: Record<string, number> = req.body?.prices || {};
    const norm = (s: string) => s.toLowerCase().replace(/\s+/g, "");
    const pmap = new Map(Object.entries(prices).map(([k, v]) => [norm(k), Number(v)]));
    const r = rows(await db.execute(sql`SELECT * FROM user_price_alerts WHERE user_id = ${uid} AND active = true AND triggered_at IS NULL`));
    const fired: any[] = [];
    for (const a of r) {
      const p = pmap.get(norm(a.product));
      if (p === undefined || !isFinite(p)) continue;
      const t = Number(a.target);
      if ((a.condition === "below" && p <= t) || (a.condition === "above" && p >= t)) {
        await db.execute(sql`UPDATE user_price_alerts SET triggered_at = now() WHERE id = ${a.id}`);
        await notify(uid, "price", `Price alert: ${a.product}`, `${a.product} is now ৳${p} (${a.condition === "below" ? "at or below" : "at or above"} your ৳${t} target)`, { alertId: a.id, price: p });
        fired.push({ id: a.id, product: a.product, price: p });
      }
    }
    res.json({ triggered: fired });
  }));

  // ---------- community items (polls, questions, rfqs, diary) ----------
  app.get("/api/community/:kind", wrap("community", async (req, res) => {
    const { kind } = req.params;
    if (!ckOk(kind)) return res.status(404).json({ error: "Unknown list" });
    const uid = userFrom(req);
    if (kind === "diary") {
      if (!uid) return res.status(401).json({ error: "Please log in to use your farm diary" });
      await fireDueReminders(uid);
      const r = rows(await db.execute(sql`SELECT * FROM community_items WHERE kind = 'diary' AND owner_id = ${uid} ORDER BY created_at DESC`));
      return res.json(r.map((x) => communityOut(x, uid)));
    }
    const r = rows(await db.execute(sql`SELECT * FROM community_items WHERE kind = ${kind} ORDER BY created_at DESC LIMIT 300`));
    res.json(r.map((x) => communityOut(x, uid)));
  }));

  app.post("/api/community/polls/:id/vote", auth, wrap("community", async (req, res) => {
    const uid = (req as any).uid;
    const row = await getItem("polls", req.params.id);
    if (!row) return res.status(404).json({ error: "Poll not found" });
    const d = J(row.data);
    if (d.isActive === false) return res.status(409).json({ error: "This poll has ended" });
    d.voters = d.voters || {};
    if (d.voters[uid]) return res.status(409).json({ error: "You already voted" });
    const opt = (d.options || []).find((o: any) => o.id === req.body?.optionId);
    if (!opt) return res.status(400).json({ error: "Pick one of the options" });
    opt.votes = Number(opt.votes || 0) + 1;
    d.totalVotes = Number(d.totalVotes || 0) + 1;
    d.voters[uid] = opt.id;
    await saveData(row.id, d);
    res.json(communityOut({ ...row, data: d }, uid));
  }));

  app.post("/api/community/questions/:id/upvote", auth, wrap("community", async (req, res) => {
    const uid = (req as any).uid;
    const row = await getItem("questions", req.params.id);
    if (!row) return res.status(404).json({ error: "Question not found" });
    const d = J(row.data);
    const ups: string[] = d.upvoters || [];
    const i = ups.indexOf(uid);
    if (i >= 0) {
      ups.splice(i, 1);
      d.upvotes = Math.max(0, Number(d.upvotes || 0) - 1);
    } else {
      ups.push(uid);
      d.upvotes = Number(d.upvotes || 0) + 1;
    }
    d.upvoters = ups;
    await saveData(row.id, d);
    res.json(communityOut({ ...row, data: d }, uid));
  }));

  app.post("/api/community/questions/:id/answers", auth, wrap("community", async (req, res) => {
    const uid = (req as any).uid;
    const text = String(req.body?.text || "").trim().slice(0, 2000);
    if (!text) return res.status(400).json({ error: "Write an answer first" });
    const row = await getItem("questions", req.params.id);
    if (!row) return res.status(404).json({ error: "Question not found" });
    const d = J(row.data);
    const me = await publicUser(uid);
    d.answerList = [...(d.answerList || []), { id: `a-${Date.now()}`, userId: uid, name: me?.name || "User", text, createdAt: new Date().toISOString() }];
    d.answers = Number(d.answers || 0) + 1;
    if (!d.answer) d.answer = text;
    await saveData(row.id, d);
    if (row.owner_id !== uid) await notify(row.owner_id, "answer", "New answer", `${me?.name || "Someone"} answered your question: "${String(d.question).slice(0, 60)}"`, { questionId: row.id });
    res.status(201).json(communityOut({ ...row, data: d }, uid));
  }));

  app.post("/api/community/rfqs/:id/bids", auth, wrap("community", async (req, res) => {
    const uid = (req as any).uid;
    const price = Number(req.body?.price);
    if (!(price > 0)) return res.status(400).json({ error: "Enter your price" });
    const row = await getItem("rfqs", req.params.id);
    if (!row) return res.status(404).json({ error: "Request not found" });
    if (row.owner_id === uid) return res.status(400).json({ error: "You can't bid on your own request" });
    const d = J(row.data);
    if (d.status === "closed") return res.status(409).json({ error: "This request is closed" });
    const me = await publicUser(uid);
    const bids: any[] = d.bids || [];
    const bid = { userId: uid, name: me?.name || "Seller", price, note: String(req.body?.note || "").slice(0, 500), createdAt: new Date().toISOString() };
    const i = bids.findIndex((b) => b.userId === uid);
    if (i >= 0) bids[i] = bid;
    else {
      bids.push(bid);
      d.bidsCount = Number(d.bidsCount || 0) + 1;
    }
    d.bids = bids;
    await saveData(row.id, d);
    await notify(row.owner_id, "rfq", "New quote", `${bid.name} quoted ৳${price} for "${String(d.title).slice(0, 60)}"`, { rfqId: row.id });
    res.status(201).json(communityOut({ ...row, data: d }, uid));
  }));

  app.post("/api/community/:kind", auth, wrap("community", async (req, res) => {
    const { kind } = req.params;
    if (!ckOk(kind)) return res.status(404).json({ error: "Unknown list" });
    const uid = (req as any).uid;
    const data = clean(req.body);
    const need = REQUIRED[kind];
    if (!data[need] || !String(data[need]).trim()) return res.status(400).json({ error: `${need} is required` });
    const me = await publicUser(uid);
    const author = { name: me?.name || "User", initials: me?.initials || "U" };
    if (kind === "polls") {
      const opts = (Array.isArray(data.options) ? data.options : []).map((o: any, i: number) => ({ id: `o${i}`, text: String(o?.text ?? o).slice(0, 200), votes: 0 })).filter((o: any) => o.text.trim());
      if (opts.length < 2) return res.status(400).json({ error: "Give at least 2 options" });
      Object.assign(data, { options: opts, totalVotes: 0, isActive: true, author });
    }
    if (kind === "questions") Object.assign(data, { author, upvotes: 0, answers: 0, isLive: false });
    if (kind === "rfqs") Object.assign(data, { buyer: author, status: "open", bidsCount: 0 });
    const id = `${kind}-${crypto.randomUUID()}`;
    await db.execute(sql`INSERT INTO community_items (id, kind, data, owner_id) VALUES (${id}, ${kind}, ${JSON.stringify(data)}::jsonb, ${uid})`);
    res.status(201).json(communityOut(await getItem(kind, id), uid));
  }));

  async function editable(req: Request, res: Response) {
    const { kind, id } = req.params;
    if (!ckOk(kind)) return res.status(404).json({ error: "Unknown list" }), null;
    const row = await getItem(kind, id);
    if (!row) return res.status(404).json({ error: "Not found" }), null;
    const uid = (req as any).uid;
    if (row.owner_id !== uid && !(await isSuperAdmin(uid))) return res.status(403).json({ error: "Only the owner or an admin can change this" }), null;
    return row;
  }
  app.put("/api/community/:kind/:id", auth, wrap("community", async (req, res) => {
    const row = await editable(req, res);
    if (!row) return;
    const d = { ...J(row.data), ...clean(req.body) };
    if (req.body?.remindAt !== undefined) d.reminded = false;
    await saveData(row.id, d);
    res.json(communityOut({ ...row, data: d }, (req as any).uid));
  }));
  app.delete("/api/community/:kind/:id", auth, wrap("community", async (req, res) => {
    const row = await editable(req, res);
    if (!row) return;
    await db.execute(sql`DELETE FROM community_items WHERE id = ${row.id}`);
    res.json({ success: true });
  }));
}
