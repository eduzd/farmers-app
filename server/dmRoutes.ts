import type { Express, Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import crypto from "crypto";
import { sql } from "drizzle-orm";
import { db, dbReady } from "./db";
import { config } from "./config";
import { notify, publicUser } from "./featureRoutes";

/**
 * Person-to-person direct messages.
 *  GET  /api/dm/threads                    my conversations (other user, last message, unread)
 *  GET  /api/dm/unread                     { total } unread messages across all conversations
 *  GET  /api/dm/:otherId/messages          messages between me and that person (?since=ISO, inclusive)
 *                                          header X-Seen-Until: newest of MY messages they have read
 *  POST /api/dm/:otherId/messages          send { content, clientId? }   (clientId makes retries safe)
 *  POST /api/dm/:otherId/voice             send a voice message { audio: base64, mime, durationMs, clientId? }
 *  GET  /api/dm/media/:mediaId             the audio file (only the sender and the recipient)
 *  GET  /api/dm/:otherId/contact           { userId, name, phone } for the Call button
 *
 * :otherId may be a user id, "user_<id>", "store_<id>", a store id, a company id or a
 * catalog product id; stores, companies and products resolve to the person who owns them.
 * Messages are stored in the database (table created on start) and pushed live
 * over the /ws/chat socket when the other person is connected; the app also polls,
 * so delivery works through proxies/tunnels without sockets.
 */

type Pusher = (userId: string, message: any) => boolean;

function auth(req: Request, res: Response, next: NextFunction) {
  const h = req.headers.authorization;
  if (!h || !h.startsWith("Bearer ")) return res.status(401).json({ error: "Please log in to send messages" });
  try {
    const decoded = jwt.verify(h.slice(7), config.jwtSecret) as any;
    (req as any).dmUserId = decoded.userId;
    next();
  } catch {
    return res.status(401).json({ error: "Session expired, please log in again" });
  }
}

let tableReady: Promise<void> | null = null;
function ensureTable() {
  if (!tableReady) {
    tableReady = (async () => {
      await dbReady;
      await db.execute(sql`CREATE TABLE IF NOT EXISTS direct_messages (
        id varchar PRIMARY KEY,
        sender_id varchar NOT NULL,
        recipient_id varchar NOT NULL,
        content text NOT NULL,
        read_at timestamp,
        created_at timestamp NOT NULL DEFAULT now()
      )`);
      await db.execute(sql`CREATE INDEX IF NOT EXISTS direct_messages_pair_idx ON direct_messages (sender_id, recipient_id, created_at)`);
      await db.execute(sql`ALTER TABLE direct_messages ADD COLUMN IF NOT EXISTS kind varchar NOT NULL DEFAULT 'text'`);
      await db.execute(sql`ALTER TABLE direct_messages ADD COLUMN IF NOT EXISTS media_id varchar`);
      await db.execute(sql`ALTER TABLE direct_messages ADD COLUMN IF NOT EXISTS duration_ms integer`);
      await db.execute(sql`CREATE TABLE IF NOT EXISTS dm_media (
        id varchar PRIMARY KEY,
        sender_id varchar NOT NULL,
        recipient_id varchar NOT NULL,
        mime varchar NOT NULL,
        size integer NOT NULL,
        data bytea NOT NULL,
        created_at timestamp NOT NULL DEFAULT now()
      )`);
    })().catch((e) => {
      tableReady = null;
      throw e;
    });
  }
  return tableReady;
}

const rows = (r: any): any[] => (Array.isArray(r) ? r : r?.rows || []);
// timestamps are stored as UTC without a zone; always hand out ISO with "Z"
const iso = (v: any) => {
  if (!v) return null;
  if (v instanceof Date) return v.toISOString();
  const s = String(v);
  return new Date(/[zZ]|[+-]\d\d:?\d\d$/.test(s) ? s : s.replace(" ", "T") + "Z").toISOString();
};

function initials(name?: string | null) {
  return (name || "?")
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .substring(0, 2);
}

const MAX_VOICE_BYTES = 3 * 1024 * 1024; // ~3 MB, about 6 minutes at 64 kbps (the app stops at 2)
const MAX_VOICE_MS = 3 * 60 * 1000;
const VOICE_MIME = new Set(["audio/mp4", "audio/m4a", "audio/x-m4a", "audio/aac", "audio/webm", "audio/ogg", "audio/mpeg", "audio/3gpp", "audio/wav", "audio/x-wav"]);
const VOICE_LABEL = "\u{1F3A4} Voice message";

async function first(q: any): Promise<any | null> {
  try {
    return rows(await db.execute(q))[0] ?? null;
  } catch {
    return null; // table may not exist on this database yet
  }
}

/**
 * Turn whatever id the app navigated with into the account id of a real person.
 * Store, company and product ids resolve to their owner. Returns null for sample
 * people (no account) so the app can say so instead of failing silently.
 */
export async function resolvePerson(raw: string): Promise<string | null> {
  let id = String(raw || "").trim().slice(0, 120);
  if (!id) return null;
  const direct = await first(sql`SELECT id FROM users WHERE id = ${id} LIMIT 1`);
  if (direct) return direct.id;
  for (const p of ["user_", "store_", "seller_", "company_"]) if (id.startsWith(p)) id = id.slice(p.length);
  const u = await first(sql`SELECT id FROM users WHERE id = ${id} LIMIT 1`);
  if (u) return u.id;
  const st = await first(sql`SELECT owner_id FROM stores WHERE id = ${id} OR slug = ${id} LIMIT 1`);
  if (st?.owner_id) return st.owner_id;
  const co = await first(sql`SELECT owner_id FROM companies WHERE id = ${id} LIMIT 1`);
  if (co?.owner_id) return co.owner_id;
  const item = await first(sql`SELECT owner_id FROM catalog_items WHERE id = ${id} LIMIT 1`);
  if (item?.owner_id) return item.owner_id;
  return null;
}

function msgOut(m: any, me: string) {
  return {
    id: m.id,
    senderId: m.sender_id,
    recipientId: m.recipient_id,
    content: m.content,
    kind: m.kind || "text",
    mediaId: m.media_id || null,
    durationMs: m.duration_ms == null ? null : Number(m.duration_ms),
    createdAt: iso(m.created_at),
    readAt: iso(m.read_at),
    isMe: m.sender_id === me,
  };
}

const CLIENT_ID = /^[A-Za-z0-9_-]{8,64}$/;

/** A message id for this send; a retry with the same clientId gets the same id. */
async function messageId(clientId: unknown, me: string): Promise<{ id: string; existing: any | null }> {
  if (typeof clientId === "string" && CLIENT_ID.test(clientId)) {
    const id = `dm-${clientId}`;
    const ex = await first(sql`SELECT * FROM direct_messages WHERE id = ${id} LIMIT 1`);
    if (!ex) return { id, existing: null };
    if (ex.sender_id === me) return { id, existing: ex };
  }
  return { id: `dm-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`, existing: null };
}

function fmtDuration(ms: number) {
  const s = Math.max(0, Math.round(ms / 1000));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}

export function registerDmRoutes(app: Express, push: Pusher) {
  ensureTable().catch((e) => console.error("[dm] table setup failed:", e?.message || e));

  /** Checks shared by both send routes. Returns the resolved recipient or sends the error. */
  async function recipientFor(req: Request, res: Response): Promise<string | null> {
    const me = (req as any).dmUserId as string;
    const other = await resolvePerson(req.params.otherId);
    if (!other) {
      res.status(404).json({ error: "This person doesn't have an account yet, so they can't get messages.", code: "NO_ACCOUNT" });
      return null;
    }
    if (other === me) {
      res.status(400).json({ error: "You can't message yourself", code: "SELF" });
      return null;
    }
    const u = await first(sql`SELECT banned FROM users WHERE id = ${other} LIMIT 1`);
    if (u?.banned) {
      res.status(403).json({ error: "This account has been suspended.", code: "SUSPENDED" });
      return null;
    }
    return other;
  }

  function deliver(me: string, other: string, row: any, preview: string) {
    const msg = msgOut(row, me);
    push(other, { type: "dm", data: { ...msg, isMe: false } });
    push(me, { type: "dm", data: msg }); // my other phones / tabs
    publicUser(me).then((u) =>
      notify(other, "message", `Message from ${u?.name || "someone"}`, preview.slice(0, 140), { userId: me, userName: u?.name || "Farmer" })
    );
    return msg;
  }

  /**
   * PUT /api/me/profile { name?, phone? }: the app's profile screen saved these on the
   * phone only, so nobody could ever call a farmer. Phone accepts any reasonable number
   * (digits, spaces, +, -); an empty string removes it.
   */
  app.put("/api/me/profile", auth, async (req, res) => {
    try {
      const me = (req as any).dmUserId as string;
      const b = req.body || {};
      const u = await first(sql`SELECT id, name, phone FROM users WHERE id = ${me} LIMIT 1`);
      if (!u) return res.status(404).json({ error: "Account not found" });
      let phone: string | null = u.phone ?? null;
      if (b.phone !== undefined) {
        const p = String(b.phone ?? "").trim();
        if (!p) phone = null;
        else {
          const digits = p.replace(/[^\d]/g, "");
          if (!/^\+?[\d\s()-]{6,24}$/.test(p) || digits.length < 6 || digits.length > 15) {
            return res.status(400).json({ error: "That phone number doesn't look right" });
          }
          phone = p;
        }
      }
      let name: string | null = u.name ?? null;
      if (b.name !== undefined) {
        const n = String(b.name ?? "").trim().slice(0, 120);
        if (n) name = n;
      }
      await db.execute(sql`UPDATE users SET name = ${name}, phone = ${phone} WHERE id = ${me}`);
      res.json({ success: true, name, phone });
    } catch (e: any) {
      console.error("[dm] profile error:", e?.message || e);
      res.status(500).json({ error: "Couldn't save your profile" });
    }
  });

  app.get("/api/dm/threads", auth, async (req, res) => {
    try {
      await ensureTable();
      const me = (req as any).dmUserId as string;
      const r = rows(
        await db.execute(sql`
          WITH mine AS (
            SELECT *, CASE WHEN sender_id = ${me} THEN recipient_id ELSE sender_id END AS other_id
            FROM direct_messages WHERE sender_id = ${me} OR recipient_id = ${me}
          ), last AS (
            SELECT DISTINCT ON (other_id) other_id, content, kind, created_at, sender_id
            FROM mine ORDER BY other_id, created_at DESC, id DESC
          )
          SELECT last.other_id, last.content, last.kind, last.created_at, last.sender_id,
                 u.name, u.avatar,
                 (SELECT count(*) FROM direct_messages d WHERE d.sender_id = last.other_id AND d.recipient_id = ${me} AND d.read_at IS NULL)::int AS unread
          FROM last LEFT JOIN users u ON u.id = last.other_id
          ORDER BY last.created_at DESC`)
      );
      res.json(
        r.map((t: any) => ({
          userId: t.other_id,
          name: t.name || "Farmer",
          initials: initials(t.name),
          avatar: t.avatar || null,
          lastMessage: t.kind === "voice" ? VOICE_LABEL : t.content,
          lastKind: t.kind || "text",
          lastMessageAt: iso(t.created_at),
          lastFromMe: t.sender_id === me,
          unread: Number(t.unread) || 0,
        }))
      );
    } catch (e: any) {
      console.error("[dm] threads error:", e?.message || e);
      res.status(500).json({ error: "Couldn't load conversations" });
    }
  });

  app.get("/api/dm/unread", auth, async (req, res) => {
    try {
      await ensureTable();
      const me = (req as any).dmUserId as string;
      const r = await first(sql`SELECT count(*)::int AS n FROM direct_messages WHERE recipient_id = ${me} AND read_at IS NULL`);
      res.json({ total: Number(r?.n) || 0 });
    } catch {
      res.status(500).json({ error: "Couldn't count messages" });
    }
  });

  app.get("/api/dm/media/:mediaId", auth, async (req, res) => {
    try {
      await ensureTable();
      const me = (req as any).dmUserId as string;
      const m = await first(sql`SELECT sender_id, recipient_id, mime, encode(data, 'base64') AS b64 FROM dm_media WHERE id = ${req.params.mediaId} LIMIT 1`);
      // Same answer for "missing" and "not yours", so ids can't be probed.
      if (!m || (m.sender_id !== me && m.recipient_id !== me)) return res.status(404).json({ error: "Voice message not found" });
      const buf = Buffer.from(String(m.b64).replace(/\s+/g, ""), "base64");
      res.setHeader("Content-Type", m.mime);
      res.setHeader("Content-Length", String(buf.length));
      res.setHeader("Cache-Control", "private, max-age=86400");
      res.end(buf);
    } catch (e: any) {
      console.error("[dm] media error:", e?.message || e);
      res.status(500).json({ error: "Couldn't load the voice message" });
    }
  });

  app.get("/api/dm/:otherId/contact", auth, async (req, res) => {
    try {
      await ensureTable();
      const me = (req as any).dmUserId as string;
      const other = await resolvePerson(req.params.otherId);
      if (!other) return res.status(404).json({ error: "This person doesn't have an account yet.", code: "NO_ACCOUNT" });
      const u = await first(sql`SELECT id, name, username, phone FROM users WHERE id = ${other} LIMIT 1`);
      const name = u?.name || u?.username || "Farmer";
      // A shop's phone is public business contact info.
      const store = await first(sql`SELECT phone FROM stores WHERE owner_id = ${other} AND status = 'active' AND phone IS NOT NULL AND phone <> '' LIMIT 1`);
      if (store?.phone) return res.json({ userId: other, name, phone: String(store.phone), phoneSource: "store" });
      const co = await first(sql`SELECT phone FROM companies WHERE owner_id = ${other} AND phone IS NOT NULL AND phone <> '' LIMIT 1`);
      if (co?.phone) return res.json({ userId: other, name, phone: String(co.phone), phoneSource: "store" });
      // A personal number is only shared with people they already deal with:
      // they have messaged you, or there is an order between the two of you.
      let phone: string | null = null;
      if (u?.phone) {
        const wrote = await first(sql`SELECT 1 AS ok FROM direct_messages WHERE sender_id = ${other} AND recipient_id = ${me} LIMIT 1`);
        const order = wrote
          ? null
          : await first(sql`SELECT 1 AS ok FROM shop_orders
              WHERE (user_id = ${me} AND (',' || seller_ids || ',') LIKE ${"%," + other + ",%"})
                 OR (user_id = ${other} AND (',' || seller_ids || ',') LIKE ${"%," + me + ",%"}) LIMIT 1`);
        if (wrote || order) phone = String(u.phone);
      }
      res.json({ userId: other, name, phone, phoneSource: phone ? "profile" : null });
    } catch (e: any) {
      console.error("[dm] contact error:", e?.message || e);
      res.status(500).json({ error: "Couldn't load contact details" });
    }
  });

  app.get("/api/dm/:otherId/messages", auth, async (req, res) => {
    try {
      await ensureTable();
      const me = (req as any).dmUserId as string;
      const withMeta = req.query.withMeta === "1";
      const other = await resolvePerson(req.params.otherId);
      if (!other) {
        return res.json(withMeta ? { otherId: null, hasAccount: false, messages: [], seenUntil: null } : []);
      }
      const since = typeof req.query.since === "string" && req.query.since ? new Date(req.query.since) : null;
      // "since" is inclusive: two messages can share a millisecond, and the app drops ids it already has.
      const r = rows(
        since && !isNaN(since.getTime())
          ? await db.execute(sql`SELECT * FROM direct_messages
              WHERE ((sender_id = ${me} AND recipient_id = ${other}) OR (sender_id = ${other} AND recipient_id = ${me}))
                AND created_at >= ${since.toISOString()}
              ORDER BY created_at ASC, id ASC LIMIT 500`)
          : await db.execute(sql`SELECT * FROM (SELECT * FROM direct_messages
              WHERE (sender_id = ${me} AND recipient_id = ${other}) OR (sender_id = ${other} AND recipient_id = ${me})
              ORDER BY created_at DESC, id DESC LIMIT 300) t ORDER BY created_at ASC, id ASC`)
      );
      await db.execute(
        sql`UPDATE direct_messages SET read_at = now() WHERE sender_id = ${other} AND recipient_id = ${me} AND read_at IS NULL`
      );
      const list = r.map((m: any) => msgOut(m, me));
      if (!withMeta) return res.json(list);
      const seen = await first(
        sql`SELECT max(created_at) AS t FROM direct_messages WHERE sender_id = ${me} AND recipient_id = ${other} AND read_at IS NOT NULL`
      );
      res.json({ otherId: other, hasAccount: true, messages: list, seenUntil: iso(seen?.t) });
    } catch (e: any) {
      console.error("[dm] messages error:", e?.message || e);
      res.status(500).json({ error: "Couldn't load messages" });
    }
  });

  app.post("/api/dm/:otherId/messages", auth, async (req, res) => {
    try {
      await ensureTable();
      const me = (req as any).dmUserId as string;
      const content = String(req.body?.content ?? "").trim().slice(0, 2000);
      if (!content) return res.status(400).json({ error: "Message is empty" });
      const other = await recipientFor(req, res);
      if (!other) return;
      const { id, existing } = await messageId(req.body?.clientId, me);
      if (existing) return res.json(msgOut(existing, me)); // a retry of a send that already went through
      const createdAt = new Date().toISOString();
      await db.execute(
        sql`INSERT INTO direct_messages (id, sender_id, recipient_id, content, kind, created_at)
            VALUES (${id}, ${me}, ${other}, ${content}, 'text', ${createdAt}) ON CONFLICT (id) DO NOTHING`
      );
      const row = { id, sender_id: me, recipient_id: other, content, kind: "text", created_at: createdAt, read_at: null };
      res.json(deliver(me, other, row, content));
    } catch (e: any) {
      console.error("[dm] send error:", e?.message || e);
      res.status(500).json({ error: "Couldn't send the message" });
    }
  });

  app.post("/api/dm/:otherId/voice", auth, async (req, res) => {
    try {
      await ensureTable();
      const me = (req as any).dmUserId as string;
      let b64 = String(req.body?.audio ?? "");
      const dataUrl = /^data:([^;,]+)[^,]*,/.exec(b64);
      if (dataUrl) b64 = b64.slice(dataUrl[0].length);
      b64 = b64.replace(/\s+/g, "");
      const mime = String(req.body?.mime || dataUrl?.[1] || "audio/mp4").split(";")[0].trim().toLowerCase();
      if (!b64 || !/^[A-Za-z0-9+/]+={0,2}$/.test(b64)) return res.status(400).json({ error: "The recording is missing or damaged" });
      if (!VOICE_MIME.has(mime)) return res.status(400).json({ error: "That audio format isn't supported" });
      const size = Math.floor((b64.length * 3) / 4) - (b64.endsWith("==") ? 2 : b64.endsWith("=") ? 1 : 0);
      if (size < 200) return res.status(400).json({ error: "The recording is too short" });
      if (size > MAX_VOICE_BYTES) return res.status(413).json({ error: "The recording is too long" });
      const durationMs = Math.max(0, Math.min(MAX_VOICE_MS, Math.round(Number(req.body?.durationMs) || 0)));
      const other = await recipientFor(req, res);
      if (!other) return;
      const { id, existing } = await messageId(req.body?.clientId, me);
      if (existing) return res.json(msgOut(existing, me));
      const mediaId = `vm-${Date.now()}-${crypto.randomBytes(8).toString("hex")}`;
      const createdAt = new Date().toISOString();
      await db.execute(sql`INSERT INTO dm_media (id, sender_id, recipient_id, mime, size, data)
        VALUES (${mediaId}, ${me}, ${other}, ${mime}, ${size}, decode(${b64}, 'base64'))`);
      await db.execute(
        sql`INSERT INTO direct_messages (id, sender_id, recipient_id, content, kind, media_id, duration_ms, created_at)
            VALUES (${id}, ${me}, ${other}, ${VOICE_LABEL}, 'voice', ${mediaId}, ${durationMs}, ${createdAt}) ON CONFLICT (id) DO NOTHING`
      );
      const row = { id, sender_id: me, recipient_id: other, content: VOICE_LABEL, kind: "voice", media_id: mediaId, duration_ms: durationMs, created_at: createdAt, read_at: null };
      res.json(deliver(me, other, row, durationMs ? `${VOICE_LABEL} (${fmtDuration(durationMs)})` : VOICE_LABEL));
    } catch (e: any) {
      console.error("[dm] voice error:", e?.message || e);
      res.status(500).json({ error: "Couldn't send the voice message" });
    }
  });
}
