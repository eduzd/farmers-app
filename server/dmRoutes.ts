import type { Express, Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import { sql } from "drizzle-orm";
import { db, dbReady } from "./db";
import { config } from "./config";
import { notify, publicUser } from "./featureRoutes";

/**
 * Person-to-person direct messages.
 *  GET  /api/dm/threads                    my conversations (other user, last message, unread)
 *  GET  /api/dm/:otherUserId/messages      messages between me and that user (?since=ISO)
 *  POST /api/dm/:otherUserId/messages      send { content }
 * Messages are stored in the database (table created on start) and pushed live
 * over the existing /ws/chat socket when the other person is connected; the
 * app also polls, so delivery works through proxies/tunnels without sockets.
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

export function registerDmRoutes(app: Express, push: Pusher) {
  ensureTable().catch((e) => console.error("[dm] table setup failed:", e?.message || e));

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
            SELECT DISTINCT ON (other_id) other_id, content, created_at, sender_id
            FROM mine ORDER BY other_id, created_at DESC
          )
          SELECT last.other_id, last.content, last.created_at, last.sender_id,
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
          lastMessage: t.content,
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

  app.get("/api/dm/:otherId/messages", auth, async (req, res) => {
    try {
      await ensureTable();
      const me = (req as any).dmUserId as string;
      const other = req.params.otherId;
      const since = typeof req.query.since === "string" && req.query.since ? new Date(req.query.since) : null;
      const r = rows(
        since && !isNaN(since.getTime())
          ? await db.execute(sql`SELECT * FROM direct_messages
              WHERE ((sender_id = ${me} AND recipient_id = ${other}) OR (sender_id = ${other} AND recipient_id = ${me}))
                AND created_at > ${since.toISOString()}
              ORDER BY created_at ASC LIMIT 500`)
          : await db.execute(sql`SELECT * FROM (SELECT * FROM direct_messages
              WHERE (sender_id = ${me} AND recipient_id = ${other}) OR (sender_id = ${other} AND recipient_id = ${me})
              ORDER BY created_at DESC LIMIT 300) t ORDER BY created_at ASC`)
      );
      await db.execute(
        sql`UPDATE direct_messages SET read_at = now() WHERE sender_id = ${other} AND recipient_id = ${me} AND read_at IS NULL`
      );
      res.json(
        r.map((m: any) => ({
          id: m.id,
          senderId: m.sender_id,
          recipientId: m.recipient_id,
          content: m.content,
          createdAt: iso(m.created_at),
          readAt: iso(m.read_at),
          isMe: m.sender_id === me,
        }))
      );
    } catch (e: any) {
      console.error("[dm] messages error:", e?.message || e);
      res.status(500).json({ error: "Couldn't load messages" });
    }
  });

  app.post("/api/dm/:otherId/messages", auth, async (req, res) => {
    try {
      await ensureTable();
      const me = (req as any).dmUserId as string;
      const other = req.params.otherId;
      const content = String(req.body?.content ?? "").trim().slice(0, 2000);
      if (!content) return res.status(400).json({ error: "Message is empty" });
      if (other === me) return res.status(400).json({ error: "You can't message yourself" });
      const exists = rows(await db.execute(sql`SELECT id FROM users WHERE id = ${other} LIMIT 1`));
      if (!exists.length) return res.status(404).json({ error: "That user doesn't have an account yet" });
      const id = `dm-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
      const createdAt = new Date().toISOString();
      await db.execute(
        sql`INSERT INTO direct_messages (id, sender_id, recipient_id, content, created_at) VALUES (${id}, ${me}, ${other}, ${content}, ${createdAt})`
      );
      const msg = { id, senderId: me, recipientId: other, content, createdAt, readAt: null };
      push(other, { type: "dm", data: { ...msg, isMe: false } });
      publicUser(me).then((u) => notify(other, "message", `Message from ${u?.name || "someone"}`, content.slice(0, 140), { userId: me }));
      res.json({ ...msg, isMe: true });
    } catch (e: any) {
      console.error("[dm] send error:", e?.message || e);
      res.status(500).json({ error: "Couldn't send the message" });
    }
  });
}
