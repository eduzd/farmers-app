import type { Express, Request, Response } from "express";
import { sql } from "drizzle-orm";
import { db } from "./db";
import { requireAdmin, audit } from "./platformRoutes";
import { ensureCheckout } from "./checkoutRoutes";
import { notify } from "./featureRoutes";

/**
 * Payment settings for every purchase (admin: More > Payment settings).
 *
 * Methods: Cash on Delivery and Rocket (Dutch-Bangla Bank mobile banking). Rocket is a MANUAL
 * payment: the buyer sends the order total to the admin's Rocket account and types the Transaction ID
 * (TrxID) at checkout; an admin checks it in Rocket and marks the payment Verified or Rejected.
 * Nothing here talks to Rocket or moves money; there is no Rocket merchant API connected.
 *
 *  Public   GET  /api/checkout/payment-methods          -> methods the admin has turned on (with the Rocket
 *                                                          number buyers must send money to)
 *  Admin    GET  /api/admin/manage/payments             -> settings, Rocket number masked (?reveal=1 shows it, logged)
 *           PUT  /api/admin/manage/payments             -> save (empty Rocket number = keep the saved one)
 *           PUT  /api/admin/manage/orders/:id/payment   -> {status: verified | rejected | awaiting}
 *  POST /api/shop-orders calls checkPayment() and refuses methods that are off or Rocket orders without
 *  a valid sender number + TrxID, or with a TrxID already used on another order.
 */

const rows = (r: any): any[] => (Array.isArray(r) ? r : r?.rows || []);
const J = (v: any) => (typeof v === "string" ? (() => { try { return JSON.parse(v); } catch { return null; } })() : v);

export const ROCKET_ACCOUNT_TYPES = ["personal", "merchant", "agent"] as const;
type RocketType = (typeof ROCKET_ACCOUNT_TYPES)[number];

export type PaymentConfig = {
  cod: { enabled: boolean };
  rocket: {
    enabled: boolean;
    accountNumber: string;
    accountName: string;
    accountType: RocketType;
    instructionsEn: string;
    instructionsBn: string;
  };
  updatedAt?: string | null;
  updatedBy?: string | null;
};

export const DEFAULT_PAYMENTS: PaymentConfig = {
  cod: { enabled: true },
  rocket: { enabled: false, accountNumber: "", accountName: "", accountType: "personal", instructionsEn: "", instructionsBn: "" },
  updatedAt: null,
  updatedBy: null,
};

/** Rocket account: 11-digit mobile number plus Rocket's check digit (12 digits); 11 digits also accepted. */
export function normalizeRocket(v: any): string | null {
  const d = String(v ?? "").replace(/[\s\-()]/g, "");
  const m = d.match(/^(?:\+?88)?(01[3-9]\d{8}\d?)$/);
  return m ? m[1] : null;
}

/** Rocket TrxIDs are short codes from the confirmation SMS; accept 6-20 letters/digits. */
export function normalizeTrxId(v: any): string | null {
  const t = String(v ?? "").replace(/[\s\-]/g, "").toUpperCase();
  return /^[A-Z0-9]{6,20}$/.test(t) ? t : null;
}

export function maskNumber(n: string): string {
  if (!n) return "";
  if (n.length <= 6) return "•".repeat(n.length);
  return `${n.slice(0, 3)}${"•".repeat(n.length - 6)}${n.slice(-3)}`;
}

let ready: Promise<void> | null = null;
export function ensurePayments() {
  if (!ready) {
    ready = (async () => {
      await ensureCheckout();
      await db.execute(sql`CREATE TABLE IF NOT EXISTS app_settings (key varchar PRIMARY KEY, value text)`);
      await db.execute(sql`ALTER TABLE shop_orders ADD COLUMN IF NOT EXISTS payment jsonb`);
    })().catch((e) => {
      ready = null;
      throw e;
    });
  }
  return ready;
}

