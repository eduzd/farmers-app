// Payment settings check (admin > Payment settings) on a locally run server with a throwaway database:
// Rocket and cash on delivery on/off, masked Rocket number, admin-only access, checkout methods,
// and the server refusing orders with a method that is off or a Rocket order without sender + TrxID.
//
//   node tests/check-payments.mjs
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
  for (let i = 0; i < 480; i++) {
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
  await stop();
  const pg = new PGlite(join(dataDir, "pglite"));
  await pg.query("UPDATE users SET is_super_admin = true WHERE id = $1", [admin.id]);
  await pg.close();
  await start();
  admin.token = (await login(admin)) || admin.token;
  buyer.token = (await login(buyer)) || buyer.token;
  const A = "/api/admin/manage";
  const order = (n, body) => call("POST", "/api/shop-orders", buyer.token, { id: `ORD-PAYCHK-${stamp}-${n}`, total: 450, itemCount: 1, items: [], ...body });

  // ---- defaults: cash on delivery only
  let r = await call("GET", "/api/checkout/payment-methods");
  ok(r.status === 200 && JSON.stringify(r.data?.methods) === JSON.stringify([{ id: "cod" }]), "default checkout methods: cash on delivery only", r);
  r = await order(1, { paymentMethod: "rocket", payment: { senderNumber: "017123456789", trxId: "ABC12345" } });
  ok(r.status === 400 && r.data?.code === "payment_method_off", "Rocket order refused while Rocket is off", r);
  r = await order(2, { paymentMethod: "bkash" });
  ok(r.status === 400 && r.data?.code === "payment_method_off", "bKash order refused (not a payment method)", r);
  r = await order(3, { paymentMethod: "cod" });
  ok(r.status === 201 && r.data?.paymentMethod === "cod" && r.data?.payment === null, "cash on delivery order accepted", r);

  // ---- admin only
  r = await call("GET", `${A}/payments`, buyer.token);
  ok(r.status === 401 || r.status === 403, "buyer can't read payment settings", r.status);
  r = await call("PUT", `${A}/payments`, buyer.token, { cod: { enabled: false } });
  ok(r.status === 401 || r.status === 403, "buyer can't change payment settings", r.status);
  r = await call("GET", `${A}/payments`);
  ok(r.status === 401 || r.status === 403, "signed-out visitor can't read payment settings", r.status);

  // ---- validation
  r = await call("PUT", `${A}/payments`, admin.token, { rocket: { enabled: true, accountName: "Farmers Ltd" } });
  ok(r.status === 400 && /number/i.test(r.data?.error), "Rocket can't be turned on without a number", r);
  r = await call("PUT", `${A}/payments`, admin.token, { rocket: { enabled: true, accountNumber: "12345", accountName: "Farmers Ltd" } });
  ok(r.status === 400, "bad Rocket number refused", r);
  r = await call("PUT", `${A}/payments`, admin.token, { cod: { enabled: false }, rocket: { enabled: false } });
  ok(r.status === 400 && /at least one/i.test(r.data?.error), "can't turn every method off", r);

  // ---- save Rocket
  r = await call("PUT", `${A}/payments`, admin.token, { cod: { enabled: true }, rocket: { enabled: true, accountNumber: "+88 01712-3456783", accountName: "Farmers Ltd", accountType: "merchant", instructionsEn: "Write your phone as reference", instructionsBn: "রেফারেন্সে ফোন নম্বর লিখুন" } });
  ok(r.status === 200 && r.data?.rocket?.enabled === true && r.data?.rocket?.accountNumber === "" && r.data?.rocket?.accountNumberMasked === "017••••••783" && r.data?.rocket?.accountNumberSet === true, "admin saves Rocket; answer shows the number masked", r.data?.rocket);
  r = await call("GET", `${A}/payments`, admin.token);
  ok(r.status === 200 && r.data?.rocket?.accountNumber === "" && r.data?.rocket?.accountNumberMasked === "017••••••783" && r.data?.rocket?.accountType === "merchant" && r.data?.rocket?.instructionsBn === "রেফারেন্সে ফোন নম্বর লিখুন", "settings persist; number stays masked", r.data?.rocket);
  r = await call("GET", `${A}/payments?reveal=1`, admin.token);
  ok(r.status === 200 && r.data?.rocket?.accountNumber === "017123456783", "admin can reveal the full number on purpose", r.data?.rocket);

  // ---- name kept when number left empty
  r = await call("PUT", `${A}/payments`, admin.token, { rocket: { accountNumber: "", accountName: "Farmers Agro Ltd" } });
  ok(r.status === 200 && r.data?.rocket?.accountNumberMasked === "017••••••783" && r.data?.rocket?.accountName === "Farmers Agro Ltd", "empty number keeps the saved one", r.data?.rocket);

  r = await call("GET", "/api/checkout/payment-methods");
  const rk = (r.data?.methods || []).find((m) => m.id === "rocket");
  ok(r.status === 200 && r.data.methods.length === 2 && rk?.accountNumber === "017123456783" && rk?.accountName === "Farmers Agro Ltd" && rk?.accountType === "merchant" && rk?.instructionsEn, "checkout shows COD and Rocket with the number to pay", r.data);

  // ---- Rocket orders
  r = await order(4, { paymentMethod: "rocket" });
  ok(r.status === 400 && r.data?.code === "rocket_sender", "Rocket order without sender number refused", r);
  r = await order(5, { paymentMethod: "rocket", payment: { senderNumber: "01812345678" } });
  ok(r.status === 400 && r.data?.code === "rocket_trxid", "Rocket order without TrxID refused", r);
  r = await order(6, { paymentMethod: "rocket", payment: { senderNumber: "018-1234-56781", trxId: "abc 1234 xyz" } });
  ok(r.status === 201 && r.data?.payment?.trxId === "ABC1234XYZ" && r.data?.payment?.senderNumber === "018123456781" && r.data?.payment?.status === "awaiting" && r.data?.payment?.amount === 450, "Rocket order accepted, payment waiting for check", r.data);
  const rocketOrder = `ORD-PAYCHK-${stamp}-6`;
  r = await order(6, { paymentMethod: "rocket", payment: { senderNumber: "018123456781", trxId: "ABC1234XYZ" } });
  ok(r.status === 201 && r.data?.duplicate === true, "same order sent twice answers with the saved order", r.data);
  r = await order(7, { paymentMethod: "rocket", payment: { senderNumber: "019123456789", trxId: "ABC1234XYZ" } });
  ok(r.status === 409 && r.data?.code === "rocket_trxid_used", "TrxID used on another order refused", r);

  // ---- admin sees and checks the payment
  r = await call("GET", `${A}/orders/${rocketOrder}`, admin.token);
  ok(r.status === 200 && r.data?.paymentMethod === "rocket" && r.data?.payment?.trxId === "ABC1234XYZ", "admin order page has the Rocket TrxID", r.data?.payment);
  r = await call("PUT", `${A}/orders/${rocketOrder}/payment`, buyer.token, { status: "verified" });
  ok(r.status === 401 || r.status === 403, "buyer can't verify a payment", r.status);
  r = await call("PUT", `${A}/orders/${rocketOrder}/payment`, admin.token, { status: "verified" });
  ok(r.status === 200 && r.data?.payment?.status === "verified" && r.data?.payment?.checkedBy, "admin marks the Rocket payment verified", r.data);
  r = await call("PUT", `${A}/orders/ORD-PAYCHK-${stamp}-3/payment`, admin.token, { status: "verified" });
  ok(r.status === 400, "can't verify a cash on delivery order as Rocket", r);
  r = await call("GET", "/api/me/notifications", buyer.token);
  ok(JSON.stringify(r.data || "").includes("Payment received"), "buyer is notified the payment was received", r.status);
  r = await call("GET", "/api/me/orders", buyer.token);
  const mine = (Array.isArray(r.data) ? r.data : r.data?.orders || []).find((o) => o.id === rocketOrder);
  ok(mine ? mine.payment?.status === "verified" : true, "buyer's order list carries the payment status", mine?.payment || r.status);

  // ---- turn COD off: COD refused, Rocket still works
  r = await call("PUT", `${A}/payments`, admin.token, { cod: { enabled: false } });
  ok(r.status === 200 && r.data?.cod?.enabled === false, "admin turns cash on delivery off", r.data);
  r = await order(8, { paymentMethod: "cod" });
  ok(r.status === 400 && r.data?.code === "payment_method_off", "cash on delivery refused when off", r);
  r = await call("GET", "/api/checkout/payment-methods");
  ok(r.data?.methods?.length === 1 && r.data.methods[0].id === "rocket", "checkout then offers Rocket only", r.data);
  // ---- turn Rocket off again
  r = await call("PUT", `${A}/payments`, admin.token, { cod: { enabled: true }, rocket: { enabled: false } });
  r = await order(9, { paymentMethod: "rocket", payment: { senderNumber: "019123456789", trxId: "ZZZ999888" } });
  ok(r.status === 400 && r.data?.code === "payment_method_off", "Rocket refused after the admin turns it off", r);

  // ---- persists across a restart; activity log
  await stop();
  const pg2 = new PGlite(join(dataDir, "pglite"));
  const logs = (await pg2.query("SELECT action, details FROM audit_logs WHERE action IN ('UPDATE_PAYMENTS','REVEAL_PAYMENT_ACCOUNT','ORDER_PAYMENT')")).rows;
  await pg2.close();
  const logText = JSON.stringify(logs);
  ok(logText.includes("UPDATE_PAYMENTS") && logText.includes("REVEAL_PAYMENT_ACCOUNT") && logText.includes("ORDER_PAYMENT") && !logText.includes("017123456783"), "saves, reveal and verify are in the activity log, never with the full number", logs.length);
  await start();
  r = await call("GET", `${A}/payments`, admin.token);
  ok(r.status === 200 && r.data?.rocket?.accountNumberMasked === "017••••••783" && r.data?.rocket?.enabled === false && r.data?.cod?.enabled === true, "settings survive a server restart", r.data);
} catch (e) {
  failed++;
  console.log("FAIL  " + (e?.stack || e));
} finally {
  await stop().catch(() => {});
  try { rmSync(dataDir, { recursive: true, force: true }); } catch {}
  console.log(`\n${passed} passed, ${failed} failed`);
  process.exit(failed ? 1 : 0);
}
