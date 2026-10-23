import type { Express, Request, Response } from "express";
import crypto from "crypto";
import { sql } from "drizzle-orm";
import { db } from "./db";
import { notify } from "./featureRoutes";
import { rows, J, iso, str, wrap, requireUser, requireAdmin, audit } from "./platformRoutes";
import { ensureModeration, OFFICIAL_ID, OFFICIAL_NAME } from "./moderationRoutes";

/**
 * Official accounts and their messages. Farmers Official is the default account; admins can create more
 * (Safety, Market news...), each a verified chat of its own in people's Chats. Only admins write; nobody
 * can reply into an official chat.
 *
 *  Users   GET  /api/official/accounts               official chats I have messages in: unread + last message
 *          GET  /api/official/messages?account=id    one account's messages to me (to everyone + to me); marks read
 *          GET  /api/official/summary                Farmers Official only (older apps)
 *  Admins  GET    /api/admin/manage/official-accounts         every account, with message counts
 *          POST   /api/admin/manage/official-accounts         {nameEn,nameBn,aboutEn,aboutBn,icon,color}
 *          PUT    /api/admin/manage/official-accounts/:id     same fields + active (the default stays on)
 *          DELETE /api/admin/manage/official-accounts/:id     removes it and its messages (not the default)
 *          GET    /api/admin/manage/official?account=         sent messages
 *          POST   /api/admin/manage/official                  {accountId, title?, body, target: "all"|user, notify?, link?}
 *          DELETE /api/admin/manage/official/:id
 */

export const OFFICIAL_ICONS = ["check-circle", "shield", "alert-triangle", "bell", "trending-up", "shopping-bag", "heart", "sun", "droplet", "info", "award", "truck"];
const HEX = /^#[0-9A-Fa-f]{6}$/;

const w = (fn: (req: Request, res: Response) => Promise<any>) =>
  wrap(async (req, res) => {
    await ensureModeration();
    return fn(req, res);
  });

/** "official" (what older notifications carry) is Farmers Official. */
const accountKey = (v: any) => {
  const s = String(v ?? "").trim();
  return !s || s === "official" ? OFFICIAL_ID : s.slice(0, 80);
};

const accountOut = (a: any) => ({
  id: a.id, nameEn: a.name_en, nameBn: a.name_bn || a.name_en, aboutEn: a.about_en || "", aboutBn: a.about_bn || a.about_en || "",
  icon: a.icon || "check-circle", color: a.color || "#2563EB", isDefault: !!a.is_default, active: a.active !== false, verified: true,
});
const messageOut = (m: any) => ({
  id: m.id, accountId: m.account_id || OFFICIAL_ID, title: m.title || "", body: m.body, link: J(m.link) || null, toAll: !m.target_user_id, createdAt: iso(m.created_at),
});
const forUser = (uid: string) => sql`(target_user_id IS NULL OR target_user_id = ${uid})`;

async function getAccount(id: string) {
  return rows(await db.execute(sql`SELECT * FROM official_accounts WHERE id = ${id} LIMIT 1`))[0] || null;
}

async function readAt(uid: string, accountId: string) {
  const r = rows(await db.execute(sql`SELECT read_at FROM official_account_reads WHERE user_id = ${uid} AND account_id = ${accountId} LIMIT 1`))[0];
  if (r) return r.read_at;
  if (accountId === OFFICIAL_ID) return rows(await db.execute(sql`SELECT read_at FROM official_reads WHERE user_id = ${uid} LIMIT 1`))[0]?.read_at || null;
  return null;
}

async function unreadFor(uid: string, accountId: string) {
  const ra = await readAt(uid, accountId);
  const r = rows(await db.execute(ra
    ? sql`SELECT count(*)::int AS n FROM official_messages WHERE account_id = ${accountId} AND ${forUser(uid)} AND created_at > ${iso(ra)}`
    : sql`SELECT count(*)::int AS n FROM official_messages WHERE account_id = ${accountId} AND ${forUser(uid)}`))[0];
  return Number(r?.n || 0);
}

