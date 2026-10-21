import type { Express, Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import crypto from "crypto";
import { sql } from "drizzle-orm";
import { db } from "./db";
import { config } from "./config";
import { ensureFeatures } from "./featureRoutes";

/**
 * Checkout (pass 5):
 *  Coupons          GET /api/coupons                       -> active promo codes
 *  Quote            POST /api/checkout/quote {items, deliveryMethod, division, couponCode}
 *                   -> {subtotal, deliveryFee, discount, total, coupon, couponError, stockErrors, methods}
 *  Saved addresses  GET/POST /api/me/addresses, PUT /api/me/addresses/:id/default, DELETE /api/me/addresses/:id
 * POST /api/shop-orders (catalogRoutes) uses quoteOrder() when the client sends `checkout`, so totals are
 * worked out on the server, stock is checked and taken off the listing, and the delivery details are saved.
 */

const rows = (r: any): any[] => (Array.isArray(r) ? r : r?.rows || []);
const J = (v: any) => (typeof v === "string" ? JSON.parse(v) : v);

export const DIVISIONS = ["Dhaka", "Chattogram", "Rajshahi", "Khulna", "Barishal", "Sylhet", "Rangpur", "Mymensingh"];

export const DELIVERY_METHODS = [
  { id: "home", label: "Home delivery", days: "2-3 days" },
  { id: "express", label: "Express delivery", days: "Next day (Dhaka only)" },
  { id: "pickup", label: "Pick up from seller", days: "When the seller confirms" },
] as const;

export const FREE_DELIVERY_OVER = 2000;

export const COUPONS = [
  { code: "KRISHI10", type: "percent", value: 10, max: 200, minOrder: 300, description: "10% off (up to ৳200) on orders over ৳300" },
  { code: "NEW50", type: "flat", value: 50, minOrder: 400, description: "৳50 off orders over ৳400" },
  { code: "FARMER100", type: "flat", value: 100, minOrder: 1500, description: "৳100 off orders over ৳1,500" },
  { code: "FREESHIP", type: "shipping", value: 0, minOrder: 500, description: "Free delivery on orders over ৳500" },
] as const;

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

let ready: Promise<void> | null = null;
export function ensureCheckout() {
  if (!ready) {
    ready = (async () => {
      await ensureFeatures();
      await db.execute(sql`ALTER TABLE shop_orders ADD COLUMN IF NOT EXISTS checkout jsonb`);
      await db.execute(sql`CREATE TABLE IF NOT EXISTS user_addresses (
        id varchar PRIMARY KEY, user_id varchar NOT NULL, data jsonb NOT NULL, is_default boolean NOT NULL DEFAULT false,
        created_at timestamp NOT NULL DEFAULT now())`);
    })().catch((e) => {
      ready = null;
      throw e;
    });
  }
  return ready;
}

export function deliveryFee(method: string, division: string, subtotal: number) {
  if (method === "pickup") return 0;
  const inDhaka = String(division || "").toLowerCase() === "dhaka";
  if (method === "express") return inDhaka ? 150 : -1; // -1 = not available
  if (subtotal >= FREE_DELIVERY_OVER) return 0;
  return inDhaka ? 60 : 120;
}

export async function quoteOrder(input: any) {
  await ensureCheckout();
  const items: any[] = Array.isArray(input?.items) ? input.items : [];
  let method = ["home", "express", "pickup"].includes(input?.deliveryMethod) ? input.deliveryMethod : "home";
  const division = String(input?.division || "");
  const stockErrors: { productId: string; name: string; available: number }[] = [];
  const lines: any[] = [];
  let subtotal = 0;
  for (const it of items) {
    const qty = Math.max(1, parseInt(it?.quantity, 10) || 1);
    let price = Number(it?.price) || 0;
    let name = String(it?.name || "");
    const pid = String(it?.productId || "");
    if (pid) {
      const r = rows(await db.execute(sql`SELECT data FROM catalog_items WHERE id = ${pid} AND kind = 'listings' LIMIT 1`));
      if (r[0]) {
        const d = J(r[0].data) || {};
        if (Number(d.price) > 0) price = Number(d.price);
        name = d.name || name;
        const stock = d.quantity === undefined || d.quantity === null || d.quantity === "" ? null : Number(d.quantity);
        if (stock !== null && !Number.isNaN(stock) && qty > stock) stockErrors.push({ productId: pid, name, available: Math.max(0, stock) });
      }
    }
    subtotal += price * qty;
    lines.push({ productId: pid, name, price, quantity: qty });
  }
  let fee = deliveryFee(method, division, subtotal);
  const methodError = fee < 0 ? "Express delivery is only available inside Dhaka division" : null;
  if (fee < 0) {
    method = "home";
    fee = deliveryFee("home", division, subtotal);
  }

  let discount = 0;
  let coupon: any = null;
  let couponError: string | null = null;
  const code = String(input?.couponCode || "").trim().toUpperCase();
  if (code) {
    const c = COUPONS.find((x) => x.code === code);
    if (!c) couponError = "This code isn't valid";
    else if (subtotal < c.minOrder) couponError = `This code needs an order of at least ৳${c.minOrder}`;
    else {
      coupon = { code: c.code, description: c.description };
      if (c.type === "percent") discount = Math.min(Math.round((subtotal * c.value) / 100), (c as any).max || Infinity);
      else if (c.type === "flat") discount = c.value;
      else if (c.type === "shipping") discount = fee;
    }
  }
  discount = Math.min(discount, subtotal + fee);
  const total = Math.max(0, subtotal + fee - discount);
  const methods = DELIVERY_METHODS.map((m) => {
    const f = deliveryFee(m.id, division, subtotal);
    return { ...m, fee: f < 0 ? null : f, available: f >= 0 };
  });
  return { subtotal, deliveryMethod: method, deliveryFee: fee, discount, total, coupon, couponError, methodError, stockErrors, lines, methods, freeDeliveryOver: FREE_DELIVERY_OVER };
}

/** Take ordered quantities off listings that track stock. */
export async function takeStock(items: any[]) {
  for (const it of items || []) {
    const pid = String(it?.productId || "");
    const qty = Math.max(1, parseInt(it?.quantity, 10) || 1);
    if (!pid) continue;
    const r = rows(await db.execute(sql`SELECT data FROM catalog_items WHERE id = ${pid} AND kind = 'listings' LIMIT 1`));
    if (!r[0]) continue;
    const d = J(r[0].data) || {};
    if (d.quantity === undefined || d.quantity === null || d.quantity === "" || Number.isNaN(Number(d.quantity))) continue;
    d.quantity = Math.max(0, Number(d.quantity) - qty);
    d.sold = (Number(d.sold) || 0) + qty;
    await db.execute(sql`UPDATE catalog_items SET data = ${JSON.stringify(d)}::jsonb, updated_at = now() WHERE id = ${pid}`);
  }
}

const addrOut = (r: any) => ({ ...(J(r.data) || {}), id: r.id, isDefault: !!r.is_default });

function cleanAddress(b: any) {
  const s = (v: any, n = 200) => String(v ?? "").trim().slice(0, n);
  return {
    label: s(b?.label, 40) || "Home",
    fullName: s(b?.fullName, 100),
    phone: s(b?.phone, 30),
    division: s(b?.division, 40),
    district: s(b?.district, 60),
    upazila: s(b?.upazila, 60),
    address: s(b?.address, 300),
    area: s(b?.area || b?.upazila, 60),
    city: s(b?.city || b?.district, 60),
    postalCode: s(b?.postalCode, 10),
  };
}

export function registerCheckoutRoutes(app: Express) {
  const wrap = (fn: (req: Request, res: Response) => Promise<any>) => async (req: Request, res: Response) => {
    try {
      await ensureCheckout();
      await fn(req, res);
    } catch (e: any) {
      console.error("[checkout]", e?.message);
      res.status(500).json({ error: "Something went wrong" });
    }
  };

  app.get("/api/coupons", (_req, res) => {
    res.json(COUPONS.map((c) => ({ code: c.code, description: c.description, minOrder: c.minOrder })));
  });

  app.get("/api/checkout/options", (_req, res) => {
    res.json({ divisions: DIVISIONS, methods: DELIVERY_METHODS, freeDeliveryOver: FREE_DELIVERY_OVER });
  });

  app.post("/api/checkout/quote", wrap(async (req, res) => {
    res.json(await quoteOrder(req.body || {}));
  }));

  app.get("/api/me/addresses", auth, wrap(async (req, res) => {
    const r = rows(await db.execute(sql`SELECT * FROM user_addresses WHERE user_id = ${(req as any).uid} ORDER BY is_default DESC, created_at DESC`));
    res.json(r.map(addrOut));
  }));

  app.post("/api/me/addresses", auth, wrap(async (req, res) => {
    const uid = (req as any).uid;
    const a = cleanAddress(req.body);
    if (!a.fullName || !a.phone || !a.address || !a.district) return res.status(400).json({ error: "Name, phone, district and address are required" });
    const count = rows(await db.execute(sql`SELECT count(*)::int AS n FROM user_addresses WHERE user_id = ${uid}`))[0]?.n || 0;
    if (count >= 10) return res.status(400).json({ error: "You can save up to 10 addresses" });
    const makeDefault = !!req.body?.isDefault || count === 0;
    if (makeDefault) await db.execute(sql`UPDATE user_addresses SET is_default = false WHERE user_id = ${uid}`);
    const id = `addr-${crypto.randomUUID()}`;
    await db.execute(sql`INSERT INTO user_addresses (id, user_id, data, is_default) VALUES (${id}, ${uid}, ${JSON.stringify(a)}::jsonb, ${makeDefault})`);
    const r = rows(await db.execute(sql`SELECT * FROM user_addresses WHERE id = ${id}`));
    res.status(201).json(addrOut(r[0]));
  }));

  app.put("/api/me/addresses/:id/default", auth, wrap(async (req, res) => {
    const uid = (req as any).uid;
    const r = rows(await db.execute(sql`SELECT id FROM user_addresses WHERE id = ${req.params.id} AND user_id = ${uid}`));
    if (!r[0]) return res.status(404).json({ error: "Address not found" });
    await db.execute(sql`UPDATE user_addresses SET is_default = (id = ${req.params.id}) WHERE user_id = ${uid}`);
    res.json({ success: true });
  }));

  app.delete("/api/me/addresses/:id", auth, wrap(async (req, res) => {
    const uid = (req as any).uid;
    await db.execute(sql`DELETE FROM user_addresses WHERE id = ${req.params.id} AND user_id = ${uid}`);
    res.json({ success: true });
  }));
}
