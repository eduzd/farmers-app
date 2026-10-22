import type { Express } from "express";
import { sql } from "drizzle-orm";
import { db } from "./db";
import { rows, wrap, requireAdmin, storeOut, itemOut } from "./platformRoutes";

/**
 * "View as buyer" for the admin app. Read-only: nothing here writes to the database.
 *
 *  GET /api/admin/manage/preview/products/:id   the product exactly as the public catalog sends it (same fields as
 *                                                GET /api/catalog/listings), even when buyers can't see it right now,
 *                                                plus why buyers can't see it (hidden, switched off, shop suspended)
 *  GET /api/admin/manage/preview/stores/:idOrSlug   the shop exactly as GET /api/stores/:slug sends it (only the
 *                                                products buyers can see), even when the shop is suspended,
 *                                                plus how many products are left out and why buyers can't see it
 *
 * Both are admin only (requireAdmin checks the account on every request), so a hidden product or a suspended
 * shop never reaches anyone else through these.
 */
export function registerPreviewRoutes(app: Express) {
  const A = "/api/admin/manage/preview";

  app.get(`${A}/products/:id`, requireAdmin, wrap(async (req, res) => {
    const r = rows(await db.execute(sql`SELECT * FROM catalog_items WHERE id = ${String(req.params.id)} AND kind = 'listings' LIMIT 1`))[0];
    if (!r) return res.status(404).json({ error: "Product not found" });
    const product: any = itemOut(r);
    const s = r.owner_id
      ? rows(await db.execute(sql`SELECT * FROM stores WHERE owner_id = ${r.owner_id} OR id = ${String(product.storeId || "")} ORDER BY (id = ${String(product.storeId || "")}) DESC LIMIT 1`))[0]
      : null;
    const reasons: string[] = [];
    if (product.hidden) reasons.push("hidden");
    if (product.active === false) reasons.push("inactive");
    if (s && s.status !== "active") reasons.push("storeSuspended");
    res.json({ product, store: s ? storeOut(s) : null, buyersCanSee: reasons.length === 0, reasons });
  }));

  app.get(`${A}/stores/:id`, requireAdmin, wrap(async (req, res) => {
    const key = String(req.params.id);
    const s = rows(await db.execute(sql`SELECT * FROM stores WHERE id = ${key} OR slug = ${key} LIMIT 1`))[0];
    if (!s) return res.status(404).json({ error: "Store not found" });
    const all = rows(await db.execute(sql`SELECT * FROM catalog_items WHERE kind = 'listings' AND owner_id = ${s.owner_id} ORDER BY created_at DESC`)).map(itemOut);
    // Same rule as the public shop page: hidden or switched-off products are not shown to buyers.
    const products = all.filter((i: any) => !i.hidden && i.active !== false);
    const reasons: string[] = s.status !== "active" ? ["storeSuspended"] : [];
    res.json({ store: storeOut(s), products, leftOut: all.length - products.length, buyersCanSee: reasons.length === 0, reasons });
  }));
}
