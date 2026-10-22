import type { Express, Request, Response } from "express";
import crypto from "crypto";
import { sql } from "drizzle-orm";
import { db } from "./db";
import { notify } from "./featureRoutes";
import { decodeUpload, looksLikeImage, IMAGE_MIME, MAX_IMAGE_BYTES, VOICE_MIME, MAX_VOICE_BYTES, MAX_VOICE_MS } from "./dmRoutes";
import { isUserPresent } from "./communityRoutes";
import {
  rows, J, iso, str, wrap, requireUser, requireAdmin, audit, storeOut, itemOut, slugify, productFields, storeFields, ensurePlatform,
} from "./platformRoutes";

/**
 * Farmers Admin app backend (one backend for the main app, the Seller Hub and the Admin app).
 *
 *  Public (main app + Seller Hub, no rebuild needed when the admin changes them):
 *    GET  /api/market/categories                     active marketplace categories, admin order
 *  Users (signed in, the account always comes from the token, never from the request):
 *    GET  /api/support/thread                        my own support conversation + messages (marks admin replies read)
 *    POST /api/support/messages {body, clientId?}    write to the admin (opens / reopens my conversation)
 *    GET  /api/support/unread                        admin replies I haven't read (+ adminsOnline: a Farmers admin has the app open now)
 *    POST /api/support/photo {image, mime, width?, height?, clientId?}   send a photo to the admins
 *    POST /api/support/voice {audio, mime, durationMs, clientId?}        send a voice message to the admins
 *    GET  /api/support/media/:id                     a support photo / voice file (the conversation's user, or an admin)
 *  Admin (/api/admin/manage/*, requireAdmin = signed-in, is_super_admin, not banned, checked on every request):
 *    categories:  GET/POST /categories, PUT/DELETE /categories/:id (?reassign=slug), POST /categories/reorder
 *    shop:        GET /shop/overview, GET /products (q, category, storeId, ownerId, status), GET/PUT/DELETE /products/:id,
 *                 POST /products, POST /stores, GET /stores/:id, PUT /stores/:id/details, GET /orders/:id
 *    support:     GET /support/threads (status, q), GET /support/unread, GET /support/threads/:id,
 *                 POST /support/threads/:id/reply, PUT /support/threads/:id {status}
 */

const SEED: [string, string, string, string, string][] = [
  ["vegetables", "Vegetables", "সবজি", "feather", "#16A34A"],
  ["fruits", "Fruits", "ফল", "sun", "#EA580C"],
  ["grains", "Grains", "শস্য", "layers", "#CA8A04"],
  ["livestock", "Livestock", "গবাদি পশু", "github", "#92400E"],
  ["seeds", "Seeds", "বীজ", "sun", "#65A30D"],
  ["fertilizer", "Fertilizer", "সার", "droplet", "#0891B2"],
  ["equipment", "Equipment", "যন্ত্রপাতি", "tool", "#475569"],
  ["feed", "Feed", "খাদ্য", "package", "#B45309"],
  ["medicine", "Medicine", "ওষুধ", "heart", "#DC2626"],
  ["organic", "Organic", "অর্গানিক", "zap", "#15803D"],
  ["dairy", "Dairy", "দুগ্ধ", "coffee", "#2563EB"],
  ["fish", "Fish", "মাছ", "anchor", "#0E7490"],
  ["other", "Other", "অন্যান্য", "grid", "#64748B"],
];

let ready: Promise<void> | null = null;
export function ensureAdminApp() {
  if (!ready) {
    ready = (async () => {
      await ensurePlatform();
      const q = (s: any) => db.execute(s);
      await q(sql`CREATE TABLE IF NOT EXISTS shop_categories (
        id varchar PRIMARY KEY, slug varchar NOT NULL UNIQUE, name_en varchar NOT NULL, name_bn varchar NOT NULL DEFAULT '',
        icon varchar NOT NULL DEFAULT 'grid', color varchar NOT NULL DEFAULT '#16A34A', sort_order integer NOT NULL DEFAULT 0,
        active boolean NOT NULL DEFAULT true, created_at timestamp NOT NULL DEFAULT now(), updated_at timestamp NOT NULL DEFAULT now())`);
      await q(sql`CREATE TABLE IF NOT EXISTS app_settings (key varchar PRIMARY KEY, value text)`).catch(() => {});
      const seeded = rows(await q(sql`SELECT value FROM app_settings WHERE key = 'shop_categories_seeded' LIMIT 1`))[0];
      if (!seeded) {
        let i = 0;
        for (const [slug, en, bn, icon, color] of SEED) {
          await q(sql`INSERT INTO shop_categories (id, slug, name_en, name_bn, icon, color, sort_order)
            VALUES (${"cat-" + slug}, ${slug}, ${en}, ${bn}, ${icon}, ${color}, ${i++}) ON CONFLICT (slug) DO NOTHING`);
        }
        await q(sql`INSERT INTO app_settings (key, value) VALUES ('shop_categories_seeded', 'true') ON CONFLICT (key) DO NOTHING`);
      }
      await q(sql`CREATE TABLE IF NOT EXISTS support_threads (
        id varchar PRIMARY KEY, user_id varchar NOT NULL UNIQUE, status varchar NOT NULL DEFAULT 'open',
        last_message text, last_from_admin boolean NOT NULL DEFAULT false, admin_unread integer NOT NULL DEFAULT 0,
        user_unread integer NOT NULL DEFAULT 0, last_message_at timestamp NOT NULL DEFAULT now(), created_at timestamp NOT NULL DEFAULT now())`);
      await q(sql`CREATE TABLE IF NOT EXISTS support_messages (
        id varchar PRIMARY KEY, thread_id varchar NOT NULL, sender_id varchar NOT NULL, from_admin boolean NOT NULL DEFAULT false,
        body text NOT NULL, client_id varchar, created_at timestamp NOT NULL DEFAULT now())`);
      await q(sql`CREATE INDEX IF NOT EXISTS support_messages_thread_idx ON support_messages (thread_id, created_at)`);
      // Help chat works like the normal chat: text, photos and voice messages.
      await q(sql`ALTER TABLE support_messages ADD COLUMN IF NOT EXISTS kind varchar NOT NULL DEFAULT 'text'`);
      await q(sql`ALTER TABLE support_messages ADD COLUMN IF NOT EXISTS media_id varchar`);
      await q(sql`ALTER TABLE support_messages ADD COLUMN IF NOT EXISTS width integer`);
      await q(sql`ALTER TABLE support_messages ADD COLUMN IF NOT EXISTS height integer`);
      await q(sql`ALTER TABLE support_messages ADD COLUMN IF NOT EXISTS duration_ms integer`);
      await q(sql`CREATE TABLE IF NOT EXISTS support_media (
        id varchar PRIMARY KEY, thread_id varchar NOT NULL, sender_id varchar NOT NULL, mime varchar NOT NULL,
        size integer NOT NULL DEFAULT 0, data bytea NOT NULL, created_at timestamp NOT NULL DEFAULT now())`);
    })();
    ready.catch(() => (ready = null));
  }
  return ready;
}

