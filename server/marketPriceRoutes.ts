import type { Express, Request } from "express";
import crypto from "crypto";
import { sql } from "drizzle-orm";
import { db, dbReady } from "./db";
import { notify } from "./featureRoutes";
import { rows, iso, str, wrap, requireAdmin, audit } from "./platformRoutes";

/**
 * Daily market prices (বাজার দর), posted by admins per district and product.
 *
 *  Public   GET /api/market-prices?district=&category=&q=   latest price per product (with the previous day's for the trend)
 *           GET /api/market-prices/meta                      districts and categories that have prices, last update
 *           GET /api/market-prices/history?item=&district=   last 30 days for one product
 *  Admin    GET    /api/admin/manage/market-prices?district=&date=
 *           POST   /api/admin/manage/market-prices           {rows:[{nameEn,nameBn,category,unit,district,market,min,max,date}]} upsert
 *           PUT    /api/admin/manage/market-prices/:id
 *           DELETE /api/admin/manage/market-prices/:id
 *           POST   /api/admin/manage/market-prices/copy      {district, fromDate, toDate} copy a day as a starting point
 *           GET    /api/admin/manage/market-prices/items     product names used before (for quick picks)
 *
 * After admins save prices, users' price alerts (user_price_alerts) whose product matches the English or
 * Bangla name are checked against the new average price and fire a notification once.
 */

export const PRICE_CATEGORIES = ["vegetables", "fruits", "grains", "fish", "livestock", "poultry", "dairy", "spices", "feed", "other"];
export const PRICE_UNITS = ["kg", "maund", "litre", "piece", "dozen", "hali", "quintal"];
const DATE = /^\d{4}-\d{2}-\d{2}$/;

let ready: Promise<void> | null = null;
export function ensureMarketPrices() {
  if (!ready) {
    ready = (async () => {
      await dbReady;
      await db.execute(sql`CREATE TABLE IF NOT EXISTS daily_market_prices (
        id varchar PRIMARY KEY, item_key varchar NOT NULL, name_en text NOT NULL, name_bn text NOT NULL,
        category varchar NOT NULL DEFAULT 'other', unit varchar NOT NULL DEFAULT 'kg', district varchar NOT NULL,
        market text, price_min numeric NOT NULL, price_max numeric NOT NULL, price_date date NOT NULL,
        created_by varchar, created_at timestamp NOT NULL DEFAULT now(), updated_at timestamp NOT NULL DEFAULT now())`);
      await db.execute(sql`CREATE UNIQUE INDEX IF NOT EXISTS market_prices_key_idx ON daily_market_prices (item_key, district, price_date)`);
      await db.execute(sql`CREATE INDEX IF NOT EXISTS market_prices_date_idx ON daily_market_prices (district, price_date)`);
    })().catch((e) => {
      ready = null;
      throw e;
    });
  }
  return ready;
}

/** Today's date in Bangladesh (UTC+6), YYYY-MM-DD. */
export function todayBD() {
  return new Date(Date.now() + 6 * 3600 * 1000).toISOString().slice(0, 10);
}
const dstr = (v: any) => {
  if (!v) return null;
  if (v instanceof Date) {
    if (v.getUTCHours() === 0 && v.getUTCMinutes() === 0) return v.toISOString().slice(0, 10);
    return new Date(v.getTime() - v.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
  }
  return String(v).slice(0, 10);
};
const keyOf = (nameEn: string) =>
  nameEn.toLowerCase().normalize("NFKD").replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 60);
const norm = (s: string) => String(s || "").toLowerCase().replace(/\s+/g, "");
const round = (n: number) => Math.round(n * 100) / 100;

function out(r: any) {
  const min = Number(r.price_min), max = Number(r.price_max);
  return {
    id: r.id, itemKey: r.item_key, nameEn: r.name_en, nameBn: r.name_bn, category: r.category, unit: r.unit,
    district: r.district, market: r.market || "", min, max, avg: round((min + max) / 2), date: dstr(r.price_date),
    updatedAt: iso(r.updated_at),
  };
}

