// Admin app backend check on a locally run server with a throwaway database:
// admin-only access, categories reaching the public market list, shop / products / orders
// management, and Help -> admin support chat with replies and strict conversation access.
//
//   node tests/check-admin-app.mjs
//
// The admin account is made the normal way (sign up), then promoted straight in the
// throwaway database while the server is stopped. There is no test back door in the server.
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
  const seller = await signup("seller");
  const buyer = await signup("buyer");
  const other = await signup("other");
  await stop();
  const pg = new PGlite(join(dataDir, "pglite"));
  await pg.query("UPDATE users SET is_super_admin = true WHERE id = $1", [admin.id]);
  await pg.close();
  await start();
  admin.token = (await login(admin)) || admin.token;

  // ---- access control ----
  const adminPaths = ["/categories", "/shop/overview", "/products", "/support/threads", "/support/unread", "/orders", "/stores"];
  for (const p of adminPaths) {
    const a = await call("GET", `/api/admin/manage${p}`, null);
    const b = await call("GET", `/api/admin/manage${p}`, buyer.token);
    ok(a.status === 401 && b.status === 403, `non-admin denied ${p} (no token ${a.status}, user ${b.status})`);
  }
  const denyWrite = await call("POST", "/api/admin/manage/categories", buyer.token, { nameEn: "Hack" });
  ok(denyWrite.status === 403, "non-admin can't create a category", denyWrite);
  const denyProd = await call("POST", "/api/admin/manage/products", seller.token, { name: "x", price: 1 });
  ok(denyProd.status === 403, "non-admin can't add products through admin API", denyProd);
  const adminOk = await call("GET", "/api/admin/manage/categories", admin.token);
  ok(adminOk.status === 200 && adminOk.data.length >= 13, `admin sees categories (${adminOk.data?.length})`, adminOk);

  // ---- categories propagate to the public list (main app + Seller Hub) ----
  const add = await call("POST", "/api/admin/manage/categories", admin.token, { nameEn: "Fish Feed", nameBn: "মাছের খাদ্য", icon: "anchor", color: "#0E7490" });
  ok(add.status === 201 && add.data.slug === "fish-feed", "admin creates Fish Feed category", add);
  let pub = await call("GET", "/api/market/categories", null);
  ok(pub.data.some((c) => c.slug === "fish-feed" && c.nameBn === "মাছের খাদ্য"), "new category appears in the public market list immediately");
  const ids = adminOk.data.map((c) => c.id);
  await call("POST", "/api/admin/manage/categories/reorder", admin.token, { ids: [add.data.id, ...ids] });
  pub = await call("GET", "/api/market/categories", null);
  ok(pub.data[0]?.slug === "fish-feed", "reorder puts it first in the public list");
  await call("PUT", `/api/admin/manage/categories/${add.data.id}`, admin.token, { nameEn: "Fish feed & food" });
  const hide = await call("PUT", `/api/admin/manage/categories/${ids[ids.length - 1]}`, admin.token, { active: false });
  pub = await call("GET", "/api/market/categories", null);
  ok(pub.data.find((c) => c.slug === "fish-feed")?.nameEn === "Fish feed & food" && !pub.data.some((c) => c.id === hide.data.id), "rename and hide reach the public list");
  const dupe = await call("POST", "/api/admin/manage/categories", admin.token, { nameEn: "Fish Feed" });
  ok(dupe.status === 409, "duplicate category refused");

  // ---- shops and products ----
  const st = await call("POST", "/api/admin/manage/stores", admin.token, { owner: seller.email, name: "Green Valley Agro", location: "Bogura" });
  ok(st.status === 201 && st.data.name === "Green Valley Agro", "admin opens a shop for the seller", st);
  const st2 = await call("POST", "/api/admin/manage/stores", admin.token, { owner: seller.email, name: "Second" });
  ok(st2.status === 409, "one shop per account");
  const badCat = await call("POST", "/api/admin/manage/products", admin.token, { storeId: st.data.id, name: "Tilapia feed", price: 900, quantity: 40, category: "nope" });
  ok(badCat.status === 400, "product with an unknown category refused");
  const p1 = await call("POST", "/api/admin/manage/products", admin.token, { storeId: st.data.id, name: "Tilapia feed 25kg", price: 900, quantity: 40, unit: "bag", category: "fish-feed", description: "Floating feed" });
  const p2 = await call("POST", "/api/admin/manage/products", admin.token, { storeId: st.data.id, name: "BRRI dhan seed", price: 150, quantity: 3, unit: "kg", category: "seeds" });
  ok(p1.status === 201 && p1.data.storeId === st.data.id && p1.data.ownerId === seller.id, "admin adds product into the seller's shop", p1);
  ok(p2.status === 201, "admin adds a second product", p2);
  const sellerView = await call("GET", "/api/seller/products", seller.token);
  ok(sellerView.status === 200 && JSON.stringify(sellerView.data).includes("Tilapia feed 25kg"), "seller sees the admin-added product in Seller Hub", sellerView.status);
  const market = await call("GET", "/api/catalog/listings", null);
  ok(JSON.stringify(market.data).includes("Tilapia feed 25kg"), "product is in the public marketplace");
  const search = await call("GET", "/api/admin/manage/products?q=tilapia", admin.token);
  ok(search.data.length === 1 && search.data[0].id === p1.data.id, "product search finds it by name");
  const byShop = await call("GET", `/api/admin/manage/products?q=green%20valley`, admin.token);
  ok(byShop.data.length === 2, "product search by shop name");
  const byCat = await call("GET", "/api/admin/manage/products?category=seeds", admin.token);
  ok(byCat.data.length === 1 && byCat.data[0].id === p2.data.id, "filter by category");
  const ed = await call("PUT", `/api/admin/manage/products/${p2.data.id}`, admin.token, { price: 160, hidden: true });
  ok(ed.status === 200 && ed.data.price === 160 && ed.data.hidden, "admin edits price and hides product", ed);
  const market2 = await call("GET", "/api/catalog/listings", null);
  ok(!JSON.stringify(market2.data).includes("BRRI dhan seed"), "hidden product leaves the public marketplace");
  const hiddenF = await call("GET", "/api/admin/manage/products?status=hidden", admin.token);
  ok(hiddenF.data.length === 1, "filter hidden products");

  // category delete must move products first
  const delBlocked = await call("DELETE", `/api/admin/manage/categories/${add.data.id}`, admin.token);
  ok(delBlocked.status === 409, "can't delete a category that still has products", delBlocked);
  const delMove = await call("DELETE", `/api/admin/manage/categories/${add.data.id}?reassign=feed`, admin.token);
  const moved = await call("GET", `/api/admin/manage/products/${p1.data.id}`, admin.token);
  ok(delMove.status === 200 && delMove.data.moved === 1 && moved.data.category === "feed", "delete with move puts products in the chosen category", delMove);

  // ---- orders ----
  const order = await call("POST", "/api/shop-orders", buyer.token, { id: `ord-${stamp}`, total: 1800, itemCount: 2, paymentMethod: "cod",
    items: [{ productId: p1.data.id, name: "Tilapia feed 25kg", price: 900, quantity: 2, seller: "Green Valley Agro" }], shippingAddress: { name: "Buyer", address: "Sherpur" } });
  ok(order.status === 201, "buyer places an order", order);
  const pd = await call("GET", `/api/admin/manage/products/${p1.data.id}`, admin.token);
  ok(pd.data.orderList?.length === 1 && pd.data.orderList[0].buyerId === buyer.id && pd.data.sold === 2, "product detail shows who ordered and how many", pd.data);
  const sd = await call("GET", `/api/admin/manage/stores/${st.data.id}`, admin.token);
  ok(sd.status === 200 && sd.data.products.length === 2 && sd.data.orders.length === 1 && sd.data.customers[0]?.id === buyer.id && sd.data.revenue === 1800, "shop detail: products, orders, customers, revenue", sd.data);
  const od = await call("GET", `/api/admin/manage/orders/ord-${stamp}`, admin.token);
  ok(od.status === 200 && od.data.products[p1.data.id]?.storeId === st.data.id && od.data.sellers[0]?.id === seller.id && od.data.buyerEmail === buyer.email, "order detail links product, shop, seller and buyer", od.data);
  const ost = await call("PUT", `/api/admin/manage/orders/ord-${stamp}`, admin.token, { status: "confirmed", note: "Called buyer" });
  const od2 = await call("GET", `/api/admin/manage/orders/ord-${stamp}`, admin.token);
  ok(ost.status === 200 && od2.data.status === "confirmed" && od2.data.history.length >= 1, "admin changes order status with history", ost);
  const odDeny = await call("GET", `/api/admin/manage/orders/ord-${stamp}`, buyer.token);
  ok(odDeny.status === 403, "buyer can't open the admin order view");
  const ov = await call("GET", "/api/admin/manage/shop/overview", admin.token);
  ok(ov.status === 200 && ov.data.stores === 1 && ov.data.products === 2 && ov.data.recentOrders.length === 1, "shop overview counts", ov.data);
  const sEd = await call("PUT", `/api/admin/manage/stores/${st.data.id}/details`, admin.token, { name: "Green Valley Agro Ltd", phone: "01700000000" });
  const pAfter = await call("GET", `/api/admin/manage/products/${p1.data.id}`, admin.token);
  ok(sEd.status === 200 && sEd.data.name === "Green Valley Agro Ltd" && pAfter.data.storeName === "Green Valley Agro Ltd", "admin edits shop details", sEd);
  const del = await call("DELETE", `/api/admin/manage/products/${p2.data.id}`, admin.token);
  const gone = await call("GET", `/api/admin/manage/products/${p2.data.id}`, admin.token);
  ok(del.status === 200 && gone.status === 404, "admin deletes a product");

  // ---- Help -> admin support chat ----
  const none = await call("GET", "/api/support/thread", buyer.token);
  ok(none.status === 200 && none.data.thread === null, "no conversation before writing");
  const empty = await call("POST", "/api/support/messages", buyer.token, { body: "  " });
  ok(empty.status === 400, "empty help message refused");
  const anon = await call("POST", "/api/support/messages", null, { body: "hi" });
  ok(anon.status === 401, "signed-out user can't write to support");
  const m1 = await call("POST", "/api/support/messages", buyer.token, { body: "My order hasn't arrived", clientId: "c1" });
  const m1b = await call("POST", "/api/support/messages", buyer.token, { body: "My order hasn't arrived", clientId: "c1" });
  ok(m1.status === 201 && m1b.data.message.id === m1.data.message.id, "help message sent (retry not duplicated)", m1);
  await call("POST", "/api/support/messages", other.token, { body: "How do I open a shop?" });
  const un = await call("GET", "/api/admin/manage/support/unread", admin.token);
  ok(un.data.threads === 2 && un.data.messages === 2, "admin unread count", un.data);
  const notes = await call("GET", "/api/me/notifications", admin.token);
  ok(JSON.stringify(notes.data || "").includes("Help request"), "admin gets a notification", notes.status);
  const list = await call("GET", "/api/admin/manage/support/threads", admin.token);
  ok(list.data.length === 2 && list.data.every((t) => t.adminUnread === 1), "admin inbox lists both conversations");
  const found = await call("GET", "/api/admin/manage/support/threads?q=arrived", admin.token);
  ok(found.data.length === 1 && found.data[0].userId === buyer.id, "inbox search by message text");
  const th = await call("GET", `/api/admin/manage/support/threads/${found.data[0].id}`, admin.token);
  ok(th.data.messages.length === 1 && th.data.thread.userEmail === buyer.email, "admin opens the conversation");
  const rep = await call("POST", `/api/admin/manage/support/threads/${found.data[0].id}/reply`, admin.token, { body: "It's on the way, arriving tomorrow" });
  ok(rep.status === 201, "admin replies", rep);
  const uu = await call("GET", "/api/support/unread", buyer.token);
  ok(uu.data.unread === 1, "buyer has one unread reply");
  const mine = await call("GET", "/api/support/thread", buyer.token);
  ok(mine.data.messages.length === 2 && mine.data.messages[1].fromAdmin && mine.data.messages[1].body.includes("arriving tomorrow"), "buyer sees the admin reply");
  ok((await call("GET", "/api/support/unread", buyer.token)).data.unread === 0, "reading clears the buyer's unread");
  const bnotes = await call("GET", "/api/me/notifications", buyer.token);
  ok(JSON.stringify(bnotes.data || "").includes("Farmers Support replied"), "buyer gets a reply notification");
  const otherSees = await call("GET", "/api/support/thread", other.token);
  ok(otherSees.data.messages.length === 1 && !JSON.stringify(otherSees.data).includes("arrived"), "another user only sees their own conversation");
  const peek = await call("GET", `/api/admin/manage/support/threads/${found.data[0].id}`, other.token);
  const replyAs = await call("POST", `/api/admin/manage/support/threads/${found.data[0].id}/reply`, other.token, { body: "fake" });
  ok(peek.status === 403 && replyAs.status === 403, "non-admin can't open or reply to someone's conversation");
  const close = await call("PUT", `/api/admin/manage/support/threads/${found.data[0].id}`, admin.token, { status: "closed" });
  const closedList = await call("GET", "/api/admin/manage/support/threads?status=closed", admin.token);
  ok(close.status === 200 && closedList.data.length === 1, "admin closes a conversation");
  await call("POST", "/api/support/messages", buyer.token, { body: "Thanks!" });
  const reopened = await call("GET", "/api/admin/manage/support/threads?status=open", admin.token);
  ok(reopened.data.some((t) => t.userId === buyer.id), "a new message reopens it");
} catch (e) {
  failed++;
  console.log("FAIL  crashed:", e?.message);
} finally {
  await stop();
  rmSync(dataDir, { recursive: true, force: true });
  console.log(`\n${passed} passed, ${failed} failed`);
  process.exit(failed ? 1 : 0);
}