/** Validates the account fields an admin sends. Returns [fields, error]. */
function parseAccount(b: any, partial: boolean): [any, string | null] {
  const f: any = {};
  if (!partial || b.nameEn !== undefined || b.nameBn !== undefined) {
    const nameEn = str(b.nameEn, 60), nameBn = str(b.nameBn, 60);
    if (!nameEn && !nameBn) return [null, "Give the account a name"];
    f.nameEn = nameEn || nameBn;
    f.nameBn = nameBn || nameEn;
  }
  if (!partial || b.aboutEn !== undefined) f.aboutEn = str(b.aboutEn, 200);
  if (!partial || b.aboutBn !== undefined) f.aboutBn = str(b.aboutBn, 200);
  if (!partial || b.icon !== undefined) f.icon = OFFICIAL_ICONS.includes(String(b.icon)) ? String(b.icon) : "check-circle";
  if (!partial || b.color !== undefined) f.color = HEX.test(String(b.color || "")) ? String(b.color) : "#2563EB";
  return [f, null];
}

async function nameTaken(f: any, exceptId: string | null) {
  if (!f.nameEn) return false;
  const r = rows(await db.execute(sql`SELECT id FROM official_accounts
    WHERE (lower(name_en) = lower(${f.nameEn}) OR lower(name_bn) = lower(${f.nameBn})) AND id <> ${exceptId || ""} LIMIT 1`))[0];
  return !!r;
}

