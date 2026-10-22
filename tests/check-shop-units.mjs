// Shop selling units check on a locally run server with a throwaway database:
// company shops the admin opens without an owner, products sold by kg / litre / bag / bottle / dozen,
// what the main app's shop gets, and the server's checks on amounts, prices, stock and order lines.
//
//   node tests/check-shop-units.mjs
//
// Orders here go to the throwaway database only. The admin is promoted straight in that database.
import { spawn } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { PGlite } from "@electric-sql/pglite";

const PORT = 7000 + Math.floor(Math.random() * 900) + 50;
const BASE = `http://127.0.0.1:${PORT}`;
const dataDir = mkdtempSync(join(tmpdir(), "admin-check-"));
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
      PUSH_DISABLED: "1", ADMIN_EMAIL: "", JWT_SECRET: "admin-check-secret-0123456789abcdef0123456789ab" },
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

try {
  await start();
  const admin = await signup("boss");
  const buyer = await signup("buyer");
  const seller = await signup("seller");
  await stop();
  const pg = new PGlite(join(dataDir, "pglite"));
  await pg.query("UPDATE users SET is_super_admin = true WHERE id = $1", [admin.id]);
  await pg.close();
  await start();
  admin.token = (await login(admin)) || admin.token;
  buyer.token = (await login(buyer)) || buyer.token;
  seller.token = (await login(seller)) || seller.token;
  const A = "/api/admin/manage";

  // ---- company shop with no owner account
  let r = await call("POST", `${A}/stores`, admin.token, { name: `ACI Agro ${stamp}`, tagline: "Feed and fish medicine", location: "Dhaka" });
  ok(r.status === 201 && r.data?.companyShop === true && r.data?.ownerId?.startsWith("company-"), "admin opens a company shop with no owner", r);
  const shop = r.data;
  r = await call("POST", `${A}/stores`, admin.token, { name: `Square Agro ${stamp}` });
  ok(r.status === 201 && r.data?.companyShop === true, "a second company shop (several companies)", r);
  const shop2 = r.data;
  r = await call("POST", `${A}/stores`, admin.token, { name: `ACI Agro ${stamp}` });
  ok(r.status === 409, "same shop name twice is refused", r);
  r = await call("POST", `${A}/stores`, admin.token, { name: `Seller Shop ${stamp}`, owner: seller.email });
  ok(r.status === 201 && r.data?.companyShop === false && r.data?.ownerId === seller.id, "a seller's shop still works with an owner", r);
  r = await call("POST", `${A}/stores`, buyer.token, { name: "Hack shop" });
  ok(r.status === 401 || r.status === 403, "non-admin can't open a shop", r.status);

  // ---- products with different ways of selling
  const mk = async (body, sid = shop.id) => call("POST", `${A}/products`, admin.token, { storeId: sid, category: "other", ...body });
  r = await mk({ name: "Rice", price: 60, quantity: 50, unit: "kg", sellAs: "weight", step: 0.5, minOrder: 1, maxOrder: 20, presets: [1, 5, 10] });
  ok(r.status === 201, "rice sold by kg, step 0.5, min 1, max 20", r);
  const rice = r.data;
  ok(rice?.ownerId === shop.ownerId || rice?.data?.storeId === shop.id || rice?.storeId === shop.id, "rice belongs to the company shop", rice);
  r = await mk({ name: "BKC", price: 450, quantity: 30, unit: "litre", sellAs: "volume", step: 0.5, minOrder: 0.5 });
  ok(r.status === 201, "BKC sold by the litre in 0.5 steps", r);
  const bkc = r.data;
  r = await mk({ name: "Fish feed", price: 1500, quantity: 40, unit: "bag", sellAs: "pack", packSize: 25, packUnit: "kg", presets: [1, 2, 4] });
  ok(r.status === 201, "fish feed sold by 25 kg bag", r);
  const feed = r.data;
  r = await mk({ name: "Medicine", price: 220, quantity: 12, unit: "bottle", sellAs: "pack", packSize: 500, packUnit: "ml", maxOrder: 5 }, shop2.id);
  ok(r.status === 201, "medicine sold by 500 ml bottle, max 5", r);
  const med = r.data;
  r = await mk({ name: "Eggs", price: 150, quantity: 20, unit: "dozen", sellAs: "dozen" }, shop2.id);
  ok(r.status === 201, "eggs sold by the dozen", r);

  r = await mk({ name: "Bad bottle", price: 10, quantity: 5, unit: "bottle", sellAs: "pack", packSize: 1, packUnit: "litre", step: 0.5 });
  ok(r.status === 400, "half a bottle step is refused", r);
  r = await mk({ name: "Bad presets", price: 10, quantity: 5, unit: "kg", sellAs: "weight", step: 0.5, presets: [1.2] });
  ok(r.status === 400, "quick amount off the step is refused", r);
  r = await mk({ name: "Bad min", price: 10, quantity: 5, unit: "kg", sellAs: "weight", step: 2, minOrder: 3 });
  ok(r.status === 400, "minimum not on a step is refused", r);
  r = await mk({ name: "Bad unit", price: 10, quantity: 5, unit: "litre", sellAs: "weight" });
  ok(r.status === 400, "unit that doesn't match how it is sold is refused", r);
  r = await call("PUT", `${A}/products/${med.id}`, admin.token, { step: 0.5 });
  ok(r.status === 400, "editing bottles to half steps is refused", r);
  r = await call("PUT", `${A}/products/${rice.id}`, admin.token, { presets: [1, 2.5, 10] });
  ok(r.status === 200, "editing rice quick amounts works", r);

  // ---- the main app's shop sees shops and products as set
  r = await call("GET", "/api/stores", null);
  const listed = (r.data || []).find((s) => s.id === shop.id);
  ok(r.status === 200 && listed?.products === 3 && listed?.companyShop === true, "public shop list shows the company shop with 3 products", listed || r);
  r = await call("GET", `/api/stores/${shop.slug}`, null);
  const pr = (r.data?.products || []).find((p) => p.id === rice.id);
  ok(r.status === 200 && pr?.step === 0.5 && pr?.minOrder === 1 && pr?.maxOrder === 20 && JSON.stringify(pr?.presets) === "[1,2.5,10]" && pr?.sellAs === "weight", "shop page gives rice's selling settings", pr || r);
  const pf = (r.data?.products || []).find((p) => p.id === feed.id);
  ok(pf?.packSize === 25 && pf?.packUnit === "kg" && pf?.unit === "bag", "shop page gives fish feed's pack size", pf);
  r = await call("GET", "/api/catalog/listings", buyer.token);
  ok((r.data || []).some((p) => p.id === rice.id && p.storeSlug === shop.slug), "marketplace list has rice with its shop", (r.data || []).length);

  // hidden products leave the marketplace
  r = await call("PUT", `${A}/products/${med.id}`, admin.token, { hidden: true });
  const hid = await call("GET", "/api/catalog/listings", buyer.token);
  ok(!(hid.data || []).some((p) => p.id === med.id), "hidden product is not in the marketplace", r);
  r = await call("PUT", `${A}/products/${med.id}`, admin.token, { hidden: false });
  const back = await call("GET", "/api/catalog/listings", buyer.token);
  ok((back.data || []).some((p) => p.id === med.id), "shown again after un-hiding", r);

  // ---- checkout rules on the server
  const quote = (items) => call("POST", "/api/checkout/quote", buyer.token, { items, deliveryMethod: "home", zone: "inside_dhaka", division: "Dhaka" });
  const line = (p, quantity) => ({ productId: p.id, name: "x", price: 1, quantity });
  r = await quote([line(rice, 2.5)]);
  ok(r.status === 200 && r.data?.subtotal === 150 && !(r.data?.itemErrors || []).length && r.data?.lines?.[0]?.unit === "kg", "2.5 kg rice quotes ৳150", r.data);
  r = await quote([line(rice, 2.3)]);
  ok((r.data?.itemErrors || []).some((e) => /steps of 0.5 kg/.test(e.error)), "2.3 kg is refused (steps of 0.5)", r.data);
  r = await quote([line(rice, 0.5)]);
  ok((r.data?.itemErrors || []).some((e) => /minimum order of 1 kg/.test(e.error)), "0.5 kg is below the minimum", r.data);
  r = await quote([line(rice, 21)]);
  ok((r.data?.itemErrors || []).some((e) => /up to 20 kg/.test(e.error)), "21 kg is above the maximum", r.data);
  r = await quote([line(bkc, 1.5)]);
  ok(r.data?.subtotal === 675 && !(r.data?.itemErrors || []).length, "1.5 litre BKC quotes ৳675", r.data);
  r = await quote([line(med, 1.5)]);
  ok((r.data?.itemErrors || []).length > 0, "1.5 bottles is refused", r.data);
  r = await quote([line(med, 6)]);
  ok((r.data?.itemErrors || []).some((e) => /up to 5 bottles/.test(e.error)), "6 bottles is above the maximum of 5", r.data);
  r = await quote([line(feed, 41)]);
  ok((r.data?.stockErrors || []).some((e) => e.available === 40), "41 bags is more than the stock", r.data);
  r = await quote([{ ...line(rice, 2), price: 1 }]);
  ok(r.data?.subtotal === 120, "price comes from the product, not the app", r.data);

  // ---- a real order on the throwaway server: lines keep the unit, stock goes down in kg
  const checkout = { contactName: "Buyer", contactPhone: "01712345678", zone: "inside_dhaka", division: "Dhaka", district: "Dhaka", address: "Road 1", deliveryMethod: "home", paymentMethod: "cod" };
  r = await call("POST", "/api/shop-orders", buyer.token, { items: [line(rice, 2.5), line(feed, 3)], checkout, paymentMethod: "cod" });
  ok(r.status === 201 || r.status === 200, "order of 2.5 kg rice and 3 bags of feed is placed", r);
  const order = r.data;
  const items = order?.items || [];
  const ri = items.find((i) => i.productId === rice.id), fi = items.find((i) => i.productId === feed.id);
  ok(ri?.quantity === 2.5 && ri?.unit === "kg" && ri?.sellAs === "weight", "order line says 2.5 kg", ri);
  ok(fi?.quantity === 3 && fi?.unit === "bag" && fi?.packSize === 25 && fi?.packUnit === "kg", "order line says 3 bags of 25 kg", fi);
  ok(Number(order?.checkout?.subtotal) === 150 + 4500, "order subtotal ৳4650", order?.checkout);
  r = await call("GET", `${A}/products/${rice.id}`, admin.token);
  const rd = r.data?.data || r.data;
  ok(Number(rd?.quantity) === 47.5, "rice stock went from 50 to 47.5 kg", rd?.quantity);
  r = await call("POST", "/api/shop-orders", buyer.token, { items: [line(rice, 2.3)], checkout, paymentMethod: "cod" });
  ok(r.status === 400, "an order with 2.3 kg is refused by the server", r);
  r = await call("GET", "/api/admin/manage/orders", admin.token);
  ok(r.status === 200, "admin orders list still loads", r.status);

  // ---- older products (no selling settings) keep the old rule
  r = await call("POST", "/api/catalog/listings", seller.token, { name: "Old mango", price: 100, unit: "kg", quantity: 10 });
  ok(r.status === 201 || r.status === 200, "old-style listing made with the Sell form", r);
  const old = r.data;
  r = await quote([line(old, 2)]);
  ok(r.data?.subtotal === 200 && !(r.data?.itemErrors || []).length, "old listing: 2 kg is fine", r.data);
  r = await quote([line(old, 1.5)]);
  ok((r.data?.itemErrors || []).length > 0, "old listing: still whole numbers only", r.data);
} catch (e) {
  failed++;
  console.log("ERROR", e?.stack || e);
} finally {
  await stop();
  rmSync(dataDir, { recursive: true, force: true });
  console.log(`\n${passed} passed, ${failed} failed`);
  process.exit(failed ? 1 : 0);
}
