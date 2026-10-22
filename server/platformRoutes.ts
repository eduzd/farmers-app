import type { Express, Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import crypto from "crypto";
import bcrypt from "bcryptjs";
import { sql } from "drizzle-orm";
import { db, dbReady } from "./db";
import { config } from "./config";
import { notify, ensureFeatures } from "./featureRoutes";
import { cleanOptions, cleanDeliveryConfig, deliveryConfig, ensureCheckout } from "./checkoutRoutes";
import { PART_UNITS, MAX_QTY, isStepMultiple, round3, SELL_UNITS } from "@shared/selling";

/**
 * Three apps, one backend.
 *
 *  Guard (every /api request):
 *    - banned accounts get 403 (code BANNED) and cannot log in
 *    - maintenance mode answers 503 (code MAINTENANCE) to everyone but super admins
 *    - feature flags (chat / marketplace / comments / uploads) block writes when switched off
 *    - hidden listings and listings of suspended stores are removed from the public catalog
 *  Public:   GET /api/app/status, GET /api/stores/:slug
 *  Seller:   GET /api/seller/me, POST /api/seller/register, PUT /api/seller/store,
 *            GET/POST /api/seller/products, PUT/DELETE /api/seller/products/:id, GET /api/seller/stats
 *            (a seller only ever touches the store and listings whose owner_id is their own user id)
 *  Admin:    /api/admin/manage/* (super admin JWT only): summary, users, stores, orders, catalog, notify
 */

export const rows = (r: any): any[] => (Array.isArray(r) ? r : r?.rows || []);
export const J = (v: any) => (typeof v === "string" ? JSON.parse(v) : v);
export const iso = (v: any) => {
  if (!v) return null;
  if (v instanceof Date) return v.toISOString();
  const s = String(v);
  return new Date(/[zZ]|[+-]\d\d:?\d\d$/.test(s) ? s : s.replace(" ", "T") + "Z").toISOString();
};
export const str = (v: any, max = 500) => (v === undefined || v === null ? "" : String(v).trim().slice(0, max));

let ready: Promise<void> | null = null;
export function ensurePlatform() {
  if (!ready) {
    ready = (async () => {
      await dbReady;
      await ensureFeatures();
      const q = (s: any) => db.execute(s);
      await q(sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS banned boolean NOT NULL DEFAULT false`);
      await q(sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS banned_reason text`);
      await q(sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS banned_until timestamp`);
      await q(sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS restrictions jsonb`);
      await q(sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS deleted_at timestamp`);
      await q(sql`CREATE TABLE IF NOT EXISTS catalog_items (
        id varchar PRIMARY KEY, kind varchar NOT NULL, data jsonb NOT NULL, owner_id varchar,
        created_at timestamp NOT NULL DEFAULT now(), updated_at timestamp NOT NULL DEFAULT now())`);
      await q(sql`CREATE TABLE IF NOT EXISTS stores (
        id varchar PRIMARY KEY,
        owner_id varchar NOT NULL UNIQUE,
        name varchar NOT NULL,
        slug varchar NOT NULL UNIQUE,
        tagline text, description text, logo text, banner text,
        theme_color varchar NOT NULL DEFAULT '#2563EB',
        phone varchar, location text, category varchar,
        status varchar NOT NULL DEFAULT 'active',
        status_reason text,
        created_at timestamp NOT NULL DEFAULT now(),
        updated_at timestamp NOT NULL DEFAULT now())`);
      await q(sql`ALTER TABLE shop_orders ADD COLUMN IF NOT EXISTS admin_note text`);
      await q(sql`ALTER TABLE shop_orders ADD COLUMN IF NOT EXISTS admin_notes jsonb`);
    })();
    ready.catch(() => (ready = null));
  }
  return ready;
}

function tokenUid(req: Request): string | null {
  const h = req.headers.authorization;
  if (!h || !h.startsWith("Bearer ")) return null;
  try {
    return (jwt.verify(h.slice(7), config.jwtSecret) as any).userId || null;
  } catch {
    return null;
  }
}

async function account(uid: string | null) {
  if (!uid) return null;
  const r = rows(await db.execute(sql`SELECT id, email, name, username, is_super_admin, banned, banned_until, restrictions, deleted_at FROM users WHERE id = ${uid} LIMIT 1`));
  const u = r[0] || null;
  // A time-limited ban ends by itself.
  if (u?.banned && u.banned_until && new Date(iso(u.banned_until) as string).getTime() <= Date.now()) {
    await db.execute(sql`UPDATE users SET banned = false, banned_reason = null, banned_until = null WHERE id = ${u.id}`);
    u.banned = false;
  }
  if (u?.deleted_at) u.banned = true;
  return u;
}

// ---------- moderation restrictions ----------
export const RESTRICTION_KEYS = ["message", "post", "comment", "sell", "buy"] as const;
export type Restrictions = { message?: boolean; post?: boolean; comment?: boolean; sell?: boolean; buy?: boolean; until?: string | null; reason?: string };

/** The restrictions that are switched on right now (an expired "until" switches them all off). */
export function activeRestrictions(raw: any): Restrictions {
  const r = (typeof raw === "string" ? JSON.parse(raw || "{}") : raw) || {};
  if (r.until && new Date(r.until).getTime() <= Date.now()) return {};
  const out: Restrictions = {};
  for (const k of RESTRICTION_KEYS) if (r[k]) out[k] = true;
  if (Object.keys(out).length) {
    out.until = r.until || null;
    out.reason = r.reason || "";
  }
  return out;
}

export function cleanRestrictions(b: any): Restrictions {
  const out: Restrictions = {};
  for (const k of RESTRICTION_KEYS) if (b?.[k]) out[k] = true;
  const days = Number(b?.days);
  if (b?.until) {
    const t = new Date(b.until).getTime();
    if (t > Date.now()) out.until = new Date(t).toISOString();
  } else if (days > 0) out.until = new Date(Date.now() + Math.min(days, 3650) * 86400000).toISOString();
  else out.until = null;
  out.reason = str(b?.reason, 300);
  return out;
}

/** Which restriction a write request needs to be free of (null = not a restricted action). */
export function restrictionFor(method: string, p: string): keyof Restrictions | null {
  if (method === "GET" || method === "HEAD" || method === "OPTIONS") return null;
  if (method === "DELETE") return null; // people can always remove their own things
  if (/^\/api\/dm\/[^/]+\/(messages|image|voice)$/.test(p) || p === "/api/dm/reactions" || /^\/api\/dm\/messages\/[^/]+\/reaction$/.test(p)) return "message";
  if (/^\/api\/posts\/[^/]+\/comments$/.test(p) || /^\/api\/community\/questions\/[^/]+\/answers$/.test(p) || /^\/api\/reviews\/[^/]+$/.test(p) || /^\/api\/community\/rfqs\/[^/]+\/bids$/.test(p)) return "comment";
  if (p === "/api/posts" || (method === "PATCH" && /^\/api\/posts\/[^/]+$/.test(p)) || /^\/api\/community\/(polls|questions|rfqs|diary)(\/[^/]+)?$/.test(p)) return "post";
  if (/^\/api\/seller\/(products|register|store)(\/[^/]+)?$/.test(p) || /^\/api\/catalog\/listings(\/[^/]+)?$/.test(p)) return "sell";
  if (p === "/api/shop-orders" || /^\/api\/bkash\//.test(p)) return "buy";
  return null;
}

const RESTRICTION_MSG: Record<string, string> = {
  message: "The admin has stopped your account from sending messages for now.",
  post: "The admin has stopped your account from posting in the community for now.",
  comment: "The admin has stopped your account from commenting for now.",
  sell: "The admin has stopped your account from selling for now.",
  buy: "The admin has stopped your account from placing orders for now.",
};

export const wrap = (fn: (req: Request, res: Response) => Promise<any>) => (req: Request, res: Response) => {
  ensurePlatform()
    .then(() => fn(req, res))
    .catch((e: any) => {
      console.error("[platform]", req.method, req.path, e?.message);
      if (!res.headersSent) res.status(500).json({ error: "Something went wrong, please try again" });
    });
};

export function requireUser(req: Request, res: Response, next: NextFunction) {
  const uid = tokenUid(req);
  if (!uid) return res.status(401).json({ error: "Please log in first" });
  (req as any).uid = uid;
  next();
}

export function requireAdmin(req: Request, res: Response, next: NextFunction) {
  const uid = tokenUid(req);
  if (!uid) return res.status(401).json({ error: "Please log in first" });
  ensurePlatform()
    .then(() => account(uid))
    .then((u) => {
      if (!u || !u.is_super_admin || u.banned) return res.status(403).json({ error: "Admin access required" });
      (req as any).uid = uid;
      (req as any).admin = u;
      next();
    })
    .catch(() => res.status(500).json({ error: "Authentication failed" }));
}

export async function audit(req: Request, action: string, targetType: string, targetId: string | null, details: any) {
  const a = (req as any).admin;
  try {
    await db.execute(sql`INSERT INTO audit_logs (id, admin_id, admin_email, action, target_type, target_id, details)
      VALUES (${crypto.randomUUID()}, ${a?.id || null}, ${a?.email || null}, ${action}, ${targetType}, ${targetId}, ${typeof details === "string" ? details : JSON.stringify(details)})`);
  } catch (e: any) {
    console.error("[audit]", e?.message);
  }
}

// ---------- app settings (cached for a few seconds) ----------
type Settings = { maintenanceMode: boolean; maintenanceMessage: string; featureFlags: Record<string, boolean> };
let settingsCache: { at: number; v: Settings } | null = null;
export function clearSettingsCache() {
  settingsCache = null;
}
async function appSettings(): Promise<Settings> {
  if (settingsCache && Date.now() - settingsCache.at < 3000) return settingsCache.v;
  const m: Record<string, string> = {};
  try {
    for (const r of rows(await db.execute(sql`SELECT key, value FROM app_settings`))) m[r.key] = r.value;
  } catch {}
  const v: Settings = {
    maintenanceMode: m["maintenance_mode"] === "true",
    maintenanceMessage: m["maintenance_message"] || "",
    featureFlags: {
      chatEnabled: m["feature_chat"] !== "false",
      marketplaceEnabled: m["feature_marketplace"] !== "false",
      commentsEnabled: m["feature_comments"] !== "false",
      uploadsEnabled: m["feature_uploads"] !== "false",
    },
  };
  settingsCache = { at: Date.now(), v };
  return v;
}

async function hiddenFilterSets() {
  const suspended = new Set<string>();
  for (const r of rows(await db.execute(sql`SELECT owner_id FROM stores WHERE status <> 'active'`))) suspended.add(r.owner_id);
  return suspended;
}

/** Mounted before every other route. */
export function platformGuard(req: Request, res: Response, next: NextFunction) {
  const p = req.path;
  if (!p.startsWith("/api/") || p === "/api/health" || p === "/api/app/status") return next();
  (async () => {
    await ensurePlatform();
    const uid = tokenUid(req);
    const me = await account(uid);
    if (uid && !me) {
      // The account behind this sign-in was deleted.
      return res.status(401).json({ error: "This account no longer exists.", code: "NO_ACCOUNT" });
    }
    if (me?.banned) {
      return res.status(403).json({ error: "Your account has been suspended by the admin.", code: "BANNED" });
    }
    if (req.method === "POST" && /^\/api\/auth\/login$/.test(p) && req.body?.email) {
      const r = rows(await db.execute(sql`SELECT id FROM users WHERE lower(email) = lower(${String(req.body.email)}) LIMIT 1`));
      const who = r[0] ? await account(r[0].id) : null;
      if (who?.banned) return res.status(403).json({ error: "Your account has been suspended by the admin.", code: "BANNED" });
    }
    const isAdmin = !!me?.is_super_admin;
    if (!isAdmin && me?.restrictions) {
      const need = restrictionFor(req.method, p);
      const act = activeRestrictions(me.restrictions);
      if (need && (act as any)[need]) {
        return res.status(403).json({ error: RESTRICTION_MSG[need as string], code: "RESTRICTED", restriction: need, until: act.until || null, reason: act.reason || "" });
      }
    }
    if (!isAdmin) {
      const s = await appSettings();
      if (s.maintenanceMode && !p.startsWith("/api/auth/") && !p.startsWith("/api/admin/")) {
        return res.status(503).json({ error: s.maintenanceMessage || "The app is under maintenance. Please try again soon.", code: "MAINTENANCE" });
      }
      if (req.method !== "GET") {
        const f = s.featureFlags;
        const off = (msg: string) => res.status(403).json({ error: msg, code: "FEATURE_OFF" });
        if (!f.chatEnabled && /^\/api\/(dm|chat|messages|conversations)/.test(p)) return off("Chat is turned off by the admin right now.");
        if (!f.marketplaceEnabled && /^\/api\/(shop-orders|catalog\/listings|seller\/products|checkout)/.test(p)) return off("The marketplace is closed by the admin right now.");
        if (!f.commentsEnabled && /\/(comments|answers)$/.test(p)) return off("Comments are turned off by the admin right now.");
        if (!f.uploadsEnabled && p === "/api/uploads") return off("Uploads are turned off by the admin right now.");
      }
      if (req.method === "GET" && p === "/api/catalog/listings") {
        const suspended = await hiddenFilterSets();
        const orig = res.json.bind(res);
        (res as any).json = (body: any) =>
          orig(Array.isArray(body) ? body.filter((it: any) => !it?.hidden && !(it?.ownerId && suspended.has(it.ownerId))) : body);
      }
    }
    next();
  })().catch((e) => {
    console.error("[guard]", e?.message);
    next();
  });
}

// ---------- helpers ----------
/** Company shops are run by the admins and have no owner account; their products use this made-up owner id. */
export const COMPANY_OWNER_PREFIX = "company-";
export const isCompanyOwner = (id: any) => typeof id === "string" && id.startsWith(COMPANY_OWNER_PREFIX);
export function storeOut(r: any) {
  if (!r) return null;
  return {
    id: r.id,
    ownerId: r.owner_id,
    /** a company shop the admin runs, with no owner account */
    companyShop: isCompanyOwner(r.owner_id),
    name: r.name,
    slug: r.slug,
    tagline: r.tagline || "",
    description: r.description || "",
    logo: r.logo || "",
    banner: r.banner || "",
    themeColor: r.theme_color || "#2563EB",
    phone: r.phone || "",
    location: r.location || "",
    category: r.category || "",
    status: r.status,
    statusReason: r.status_reason || "",
    createdAt: iso(r.created_at),
  };
}
export const itemOut = (r: any) => ({ ...(J(r.data) || {}), id: r.id, ownerId: r.owner_id || null, createdAt: iso(r.created_at), updatedAt: iso(r.updated_at) });
async function myStore(uid: string) {
  return rows(await db.execute(sql`SELECT * FROM stores WHERE owner_id = ${uid} LIMIT 1`))[0] || null;
}
export function slugify(name: string) {
  const base = name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 40) || "store";
  return `${base}-${crypto.randomBytes(2).toString("hex")}`;
}
export const HEX = /^#[0-9a-fA-F]{6}$/;

export function storeFields(body: any) {
  const o: Record<string, string> = {};
  for (const k of ["name", "tagline", "description", "logo", "banner", "phone", "location", "category"]) {
    if (body?.[k] !== undefined) o[k] = str(body[k], k === "description" ? 2000 : 500);
  }
  if (body?.themeColor !== undefined && HEX.test(String(body.themeColor))) o.theme_color = String(body.themeColor);
  return o;
}

/** weight = by kg/g/maund, piece = each, pack = a bag/box with a fixed amount, volume = litre, dozen = 12 pieces */
export const SELL_AS = ["weight", "piece", "pack", "volume", "dozen"];
export function productFields(body: any, partial: boolean) {
  const o: any = {};
  const err = (m: string) => ({ error: m });
  if (!partial || body?.name !== undefined) {
    o.name = str(body?.name, 120);
    if (!o.name) return err("Product name is required");
  }
  if (!partial || body?.price !== undefined) {
    o.price = Number(body?.price);
    if (!(o.price > 0)) return err("Price must be more than 0");
  }
  if (body?.quantity !== undefined) {
    o.quantity = Math.max(0, round3(Number(body.quantity) || 0));
  } else if (!partial) o.quantity = 0;
  for (const k of ["unit", "category", "description", "image", "location"]) if (body?.[k] !== undefined) o[k] = str(body[k], k === "description" ? 2000 : 500);
  if (body?.active !== undefined) o.active = !!body.active;
  const amt = (v: any) => (v === null || v === "" ? null : Number(v) > 0 && Number(v) <= MAX_QTY ? round3(Number(v)) : NaN);
  if (body?.minOrder !== undefined) {
    o.minOrder = amt(body.minOrder);
    if (Number.isNaN(o.minOrder)) return err("Minimum order must be a number more than 0");
  }
  if (body?.step !== undefined) {
    o.step = amt(body.step);
    if (Number.isNaN(o.step)) return err("Step must be a number more than 0");
  }
  if (body?.presets !== undefined) {
    const list = Array.isArray(body.presets) ? body.presets : String(body.presets || "").split(/[,\s]+/);
    const vals = list.filter((x: any) => x !== "" && x !== null).map((x: any) => Number(x));
    if (vals.some((x: number) => !(x > 0 && x <= MAX_QTY))) return err("Quick amounts must be numbers more than 0");
    o.presets = [...new Set(vals.map(round3))].sort((a: any, b: any) => a - b).slice(0, 6);
  }
  if (body?.options !== undefined) {
    if (!Array.isArray(body.options)) return err("Options must be a list");
    o.options = cleanOptions(body.options);
  }
  // How the product is sold and extra details buyers see.
  if (body?.sellAs !== undefined) {
    o.sellAs = String(body.sellAs || "");
    if (o.sellAs && !SELL_AS.includes(o.sellAs)) return err("Pick how the product is sold");
  }
  if (body?.packSize !== undefined) {
    const n = Number(body.packSize);
    o.packSize = body.packSize === null || body.packSize === "" ? null : n > 0 && n <= 100000 ? Math.round(n * 1000) / 1000 : NaN;
    if (Number.isNaN(o.packSize)) return err("Pack size must be a number more than 0");
  }
  for (const k of ["packUnit", "grade", "origin", "shelfLife", "storage", "variety"]) if (body?.[k] !== undefined) o[k] = str(body[k], 80);
  if (body?.harvestDate !== undefined) {
    o.harvestDate = str(body.harvestDate, 10);
    if (o.harvestDate && !/^\d{4}-\d{2}-\d{2}$/.test(o.harvestDate)) return err("Harvest date: use YYYY-MM-DD");
  }
  if (body?.organic !== undefined) o.organic = !!body.organic;
  if (body?.maxOrder !== undefined) {
    o.maxOrder = amt(body.maxOrder);
    if (Number.isNaN(o.maxOrder)) return err("Maximum order must be a number more than 0");
  }
  if (o.sellAs === "pack" && !(o.packSize > 0) && !partial) return err("Write how much is in one pack");
  if (o.minOrder && o.quantity !== undefined && o.quantity > 0 && o.minOrder > o.quantity) return err("Minimum order can't be more than the stock");
  if (o.minOrder && o.maxOrder && o.minOrder > o.maxOrder) return err("Minimum order can't be more than the maximum");
  return o;
}

/**
 * Checks the selling settings of a product as a whole (after an edit is merged into what was saved),
 * so the shop can always offer a valid amount: steps below 1 only for kg, maund and litre,
 * and the minimum, maximum and quick amounts all on a step.
 */
export function sellComboError(d: any): string | null {
  const unit = String(d?.unit || "").toLowerCase();
  if (d?.sellAs && SELL_UNITS[d.sellAs as keyof typeof SELL_UNITS] && unit && !SELL_UNITS[d.sellAs as keyof typeof SELL_UNITS].includes(unit))
    return `Unit "${d.unit}" doesn't match how the product is sold`;
  const step = Number(d?.step) > 0 ? Number(d.step) : 1;
  const whole = (n: number) => Math.abs(n - Math.round(n)) < 1e-9;
  if (!PART_UNITS.includes(unit)) {
    for (const [label, v] of [["Step", d?.step], ["Minimum order", d?.minOrder], ["Maximum order", d?.maxOrder]] as const)
      if (v !== undefined && v !== null && v !== "" && !whole(Number(v))) return `${label} must be a whole number for ${d?.unit || "this unit"}`;
    for (const v of d?.presets || []) if (!whole(Number(v))) return `Quick amounts must be whole numbers for ${d?.unit || "this unit"}`;
  }
  if (d?.minOrder && !isStepMultiple(Number(d.minOrder), step)) return "Minimum order must be a whole number of steps";
  if (d?.maxOrder && !isStepMultiple(Number(d.maxOrder), step)) return "Maximum order must be a whole number of steps";
  if (d?.maxOrder && Number(d.maxOrder) < step) return "Maximum order can't be less than one step";
  for (const v of d?.presets || []) {
    if (!isStepMultiple(Number(v), step)) return "Each quick amount must be a whole number of steps";
    if (d?.minOrder && Number(v) < Number(d.minOrder)) return "Quick amounts can't be below the minimum order";
    if (d?.maxOrder && Number(v) > Number(d.maxOrder)) return "Quick amounts can't be above the maximum order";
  }
  return null;
}

async function sellerStats(uid: string) {
  const like = `%${uid}%`;
  const ord = rows(await db.execute(sql`SELECT status, count(*)::int AS n, coalesce(sum(total),0)::float AS v FROM shop_orders WHERE seller_ids LIKE ${like} GROUP BY status`));
  const prod = rows(await db.execute(sql`SELECT count(*)::int AS n, coalesce(sum(CASE WHEN coalesce((data->>'quantity')::numeric,0) <= 0 THEN 1 ELSE 0 END),0)::int AS out FROM catalog_items WHERE kind = 'listings' AND owner_id = ${uid}`))[0] || {};
  const byStatus: Record<string, number> = {};
  let revenue = 0;
  let orders = 0;
  for (const r of ord) {
    byStatus[r.status] = Number(r.n);
    orders += Number(r.n);
    if (r.status !== "cancelled") revenue += Number(r.v);
  }
  return { products: Number(prod.n || 0), outOfStock: Number(prod.out || 0), orders, byStatus, revenue };
}

const CATALOG = ["listings", "experts", "events"];
const COMMUNITY = ["polls", "questions", "rfqs", "diary"];
const tableFor = (kind: string) => (CATALOG.includes(kind) ? "catalog_items" : COMMUNITY.includes(kind) ? "community_items" : null);
export const ORDER_STATUSES = ["pending", "confirmed", "processing", "shipped", "delivered", "cancelled"];
/** The order steps in order. The admin moves an order forward one step at a time. */
export const ORDER_FLOW = ["pending", "confirmed", "processing", "shipped", "delivered"];
function privateNote(req: Request, text: string, step: string | null) {
  const a = (req as any).admin;
  return { id: crypto.randomUUID(), text, at: new Date().toISOString(), by: a?.name || a?.email || "Admin", ...(step ? { step } : {}) };
}
export function adminNextSteps(from: string): string[] {
  if (from === "delivered" || from === "cancelled") return [];
  const i = ORDER_FLOW.indexOf(from);
  return [...(i >= 0 && ORDER_FLOW[i + 1] ? [ORDER_FLOW[i + 1]] : []), "cancelled"];
}

export function registerPlatformRoutes(app: Express) {
  ensurePlatform().catch((e) => console.error("[platform] init", e?.message));

  app.get("/api/app/status", wrap(async (_req, res) => res.json(await appSettings())));

  // ================= SELLER =================
  app.get("/api/seller/me", requireUser, wrap(async (req, res) => {
    const uid = (req as any).uid;
    const s = await myStore(uid);
    res.json({ store: storeOut(s), stats: s ? await sellerStats(uid) : null });
  }));

  app.post("/api/seller/register", requireUser, wrap(async (req, res) => {
    const uid = (req as any).uid;
    if (await myStore(uid)) return res.status(409).json({ error: "You already have a store" });
    const f = storeFields(req.body);
    if (!f.name || f.name.length < 2) return res.status(400).json({ error: "Store name is required" });
    const id = `store-${crypto.randomUUID()}`;
    await db.execute(sql`INSERT INTO stores (id, owner_id, name, slug, tagline, description, logo, banner, theme_color, phone, location, category)
      VALUES (${id}, ${uid}, ${f.name}, ${slugify(f.name)}, ${f.tagline || null}, ${f.description || null}, ${f.logo || null}, ${f.banner || null},
        ${f.theme_color || "#2563EB"}, ${f.phone || null}, ${f.location || null}, ${f.category || null})`);
    await notify(uid, "store", "Your store is open", `${f.name} is live. Add your first product from the Seller app.`, { storeId: id });
    res.status(201).json({ store: storeOut(await myStore(uid)) });
  }));

  app.put("/api/seller/store", requireUser, wrap(async (req, res) => {
    const uid = (req as any).uid;
    const s = await myStore(uid);
    if (!s) return res.status(404).json({ error: "Create your store first" });
    if (s.status !== "active") return res.status(403).json({ error: "Your store is suspended by the admin", code: "STORE_SUSPENDED" });
    const f = storeFields(req.body);
    if (f.name !== undefined && f.name.length < 2) return res.status(400).json({ error: "Store name is required" });
    const m = { ...J(JSON.stringify(storeOut(s))) };
    await db.execute(sql`UPDATE stores SET
      name = ${f.name ?? s.name}, tagline = ${f.tagline ?? s.tagline}, description = ${f.description ?? s.description},
      logo = ${f.logo ?? s.logo}, banner = ${f.banner ?? s.banner}, theme_color = ${f.theme_color ?? s.theme_color},
      phone = ${f.phone ?? s.phone}, location = ${f.location ?? s.location}, category = ${f.category ?? s.category}, updated_at = now()
      WHERE id = ${s.id} AND owner_id = ${uid}`);
    if (f.name && f.name !== m.name) {
      await db.execute(sql`UPDATE catalog_items SET data = jsonb_set(data, '{seller}', to_jsonb(${f.name}::text)) WHERE kind = 'listings' AND owner_id = ${uid}`);
    }
    res.json({ store: storeOut(await myStore(uid)) });
  }));

  app.get("/api/seller/stats", requireUser, wrap(async (req, res) => res.json(await sellerStats((req as any).uid))));

  app.get("/api/seller/products", requireUser, wrap(async (req, res) => {
    const uid = (req as any).uid;
    const r = rows(await db.execute(sql`SELECT * FROM catalog_items WHERE kind = 'listings' AND owner_id = ${uid} ORDER BY created_at DESC LIMIT 500`));
    res.json(r.map(itemOut));
  }));

  app.post("/api/seller/products", requireUser, wrap(async (req, res) => {
    const uid = (req as any).uid;
    const s = await myStore(uid);
    if (!s) return res.status(403).json({ error: "Create your store first", code: "NO_STORE" });
    if (s.status !== "active") return res.status(403).json({ error: "Your store is suspended by the admin", code: "STORE_SUSPENDED" });
    const f = productFields(req.body, false);
    if (f.error) return res.status(400).json(f);
    const id = `listings-${crypto.randomUUID()}`;
    const data = { currency: "৳", unit: "kg", category: "other", rating: 0, active: true, ...f, seller: s.name, storeId: s.id, storeSlug: s.slug, location: f.location || s.location || "" };
    const combo = sellComboError(data);
    if (combo) return res.status(400).json({ error: combo });
    await db.execute(sql`INSERT INTO catalog_items (id, kind, data, owner_id) VALUES (${id}, 'listings', ${JSON.stringify(data)}::jsonb, ${uid})`);
    const r = rows(await db.execute(sql`SELECT * FROM catalog_items WHERE id = ${id}`));
    res.status(201).json(itemOut(r[0]));
  }));

  app.put("/api/seller/products/:id", requireUser, wrap(async (req, res) => {
    const uid = (req as any).uid;
    const s = await myStore(uid);
    if (s && s.status !== "active") return res.status(403).json({ error: "Your store is suspended by the admin", code: "STORE_SUSPENDED" });
    const r = rows(await db.execute(sql`SELECT * FROM catalog_items WHERE id = ${req.params.id} AND kind = 'listings' LIMIT 1`));
    if (!r[0]) return res.status(404).json({ error: "Product not found" });
    if (r[0].owner_id !== uid) return res.status(403).json({ error: "This product belongs to another store" });
    const f = productFields(req.body, true);
    if (f.error) return res.status(400).json(f);
    const data = { ...(J(r[0].data) || {}), ...f };
    const combo = sellComboError(data);
    if (combo) return res.status(400).json({ error: combo });
    if (Number(data.minOrder) > 1 && Number(data.quantity) > 0 && Number(data.minOrder) > Number(data.quantity))
      return res.status(400).json({ error: "Minimum order can't be more than the stock" });
    await db.execute(sql`UPDATE catalog_items SET data = ${JSON.stringify(data)}::jsonb, updated_at = now() WHERE id = ${r[0].id} AND owner_id = ${uid}`);
    res.json(itemOut({ ...r[0], data, updated_at: new Date() }));
  }));

  app.delete("/api/seller/products/:id", requireUser, wrap(async (req, res) => {
    const uid = (req as any).uid;
    const r = rows(await db.execute(sql`SELECT owner_id FROM catalog_items WHERE id = ${req.params.id} AND kind = 'listings' LIMIT 1`));
    if (!r[0]) return res.status(404).json({ error: "Product not found" });
    if (r[0].owner_id !== uid) return res.status(403).json({ error: "This product belongs to another store" });
    await db.execute(sql`DELETE FROM catalog_items WHERE id = ${req.params.id} AND owner_id = ${uid}`);
    res.json({ success: true });
  }));

  // Public storefront
  // All open shops for the main app's Shop tab (company shops and sellers' shops), with how many products each shows.
  app.get("/api/stores", wrap(async (_req, res) => {
    const r = rows(await db.execute(sql`SELECT s.*,
        (SELECT count(*)::int FROM catalog_items c WHERE c.kind = 'listings' AND c.owner_id = s.owner_id
           AND coalesce(c.data->>'hidden','false') <> 'true' AND coalesce(c.data->>'active','true') <> 'false') AS products
      FROM stores s WHERE s.status = 'active' ORDER BY products DESC, s.created_at ASC LIMIT 200`));
    res.json(r.map((s: any) => ({ ...storeOut(s), products: Number(s.products) || 0 })));
  }));

  app.get("/api/stores/:slug", wrap(async (req, res) => {
    const s = rows(await db.execute(sql`SELECT * FROM stores WHERE slug = ${req.params.slug} OR id = ${req.params.slug} LIMIT 1`))[0];
    if (!s || s.status !== "active") return res.status(404).json({ error: "Store not found" });
    const items = rows(await db.execute(sql`SELECT * FROM catalog_items WHERE kind = 'listings' AND owner_id = ${s.owner_id} ORDER BY created_at DESC`))
      .map(itemOut)
      .filter((i: any) => !i.hidden && i.active !== false);
    res.json({ store: storeOut(s), products: items });
  }));

  // ================= ADMIN =================
  // Existing in-app Users tab: same paths, now with a real ban. Admin-panel (non-JWT) sessions fall through.
  const jwtAdminOrPass = (req: Request, res: Response, next: NextFunction) => {
    const h = req.headers.authorization;
    if (!h) return res.status(401).json({ error: "Unauthorized" });
    if (!tokenUid(req)) return next("route");
    requireAdmin(req, res, next);
  };

  const listUsers = async (q: string, filter: string) => {
    const like = `%${q.toLowerCase()}%`;
    const r = rows(await db.execute(sql`SELECT u.id, u.username, u.email, u.name, u.phone, u.role, u.verified, u.is_super_admin, u.banned, u.banned_reason, u.banned_until, u.restrictions, u.avatar, u.created_at,
        s.id AS store_id, s.name AS store_name, s.status AS store_status,
        (SELECT count(*)::int FROM shop_orders o WHERE o.user_id = u.id) AS orders,
        (SELECT coalesce(sum(o.total),0)::float FROM shop_orders o WHERE o.user_id = u.id AND o.status <> 'cancelled') AS spent
      FROM users u LEFT JOIN stores s ON s.owner_id = u.id
      WHERE u.deleted_at IS NULL AND (${q} = '' OR lower(coalesce(u.name,'')) LIKE ${like} OR lower(coalesce(u.email,'')) LIKE ${like} OR lower(u.username) LIKE ${like} OR coalesce(u.phone,'') LIKE ${like})
      ORDER BY u.created_at DESC LIMIT 300`));
    return r
      .map((u: any) => ({
        id: u.id,
        username: u.username,
        email: u.email || "",
        name: u.name || u.username,
        phone: u.phone || "",
        role: u.role || "user",
        verified: !!u.verified,
        isSuperAdmin: !!u.is_super_admin,
        banned: !!u.banned,
        bannedReason: u.banned_reason || "",
        bannedUntil: u.banned_until ? iso(u.banned_until) : null,
        restrictions: activeRestrictions(u.restrictions),
        restricted: RESTRICTION_KEYS.some((k) => (activeRestrictions(u.restrictions) as any)[k]),
        avatar: u.avatar || "",
        status: u.banned ? "banned" : RESTRICTION_KEYS.some((k) => (activeRestrictions(u.restrictions) as any)[k]) ? "restricted" : "active",
        store: u.store_id ? { id: u.store_id, name: u.store_name, status: u.store_status } : null,
        orders: Number(u.orders || 0),
        spent: Number(u.spent || 0),
        createdAt: iso(u.created_at),
      }))
      .filter((u: any) =>
        filter === "banned" ? u.banned : filter === "restricted" ? u.restricted : filter === "admins" ? u.isSuperAdmin : filter === "sellers" ? !!u.store : filter === "buyers" ? u.orders > 0 : true,
      );
  };

  app.get("/api/admin/users", jwtAdminOrPass, wrap(async (req, res) => res.json(await listUsers(str(req.query.q), "all"))));

  const setBan = async (req: Request, res: Response, banned: boolean, reason = "") => {
    const id = req.params.userId || req.params.id;
    const me = (req as any).admin;
    const t = await account(id);
    if (!t) return res.status(404).json({ error: "User not found" });
    if (banned && t.id === me.id) return res.status(400).json({ error: "You can't ban your own account" });
    if (banned && t.is_super_admin) return res.status(400).json({ error: "Remove admin rights before banning this account" });
    await db.execute(sql`UPDATE users SET banned = ${banned}, banned_reason = ${banned ? reason || null : null} WHERE id = ${id}`);
    await audit(req, banned ? "BAN_USER" : "UNBAN_USER", "user", id, reason || "");
    res.json({ success: true, banned });
  };
  app.post("/api/admin/users/:userId/ban", jwtAdminOrPass, wrap((req, res) => setBan(req, res, true, str(req.body?.reason))));
  app.post("/api/admin/users/:userId/unban", jwtAdminOrPass, wrap((req, res) => setBan(req, res, false)));

  const A = "/api/admin/manage";

  app.get(`${A}/summary`, requireAdmin, wrap(async (_req, res) => {
    const one = async (q: any) => Number(rows(await db.execute(q))[0]?.n || 0);
    const ord = rows(await db.execute(sql`SELECT status, count(*)::int AS n, coalesce(sum(total),0)::float AS v FROM shop_orders GROUP BY status`));
    const ordersByStatus: Record<string, number> = {};
    let revenue = 0;
    let orders = 0;
    for (const r of ord) {
      ordersByStatus[r.status] = Number(r.n);
      orders += Number(r.n);
      if (r.status !== "cancelled") revenue += Number(r.v);
    }
    res.json({
      users: await one(sql`SELECT count(*)::int AS n FROM users WHERE deleted_at IS NULL`),
      banned: await one(sql`SELECT count(*)::int AS n FROM users WHERE banned AND deleted_at IS NULL`),
      admins: await one(sql`SELECT count(*)::int AS n FROM users WHERE is_super_admin`),
      restricted: rows(await db.execute(sql`SELECT restrictions FROM users WHERE restrictions IS NOT NULL AND deleted_at IS NULL`)).filter((u: any) => RESTRICTION_KEYS.some((k) => (activeRestrictions(u.restrictions) as any)[k])).length,
      openReports: await one(sql`SELECT count(*)::int AS n FROM post_reports WHERE coalesce(status, 'open') = 'open'`).catch(() => 0),
      stores: await one(sql`SELECT count(*)::int AS n FROM stores`),
      suspendedStores: await one(sql`SELECT count(*)::int AS n FROM stores WHERE status <> 'active'`),
      listings: await one(sql`SELECT count(*)::int AS n FROM catalog_items WHERE kind = 'listings'`),
      hiddenListings: await one(sql`SELECT count(*)::int AS n FROM catalog_items WHERE kind = 'listings' AND (data->>'hidden') = 'true'`),
      orders,
      ordersByStatus,
      revenue,
      settings: await appSettings(),
    });
  }));

  app.get(`${A}/users`, requireAdmin, wrap(async (req, res) => res.json(await listUsers(str(req.query.q), str(req.query.filter) || "all"))));

  app.get(`${A}/users/:id`, requireAdmin, wrap(async (req, res) => {
    const id = req.params.id;
    const list = await listUsers("", "all");
    const u = list.find((x: any) => x.id === id);
    if (!u) return res.status(404).json({ error: "User not found" });
    const orders = rows(await db.execute(sql`SELECT id, total, status, item_count, created_at FROM shop_orders WHERE user_id = ${id} ORDER BY created_at DESC LIMIT 20`)).map((o: any) => ({
      id: o.id, total: Number(o.total), status: o.status, itemCount: Number(o.item_count), createdAt: iso(o.created_at),
    }));
    const listings = Number(rows(await db.execute(sql`SELECT count(*)::int AS n FROM catalog_items WHERE kind = 'listings' AND owner_id = ${id}`))[0]?.n || 0);
    const store = rows(await db.execute(sql`SELECT id, name FROM stores WHERE owner_id = ${id} LIMIT 1`))[0] || null;
    res.json({ ...u, store: (u as any).store || store, recentOrders: orders, listings });
  }));

  app.put(`${A}/users/:id`, requireAdmin, wrap(async (req, res) => {
    const id = req.params.id;
    const me = (req as any).admin;
    const t = rows(await db.execute(sql`SELECT * FROM users WHERE id = ${id} LIMIT 1`))[0];
    if (!t) return res.status(404).json({ error: "User not found" });
    const b = req.body || {};
    if (id === me.id && (b.isSuperAdmin === false || b.banned === true)) return res.status(400).json({ error: "You can't remove your own admin rights or ban yourself" });
    const isSuperAdmin = b.isSuperAdmin !== undefined ? !!b.isSuperAdmin : !!t.is_super_admin;
    const banned = b.banned !== undefined ? !!b.banned : !!t.banned;
    if (banned && isSuperAdmin) return res.status(400).json({ error: "Remove admin rights before banning this account" });
    const role = b.role !== undefined ? str(b.role, 30) || "user" : t.role;
    if (banned && !t.banned && !b.skipWarning) {
      let warned = 0;
      try {
        warned = Number(rows(await db.execute(sql`SELECT count(*)::int AS n FROM user_warnings WHERE user_id = ${id} AND withdrawn_at IS NULL`))[0]?.n || 0);
      } catch {}
      if (!warned) return res.status(409).json({ error: "Send this person a warning before you ban them", code: "WARN_FIRST" });
    }
    let username = t.username;
    if (b.username !== undefined) {
      username = String(b.username || "").trim().toLowerCase().replace(/^@/, "");
      if (!/^[a-z0-9_.]{3,30}$/.test(username)) return res.status(400).json({ error: "Username: 3 to 30 letters, numbers, _ or ." });
      const taken = rows(await db.execute(sql`SELECT id FROM users WHERE lower(username) = ${username} AND id <> ${id} LIMIT 1`))[0];
      if (taken) return res.status(409).json({ error: "That username is taken" });
    }
    await db.execute(sql`UPDATE users SET
      username = ${username},
      name = ${b.name !== undefined ? str(b.name, 120) : t.name}, phone = ${b.phone !== undefined ? str(b.phone, 30) : t.phone},
      role = ${role}, verified = ${b.verified !== undefined ? !!b.verified : !!t.verified},
      is_super_admin = ${isSuperAdmin}, banned = ${banned}, banned_reason = ${banned ? str(b.bannedReason) || t.banned_reason || null : null}
      WHERE id = ${id}`);
    await audit(req, "UPDATE_USER", "user", id, { ...b, password: undefined });
    res.json({ success: true });
  }));

  app.put(`${A}/users/:id/password`, requireAdmin, wrap(async (req, res) => {
    const pw = String(req.body?.password || "");
    if (pw.length < 8) return res.status(400).json({ error: "Password must be at least 8 characters" });
    const t = await account(req.params.id);
    if (!t) return res.status(404).json({ error: "User not found" });
    await db.execute(sql`UPDATE users SET password = ${await bcrypt.hash(pw, 10)} WHERE id = ${t.id}`);
    await audit(req, "RESET_PASSWORD", "user", t.id, "Password set by admin");
    res.json({ success: true });
  }));

  // Stores
  app.get(`${A}/stores`, requireAdmin, wrap(async (_req, res) => {
    const r = rows(await db.execute(sql`SELECT s.*, u.email AS owner_email, u.name AS owner_name,
        (SELECT count(*)::int FROM catalog_items c WHERE c.kind = 'listings' AND c.owner_id = s.owner_id) AS products,
        (SELECT count(*)::int FROM shop_orders o WHERE o.seller_ids LIKE '%' || s.owner_id || '%') AS orders,
        (SELECT coalesce(sum(o.total),0)::float FROM shop_orders o WHERE o.seller_ids LIKE '%' || s.owner_id || '%' AND o.status <> 'cancelled') AS revenue
      FROM stores s LEFT JOIN users u ON u.id = s.owner_id ORDER BY s.created_at DESC`));
    res.json(r.map((s: any) => ({ ...storeOut(s), ownerEmail: s.owner_email || "", ownerName: s.owner_name || "", products: Number(s.products), orders: Number(s.orders), revenue: Number(s.revenue) })));
  }));

  app.put(`${A}/stores/:id`, requireAdmin, wrap(async (req, res) => {
    const s = rows(await db.execute(sql`SELECT * FROM stores WHERE id = ${req.params.id} LIMIT 1`))[0];
    if (!s) return res.status(404).json({ error: "Store not found" });
    const status = req.body?.status;
    if (status !== undefined && !["active", "suspended"].includes(status)) return res.status(400).json({ error: "Status must be active or suspended" });
    const f = storeFields(req.body);
    await db.execute(sql`UPDATE stores SET status = ${status ?? s.status}, status_reason = ${status === "suspended" ? str(req.body?.reason) || null : status === "active" ? null : s.status_reason},
      name = ${f.name || s.name}, tagline = ${f.tagline ?? s.tagline}, description = ${f.description ?? s.description}, updated_at = now() WHERE id = ${s.id}`);
    if (status && status !== s.status) {
      await notify(s.owner_id, "store", status === "suspended" ? "Store suspended" : "Store reactivated",
        status === "suspended" ? `${s.name} was suspended by the admin.${req.body?.reason ? " Reason: " + str(req.body.reason) : ""}` : `${s.name} is active again.`, { storeId: s.id });
    }
    await audit(req, "UPDATE_STORE", "store", s.id, req.body || {});
    res.json({ success: true });
  }));

  // Orders
  app.get(`${A}/orders`, requireAdmin, wrap(async (req, res) => {
    const status = str(req.query.status);
    const q = str(req.query.q).toLowerCase();
    const r = rows(await db.execute(sql`SELECT o.*, u.name AS buyer_name, u.email AS buyer_email FROM shop_orders o LEFT JOIN users u ON u.id = o.user_id
      WHERE (${status} = '' OR o.status = ${status}) ORDER BY o.created_at DESC LIMIT 300`));
    const out = r.map((o: any) => ({
      id: o.id,
      buyerId: o.user_id,
      buyerName: o.buyer_name || "Guest",
      buyerEmail: o.buyer_email || "",
      sellerIds: String(o.seller_ids || "").split(",").filter(Boolean),
      total: Number(o.total),
      itemCount: Number(o.item_count),
      paymentMethod: o.payment_method || "",
      status: o.status || "pending",
      items: J(o.data) || [],
      address: J(o.address) || null,
      history: J(o.history) || [],
      adminNote: o.admin_note || "",
      checkout: J(o.checkout) || null,
      createdAt: iso(o.created_at),
    }));
    res.json(q ? out.filter((o: any) => `${o.id} ${o.buyerName} ${o.buyerEmail}`.toLowerCase().includes(q)) : out);
  }));

  app.put(`${A}/orders/:id`, requireAdmin, wrap(async (req, res) => {
    const o = rows(await db.execute(sql`SELECT * FROM shop_orders WHERE id = ${req.params.id} LIMIT 1`))[0];
    if (!o) return res.status(404).json({ error: "Order not found" });
    const from = String(o.status || "pending");
    const status = req.body?.status !== undefined ? String(req.body.status) : from;
    if (!ORDER_STATUSES.includes(status)) return res.status(400).json({ error: "Unknown status" });
    // One way only: pending -> confirmed -> processing -> shipped -> delivered, one step at a time.
    // Cancel is allowed until the order is delivered. A finished step can't be picked again.
    if (status !== from && !adminNextSteps(from).includes(status)) {
      return res.status(409).json({ error: `This order is ${from}. Next it can only go to: ${adminNextSteps(from).join(" or ") || "nothing (it's finished)"}.`, status: from, next: adminNextSteps(from) });
    }
    // A note sent with a step is a private admin note: kept in admin_notes, never shown to the buyer or seller.
    const noteIn = req.body?.note !== undefined ? str(req.body.note, 1000) : "";
    const notes = [...(J(o.admin_notes) || [])];
    if (noteIn) notes.push(privateNote(req, noteIn, status !== from ? status : null));
    const history = [...(J(o.history) || [])];
    if (status !== from) history.push({ status, at: new Date().toISOString(), by: (req as any).uid, admin: true });
    await db.execute(sql`UPDATE shop_orders SET status = ${status}, admin_note = ${noteIn || o.admin_note || null}, admin_notes = ${JSON.stringify(notes)}::jsonb, history = ${JSON.stringify(history)}::jsonb, updated_at = now() WHERE id = ${o.id}`);
    if (status !== from) {
      const label: Record<string, string> = { confirmed: "confirmed", processing: "being packed", shipped: "on the way", delivered: "delivered", cancelled: "cancelled" };
      const t = `Order ${label[status] || status}`;
      await notify(o.user_id, "order", t, `Your order ${o.id} is now ${label[status] || status}.`, { orderId: o.id, role: "buyer", status });
      for (const s of String(o.seller_ids || "").split(",").filter(Boolean)) {
        await notify(s, "order", t, `The admin updated order ${o.id}: it is now ${label[status] || status}.`, { orderId: o.id, role: "seller", status });
      }
    }
    await audit(req, "UPDATE_ORDER", "order", o.id, { from, to: status, note: noteIn ? "private note added" : undefined });
    res.json({ success: true, status, next: adminNextSteps(status) });
  }));

  // Private admin notes on an order (hidden from the buyer and seller).
  app.post(`${A}/orders/:id/notes`, requireAdmin, wrap(async (req, res) => {
    const o = rows(await db.execute(sql`SELECT id, admin_notes FROM shop_orders WHERE id = ${req.params.id} LIMIT 1`))[0];
    if (!o) return res.status(404).json({ error: "Order not found" });
    const text = str(req.body?.text, 1000);
    if (!text) return res.status(400).json({ error: "Write the note first" });
    const notes = [...(J(o.admin_notes) || []), privateNote(req, text, null)];
    await db.execute(sql`UPDATE shop_orders SET admin_notes = ${JSON.stringify(notes)}::jsonb, admin_note = ${text} WHERE id = ${o.id}`);
    await audit(req, "ORDER_NOTE", "order", o.id, "private note added");
    res.status(201).json({ success: true, notes });
  }));
  app.delete(`${A}/orders/:id/notes/:nid`, requireAdmin, wrap(async (req, res) => {
    const o = rows(await db.execute(sql`SELECT id, admin_notes FROM shop_orders WHERE id = ${req.params.id} LIMIT 1`))[0];
    if (!o) return res.status(404).json({ error: "Order not found" });
    const notes = (J(o.admin_notes) || []).filter((n: any) => n.id !== req.params.nid);
    await db.execute(sql`UPDATE shop_orders SET admin_notes = ${JSON.stringify(notes)}::jsonb, admin_note = ${notes.length ? notes[notes.length - 1].text : null} WHERE id = ${o.id}`);
    await audit(req, "ORDER_NOTE_DELETE", "order", o.id, "");
    res.json({ success: true, notes });
  }));

  app.delete(`${A}/orders/:id`, requireAdmin, wrap(async (req, res) => {
    await db.execute(sql`DELETE FROM shop_orders WHERE id = ${req.params.id}`);
    await audit(req, "DELETE_ORDER", "order", req.params.id, "");
    res.json({ success: true });
  }));

  // Delivery charges (inside / outside Dhaka, express, free-delivery threshold)
  app.get(`${A}/delivery`, requireAdmin, wrap(async (_req, res) => res.json(await deliveryConfig())));
  app.put(`${A}/delivery`, requireAdmin, wrap(async (req, res) => {
    await ensureCheckout();
    const c = cleanDeliveryConfig(req.body);
    if ("error" in c) return res.status(400).json(c);
    await db.execute(sql`INSERT INTO app_settings (key, value) VALUES ('delivery_config', ${JSON.stringify(c)})
      ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value`);
    await audit(req, "UPDATE_DELIVERY", "settings", "delivery_config", c);
    res.json(c);
  }));

  // Catalog + community moderation
  app.get(`${A}/catalog`, requireAdmin, wrap(async (req, res) => {
    const kind = str(req.query.kind) || "listings";
    const table = tableFor(kind);
    if (!table) return res.status(400).json({ error: "Unknown kind" });
    const r = table === "catalog_items"
      ? rows(await db.execute(sql`SELECT c.*, u.name AS owner_name, u.email AS owner_email FROM catalog_items c LEFT JOIN users u ON u.id = c.owner_id WHERE c.kind = ${kind} ORDER BY c.created_at DESC LIMIT 500`))
      : rows(await db.execute(sql`SELECT c.*, u.name AS owner_name, u.email AS owner_email FROM community_items c LEFT JOIN users u ON u.id = c.owner_id WHERE c.kind = ${kind} ORDER BY c.created_at DESC LIMIT 500`));
    res.json(r.map((x: any) => {
      const d = J(x.data) || {};
      return {
        id: x.id, kind, ownerId: x.owner_id, ownerName: x.owner_name || d.seller || d.author || "", ownerEmail: x.owner_email || "",
        title: d.name || d.title || d.question || "(untitled)", price: d.price ?? null, quantity: d.quantity ?? null,
        hidden: !!d.hidden, image: d.image || "", storeId: d.storeId || null, createdAt: iso(x.created_at),
      };
    }));
  }));

  app.put(`${A}/catalog/:kind/:id`, requireAdmin, wrap(async (req, res) => {
    const table = tableFor(req.params.kind);
    if (!table) return res.status(400).json({ error: "Unknown kind" });
    const r = table === "catalog_items"
      ? rows(await db.execute(sql`SELECT * FROM catalog_items WHERE id = ${req.params.id} LIMIT 1`))
      : rows(await db.execute(sql`SELECT * FROM community_items WHERE id = ${req.params.id} LIMIT 1`));
    if (!r[0]) return res.status(404).json({ error: "Item not found" });
    const d = { ...(J(r[0].data) || {}) };
    const b = req.body || {};
    if (b.hidden !== undefined) d.hidden = !!b.hidden;
    if (b.price !== undefined && Number(b.price) > 0) d.price = Number(b.price);
    if (b.quantity !== undefined) d.quantity = Math.max(0, Math.floor(Number(b.quantity) || 0));
    if (b.title !== undefined && str(b.title)) d[d.name !== undefined ? "name" : d.question !== undefined ? "question" : "title"] = str(b.title, 200);
    if (table === "catalog_items") await db.execute(sql`UPDATE catalog_items SET data = ${JSON.stringify(d)}::jsonb, updated_at = now() WHERE id = ${r[0].id}`);
    else await db.execute(sql`UPDATE community_items SET data = ${JSON.stringify(d)}::jsonb, updated_at = now() WHERE id = ${r[0].id}`);
    if (b.hidden !== undefined && r[0].owner_id) {
      await notify(r[0].owner_id, "moderation", b.hidden ? "Item hidden by admin" : "Item visible again", `${d.name || d.title || d.question || "Your item"} was ${b.hidden ? "hidden" : "made visible"} by the admin.`, { itemId: r[0].id });
    }
    await audit(req, "UPDATE_ITEM", req.params.kind, r[0].id, b);
    res.json({ success: true });
  }));

  app.delete(`${A}/catalog/:kind/:id`, requireAdmin, wrap(async (req, res) => {
    const table = tableFor(req.params.kind);
    if (!table) return res.status(400).json({ error: "Unknown kind" });
    if (table === "catalog_items") await db.execute(sql`DELETE FROM catalog_items WHERE id = ${req.params.id}`);
    else await db.execute(sql`DELETE FROM community_items WHERE id = ${req.params.id}`);
    await audit(req, "DELETE_ITEM", req.params.kind, req.params.id, "");
    res.json({ success: true });
  }));

  // Notifications
  app.post(`${A}/notify`, requireAdmin, wrap(async (req, res) => {
    const title = str(req.body?.title, 200);
    const body = str(req.body?.body, 500);
    if (!title || !body) return res.status(400).json({ error: "Title and message are required" });
    const audience = str(req.body?.audience) || "all";
    let ids: string[] = [];
    if (req.body?.userId) ids = [String(req.body.userId)];
    else if (audience === "sellers") ids = rows(await db.execute(sql`SELECT owner_id AS id FROM stores`)).map((r: any) => r.id);
    else if (audience === "buyers") ids = rows(await db.execute(sql`SELECT DISTINCT user_id AS id FROM shop_orders WHERE user_id IS NOT NULL`)).map((r: any) => r.id);
    else ids = rows(await db.execute(sql`SELECT id FROM users WHERE NOT banned`)).map((r: any) => r.id);
    for (const id of ids) await notify(id, "admin", title, body, { from: "admin" });
    await audit(req, "SEND_NOTIFICATION", "notification", req.body?.userId || audience, { title, count: ids.length });
    res.json({ success: true, sent: ids.length });
  }));
}