export function registerOfficialRoutes(app: Express, A: string) {
  // ---------------- users ----------------
  app.get("/api/official/accounts", requireUser, w(async (req, res) => {
    const uid = (req as any).uid;
    const accounts = rows(await db.execute(sql`SELECT * FROM official_accounts WHERE active = true`));
    const out: any[] = [];
    for (const a of accounts) {
      const last = rows(await db.execute(sql`SELECT * FROM official_messages WHERE account_id = ${a.id} AND ${forUser(uid)} ORDER BY created_at DESC LIMIT 1`))[0];
      if (!last) continue;
      out.push({ ...accountOut(a), unread: await unreadFor(uid, a.id), last: messageOut(last) });
    }
    out.sort((x, y) => String(y.last.createdAt).localeCompare(String(x.last.createdAt)));
    res.json(out);
  }));

  app.get("/api/official/summary", requireUser, w(async (req, res) => {
    const uid = (req as any).uid;
    const last = rows(await db.execute(sql`SELECT * FROM official_messages WHERE account_id = ${OFFICIAL_ID} AND ${forUser(uid)} ORDER BY created_at DESC LIMIT 1`))[0];
    res.json({ id: OFFICIAL_ID, name: OFFICIAL_NAME, unread: await unreadFor(uid, OFFICIAL_ID), last: last ? messageOut(last) : null });
  }));

  app.get("/api/official/messages", requireUser, w(async (req, res) => {
    const uid = (req as any).uid;
    const a = await getAccount(accountKey(req.query.account));
    if (!a || a.active === false) return res.status(404).json({ error: "This official account isn't available" });
    const r = rows(await db.execute(sql`SELECT * FROM official_messages WHERE account_id = ${a.id} AND ${forUser(uid)} ORDER BY created_at DESC LIMIT 200`)).reverse();
    await db.execute(sql`INSERT INTO official_account_reads (user_id, account_id, read_at) VALUES (${uid}, ${a.id}, now())
      ON CONFLICT (user_id, account_id) DO UPDATE SET read_at = now()`);
    if (a.id === OFFICIAL_ID) {
      await db.execute(sql`INSERT INTO official_reads (user_id, read_at) VALUES (${uid}, now()) ON CONFLICT (user_id) DO UPDATE SET read_at = now()`);
    }
    res.json({ id: a.id, name: a.name_en, account: accountOut(a), messages: r.map(messageOut) });
  }));

  // ---------------- admins: accounts ----------------
  const OA = `${A}/official-accounts`;
  app.get(OA, requireAdmin, w(async (_req, res) => {
    const r = rows(await db.execute(sql`SELECT a.*, (SELECT count(*)::int FROM official_messages m WHERE m.account_id = a.id) AS messages
      FROM official_accounts a ORDER BY a.is_default DESC, a.created_at ASC`));
    res.json(r.map((a: any) => ({ ...accountOut(a), messages: Number(a.messages || 0), createdAt: iso(a.created_at) })));
  }));

  app.post(OA, requireAdmin, w(async (req, res) => {
    const [f, err] = parseAccount(req.body || {}, false);
    if (err) return res.status(400).json({ error: err });
    if (await nameTaken(f, null)) return res.status(409).json({ error: "An official account with this name already exists" });
    const n = Number(rows(await db.execute(sql`SELECT count(*)::int AS n FROM official_accounts`))[0]?.n || 0);
    if (n >= 20) return res.status(400).json({ error: "You can have up to 20 official accounts" });
    const id = `oa-${crypto.randomBytes(6).toString("hex")}`;
    await db.execute(sql`INSERT INTO official_accounts (id, name_en, name_bn, about_en, about_bn, icon, color, created_by)
      VALUES (${id}, ${f.nameEn}, ${f.nameBn}, ${f.aboutEn}, ${f.aboutBn}, ${f.icon}, ${f.color}, ${(req as any).uid})`);
    await audit(req, "OFFICIAL_ACCOUNT_CREATE", "official_account", id, { name: f.nameEn });
    res.status(201).json(accountOut(await getAccount(id)));
  }));

  app.put(`${OA}/:id`, requireAdmin, w(async (req, res) => {
    const a = await getAccount(String(req.params.id));
    if (!a) return res.status(404).json({ error: "Official account not found" });
    const b = req.body || {};
    const [f, err] = parseAccount(b, true);
    if (err) return res.status(400).json({ error: err });
    if (await nameTaken(f, a.id)) return res.status(409).json({ error: "An official account with this name already exists" });
    let active = a.active !== false;
    if (b.active !== undefined) {
      if (a.is_default && b.active === false) return res.status(400).json({ error: "Farmers Official can't be turned off" });
      active = !!b.active;
    }
    await db.execute(sql`UPDATE official_accounts SET
      name_en = ${f.nameEn ?? a.name_en}, name_bn = ${f.nameBn ?? a.name_bn}, about_en = ${f.aboutEn ?? a.about_en}, about_bn = ${f.aboutBn ?? a.about_bn},
      icon = ${f.icon ?? a.icon}, color = ${f.color ?? a.color}, active = ${active}, updated_at = now() WHERE id = ${a.id}`);
    await audit(req, "OFFICIAL_ACCOUNT_UPDATE", "official_account", a.id, { name: f.nameEn ?? a.name_en, active });
    res.json(accountOut(await getAccount(a.id)));
  }));

  app.delete(`${OA}/:id`, requireAdmin, w(async (req, res) => {
    const a = await getAccount(String(req.params.id));
    if (!a) return res.status(404).json({ error: "Official account not found" });
    if (a.is_default) return res.status(400).json({ error: "Farmers Official can't be deleted" });
    await db.execute(sql`DELETE FROM official_messages WHERE account_id = ${a.id}`);
    await db.execute(sql`DELETE FROM official_account_reads WHERE account_id = ${a.id}`);
    await db.execute(sql`DELETE FROM official_accounts WHERE id = ${a.id}`);
    await audit(req, "OFFICIAL_ACCOUNT_DELETE", "official_account", a.id, { name: a.name_en });
    res.json({ success: true });
  }));

  // ---------------- admins: messages ----------------
  app.get(`${A}/official`, requireAdmin, w(async (req, res) => {
    const acc = req.query.account ? accountKey(req.query.account) : null;
    const r = rows(await db.execute(sql`SELECT m.*, u.name AS target_name, u.username AS target_username, a.name AS admin_name,
        oa.name_en AS account_name, oa.color AS account_color
      FROM official_messages m LEFT JOIN users u ON u.id = m.target_user_id LEFT JOIN users a ON a.id = m.created_by
      LEFT JOIN official_accounts oa ON oa.id = m.account_id
      WHERE (${acc}::varchar IS NULL OR m.account_id = ${acc})
      ORDER BY m.created_at DESC LIMIT 200`));
    res.json(r.map((m: any) => ({
      ...messageOut(m), targetUserId: m.target_user_id || null, targetName: m.target_name || m.target_username || "", adminName: m.admin_name || "",
      accountName: m.account_name || OFFICIAL_NAME, accountColor: m.account_color || "#2563EB",
    })));
  }));

  app.post(`${A}/official`, requireAdmin, w(async (req, res) => {
    const b = req.body || {};
    const acct = await getAccount(accountKey(b.accountId));
    if (!acct) return res.status(404).json({ error: "Pick an official account to send from" });
    if (acct.active === false) return res.status(400).json({ error: "This official account is turned off. Turn it on first." });
    const body = str(b.body, 2000);
    if (!body) return res.status(400).json({ error: "Write the message first" });
    const title = str(b.title, 120);
    const to = str(b.target, 80) || "all";
    let targetId: string | null = null;
    if (to !== "all") {
      const u = rows(await db.execute(sql`SELECT id FROM users WHERE (id = ${to} OR lower(username) = lower(${to}) OR lower(coalesce(email,'')) = lower(${to})) AND deleted_at IS NULL LIMIT 1`))[0];
      if (!u) return res.status(404).json({ error: "No account found for that person" });
      targetId = u.id;
    }
    let link: any = null;
    if (b.link?.type && ["product", "category", "shop", "support"].includes(b.link.type)) link = { type: b.link.type, target: str(b.link.target, 200) };
    const id = `off-${Date.now()}-${crypto.randomBytes(4).toString("hex")}`;
    await db.execute(sql`INSERT INTO official_messages (id, account_id, target_user_id, title, body, link, created_by)
      VALUES (${id}, ${acct.id}, ${targetId}, ${title || null}, ${body}, ${link ? JSON.stringify(link) : null}::jsonb, ${(req as any).uid})`);
    // A bell notification (and a phone push where the person has the app installed with push on).
    const ids = targetId ? [targetId] : rows(await db.execute(sql`SELECT id FROM users WHERE NOT COALESCE(banned, false) AND deleted_at IS NULL`)).map((r: any) => r.id);
    let notified = 0;
    if (b.notify !== false) {
      for (const uid of ids) {
        await notify(uid, "official", title || acct.name_en, body.slice(0, 200), { screen: "OfficialChat", account: acct.id, accountName: acct.name_en });
        notified++;
      }
    }
    await audit(req, "OFFICIAL_MESSAGE", "official", id, { from: acct.name_en, to: targetId || "all", title, length: body.length });
    const m = rows(await db.execute(sql`SELECT * FROM official_messages WHERE id = ${id}`))[0];
    res.status(201).json({ message: messageOut(m), account: accountOut(acct), recipients: ids.length, notified });
  }));

  app.delete(`${A}/official/:id`, requireAdmin, w(async (req, res) => {
    const m = rows(await db.execute(sql`SELECT id FROM official_messages WHERE id = ${String(req.params.id)} LIMIT 1`))[0];
    if (!m) return res.status(404).json({ error: "Message not found" });
    await db.execute(sql`DELETE FROM official_messages WHERE id = ${m.id}`);
    await audit(req, "OFFICIAL_MESSAGE_DELETE", "official", m.id, "");
    res.json({ success: true });
  }));
}