/** Validates one row from the admin. Returns [row, error]. */
function parseRow(b: any): [any, string | null] {
  const nameEn = str(b?.nameEn, 80);
  const nameBn = str(b?.nameBn, 80) || nameEn;
  const district = str(b?.district, 60);
  const min = Number(b?.min), max = Number(b?.max === "" || b?.max === undefined || b?.max === null ? b?.min : b?.max);
  const date = str(b?.date, 10) || todayBD();
  const category = PRICE_CATEGORIES.includes(String(b?.category)) ? String(b.category) : "other";
  const unit = str(b?.unit, 20) || "kg";
  if (!nameEn) return [null, "Write the product name in English"];
  const itemKey = keyOf(nameEn);
  if (!itemKey) return [null, "Use English letters or numbers in the English name"];
  if (!district) return [null, "Pick a district"];
  if (!(min > 0) || !(max > 0)) return [null, "Prices must be more than 0"];
  if (min > 1e7 || max > 1e7) return [null, "Price is too high"];
  if (min > max) return [null, "Lowest price can't be more than the highest"];
  if (!DATE.test(date) || isNaN(Date.parse(date))) return [null, "Date must be YYYY-MM-DD"];
  if (date > todayBD()) return [null, "Date can't be in the future"];
  return [{ itemKey, nameEn, nameBn, category, unit, district, market: str(b?.market, 80), min, max, date }, null];
}

async function upsert(row: any, uid: string | null) {
  const id = `mp-${crypto.randomUUID()}`;
  const r = rows(
    await db.execute(sql`INSERT INTO daily_market_prices (id, item_key, name_en, name_bn, category, unit, district, market, price_min, price_max, price_date, created_by)
      VALUES (${id}, ${row.itemKey}, ${row.nameEn}, ${row.nameBn}, ${row.category}, ${row.unit}, ${row.district}, ${row.market || null}, ${row.min}, ${row.max}, ${row.date}, ${uid})
      ON CONFLICT (item_key, district, price_date) DO UPDATE SET name_en = EXCLUDED.name_en, name_bn = EXCLUDED.name_bn,
        category = EXCLUDED.category, unit = EXCLUDED.unit, market = EXCLUDED.market, price_min = EXCLUDED.price_min,
        price_max = EXCLUDED.price_max, updated_at = now()
      RETURNING *`),
  );
  return r[0];
}

/** Fires users' price alerts that match a product's new average price (once per alert). */
export async function checkPriceAlerts(items: { nameEn: string; nameBn: string; avg: number; unit: string; district: string }[]) {
  if (!items.length) return 0;
  const alerts = rows(await db.execute(sql`SELECT * FROM user_price_alerts WHERE active = true AND triggered_at IS NULL`).catch(() => [] as any));
  let fired = 0;
  for (const a of alerts) {
    const want = norm(a.product);
    const hit = items.find((i) => norm(i.nameEn) === want || norm(i.nameBn) === want);
    if (!hit) continue;
    const t = Number(a.target);
    const p = hit.avg;
    if (!((a.condition === "below" && p <= t) || (a.condition === "above" && p >= t))) continue;
    await db.execute(sql`UPDATE user_price_alerts SET triggered_at = now() WHERE id = ${a.id}`);
    await notify(
      a.user_id,
      "price",
      `Price alert: ${hit.nameEn} / ${hit.nameBn}`,
      `${hit.nameEn} is ৳${p}/${hit.unit} in ${hit.district} (${a.condition === "below" ? "at or below" : "at or above"} your ৳${t} target). ` +
        `${hit.nameBn} এখন ${hit.district}-এ ৳${p}/${hit.unit}।`,
      { alertId: a.id, price: p, screen: "MarketPrices" },
    );
    fired++;
  }
  return fired;
}

const w = (fn: (req: Request, res: any) => Promise<any>) => wrap(async (req, res) => {
  await ensureMarketPrices();
  return fn(req, res);
});