const w = (fn: (req: Request, res: Response) => Promise<any>) => wrap(async (req, res) => {
  await ensureAdminApp();
  return fn(req, res);
});

const HEX = /^#[0-9a-fA-F]{6}$/;
const SLUG = /^[a-z0-9][a-z0-9-]{0,39}$/;
const catOut = (r: any) => ({
  id: r.id, slug: r.slug, nameEn: r.name_en, nameBn: r.name_bn || r.name_en, icon: r.icon || "grid", color: r.color || "#16A34A",
  sortOrder: Number(r.sort_order || 0), active: !!r.active, productCount: r.product_count !== undefined ? Number(r.product_count) : undefined,
});
async function categoryBySlug(slug: string) {
  return rows(await db.execute(sql`SELECT * FROM shop_categories WHERE slug = ${slug} LIMIT 1`))[0] || null;
}

function productOut(r: any) {
  const d = J(r.data) || {};
  return {
    ...itemOut(r),
    name: d.name || "(untitled)",
    price: Number(d.price || 0),
    quantity: Number(d.quantity || 0),
    unit: d.unit || "",
    category: d.category || "other",
    hidden: !!d.hidden,
    active: d.active !== false,
    ownerName: r.owner_name || d.seller || "",
    ownerEmail: r.owner_email || "",
    storeId: r.store_id || d.storeId || null,
    storeName: r.store_name || d.seller || "",
    storeStatus: r.store_status || null,
    orders: r.orders !== undefined ? Number(r.orders) : undefined,
  };
}

function orderOut(o: any) {
  return {
    id: o.id,
    buyerId: o.user_id,
    buyerName: o.buyer_name || "Guest",
    buyerEmail: o.buyer_email || "",
    buyerPhone: o.buyer_phone || "",
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
  };
}

const ordersWithProduct = (pid: string) => sql`data @> ${JSON.stringify([{ productId: pid }])}::jsonb`;

async function admins(): Promise<string[]> {
  return rows(await db.execute(sql`SELECT id FROM users WHERE is_super_admin AND NOT banned`)).map((r: any) => r.id);
}

const threadOut = (t: any) => ({
  id: t.id, userId: t.user_id, status: t.status, lastMessage: t.last_message || "", lastFromAdmin: !!t.last_from_admin,
  adminUnread: Number(t.admin_unread || 0), userUnread: Number(t.user_unread || 0), lastMessageAt: iso(t.last_message_at), createdAt: iso(t.created_at),
  userName: t.user_name || t.username || "", userEmail: t.user_email || "", userPhone: t.user_phone || "", userAvatar: t.user_avatar || "",
});
const msgOut = (m: any) => ({
  id: m.id, body: m.body, kind: m.kind || "text", mediaId: m.media_id || null,
  width: m.width ? Number(m.width) : undefined, height: m.height ? Number(m.height) : undefined,
  durationMs: m.duration_ms ? Number(m.duration_ms) : undefined,
  fromAdmin: !!m.from_admin, senderId: m.sender_id, senderName: m.sender_name || "", clientId: m.client_id || null, createdAt: iso(m.created_at),
});
const PHOTO_LABEL = "\u{1F4F7} Photo";
const VOICE_LABEL = "\u{1F3A4} Voice message";
/** true while at least one Farmers admin has the app open (real presence, same as the green dots). */
async function adminsOnline(): Promise<boolean> {
  return (await admins()).some((a) => isUserPresent(a));
}