export async function paymentConfig(): Promise<PaymentConfig> {
  await ensurePayments();
  try {
    const r = rows(await db.execute(sql`SELECT value FROM app_settings WHERE key = 'payment_config' LIMIT 1`));
    const v = J(r[0]?.value);
    if (v && typeof v === "object") {
      return {
        cod: { ...DEFAULT_PAYMENTS.cod, ...(v.cod || {}) },
        rocket: { ...DEFAULT_PAYMENTS.rocket, ...(v.rocket || {}) },
        updatedAt: v.updatedAt || null,
        updatedBy: v.updatedBy || null,
      };
    }
  } catch {}
  return JSON.parse(JSON.stringify(DEFAULT_PAYMENTS));
}

/** Validates an admin save. An empty/missing Rocket number keeps the saved one. */
export function cleanPaymentConfig(b: any, saved: PaymentConfig): PaymentConfig | { error: string } {
  const s = (v: any, n: number) => String(v ?? "").trim().slice(0, n);
  const rb = b?.rocket || {};
  let accountNumber = saved.rocket.accountNumber;
  if (rb.accountNumber !== undefined && String(rb.accountNumber).trim() !== "") {
    const n = normalizeRocket(rb.accountNumber);
    if (!n) return { error: "Rocket number must be 11 or 12 digits and start with 01, like 017XXXXXXXXX" };
    accountNumber = n;
  }
  if (rb.clearAccountNumber === true) accountNumber = "";
  const accountType: RocketType = ROCKET_ACCOUNT_TYPES.includes(rb.accountType) ? rb.accountType : saved.rocket.accountType;
  const rocket = {
    enabled: rb.enabled === undefined ? saved.rocket.enabled : rb.enabled === true,
    accountNumber,
    accountName: rb.accountName === undefined ? saved.rocket.accountName : s(rb.accountName, 80),
    accountType,
    instructionsEn: rb.instructionsEn === undefined ? saved.rocket.instructionsEn : s(rb.instructionsEn, 500),
    instructionsBn: rb.instructionsBn === undefined ? saved.rocket.instructionsBn : s(rb.instructionsBn, 500),
  };
  const cod = { enabled: b?.cod?.enabled === undefined ? saved.cod.enabled : b.cod.enabled === true };
  if (rocket.enabled && !rocket.accountNumber) return { error: "Add the Rocket account number before turning Rocket on" };
  if (rocket.enabled && !rocket.accountName) return { error: "Add the Rocket account name before turning Rocket on" };
  if (!rocket.enabled && !cod.enabled) return { error: "Keep at least one payment method on, or buyers can't place orders" };
  return { cod, rocket };
}

/** What buyers see at checkout: only the methods that are on. */
export function publicMethods(c: PaymentConfig) {
  const methods: any[] = [];
  if (c.cod.enabled) methods.push({ id: "cod" });
  if (c.rocket.enabled && c.rocket.accountNumber)
    methods.push({
      id: "rocket",
      accountNumber: c.rocket.accountNumber,
      accountName: c.rocket.accountName,
      accountType: c.rocket.accountType,
      instructionsEn: c.rocket.instructionsEn,
      instructionsBn: c.rocket.instructionsBn,
    });
  return methods;
}

const adminView = (c: PaymentConfig, reveal = false) => ({
  ...c,
  rocket: {
    ...c.rocket,
    accountNumber: reveal ? c.rocket.accountNumber : "",
    accountNumberMasked: maskNumber(c.rocket.accountNumber),
    accountNumberSet: !!c.rocket.accountNumber,
  },
});

export type PaymentCheck =
  | { ok: true; method: string; payment: any | null }
  | { ok: false; status: number; error: string; code: string };

/** Server rule for every order: the method must be on; Rocket needs sender number + unused TrxID. */
export async function checkPayment(methodIn: any, p: any, total: number): Promise<PaymentCheck> {
  const c = await paymentConfig();
  const method = String(methodIn || "cod").trim().toLowerCase();
  const on = publicMethods(c).map((m) => m.id);
  if (!on.includes(method)) {
    return { ok: false, status: 400, code: "payment_method_off", error: on.length ? "This payment method is turned off. Please choose another one." : "Payments are paused right now. Please try again later." };
  }
  if (method !== "rocket") return { ok: true, method, payment: null };
  const senderNumber = normalizeRocket(p?.senderNumber);
  if (!senderNumber) return { ok: false, status: 400, code: "rocket_sender", error: "Enter the Rocket number you sent the money from" };
  const trxId = normalizeTrxId(p?.trxId);
  if (!trxId) return { ok: false, status: 400, code: "rocket_trxid", error: "Enter the Transaction ID (TrxID) from Rocket's message" };
  const used = rows(await db.execute(sql`SELECT id FROM shop_orders WHERE payment->>'trxId' = ${trxId} LIMIT 1`));
  if (used[0]) return { ok: false, status: 409, code: "rocket_trxid_used", error: "This Transaction ID was already used for another order" };
  return {
    ok: true,
    method,
    payment: {
      method: "rocket",
      senderNumber,
      trxId,
      amount: total,
      paidTo: maskNumber(c.rocket.accountNumber),
      status: "awaiting",
      submittedAt: new Date().toISOString(),
    },
  };
}

