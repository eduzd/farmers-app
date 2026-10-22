import type { Express, Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import { sql } from "drizzle-orm";
import { db, dbReady } from "./db";
import { config } from "./config";
import { publicUser, ensureFeatures } from "./featureRoutes";

/**
 * Where a notification opens (tap in the app's Notifications list, or tap on the phone push).
 *
 *  GET /api/me/notifications/:id/target
 *    -> { status: "ok",        target: { screen, params } }
 *    -> { status: "missing",   what: "post" | "order" | "user" | "comment", target?: {...} }
 *    -> { status: "forbidden", what: "order" | "admin" }
 *    404 when the notification isn't yours (or doesn't exist), 401 when signed out.
 *
 * The server decides the destination from the notification it stored for this user, never from
 * anything the phone sends, and checks the thing still exists and that this account may open it
 * (an order: its buyer, one of its sellers or a Farmers admin; Support conversations for admins:
 * admins only). The app only opens screens from its own fixed list, so a bad value can't take
 * anyone to an arbitrary place. Notices (warnings, admin announcements, official messages,
 * moderation) open as "Notice": the full message on its own page.
 *
 * A comment that was deleted still opens its post, with commentMissing so the app can say so.
 */
const rows = (r: any): any[] => (Array.isArray(r) ? r : r?.rows || []);
const J = (v: any) => { try { return typeof v === "string" ? JSON.parse(v) : v || {}; } catch { return {}; } };
const ID = /^[A-Za-z0-9_.:@-]{1,128}$/;
const cleanId = (v: any): string => { const s = String(v ?? ""); return ID.test(s) ? s : ""; };

function auth(req: Request, res: Response, next: NextFunction) {
  const h = req.headers.authorization;
  let uid: string | null = null;
  if (h?.startsWith("Bearer ")) {
    try { uid = (jwt.verify(h.slice(7), config.jwtSecret) as any).userId || null; } catch { uid = null; }
  }
  if (!uid) return res.status(401).json({ error: "Please log in first" });
  (req as any).uid = uid;
  next();
}

export const NOTICE_TYPES = ["official", "moderation", "admin", "system", "warning", "announcement", "notice", "safety"];

async function isAdmin(uid: string) {
  const u = rows(await db.execute(sql`SELECT is_super_admin, banned FROM users WHERE id = ${uid} LIMIT 1`))[0];
  return !!u && !!u.is_super_admin && !u.banned;
}

export type TargetResult =
  | { status: "ok"; target: { screen: string; params?: Record<string, any> } }
  | { status: "missing"; what: string; target?: { screen: string; params?: Record<string, any> } }
  | { status: "forbidden"; what: string };

export async function resolveNotificationTarget(uid: string, n: { type: string; data: any }): Promise<TargetResult> {
  const type = String(n.type || "");
  const d = J(n.data);
  const screen = String(d.screen || "");
  const notice: TargetResult = { status: "ok", target: { screen: "Notice" } };

  // Official accounts (Farmers Official, Safety...) open that account's chat when the app has it.
  if (type === "official" || screen === "OfficialChat")
    return { status: "ok", target: { screen: "OfficialChat", params: { account: cleanId(d.account) || "official" } } };
  if (NOTICE_TYPES.includes(type)) return notice;

  // Support: users open their Support chat, admins open that conversation in the admin app.
  if (type === "support" || screen === "Support" || screen === "AdminSupport") {
    if (screen === "AdminSupport") {
      if (!(await isAdmin(uid))) return { status: "forbidden", what: "admin" };
      const threadId = cleanId(d.supportThreadId);
      return { status: "ok", target: { screen: "AdminApp", params: threadId ? { openThread: threadId } : {} } };
    }
    return { status: "ok", target: { screen: "SupportChat" } };
  }

  if (type === "message") {
    const other = await publicUser(cleanId(d.userId) || null);
    if (!other) return { status: "missing", what: "user" };
    return { status: "ok", target: { screen: "Chat", params: { userId: other.id, userName: other.name } } };
  }

  if (type === "order" || d.orderId) {
    const orderId = cleanId(d.orderId);
    if (!orderId) return { status: "missing", what: "order" };
    const o = rows(await db.execute(sql`SELECT id, user_id, seller_ids FROM shop_orders WHERE id = ${orderId} LIMIT 1`))[0];
    if (!o) return { status: "missing", what: "order" };
    const sellers = String(o.seller_ids || "").split(",").filter(Boolean);
    if (o.user_id !== uid && !sellers.includes(uid) && !(await isAdmin(uid))) return { status: "forbidden", what: "order" };
    return { status: "ok", target: { screen: "OrderDetail", params: { orderId: o.id } } };
  }

  if (d.postId || type === "comment" || type === "like" || type === "new_post" || type === "mention") {
    const postId = cleanId(d.postId);
    const p = postId ? rows(await db.execute(sql`SELECT id FROM posts WHERE id = ${postId} LIMIT 1`))[0] : null;
    if (!p) return { status: "missing", what: "post" };
    const commentId = cleanId(d.commentId);
    if (commentId) {
      const c = rows(await db.execute(sql`SELECT id FROM post_comments WHERE id::text = ${commentId} AND post_id = ${p.id} LIMIT 1`))[0];
      if (!c) return { status: "missing", what: "comment", target: { screen: "PostDetail", params: { postId: p.id, commentMissing: true } } };
      return { status: "ok", target: { screen: "PostDetail", params: { postId: p.id, commentId: String(c.id) } } };
    }
    // Older comment notifications (sent before comment ids were saved) open the post at its comments.
    return { status: "ok", target: { screen: "PostDetail", params: type === "comment" ? { postId: p.id, toComments: true } : { postId: p.id } } };
  }

  if (type === "follow") {
    const u = await publicUser(cleanId(d.userId) || null);
    if (!u) return { status: "missing", what: "user" };
    return { status: "ok", target: { screen: "UserProfile", params: { user: u } } };
  }

  if (type === "rfq") return { status: "ok", target: { screen: "Rfq" } };
  if (type === "answer") return { status: "ok", target: { screen: "ExpertQA" } };
  if (type === "price") return { status: "ok", target: { screen: "PriceAlert" } };
  if (type === "reminder") return { status: "ok", target: { screen: "FarmDiary" } };
  if (type === "store" || type === "review") return { status: "ok", target: { screen: "SellerApp" } };

  // Anything else: show the whole message rather than guessing a page.
  return notice;
}

export function registerNotificationTargetRoutes(app: Express) {
  app.get("/api/me/notifications/:id/target", auth, async (req, res) => {
    try {
      await dbReady;
      await ensureFeatures();
      const uid = (req as any).uid as string;
      const id = cleanId(req.params.id);
      const n = id ? rows(await db.execute(sql`SELECT id, type, title, body, data, read_at, created_at FROM app_notifications WHERE id = ${id} AND user_id = ${uid} LIMIT 1`))[0] : null;
      if (!n) return res.status(404).json({ error: "Notification not found" });
      const result = await resolveNotificationTarget(uid, { type: n.type, data: n.data });
      res.json({
        ...result,
        notification: { id: n.id, type: n.type, title: n.title, body: n.body, read: !!n.read_at, createdAt: n.created_at ? new Date(n.created_at).toISOString() : null },
      });
    } catch (e: any) {
      console.error("notification target error:", e?.message || e);
      res.status(500).json({ error: "Couldn't open this notification" });
    }
  });
}
