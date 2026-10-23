import type { Express, Request } from "express";
import crypto from "crypto";
import { sql } from "drizzle-orm";
import { db } from "./db";
import { ensureFeatures, notify } from "./featureRoutes";
import { ensureCheckout } from "./checkoutRoutes";

/**
 * Guest checkout: people without an account can buy from a shop or a shared link.
 *
 * The guest's phone makes a random order key (at least 32 characters) and sends it with the order.
 * Only a hash of the key is stored. The order id plus the key is the only way to read or cancel
 * a guest order, so nobody can look up somebody else's order by guessing ids.
 *
 *  GET  /api/guest-orders/:id          (header X-Guest-Key or ?k=)  the guest's own order
 *  POST /api/guest-orders/:id/cancel   (same key)                   cancel while still pending
 */

const rows = (r: any): any[] => (Array.isArray(r) ? r : r?.rows || []);
const J = (v: any) => (typeof v === "string" ? (() => { try { return JSON.parse(v); } catch { return null; } })() : v);

export const GUEST_KEY_RE = /^[A-Za-z0-9_-]{32,128}$/;
export const hashGuestKey = (k: string) => crypto.createHash("sha256").update("farmers-guest-order:" + k).digest("hex");
export function guestKeyMatches(key: string, storedHash: string | null | undefined) {
  if (!storedHash || !GUEST_KEY_RE.test(key)) return false;
  const a = Buffer.from(hashGuestKey(key));
  const b = Buffer.from(String(storedHash));
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

let ready: Promise<void> | null = null;
export function ensureGuestOrders() {
  if (!ready)
    ready = (async () => {
      await ensureFeatures();
      await ensureCheckout();
      await db.execute(sql`ALTER TABLE shop_orders ADD COLUMN IF NOT EXISTS guest_key_hash varchar`);
    })().catch((e) => {
      ready = null;
      throw e;
    });
  return ready;
}

/** Small per-address limit so a script can't flood shops with fake guest orders. */
const hits = new Map<string, number[]>();
export function guestOrderAllowed(req: Request, max = 8, windowMs = 60 * 60 * 1000) {
  const fwd = String(req.headers["x-forwarded-for"] || "").split(",")[0].trim();
  const ip = fwd || req.socket?.remoteAddress || "?";
  const now = Date.now();
  const list = (hits.get(ip) || []).filter((t) => now - t < windowMs);
  if (list.length >= max) {
    hits.set(ip, list);
    return false;
  }
  list.push(now);
  hits.set(ip, list);
  if (hits.size > 5000) for (const [k, v] of hits) if (!v.some((t) => now - t < windowMs)) hits.delete(k);
  return true;
}

export function guestLabel(checkout: any) {
  const n = String(checkout?.contactName || "").trim();
  return n ? `${n} (Guest)` : "Guest";
}

/** What a guest may see about their own order: no admin names, notes or seller ids. */
function guestOrderOut(r: any) {
  const pay = J(r.payment);
  return {
    id: r.id,
    guest: true,
    status: r.status || "pending",
    total: Number(r.total),
    itemCount: Number(r.item_count) || 0,
    paymentMethod: r.payment_method || "cod",
    payment: pay ? { method: pay.method, status: pay.status, senderNumber: pay.senderNumber, trxId: pay.trxId, note: pay.note } : null,
    items: (J(r.data) || []).map((i: any) => ({
      productId: i?.productId, name: i?.name, price: i?.price, quantity: i?.quantity, image: i?.image,
      unit: i?.unit, sellAs: i?.sellAs, packSize: i?.packSize, packUnit: i?.packUnit, options: i?.options, lineTotal: i?.lineTotal,
    })),
    checkout: J(r.checkout) || null,
    history: (J(r.history) || []).map((h: any) => ({ status: h?.status, at: h?.at })),
    createdAt: r.created_at ? new Date(r.created_at).toISOString() : null,
    updatedAt: r.updated_at ? new Date(r.updated_at).toISOString() : null,
  };
}

async function findGuestOrder(req: Request) {
  await ensureGuestOrders();
  const key = String(req.headers["x-guest-key"] || req.query.k || "");
  const id = String(req.params.id || "").slice(0, 80);
  if (!id || !GUEST_KEY_RE.test(key)) return null;
  const r = rows(await db.execute(sql`SELECT * FROM shop_orders WHERE id = ${id} AND user_id IS NULL LIMIT 1`))[0];
  if (!r || !guestKeyMatches(key, r.guest_key_hash)) return null;
  return r;
}

export function registerGuestOrderRoutes(app: Express) {
  ensureGuestOrders().catch((e) => console.error("[guest-orders] setup", e?.message));

  app.get("/api/guest-orders/:id", async (req, res) => {
    try {
      const r = await findGuestOrder(req);
      if (!r) return res.status(404).json({ error: "Order not found. Check the link you saved." });
      res.json(guestOrderOut(r));
    } catch (e: any) {
      console.error("[guest-orders] get", e?.message);
      res.status(500).json({ error: "Couldn't load the order" });
    }
  });

  app.post("/api/guest-orders/:id/cancel", async (req, res) => {
    try {
      const r = await findGuestOrder(req);
      if (!r) return res.status(404).json({ error: "Order not found. Check the link you saved." });
      if ((r.status || "pending") !== "pending")
        return res.status(400).json({ error: "This order can't be cancelled any more. Please call the shop." });
      const history = [...(J(r.history) || []), { status: "cancelled", at: new Date().toISOString(), by: "guest" }];
      await db.execute(sql`UPDATE shop_orders SET status = 'cancelled', history = ${JSON.stringify(history)}::jsonb, updated_at = now()
        WHERE id = ${r.id} AND status = 'pending'`);
      const who = guestLabel(J(r.checkout));
      for (const s of String(r.seller_ids || "").split(",").filter(Boolean))
        await notify(s, "order", "Order cancelled", `${who} cancelled order ${r.id}`, { orderId: r.id, role: "seller" });
      const fresh = rows(await db.execute(sql`SELECT * FROM shop_orders WHERE id = ${r.id} LIMIT 1`))[0];
      res.json(guestOrderOut(fresh));
    } catch (e: any) {
      console.error("[guest-orders] cancel", e?.message);
      res.status(500).json({ error: "Couldn't cancel the order" });
    }
  });
}