export function registerAdminAppRoutes(app: Express) {
  ensureAdminApp().catch((e) => console.error("[admin-app] init", e?.message));
  const A = "/api/admin/manage";

  // ================= CATEGORIES =================
  app.get("/api/market/categories", w(async (_req, res) => {
    const r = rows(await db.execute(sql`SELECT * FROM shop_categories WHERE active ORDER BY sort_order, name_en`));
    res.json(r.map(catOut));
  }));

  app.get(`${A}/categories`, requireAdmin, w(async (_req, res) => {
    const r = rows(await db.execute(sql`SELECT c.*, (SELECT count(*)::int FROM catalog_items i WHERE i.kind = 'listings' AND coalesce(i.data->>'category','other') = c.slug) AS product_count
      FROM shop_categories c ORDER BY c.sort_order, c.name_en`));
    res.json(r.map(catOut));
  }));

  app.post(`${A}/categories`, requireAdmin, w(async (req, res) => {
    const b = req.body || {};
    const nameEn = str(b.nameEn, 60);
    if (!nameEn) return res.status(400).json({ error: "English name is required" });
    const slug = (str(b.slug, 40) || nameEn).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 40);
    if (!SLUG.test(slug)) return res.status(400).json({ error: "Use English letters or numbers in the name" });
    if (await categoryBySlug(slug)) return res.status(409).json({ error: "A category with this name already exists" });
    const max = Number(rows(await db.execute(sql`SELECT coalesce(max(sort_order), -1)::int AS m FROM shop_categories`))[0]?.m ?? -1);
    const id = `cat-${crypto.randomUUID()}`;
    await db.execute(sql`INSERT INTO shop_categories (id, slug, name_en, name_bn, icon, color, sort_order, active)
      VALUES (${id}, ${slug}, ${nameEn}, ${str(b.nameBn, 60) || nameEn}, ${str(b.icon, 40) || "grid"}, ${HEX.test(String(b.color)) ? String(b.color) : "#16A34A"},
        ${max + 1}, ${b.active === undefined ? true : !!b.active})`);
    await audit(req, "CREATE_CATEGORY", "category", id, { slug, nameEn });
    res.status(201).json(catOut(rows(await db.execute(sql`SELECT * FROM shop_categories WHERE id = ${id}`))[0]));
  }));

  app.put(`${A}/categories/:id`, requireAdmin, w(async (req, res) => {
    const c = rows(await db.execute(sql`SELECT * FROM shop_categories WHERE id = ${req.params.id} LIMIT 1`))[0];
    if (!c) return res.status(404).json({ error: "Category not found" });
    const b = req.body || {};
    const nameEn = b.nameEn !== undefined ? str(b.nameEn, 60) : c.name_en;
    if (!nameEn) return res.status(400).json({ error: "English name is required" });
    await db.execute(sql`UPDATE shop_categories SET name_en = ${nameEn}, name_bn = ${b.nameBn !== undefined ? str(b.nameBn, 60) || nameEn : c.name_bn},
      icon = ${b.icon !== undefined ? str(b.icon, 40) || "grid" : c.icon}, color = ${HEX.test(String(b.color)) ? String(b.color) : c.color},
      active = ${b.active !== undefined ? !!b.active : !!c.active}, updated_at = now() WHERE id = ${c.id}`);
    await audit(req, "UPDATE_CATEGORY", "category", c.id, b);
    res.json(catOut(rows(await db.execute(sql`SELECT * FROM shop_categories WHERE id = ${c.id}`))[0]));
  }));

  app.post(`${A}/categories/reorder`, requireAdmin, w(async (req, res) => {
    const ids = Array.isArray(req.body?.ids) ? req.body.ids.map(String).slice(0, 200) : null;
    if (!ids || !ids.length) return res.status(400).json({ error: "Send the categories in their new order" });
    let i = 0;
    for (const id of ids) await db.execute(sql`UPDATE shop_categories SET sort_order = ${i++}, updated_at = now() WHERE id = ${id}`);
    await audit(req, "REORDER_CATEGORIES", "category", null, { ids });
    res.json({ success: true });
  }));

  app.delete(`${A}/categories/:id`, requireAdmin, w(async (req, res) => {
    const c = rows(await db.execute(sql`SELECT * FROM shop_categories WHERE id = ${req.params.id} LIMIT 1`))[0];
    if (!c) return res.status(404).json({ error: "Category not found" });
    const n = Number(rows(await db.execute(sql`SELECT count(*)::int AS n FROM catalog_items WHERE kind = 'listings' AND coalesce(data->>'category','other') = ${c.slug}`))[0]?.n || 0);
    const to = str(req.query.reassign, 40);
    if (n > 0) {
      if (!to) return res.status(409).json({ error: `${n} product(s) use this category. Choose another category to move them to.`, products: n });
      if (to === c.slug || !(await categoryBySlug(to))) return res.status(400).json({ error: "Choose a different, existing category" });
      await db.execute(sql`UPDATE catalog_items SET data = jsonb_set(data, '{category}', to_jsonb(${to}::text)), updated_at = now()
        WHERE kind = 'listings' AND coalesce(data->>'category','other') = ${c.slug}`);
    }
    await db.execute(sql`DELETE FROM shop_categories WHERE id = ${c.id}`);
    await audit(req, "DELETE_CATEGORY", "category", c.id, { slug: c.slug, movedTo: to || null, products: n });
    res.json({ success: true, moved: n });
  }));

  // ================= SHOP =================
  app.get(`${A}/shop/overview`, requireAdmin, w(async (_req, res) => {
    const one = async (q: any) => Number(rows(await db.execute(q))[0]?.n || 0);
    const recent = rows(await db.execute(sql`SELECT o.*, u.name AS buyer_name, u.email AS buyer_email FROM shop_orders o LEFT JOIN users u ON u.id = o.user_id ORDER BY o.created_at DESC LIMIT 5`));
    const low = rows(await db.execute(sql`SELECT c.*, u.name AS owner_name FROM catalog_items c LEFT JOIN users u ON u.id = c.owner_id
      WHERE c.kind = 'listings' AND coalesce((c.data->>'quantity')::numeric, 0) <= 5 ORDER BY coalesce((c.data->>'quantity')::numeric, 0) ASC LIMIT 5`));
    res.json({
      stores: await one(sql`SELECT count(*)::int AS n FROM stores`),
      activeStores: await one(sql`SELECT count(*)::int AS n FROM stores WHERE status = 'active'`),
      products: await one(sql`SELECT count(*)::int AS n FROM catalog_items WHERE kind = 'listings'`),
      hiddenProducts: await one(sql`SELECT count(*)::int AS n FROM catalog_items WHERE kind = 'listings' AND (data->>'hidden') = 'true'`),
      outOfStock: await one(sql`SELECT count(*)::int AS n FROM catalog_items WHERE kind = 'listings' AND coalesce((data->>'quantity')::numeric, 0) <= 0`),
      categories: await one(sql`SELECT count(*)::int AS n FROM shop_categories`),
      pendingOrders: await one(sql`SELECT count(*)::int AS n FROM shop_orders WHERE status = 'pending'`),
      recentOrders: recent.map(orderOut),
      lowStock: low.map(productOut),
    });
  }));

  app.get(`${A}/products`, requireAdmin, w(async (req, res) => {
    const q = str(req.query.q, 100).toLowerCase();
    const like = `%${q}%`;
    const category = str(req.query.category, 40);
    const storeId = str(req.query.storeId, 80);
    const ownerId = str(req.query.ownerId, 80);
    const status = str(req.query.status, 20);
    const r = rows(await db.execute(sql`SELECT c.*, u.name AS owner_name, u.email AS owner_email, s.id AS store_id, s.name AS store_name, s.status AS store_status,
        (SELECT count(*)::int FROM shop_orders o WHERE o.data @> jsonb_build_array(jsonb_build_object('productId', c.id))) AS orders
      FROM catalog_items c LEFT JOIN users u ON u.id = c.owner_id LEFT JOIN stores s ON s.owner_id = c.owner_id
      WHERE c.kind = 'listings'
        AND (${q} = '' OR lower(coalesce(c.data->>'name','')) LIKE ${like} OR lower(coalesce(c.data->>'description','')) LIKE ${like}
             OR lower(coalesce(s.name, c.data->>'seller', '')) LIKE ${like} OR lower(coalesce(u.name,'')) LIKE ${like} OR lower(c.id) LIKE ${like})
        AND (${category} = '' OR coalesce(c.data->>'category','other') = ${category})
        AND (${storeId} = '' OR s.id = ${storeId})
        AND (${ownerId} = '' OR c.owner_id = ${ownerId})
        AND (${status} = '' OR (${status} = 'hidden' AND (c.data->>'hidden') = 'true')
             OR (${status} = 'out' AND coalesce((c.data->>'quantity')::numeric, 0) <= 0)
             OR (${status} = 'visible' AND coalesce(c.data->>'hidden','false') <> 'true'))
      ORDER BY c.created_at DESC LIMIT 300`));
    res.json(r.map(productOut));
  }));

  const productRow = async (id: string) =>
    rows(await db.execute(sql`SELECT c.*, u.name AS owner_name, u.email AS owner_email, s.id AS store_id, s.name AS store_name, s.status AS store_status
      FROM catalog_items c LEFT JOIN users u ON u.id = c.owner_id LEFT JOIN stores s ON s.owner_id = c.owner_id
      WHERE c.id = ${id} AND c.kind = 'listings' LIMIT 1`))[0] || null;

  app.get(`${A}/products/:id`, requireAdmin, w(async (req, res) => {
    const p = await productRow(req.params.id);
    if (!p) return res.status(404).json({ error: "Product not found" });
    const orders = rows(await db.execute(sql`SELECT o.*, u.name AS buyer_name, u.email AS buyer_email FROM shop_orders o LEFT JOIN users u ON u.id = o.user_id
      WHERE ${ordersWithProduct(p.id)} ORDER BY o.created_at DESC LIMIT 100`)).map(orderOut);
    const out = productOut(p);
    const sold = orders.filter((o) => o.status !== "cancelled").reduce((n, o) => n + o.items.filter((it: any) => it?.productId === p.id).reduce((m: number, it: any) => m + (Number(it.quantity) || 0), 0), 0);
    res.json({ ...out, orderList: orders, sold });
  }));

  app.post(`${A}/products`, requireAdmin, w(async (req, res) => {
    const b = req.body || {};
    const me = (req as any).admin;
    let store: any = null;
    let ownerId = me.id;
    if (b.storeId) {
      store = rows(await db.execute(sql`SELECT * FROM stores WHERE id = ${String(b.storeId)} LIMIT 1`))[0];
      if (!store) return res.status(404).json({ error: "Shop not found" });
      ownerId = store.owner_id;
    } else if (b.ownerId) {
      const u = rows(await db.execute(sql`SELECT id FROM users WHERE id = ${String(b.ownerId)} LIMIT 1`))[0];
      if (!u) return res.status(404).json({ error: "User not found" });
      ownerId = u.id;
      store = rows(await db.execute(sql`SELECT * FROM stores WHERE owner_id = ${ownerId} LIMIT 1`))[0] || null;
    }
    const f = productFields(b, false);
    if (f.error) return res.status(400).json(f);
    const cat = f.category || "other";
    if (!(await categoryBySlug(cat))) return res.status(400).json({ error: "Choose a category from the list" });
    const owner = rows(await db.execute(sql`SELECT name, username FROM users WHERE id = ${ownerId} LIMIT 1`))[0] || {};
    const id = `listings-${crypto.randomUUID()}`;
    const data: any = {
      currency: "৳", unit: "kg", rating: 0, active: true, ...f, category: cat,
      seller: store?.name || owner.name || owner.username || "Farmers", location: f.location || store?.location || "",
      ...(store ? { storeId: store.id, storeSlug: store.slug } : {}),
      ...(b.hidden !== undefined ? { hidden: !!b.hidden } : {}),
      ...(b.featured !== undefined ? { featured: !!b.featured } : {}),
      addedByAdmin: true,
    };
    await db.execute(sql`INSERT INTO catalog_items (id, kind, data, owner_id) VALUES (${id}, 'listings', ${JSON.stringify(data)}::jsonb, ${ownerId})`);
    await audit(req, "CREATE_PRODUCT", "listings", id, { name: data.name, storeId: store?.id || null, ownerId });
    res.status(201).json(productOut(await productRow(id)));
  }));

  app.put(`${A}/products/:id`, requireAdmin, w(async (req, res) => {
    const p = await productRow(req.params.id);
    if (!p) return res.status(404).json({ error: "Product not found" });
    const b = req.body || {};
    const f = productFields(b, true);
    if (f.error) return res.status(400).json(f);
    if (f.category !== undefined && !(await categoryBySlug(f.category))) return res.status(400).json({ error: "Choose a category from the list" });
    const before = J(p.data) || {};
    const data: any = { ...before, ...f };
    if (b.hidden !== undefined) data.hidden = !!b.hidden;
    if (b.featured !== undefined) data.featured = !!b.featured;
    if (Number(data.minOrder) > 1 && Number(data.quantity) > 0 && Number(data.minOrder) > Number(data.quantity))
      return res.status(400).json({ error: "Minimum order can't be more than the stock" });
    await db.execute(sql`UPDATE catalog_items SET data = ${JSON.stringify(data)}::jsonb, updated_at = now() WHERE id = ${p.id}`);
    if (b.hidden !== undefined && !!before.hidden !== !!b.hidden && p.owner_id && p.owner_id !== (req as any).uid) {
      await notify(p.owner_id, "moderation", b.hidden ? "Product hidden by admin" : "Product visible again", `${data.name} was ${b.hidden ? "hidden from the marketplace" : "made visible again"} by the admin.`, { itemId: p.id });
    }
    await audit(req, "UPDATE_PRODUCT", "listings", p.id, b);
    res.json(productOut(await productRow(p.id)));
  }));

  app.delete(`${A}/products/:id`, requireAdmin, w(async (req, res) => {
    const p = await productRow(req.params.id);
    if (!p) return res.status(404).json({ error: "Product not found" });
    await db.execute(sql`DELETE FROM catalog_items WHERE id = ${p.id}`);
    if (p.owner_id && p.owner_id !== (req as any).uid) {
      await notify(p.owner_id, "moderation", "Product removed by admin", `${(J(p.data) || {}).name || "Your product"} was removed by the admin.`, { itemId: p.id });
    }
    await audit(req, "DELETE_PRODUCT", "listings", p.id, { name: (J(p.data) || {}).name });
    res.json({ success: true });
  }));

  // Shops (stores)
  app.post(`${A}/stores`, requireAdmin, w(async (req, res) => {
    const b = req.body || {};
    const who = str(b.owner, 200).toLowerCase();
    if (!who) return res.status(400).json({ error: "Choose the shop owner (email, username or user id)" });
    const u = rows(await db.execute(sql`SELECT id, name FROM users WHERE id = ${who} OR lower(coalesce(email,'')) = ${who} OR lower(username) = ${who} LIMIT 1`))[0];
    if (!u) return res.status(404).json({ error: "No account found for that owner" });
    if (rows(await db.execute(sql`SELECT id FROM stores WHERE owner_id = ${u.id} LIMIT 1`))[0]) return res.status(409).json({ error: "This account already has a shop" });
    const f = storeFields(b);
    if (!f.name || f.name.length < 2) return res.status(400).json({ error: "Shop name is required" });
    const id = `store-${crypto.randomUUID()}`;
    await db.execute(sql`INSERT INTO stores (id, owner_id, name, slug, tagline, description, logo, banner, theme_color, phone, location, category)
      VALUES (${id}, ${u.id}, ${f.name}, ${slugify(f.name)}, ${f.tagline || null}, ${f.description || null}, ${f.logo || null}, ${f.banner || null},
        ${f.theme_color || "#2563EB"}, ${f.phone || null}, ${f.location || null}, ${f.category || null})`);
    await db.execute(sql`UPDATE catalog_items SET data = data || ${JSON.stringify({ storeId: id, seller: f.name })}::jsonb WHERE kind = 'listings' AND owner_id = ${u.id}`);
    await notify(u.id, "store", "Your shop is open", `The admin opened ${f.name} for you. Manage it from the Seller Hub.`, { storeId: id });
    await audit(req, "CREATE_STORE", "store", id, { name: f.name, ownerId: u.id });
    res.status(201).json(storeOut(rows(await db.execute(sql`SELECT * FROM stores WHERE id = ${id}`))[0]));
  }));

  app.get(`${A}/stores/:id`, requireAdmin, w(async (req, res) => {
    const s = rows(await db.execute(sql`SELECT s.*, u.name AS owner_name, u.email AS owner_email, u.phone AS owner_phone, u.username AS owner_username
      FROM stores s LEFT JOIN users u ON u.id = s.owner_id WHERE s.id = ${req.params.id} LIMIT 1`))[0];
    if (!s) return res.status(404).json({ error: "Shop not found" });
    const like = `%${s.owner_id}%`;
    const products = rows(await db.execute(sql`SELECT c.*, ${s.id} AS store_id, ${s.name} AS store_name,
        (SELECT count(*)::int FROM shop_orders o WHERE o.data @> jsonb_build_array(jsonb_build_object('productId', c.id))) AS orders
      FROM catalog_items c WHERE c.kind = 'listings' AND c.owner_id = ${s.owner_id} ORDER BY c.created_at DESC LIMIT 300`)).map(productOut);
    const orders = rows(await db.execute(sql`SELECT o.*, u.name AS buyer_name, u.email AS buyer_email FROM shop_orders o LEFT JOIN users u ON u.id = o.user_id
      WHERE o.seller_ids LIKE ${like} ORDER BY o.created_at DESC LIMIT 200`)).map(orderOut);
    const revenue = orders.filter((o) => o.status !== "cancelled").reduce((n, o) => n + o.total, 0);
    res.json({
      ...storeOut(s), ownerName: s.owner_name || s.owner_username || "", ownerEmail: s.owner_email || "", ownerPhone: s.owner_phone || "",
      products, orders, revenue,
      customers: [...new Map(orders.filter((o) => o.buyerId).map((o) => [o.buyerId, { id: o.buyerId, name: o.buyerName, email: o.buyerEmail }])).values()],
    });
  }));

  app.put(`${A}/stores/:id/details`, requireAdmin, w(async (req, res) => {
    const s = rows(await db.execute(sql`SELECT * FROM stores WHERE id = ${req.params.id} LIMIT 1`))[0];
    if (!s) return res.status(404).json({ error: "Shop not found" });
    const f = storeFields(req.body);
    if (f.name !== undefined && f.name.length < 2) return res.status(400).json({ error: "Shop name is required" });
    await db.execute(sql`UPDATE stores SET
      name = ${f.name ?? s.name}, tagline = ${f.tagline ?? s.tagline}, description = ${f.description ?? s.description},
      logo = ${f.logo ?? s.logo}, banner = ${f.banner ?? s.banner}, theme_color = ${f.theme_color ?? s.theme_color},
      phone = ${f.phone ?? s.phone}, location = ${f.location ?? s.location}, category = ${f.category ?? s.category}, updated_at = now()
      WHERE id = ${s.id}`);
    if (f.name && f.name !== s.name) {
      await db.execute(sql`UPDATE catalog_items SET data = jsonb_set(data, '{seller}', to_jsonb(${f.name}::text)) WHERE kind = 'listings' AND owner_id = ${s.owner_id}`);
    }
    await audit(req, "UPDATE_STORE_DETAILS", "store", s.id, f);
    res.json(storeOut(rows(await db.execute(sql`SELECT * FROM stores WHERE id = ${s.id}`))[0]));
  }));

  app.get(`${A}/orders/:id`, requireAdmin, w(async (req, res) => {
    const o = rows(await db.execute(sql`SELECT o.*, u.name AS buyer_name, u.email AS buyer_email, u.phone AS buyer_phone FROM shop_orders o LEFT JOIN users u ON u.id = o.user_id
      WHERE o.id = ${req.params.id} LIMIT 1`))[0];
    if (!o) return res.status(404).json({ error: "Order not found" });
    const out = orderOut(o);
    const pids = [...new Set(out.items.map((it: any) => String(it?.productId || "")).filter(Boolean))] as string[];
    const products: Record<string, any> = {};
    for (const pid of pids) {
      const p = await productRow(pid);
      if (p) products[pid] = { id: p.id, name: (J(p.data) || {}).name, storeId: p.store_id || null, storeName: p.store_name || "", ownerId: p.owner_id };
    }
    const sellers = out.sellerIds.length
      ? rows(await db.execute(sql`SELECT u.id, u.name, u.email, s.id AS store_id, s.name AS store_name FROM users u LEFT JOIN stores s ON s.owner_id = u.id
          WHERE u.id IN (${sql.join(out.sellerIds.map((x) => sql`${x}`), sql`, `)})`)).map((r: any) => ({ id: r.id, name: r.name || "", email: r.email || "", storeId: r.store_id || null, storeName: r.store_name || "" }))
      : [];
    res.json({ ...out, products, sellers });
  }));

  // ================= SUPPORT (Help -> admin) =================
  const myThread = async (uid: string) => rows(await db.execute(sql`SELECT * FROM support_threads WHERE user_id = ${uid} LIMIT 1`))[0] || null;
  const messages = async (threadId: string) =>
    rows(await db.execute(sql`SELECT m.*, u.name AS sender_name FROM support_messages m LEFT JOIN users u ON u.id = m.sender_id
      WHERE m.thread_id = ${threadId} ORDER BY m.created_at ASC, m.id ASC LIMIT 500`)).map(msgOut);

  app.get("/api/support/thread", requireUser, w(async (req, res) => {
    const uid = (req as any).uid;
    const t = await myThread(uid);
    const online = await adminsOnline();
    if (!t) return res.json({ thread: null, messages: [], adminsOnline: online });
    if (Number(t.user_unread) > 0) await db.execute(sql`UPDATE support_threads SET user_unread = 0 WHERE id = ${t.id} AND user_id = ${uid}`);
    const msgs = (await messages(t.id)).map((m) => ({ ...m, senderName: m.fromAdmin ? "Farmers Support" : m.senderName }));
    res.json({ thread: { ...threadOut(t), userUnread: 0 }, messages: msgs, adminsOnline: online });
  }));

  app.get("/api/support/unread", requireUser, w(async (req, res) => {
    const t = await myThread((req as any).uid);
    res.json({ unread: t ? Number(t.user_unread || 0) : 0, adminsOnline: await adminsOnline() });
  }));

  /** Add one message from the user to their own conversation (opens it if needed). Same clientId = same message. */
  const addUserMessage = async (
    uid: string,
    m: { body: string; kind: "text" | "image" | "voice"; clientId: string | null; media?: { b64: string; mime: string; size: number }; width?: number; height?: number; durationMs?: number },
  ) => {
    let t = await myThread(uid);
    if (m.clientId && t) {
      const dup = rows(await db.execute(sql`SELECT * FROM support_messages WHERE thread_id = ${t.id} AND client_id = ${m.clientId} LIMIT 1`))[0];
      if (dup) return { message: msgOut(dup), thread: threadOut(t), existing: true };
    }
    if (!t) {
      const id = `sup-${crypto.randomUUID()}`;
      await db.execute(sql`INSERT INTO support_threads (id, user_id) VALUES (${id}, ${uid}) ON CONFLICT (user_id) DO NOTHING`);
      t = await myThread(uid);
    }
    let mediaId: string | null = null;
    if (m.media) {
      mediaId = `sp-${Date.now()}-${crypto.randomBytes(8).toString("hex")}`;
      await db.execute(sql`INSERT INTO support_media (id, thread_id, sender_id, mime, size, data)
        VALUES (${mediaId}, ${t.id}, ${uid}, ${m.media.mime}, ${m.media.size}, decode(${m.media.b64}, 'base64'))`);
    }
    const mid = `sm-${Date.now()}-${crypto.randomBytes(4).toString("hex")}`;
    await db.execute(sql`INSERT INTO support_messages (id, thread_id, sender_id, from_admin, body, client_id, kind, media_id, width, height, duration_ms)
      VALUES (${mid}, ${t.id}, ${uid}, false, ${m.body}, ${m.clientId}, ${m.kind}, ${mediaId}, ${m.width || null}, ${m.height || null}, ${m.durationMs || null})`);
    await db.execute(sql`UPDATE support_threads SET status = 'open', last_message = ${m.body.slice(0, 200)}, last_from_admin = false,
      admin_unread = admin_unread + 1, last_message_at = now() WHERE id = ${t.id}`);
    const me = rows(await db.execute(sql`SELECT name, username FROM users WHERE id = ${uid} LIMIT 1`))[0] || {};
    for (const a of await admins()) {
      if (a === uid) continue;
      await notify(a, "support", `Help request from ${me.name || me.username || "a user"}`, m.body.slice(0, 200), { supportThreadId: t.id, screen: "AdminSupport" });
    }
    const row = rows(await db.execute(sql`SELECT * FROM support_messages WHERE id = ${mid}`))[0];
    return { message: msgOut(row), thread: threadOut(await myThread(uid)), existing: false };
  };

  app.post("/api/support/messages", requireUser, w(async (req, res) => {
    const body = str(req.body?.body, 2000);
    if (!body) return res.status(400).json({ error: "Write a message first" });
    const r = await addUserMessage((req as any).uid, { body, kind: "text", clientId: str(req.body?.clientId, 80) || null });
    res.status(r.existing ? 200 : 201).json({ message: r.message, thread: r.thread });
  }));

  app.post("/api/support/photo", requireUser, w(async (req, res) => {
    const { b64, mime, ok, size } = decodeUpload(req.body?.image, req.body?.mime, "image/jpeg");
    if (!ok) return res.status(400).json({ error: "The photo is missing or damaged" });
    if (!IMAGE_MIME.has(mime)) return res.status(400).json({ error: "That photo format isn't supported" });
    if (size < 100 || !looksLikeImage(b64, mime)) return res.status(400).json({ error: "That file isn't a photo" });
    if (size > MAX_IMAGE_BYTES) return res.status(413).json({ error: "The photo is too large (10 MB max)" });
    const width = Math.max(0, Math.min(20000, Math.round(Number(req.body?.width) || 0)));
    const height = Math.max(0, Math.min(20000, Math.round(Number(req.body?.height) || 0)));
    const r = await addUserMessage((req as any).uid, { body: PHOTO_LABEL, kind: "image", clientId: str(req.body?.clientId, 80) || null, media: { b64, mime, size }, width, height });
    res.status(r.existing ? 200 : 201).json({ message: r.message, thread: r.thread });
  }));

  app.post("/api/support/voice", requireUser, w(async (req, res) => {
    const { b64, mime, ok, size } = decodeUpload(req.body?.audio, req.body?.mime, "audio/mp4");
    if (!ok) return res.status(400).json({ error: "The recording is missing or damaged" });
    if (!VOICE_MIME.has(mime)) return res.status(400).json({ error: "That audio format isn't supported" });
    if (size < 200) return res.status(400).json({ error: "The recording is too short" });
    if (size > MAX_VOICE_BYTES) return res.status(413).json({ error: "The recording is too long" });
    const durationMs = Math.max(0, Math.min(MAX_VOICE_MS, Math.round(Number(req.body?.durationMs) || 0)));
    const r = await addUserMessage((req as any).uid, { body: VOICE_LABEL, kind: "voice", clientId: str(req.body?.clientId, 80) || null, media: { b64, mime, size }, durationMs });
    res.status(r.existing ? 200 : 201).json({ message: r.message, thread: r.thread });
  }));

  // A support photo / voice file: only the user whose conversation it is, or a Farmers admin.
  app.get("/api/support/media/:id", requireUser, w(async (req, res) => {
    const uid = (req as any).uid;
    const m = rows(await db.execute(sql`SELECT md.mime, encode(md.data, 'base64') AS b64, t.user_id FROM support_media md
      JOIN support_threads t ON t.id = md.thread_id WHERE md.id = ${String(req.params.id).slice(0, 120)} LIMIT 1`))[0];
    let allowed = !!m && m.user_id === uid;
    if (m && !allowed) {
      const u = rows(await db.execute(sql`SELECT is_super_admin, banned FROM users WHERE id = ${uid} LIMIT 1`))[0];
      allowed = !!u && !!u.is_super_admin && !u.banned;
    }
    // Same answer for "missing" and "not yours", so ids can't be probed.
    if (!m || !allowed) return res.status(404).json({ error: "File not found" });
    const buf = Buffer.from(String(m.b64).replace(/\s+/g, ""), "base64");
    res.setHeader("Content-Type", m.mime);
    res.setHeader("Content-Length", String(buf.length));
    res.setHeader("Cache-Control", "private, max-age=86400");
    res.end(buf);
  }));

  app.get(`${A}/support/unread`, requireAdmin, w(async (_req, res) => {
    const r = rows(await db.execute(sql`SELECT count(*)::int AS threads, coalesce(sum(admin_unread),0)::int AS messages FROM support_threads WHERE admin_unread > 0`))[0] || {};
    res.json({ threads: Number(r.threads || 0), messages: Number(r.messages || 0) });
  }));

  app.get(`${A}/support/threads`, requireAdmin, w(async (req, res) => {
    const status = str(req.query.status, 20);
    const q = str(req.query.q, 100).toLowerCase();
    const like = `%${q}%`;
    const r = rows(await db.execute(sql`SELECT t.*, u.name AS user_name, u.username, u.email AS user_email, u.phone AS user_phone, u.avatar AS user_avatar
      FROM support_threads t LEFT JOIN users u ON u.id = t.user_id
      WHERE (${status} = '' OR t.status = ${status})
        AND (${q} = '' OR lower(coalesce(u.name,'')) LIKE ${like} OR lower(coalesce(u.email,'')) LIKE ${like} OR lower(coalesce(u.username,'')) LIKE ${like}
             OR lower(coalesce(t.last_message,'')) LIKE ${like}
             OR EXISTS (SELECT 1 FROM support_messages m WHERE m.thread_id = t.id AND lower(m.body) LIKE ${like}))
      ORDER BY t.admin_unread > 0 DESC, t.last_message_at DESC LIMIT 300`));
    res.json(r.map(threadOut));
  }));

  const threadRow = async (id: string) =>
    rows(await db.execute(sql`SELECT t.*, u.name AS user_name, u.username, u.email AS user_email, u.phone AS user_phone, u.avatar AS user_avatar
      FROM support_threads t LEFT JOIN users u ON u.id = t.user_id WHERE t.id = ${id} LIMIT 1`))[0] || null;

  app.get(`${A}/support/threads/:id`, requireAdmin, w(async (req, res) => {
    const t = await threadRow(req.params.id);
    if (!t) return res.status(404).json({ error: "Conversation not found" });
    if (Number(t.admin_unread) > 0) await db.execute(sql`UPDATE support_threads SET admin_unread = 0 WHERE id = ${t.id}`);
    res.json({ thread: { ...threadOut(t), adminUnread: 0 }, messages: await messages(t.id) });
  }));

  app.post(`${A}/support/threads/:id/reply`, requireAdmin, w(async (req, res) => {
    const t = await threadRow(req.params.id);
    if (!t) return res.status(404).json({ error: "Conversation not found" });
    const body = str(req.body?.body, 2000);
    if (!body) return res.status(400).json({ error: "Write a reply first" });
    const clientId = str(req.body?.clientId, 80) || null;
    if (clientId) {
      const dup = rows(await db.execute(sql`SELECT m.*, u.name AS sender_name FROM support_messages m LEFT JOIN users u ON u.id = m.sender_id
        WHERE m.thread_id = ${t.id} AND m.client_id = ${clientId} LIMIT 1`))[0];
      if (dup) return res.json({ message: msgOut(dup) });
    }
    const mid = `sm-${Date.now()}-${crypto.randomBytes(4).toString("hex")}`;
    await db.execute(sql`INSERT INTO support_messages (id, thread_id, sender_id, from_admin, body, client_id) VALUES (${mid}, ${t.id}, ${(req as any).uid}, true, ${body}, ${clientId})`);
    await db.execute(sql`UPDATE support_threads SET last_message = ${body.slice(0, 200)}, last_from_admin = true, user_unread = user_unread + 1,
      admin_unread = 0, last_message_at = now(), status = ${req.body?.close ? "closed" : "open"} WHERE id = ${t.id}`);
    await notify(t.user_id, "support", "Farmers Support replied", body.slice(0, 200), { screen: "Support", supportThreadId: t.id });
    await audit(req, "SUPPORT_REPLY", "support", t.id, { length: body.length });
    const m = rows(await db.execute(sql`SELECT m.*, u.name AS sender_name FROM support_messages m LEFT JOIN users u ON u.id = m.sender_id WHERE m.id = ${mid}`))[0];
    res.status(201).json({ message: msgOut(m) });
  }));

  // Admin replies with a photo or a voice message, the same way users send them (stored in the
  // conversation; only its user or an admin can open the file).
  const adminMedia = (kind: "image" | "voice") => w(async (req, res) => {
    const t = await threadRow(req.params.id);
    if (!t) return res.status(404).json({ error: "Conversation not found" });
    const uid = (req as any).uid;
    const clientId = str(req.body?.clientId, 80) || null;
    if (clientId) {
      const dup = rows(await db.execute(sql`SELECT m.*, u.name AS sender_name FROM support_messages m LEFT JOIN users u ON u.id = m.sender_id
        WHERE m.thread_id = ${t.id} AND m.client_id = ${clientId} LIMIT 1`))[0];
      if (dup) return res.json({ message: msgOut(dup) });
    }
    let b64: string, mime: string, size: number, width = 0, height = 0, durationMs = 0;
    if (kind === "image") {
      const d = decodeUpload(req.body?.image, req.body?.mime, "image/jpeg");
      if (!d.ok) return res.status(400).json({ error: "The photo is missing or damaged" });
      if (!IMAGE_MIME.has(d.mime)) return res.status(400).json({ error: "That photo format isn't supported" });
      if (d.size < 100 || !looksLikeImage(d.b64, d.mime)) return res.status(400).json({ error: "That file isn't a photo" });
      if (d.size > MAX_IMAGE_BYTES) return res.status(413).json({ error: "The photo is too large (10 MB max)" });
      ({ b64, mime, size } = d);
      width = Math.max(0, Math.min(20000, Math.round(Number(req.body?.width) || 0)));
      height = Math.max(0, Math.min(20000, Math.round(Number(req.body?.height) || 0)));
    } else {
      const d = decodeUpload(req.body?.audio, req.body?.mime, "audio/mp4");
      if (!d.ok) return res.status(400).json({ error: "The recording is missing or damaged" });
      if (!VOICE_MIME.has(d.mime)) return res.status(400).json({ error: "That audio format isn't supported" });
      if (d.size < 200) return res.status(400).json({ error: "The recording is too short" });
      if (d.size > MAX_VOICE_BYTES) return res.status(413).json({ error: "The recording is too long" });
      ({ b64, mime, size } = d);
      durationMs = Math.max(0, Math.min(MAX_VOICE_MS, Math.round(Number(req.body?.durationMs) || 0)));
    }
    const label = kind === "image" ? PHOTO_LABEL : VOICE_LABEL;
    const mediaId = `sp-${Date.now()}-${crypto.randomBytes(8).toString("hex")}`;
    await db.execute(sql`INSERT INTO support_media (id, thread_id, sender_id, mime, size, data)
      VALUES (${mediaId}, ${t.id}, ${uid}, ${mime}, ${size}, decode(${b64}, 'base64'))`);
    const mid = `sm-${Date.now()}-${crypto.randomBytes(4).toString("hex")}`;
    await db.execute(sql`INSERT INTO support_messages (id, thread_id, sender_id, from_admin, body, kind, media_id, width, height, duration_ms, client_id)
      VALUES (${mid}, ${t.id}, ${uid}, true, ${label}, ${kind}, ${mediaId}, ${width || null}, ${height || null}, ${durationMs || null}, ${clientId})`);
    await db.execute(sql`UPDATE support_threads SET last_message = ${label}, last_from_admin = true, user_unread = user_unread + 1,
      admin_unread = 0, last_message_at = now(), status = 'open' WHERE id = ${t.id}`);
    await notify(t.user_id, "support", "Farmers Support replied", label, { screen: "Support", supportThreadId: t.id });
    await audit(req, "SUPPORT_REPLY", "support", t.id, { kind });
    const m = rows(await db.execute(sql`SELECT m.*, u.name AS sender_name FROM support_messages m LEFT JOIN users u ON u.id = m.sender_id WHERE m.id = ${mid}`))[0];
    res.status(201).json({ message: msgOut(m) });
  });
  app.post(`${A}/support/threads/:id/photo`, requireAdmin, adminMedia("image"));
  app.post(`${A}/support/threads/:id/voice`, requireAdmin, adminMedia("voice"));

  app.put(`${A}/support/threads/:id`, requireAdmin, w(async (req, res) => {
    const t = await threadRow(req.params.id);
    if (!t) return res.status(404).json({ error: "Conversation not found" });
    const status = String(req.body?.status || "");
    if (!["open", "closed"].includes(status)) return res.status(400).json({ error: "Status must be open or closed" });
    await db.execute(sql`UPDATE support_threads SET status = ${status} WHERE id = ${t.id}`);
    await audit(req, status === "closed" ? "SUPPORT_CLOSE" : "SUPPORT_REOPEN", "support", t.id, "");
    res.json({ success: true, status });
  }));
}
