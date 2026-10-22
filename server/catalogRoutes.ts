import type { Express, Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import crypto from "crypto";
import { sql } from "drizzle-orm";
import { db, dbReady } from "./db";
import { config } from "./config";
import { onOrderCreated, ensureFeatures } from "./featureRoutes";
import { quoteOrder, takeStock, ensureCheckout, validateCheckout } from "./checkoutRoutes";

/**
 * Server-backed catalog for content that used to be hard-coded in the app.
 *  GET    /api/catalog/:kind           list (kind = experts | events | listings); starts empty, no sample rows
 *  POST   /api/catalog/:kind           create (logged in)
 *  PUT    /api/catalog/:kind/:id       edit (owner or super admin)
 *  DELETE /api/catalog/:kind/:id       delete (owner or super admin)
 *  POST   /api/catalog/events/:id/register   register for an event (logged in) -> spotsLeft - 1
 *  POST   /api/shop-orders             record a placed order (any user) for admin analytics
 *  GET    /api/admin/analytics         super admin: totals + daily counts (users, posts, orders, products)
 */

const KINDS = ["experts", "events", "listings"] as const;
type Kind = (typeof KINDS)[number];

const rows = (r: any): any[] => (Array.isArray(r) ? r : r?.rows || []);

let ready: Promise<void> | null = null;
function ensure() {
  if (!ready) {
    ready = (async () => {
      await dbReady;
      await db.execute(sql`CREATE TABLE IF NOT EXISTS catalog_items (
        id varchar PRIMARY KEY,
        kind varchar NOT NULL,
        data jsonb NOT NULL,
        owner_id varchar,
        created_at timestamp NOT NULL DEFAULT now(),
        updated_at timestamp NOT NULL DEFAULT now()
      )`);
      await db.execute(sql`CREATE INDEX IF NOT EXISTS catalog_items_kind_idx ON catalog_items (kind, created_at)`);
      await db.execute(sql`CREATE TABLE IF NOT EXISTS shop_orders (
        id varchar PRIMARY KEY,
        user_id varchar,
        total numeric NOT NULL DEFAULT 0,
        item_count integer NOT NULL DEFAULT 0,
        payment_method varchar,
        data jsonb,
        created_at timestamp NOT NULL DEFAULT now()
      )`);
      // Remove the sample rows older versions inserted on first use (ids "<kind>-seed-<n>", no owner).
      // Rows people added themselves always have an owner and a different id, so they stay.
      for (const kind of KINDS) {
        await db.execute(sql`DELETE FROM catalog_items WHERE kind = ${kind} AND owner_id IS NULL AND id LIKE ${kind + "-seed-%"}`);
      }
      await db.execute(sql`DELETE FROM favorites WHERE item_id LIKE ${"listings-seed-%"}`).catch(() => {});
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

const kindOk = (k: string): k is Kind => (KINDS as readonly string[]).includes(k);

const out = (r: any) => {
  const d = typeof r.data === "string" ? JSON.parse(r.data) : r.data;
  return { ...d, id: r.id, ownerId: r.owner_id || null, createdAt: r.created_at };
};

// Only keep plain fields, cap size
function clean(body: any) {
  const o: any = {};
  for (const [k, v] of Object.entries(body || {})) {
    if (k === "id" || k === "ownerId" || k === "createdAt") continue;
    if (v === null || ["string", "number", "boolean"].includes(typeof v)) o[k] = typeof v === "string" ? v.slice(0, 2000) : v;
    else if (typeof v === "object") o[k] = v;
  }
  return o;
}

const REQUIRED: Record<Kind, string> = { experts: "name", events: "title", listings: "name" };

export function registerCatalogRoutes(app: Express) {
  ensure().catch((e) => console.error("[catalog] setup failed:", e?.message || e));

  app.get("/api/catalog/:kind", async (req, res) => {
    const { kind } = req.params;
    if (!kindOk(kind)) return res.status(404).json({ error: "Unknown catalog" });
    try {
      await ensure();
      const r = rows(await db.execute(sql`SELECT * FROM catalog_items WHERE kind = ${kind} ORDER BY created_at DESC LIMIT 500`));
      // Shop products the admin hid, or that are switched off, are left out (their owner still sees them).
      const me = kind === "listings" ? userFrom(req) : null;
      const shown = kind === "listings" ? r.filter((x: any) => { const d = (typeof x.data === "string" ? JSON.parse(x.data) : x.data) || {}; return (!d.hidden && d.active !== false) || (me && x.owner_id === me); }) : r;
      res.json(shown.map(out));
    } catch (e: any) {
      console.error("[catalog] list", e?.message);
      res.status(500).json({ error: "Failed to load" });
    }
  });

  app.post("/api/catalog/events/:id/register", auth, async (req, res) => {
    try {
      await ensure();
      const r = rows(await db.execute(sql`SELECT * FROM catalog_items WHERE kind = 'events' AND id = ${req.params.id}`));
      if (!r[0]) return res.status(404).json({ error: "Event not found" });
      const d = out(r[0]);
      const uid = (req as any).uid;
      const regs: string[] = Array.isArray(d.registrations) ? d.registrations : [];
      if (!regs.includes(uid)) {
        if (typeof d.spotsLeft === "number" && d.spotsLeft <= 0) return res.status(409).json({ error: "No spots left" });
        regs.push(uid);
        d.registrations = regs;
        if (typeof d.spotsLeft === "number") d.spotsLeft = Math.max(0, d.spotsLeft - 1);
        const { id, ownerId, createdAt, ...data } = d;
        await db.execute(sql`UPDATE catalog_items SET data = ${JSON.stringify(data)}::jsonb, updated_at = now() WHERE id = ${id}`);
      }
      res.json({ ...d, registered: true });
    } catch (e: any) {
      res.status(500).json({ error: "Failed to register" });
    }
  });

  app.post("/api/catalog/:kind", auth, async (req, res) => {
    const { kind } = req.params;
    if (!kindOk(kind)) return res.status(404).json({ error: "Unknown catalog" });
    const data = clean(req.body);
    const need = REQUIRED[kind];
    if (!data[need] || !String(data[need]).trim()) return res.status(400).json({ error: `${need} is required` });
    try {
      await ensure();
      const id = `${kind}-${crypto.randomUUID()}`;
      const uid = (req as any).uid;
      await db.execute(sql`INSERT INTO catalog_items (id, kind, data, owner_id) VALUES (${id}, ${kind}, ${JSON.stringify(data)}::jsonb, ${uid})`);
      const r = rows(await db.execute(sql`SELECT * FROM catalog_items WHERE id = ${id}`));
      res.status(201).json(out(r[0]));
    } catch (e: any) {
      console.error("[catalog] create", e?.message);
      res.status(500).json({ error: "Failed to save" });
    }
  });

  async function canEdit(req: Request, res: Response) {
    const { kind, id } = req.params;
    if (!kindOk(kind)) return res.status(404).json({ error: "Unknown catalog" }), null;
    await ensure();
    const r = rows(await db.execute(sql`SELECT * FROM catalog_items WHERE kind = ${kind} AND id = ${id}`));
    if (!r[0]) return res.status(404).json({ error: "Not found" }), null;
    const uid = (req as any).uid;
    if (r[0].owner_id !== uid && !(await isSuperAdmin(uid))) return res.status(403).json({ error: "Only the owner or an admin can change this" }), null;
    return r[0];
  }

  app.put("/api/catalog/:kind/:id", auth, async (req, res) => {
    try {
      const row = await canEdit(req, res);
      if (!row) return;
      const prev = typeof row.data === "string" ? JSON.parse(row.data) : row.data;
      const data = { ...prev, ...clean(req.body) };
      await db.execute(sql`UPDATE catalog_items SET data = ${JSON.stringify(data)}::jsonb, updated_at = now() WHERE id = ${row.id}`);
      const r = rows(await db.execute(sql`SELECT * FROM catalog_items WHERE id = ${row.id}`));
      res.json(out(r[0]));
    } catch (e: any) {
      res.status(500).json({ error: "Failed to update" });
    }
  });

  app.delete("/api/catalog/:kind/:id", auth, async (req, res) => {
    try {
      const row = await canEdit(req, res);
      if (!row) return;
      await db.execute(sql`DELETE FROM catalog_items WHERE id = ${row.id}`);
      res.json({ success: true });
    } catch {
      res.status(500).json({ error: "Failed to delete" });
    }
  });

  app.post("/api/shop-orders", async (req, res) => {
    try {
      await ensure();
      const b = req.body || {};
      const id = String(b.id || crypto.randomUUID()).slice(0, 80);
      let total = Number(b.total) || 0;
      let checkout: any = null;
      if (b.checkout && typeof b.checkout === "object") {
        // Pass 5 checkout: the server works out the totals and checks stock.
        const q = await quoteOrder({ items: b.items, deliveryMethod: b.checkout.deliveryMethod, division: b.checkout.division, zone: b.checkout.zone, couponCode: b.checkout.couponCode });
        if (!q.lines.length) return res.status(400).json({ error: "Your cart is empty" });
        if (q.itemErrors.length) return res.status(400).json({ error: q.itemErrors[0].error, itemErrors: q.itemErrors });
        if (q.stockErrors.length) {
          const e = q.stockErrors[0];
          const ln = q.lines.find((l: any) => l.productId === e.productId);
          return res.status(409).json({ error: `Only ${e.available}${ln?.unit ? " " + ln.unit : ""} left of ${e.name}`, stockErrors: q.stockErrors });
        }
        if (b.checkout.deliveryMethod === "express" && q.deliveryMethod !== "express") return res.status(400).json({ error: q.methodError || "Express delivery isn't available here" });
        const v = validateCheckout(b.checkout, q.deliveryMethod);
        if (v.error) return res.status(400).json({ error: v.error });
        total = q.total;
        if (Array.isArray(b.items))
          b.items = b.items.map((it: any, i: number) => ({
            ...it, price: q.lines[i]?.price ?? it.price, name: q.lines[i]?.name || it.name, quantity: q.lines[i]?.quantity ?? it.quantity,
            // how the product was sold, saved on the order so it always reads "2.5 kg" / "3 bags (25 kg)"
            ...(q.lines[i] ? { unit: q.lines[i].unit, sellAs: q.lines[i].sellAs, lineTotal: q.lines[i].lineTotal } : {}),
            ...(q.lines[i]?.packSize ? { packSize: q.lines[i].packSize, packUnit: q.lines[i].packUnit } : {}),
            ...(q.lines[i]?.options ? { options: q.lines[i].options } : {}),
          }));
        // part amounts (2.5 kg) count as one item each
        b.itemCount = q.lines.reduce((n: number, l: any) => n + (Number.isInteger(l.quantity) ? l.quantity : 1), 0);
        const s = (v: any, n = 300) => String(v ?? "").trim().slice(0, n);
        checkout = {
          deliveryMethod: q.deliveryMethod, zone: q.deliveryMethod === "pickup" ? null : q.zone,
          contactName: s(b.checkout.contactName, 100), contactPhone: v.contactPhone, altPhone: v.altPhone,
          address: s(b.checkout.address, 300), division: s(b.checkout.division, 40), district: s(b.checkout.district, 60), upazila: s(b.checkout.upazila, 60),
          deliveryDate: s(b.checkout.deliveryDate, 20), timeSlot: s(b.checkout.timeSlot, 40), notes: s(b.checkout.notes, 500),
          subtotal: q.subtotal, deliveryFee: q.deliveryFee, discount: q.discount, coupon: q.coupon?.code || null, total: q.total,
        };
      }
      const itemCount = Math.max(0, parseInt(b.itemCount, 10) || 0);
      await db.execute(sql`INSERT INTO shop_orders (id, user_id, total, item_count, payment_method, data)
        VALUES (${id}, ${userFrom(req)}, ${total}, ${itemCount}, ${String(b.paymentMethod || "").slice(0, 20)}, ${JSON.stringify(b.items || [])}::jsonb)
        ON CONFLICT (id) DO NOTHING`);
      await ensureFeatures();
      if (checkout) {
        await ensureCheckout();
        await db.execute(sql`UPDATE shop_orders SET checkout = ${JSON.stringify(checkout)}::jsonb WHERE id = ${id}`);
        await takeStock(Array.isArray(b.items) ? b.items : []);
      }
      await onOrderCreated(id, userFrom(req), Array.isArray(b.items) ? b.items : [], b.shippingAddress || null);
      res.status(201).json({ success: true, id, total, checkout, items: Array.isArray(b.items) ? b.items : [] });
    } catch (e: any) {
      console.error("[shop-orders]", e?.message);
      res.status(500).json({ error: "Failed to record order" });
    }
  });

  app.delete("/api/shop-orders/:id", auth, async (req, res) => {
    try {
      if (!(await isSuperAdmin((req as any).uid))) return res.status(403).json({ error: "Super admin access required" });
      await ensure();
      await db.execute(sql`DELETE FROM shop_orders WHERE id = ${req.params.id}`);
      res.json({ success: true });
    } catch {
      res.status(500).json({ error: "Failed to delete" });
    }
  });

  app.get("/api/admin/analytics", auth, async (req, res) => {
    try {
      if (!(await isSuperAdmin((req as any).uid))) return res.status(403).json({ error: "Super admin access required" });
      await ensure();
      const days = Math.min(90, Math.max(7, parseInt(String(req.query.days || "14"), 10) || 14));
      const since = new Date(Date.now() - (days - 1) * 86400000);
      since.setUTCHours(0, 0, 0, 0);
      const s = since.toISOString();
      const daily = async (q: any) => {
        const r = rows(await db.execute(q));
        const m: Record<string, number> = {};
        for (const x of r) m[String(x.d).slice(0, 10)] = Number(x.n);
        return m;
      };
      const [u, p, o, l, pr] = await Promise.all([
        daily(sql`SELECT to_char(created_at, 'YYYY-MM-DD') AS d, count(*)::int AS n FROM users WHERE created_at >= ${s} GROUP BY 1`),
        daily(sql`SELECT to_char(created_at, 'YYYY-MM-DD') AS d, count(*)::int AS n FROM posts WHERE created_at >= ${s} GROUP BY 1`),
        daily(sql`SELECT to_char(created_at, 'YYYY-MM-DD') AS d, count(*)::int AS n FROM shop_orders WHERE created_at >= ${s} GROUP BY 1`),
        daily(sql`SELECT to_char(created_at, 'YYYY-MM-DD') AS d, count(*)::int AS n FROM catalog_items WHERE kind = 'listings' AND owner_id IS NOT NULL AND created_at >= ${s} GROUP BY 1`),
        daily(sql`SELECT to_char(created_at, 'YYYY-MM-DD') AS d, count(*)::int AS n FROM products WHERE created_at >= ${s} GROUP BY 1`),
      ]);
      const series = [] as any[];
      for (let i = 0; i < days; i++) {
        const d = new Date(since.getTime() + i * 86400000).toISOString().slice(0, 10);
        series.push({ date: d, users: u[d] || 0, posts: p[d] || 0, orders: o[d] || 0, products: (l[d] || 0) + (pr[d] || 0) });
      }
      const one = async (q: any) => Number(rows(await db.execute(q))[0]?.n || 0);
      const totals = {
        users: await one(sql`SELECT count(*)::int AS n FROM users`),
        posts: await one(sql`SELECT count(*)::int AS n FROM posts`),
        orders: await one(sql`SELECT count(*)::int AS n FROM shop_orders`),
        revenue: Number(rows(await db.execute(sql`SELECT coalesce(sum(total),0) AS n FROM shop_orders`))[0]?.n || 0),
        products:
          (await one(sql`SELECT count(*)::int AS n FROM catalog_items WHERE kind = 'listings'`)) +
          (await one(sql`SELECT count(*)::int AS n FROM products`)),
        experts: await one(sql`SELECT count(*)::int AS n FROM catalog_items WHERE kind = 'experts'`),
        events: await one(sql`SELECT count(*)::int AS n FROM catalog_items WHERE kind = 'events'`),
        comments: await one(sql`SELECT count(*)::int AS n FROM post_comments`),
        messages: await one(sql`SELECT count(*)::int AS n FROM direct_messages`).catch(() => 0),
      };
      const roles = rows(await db.execute(sql`SELECT coalesce(role, 'user') AS role, count(*)::int AS n FROM users GROUP BY 1 ORDER BY 2 DESC`)).map((r) => ({
        role: r.role,
        count: Number(r.n),
      }));
      const recentOrders = rows(await db.execute(sql`SELECT id, total, item_count, payment_method, created_at FROM shop_orders ORDER BY created_at DESC LIMIT 10`)).map((r) => ({
        id: r.id,
        total: Number(r.total),
        itemCount: Number(r.item_count),
        paymentMethod: r.payment_method,
        createdAt: r.created_at,
      }));
      res.json({ days, series, totals, roles, recentOrders });
    } catch (e: any) {
      console.error("[analytics]", e?.message);
      res.status(500).json({ error: "Failed to load analytics" });
    }
  });
}