export function registerPaymentRoutes(app: Express) {
  const wrap = (fn: (req: Request, res: Response) => Promise<any>) => async (req: Request, res: Response) => {
    try {
      await ensurePayments();
      await fn(req, res);
    } catch (e: any) {
      console.error("[payments]", e?.message);
      res.status(500).json({ error: "Something went wrong" });
    }
  };
  const A = "/api/admin/manage";

  app.get("/api/checkout/payment-methods", wrap(async (_req, res) => {
    res.json({ methods: publicMethods(await paymentConfig()) });
  }));

  app.get(`${A}/payments`, requireAdmin, wrap(async (req, res) => {
    const reveal = String(req.query.reveal || "") === "1";
    const c = await paymentConfig();
    if (reveal) await audit(req, "REVEAL_PAYMENT_ACCOUNT", "settings", "payment_config", { rocket: maskNumber(c.rocket.accountNumber) });
    res.json(adminView(c, reveal));
  }));

  app.put(`${A}/payments`, requireAdmin, wrap(async (req, res) => {
    const saved = await paymentConfig();
    const c = cleanPaymentConfig(req.body, saved);
    if ("error" in c) return res.status(400).json(c);
    const admin = (req as any).admin;
    const out: PaymentConfig = { ...c, updatedAt: new Date().toISOString(), updatedBy: admin?.email || admin?.id || null };
    await db.execute(sql`INSERT INTO app_settings (key, value) VALUES ('payment_config', ${JSON.stringify(out)})
      ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value`);
    await audit(req, "UPDATE_PAYMENTS", "settings", "payment_config", {
      cod: out.cod.enabled, rocket: out.rocket.enabled, rocketNumber: maskNumber(out.rocket.accountNumber), rocketName: out.rocket.accountName, rocketType: out.rocket.accountType,
    });
    res.json(adminView(out));
  }));

  app.put(`${A}/orders/:id/payment`, requireAdmin, wrap(async (req, res) => {
    const status = String(req.body?.status || "");
    if (!["verified", "rejected", "awaiting"].includes(status)) return res.status(400).json({ error: "Unknown payment status" });
    const o = rows(await db.execute(sql`SELECT id, user_id, payment FROM shop_orders WHERE id = ${req.params.id} LIMIT 1`))[0];
    if (!o) return res.status(404).json({ error: "Order not found" });
    const p = J(o.payment);
    if (!p || p.method !== "rocket") return res.status(400).json({ error: "This order wasn't paid with Rocket" });
    const admin = (req as any).admin;
    const next = { ...p, status, checkedAt: new Date().toISOString(), checkedBy: admin?.email || admin?.id || null, note: String(req.body?.note ?? "").trim().slice(0, 300) };
    await db.execute(sql`UPDATE shop_orders SET payment = ${JSON.stringify(next)}::jsonb WHERE id = ${o.id}`);
    await audit(req, "ORDER_PAYMENT", "order", o.id, { status, trxId: p.trxId });
    if (o.user_id && status !== "awaiting") {
      const t = status === "verified" ? "Payment received" : "Payment not found";
      const body = status === "verified"
        ? `We received your Rocket payment for order ${o.id} (TrxID ${p.trxId}).`
        : `We couldn't find your Rocket payment for order ${o.id} (TrxID ${p.trxId}). Please check the TrxID or message Support.`;
      await notify(o.user_id, "order", t, body, { orderId: o.id, role: "buyer", payment: status }).catch(() => {});
    }
    res.json({ success: true, payment: next });
  }));
}