export function registerMarketPriceRoutes(app: Express) {
  ensureMarketPrices().catch((e) => console.error("[market-prices] init", e?.message));
  const A = "/api/admin/manage/market-prices";

  app.get("/api/market-prices/meta", w(async (_req, res) => {
    const d = rows(await db.execute(sql`SELECT district, count(DISTINCT item_key)::int AS items, max(price_date) AS last FROM daily_market_prices
      WHERE price_date >= (now() - interval '60 days')::date GROUP BY district ORDER BY district`));
    const c = rows(await db.execute(sql`SELECT DISTINCT category FROM daily_market_prices WHERE price_date >= (now() - interval '60 days')::date`));
    const last = rows(await db.execute(sql`SELECT max(updated_at) AS u FROM daily_market_prices`))[0]?.u;
    res.json({
      districts: d.map((r) => ({ district: r.district, items: Number(r.items), lastDate: dstr(r.last) })),
      categories: PRICE_CATEGORIES.filter((k) => c.some((r) => r.category === k)),
      lastUpdated: iso(last),
      today: todayBD(),
    });
  }));

  app.get("/api/market-prices", w(async (req, res) => {
    const district = str(req.query.district, 60);
    const category = str(req.query.category, 30);
    const q = str(req.query.q, 60).toLowerCase();
    // Latest two days with a price for each product (and district), within the last 60 days.
    const r = rows(await db.execute(sql`SELECT * FROM (
        SELECT m.*, row_number() OVER (PARTITION BY item_key, district ORDER BY price_date DESC) AS rn
        FROM daily_market_prices m
        WHERE price_date >= (now() - interval '60 days')::date
          AND (${district} = '' OR district = ${district})
          AND (${category} = '' OR ${category} = 'all' OR category = ${category})
      ) x WHERE rn <= 2 ORDER BY name_en, district, price_date DESC`));
    const map = new Map<string, any>();
    for (const row of r) {
      const k = `${row.item_key}|${row.district}`;
      const o = out(row);
      const cur = map.get(k);
      if (!cur) map.set(k, { ...o, prevAvg: null, prevDate: null });
      else if (cur.prevAvg === null) { cur.prevAvg = o.avg; cur.prevDate = o.date; }
    }
    let items = [...map.values()].map((i) => {
      const change = i.prevAvg === null ? null : round(i.avg - i.prevAvg);
      const changePct = i.prevAvg ? round(((i.avg - i.prevAvg) / i.prevAvg) * 100) : null;
      return { ...i, change, changePct, trend: change === null || change === 0 ? "stable" : change > 0 ? "up" : "down" };
    });
    if (q) items = items.filter((i) => i.nameEn.toLowerCase().includes(q) || i.nameBn.toLowerCase().includes(q) || i.itemKey.includes(q));
    res.json({ items, today: todayBD() });
  }));

  app.get("/api/market-prices/history", w(async (req, res) => {
    const item = str(req.query.item, 60);
    const district = str(req.query.district, 60);
    if (!item) return res.status(400).json({ error: "item is required" });
    const r = rows(await db.execute(sql`SELECT * FROM daily_market_prices WHERE item_key = ${item} AND (${district} = '' OR district = ${district})
      AND price_date >= (now() - interval '30 days')::date ORDER BY price_date ASC, district`));
    res.json({ points: r.map(out) });
  }));

  // ---------- admin ----------
  app.get(`${A}/items`, requireAdmin, w(async (_req, res) => {
    const r = rows(await db.execute(sql`SELECT DISTINCT ON (item_key) item_key, name_en, name_bn, category, unit FROM daily_market_prices ORDER BY item_key, updated_at DESC`));
    res.json(r.map((x) => ({ itemKey: x.item_key, nameEn: x.name_en, nameBn: x.name_bn, category: x.category, unit: x.unit })));
  }));

  app.get(A, requireAdmin, w(async (req, res) => {
    const district = str(req.query.district, 60);
    const date = str(req.query.date, 10) || todayBD();
    if (!DATE.test(date)) return res.status(400).json({ error: "Date must be YYYY-MM-DD" });
    const r = rows(await db.execute(sql`SELECT * FROM daily_market_prices WHERE price_date = ${date} AND (${district} = '' OR district = ${district}) ORDER BY district, name_en`));
    const days = rows(await db.execute(sql`SELECT price_date, count(*)::int AS n FROM daily_market_prices WHERE (${district} = '' OR district = ${district})
      GROUP BY price_date ORDER BY price_date DESC LIMIT 10`));
    res.json({ date, district, rows: r.map(out), recentDays: days.map((d) => ({ date: dstr(d.price_date), count: Number(d.n) })), today: todayBD() });
  }));

  app.post(A, requireAdmin, w(async (req, res) => {
    const list = Array.isArray(req.body?.rows) ? req.body.rows : [req.body];
    if (!list.length || list.length > 300) return res.status(400).json({ error: "Send between 1 and 300 prices" });
    const parsed: any[] = [];
    for (let i = 0; i < list.length; i++) {
      const [row, err] = parseRow(list[i]);
      if (err) return res.status(400).json({ error: list.length > 1 ? `Row ${i + 1}: ${err}` : err });
      parsed.push(row);
    }
    const saved = [];
    for (const row of parsed) saved.push(out(await upsert(row, (req as any).uid)));
    await audit(req, "SAVE_MARKET_PRICES", "market_price", saved[0]?.id || null, { count: saved.length, district: parsed[0].district, date: parsed[0].date });
    const today = todayBD();
    const alertsFired = await checkPriceAlerts(saved.filter((s) => s.date === today || saved.length === 1));
    res.status(201).json({ saved, alertsFired });
  }));

  app.put(`${A}/:id`, requireAdmin, w(async (req, res) => {
    const cur = rows(await db.execute(sql`SELECT * FROM daily_market_prices WHERE id = ${req.params.id}`))[0];
    if (!cur) return res.status(404).json({ error: "Price not found" });
    const [row, err] = parseRow({ ...out(cur), ...req.body });
    if (err) return res.status(400).json({ error: err });
    if (row.itemKey !== cur.item_key || row.district !== cur.district || row.date !== dstr(cur.price_date)) {
      const clash = rows(await db.execute(sql`SELECT id FROM daily_market_prices WHERE item_key = ${row.itemKey} AND district = ${row.district} AND price_date = ${row.date} AND id <> ${cur.id}`))[0];
      if (clash) return res.status(409).json({ error: "That product already has a price for this district and day" });
    }
    const r = rows(await db.execute(sql`UPDATE daily_market_prices SET item_key = ${row.itemKey}, name_en = ${row.nameEn}, name_bn = ${row.nameBn}, category = ${row.category},
      unit = ${row.unit}, district = ${row.district}, market = ${row.market || null}, price_min = ${row.min}, price_max = ${row.max}, price_date = ${row.date}, updated_at = now()
      WHERE id = ${cur.id} RETURNING *`))[0];
    await audit(req, "UPDATE_MARKET_PRICE", "market_price", cur.id, { nameEn: row.nameEn, min: row.min, max: row.max });
    const o = out(r);
    const alertsFired = await checkPriceAlerts([o]);
    res.json({ ...o, alertsFired });
  }));

  app.delete(`${A}/:id`, requireAdmin, w(async (req, res) => {
    const r = rows(await db.execute(sql`DELETE FROM daily_market_prices WHERE id = ${req.params.id} RETURNING id, name_en`));
    if (!r[0]) return res.status(404).json({ error: "Price not found" });
    await audit(req, "DELETE_MARKET_PRICE", "market_price", req.params.id, { nameEn: r[0].name_en });
    res.json({ success: true });
  }));

  app.post(`${A}/copy`, requireAdmin, w(async (req, res) => {
    const district = str(req.body?.district, 60);
    const toDate = str(req.body?.toDate, 10) || todayBD();
    let fromDate = str(req.body?.fromDate, 10);
    if (!district) return res.status(400).json({ error: "Pick a district" });
    if (!DATE.test(toDate) || toDate > todayBD()) return res.status(400).json({ error: "Date must be YYYY-MM-DD and not in the future" });
    if (!fromDate) {
      fromDate = dstr(rows(await db.execute(sql`SELECT max(price_date) AS d FROM daily_market_prices WHERE district = ${district} AND price_date < ${toDate}`))[0]?.d) || "";
      if (!fromDate) return res.status(404).json({ error: "No earlier prices to copy for this district" });
    }
    const src = rows(await db.execute(sql`SELECT * FROM daily_market_prices WHERE district = ${district} AND price_date = ${fromDate}`));
    let copied = 0;
    for (const s of src) {
      const r = rows(await db.execute(sql`INSERT INTO daily_market_prices (id, item_key, name_en, name_bn, category, unit, district, market, price_min, price_max, price_date, created_by)
        VALUES (${`mp-${crypto.randomUUID()}`}, ${s.item_key}, ${s.name_en}, ${s.name_bn}, ${s.category}, ${s.unit}, ${s.district}, ${s.market}, ${s.price_min}, ${s.price_max}, ${toDate}, ${(req as any).uid})
        ON CONFLICT (item_key, district, price_date) DO NOTHING RETURNING id`));
      if (r[0]) copied++;
    }
    await audit(req, "COPY_MARKET_PRICES", "market_price", null, { district, fromDate, toDate, copied });
    res.json({ copied, fromDate, toDate });
  }));
}
