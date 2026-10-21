// Reactions on direct messages, shared between the two people in the chat.
//
//  PUT    /api/dm/messages/:id/reaction  { emoji, super }  set (or change) my reaction
//  DELETE /api/dm/messages/:id/reaction                    remove my reaction
//  POST   /api/dm/reactions  { ids: [...] }                reactions on these messages
//
// Only the sender or the recipient of a message can react to it or read its reactions.
// Both people get the change live over /ws/chat as { type: "dm_reaction" }.
import type { Express, Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import { sql } from "drizzle-orm";
import { db, dbReady } from "./db";
import { config } from "./config";

const ALLOWED = new Set(["❤️", "😂", "😮", "😢", "😡", "👍"]);
const rowsOf = (r: any): any[] => (Array.isArray(r) ? r : r?.rows || []);

function auth(req: Request, res: Response, next: NextFunction) {
  const h = req.headers.authorization;
  if (!h || !h.startsWith("Bearer ")) return res.status(401).json({ error: "Please sign in" });
  try {
    const d = jwt.verify(h.slice(7), config.jwtSecret) as any;
    if (!d?.userId) throw new Error("no user");
    (req as any).rxUserId = String(d.userId);
    next();
  } catch {
    res.status(401).json({ error: "Please sign in" });
  }
}

let ready: Promise<void> | null = null;
function ensure() {
  if (!ready) {
    ready = (async () => {
      await dbReady;
      await db.execute(sql`CREATE TABLE IF NOT EXISTS dm_reactions (
        message_id varchar NOT NULL,
        user_id varchar NOT NULL,
        emoji text NOT NULL,
        is_super boolean NOT NULL DEFAULT false,
        created_at timestamp NOT NULL DEFAULT now(),
        PRIMARY KEY (message_id, user_id)
      )`);
    })().catch((e) => {
      ready = null;
      throw e;
    });
  }
  return ready;
}

async function messageFor(uid: string, id: string) {
  const r = rowsOf(
    await db.execute(sql`SELECT id, sender_id, recipient_id FROM direct_messages
      WHERE id = ${id} AND (sender_id = ${uid} OR recipient_id = ${uid}) LIMIT 1`),
  )[0];
  if (!r) return null;
  return { id: String(r.id), peer: String(r.sender_id) === uid ? String(r.recipient_id) : String(r.sender_id) };
}

export function registerReactionRoutes(app: Express, sendToUser: (userId: string, message: any) => unknown) {
  app.put("/api/dm/messages/:id/reaction", auth, async (req: Request, res: Response) => {
    try {
      await ensure();
      const uid = (req as any).rxUserId as string;
      const emoji = String(req.body?.emoji || "");
      const isSuper = !!req.body?.super;
      if (!ALLOWED.has(emoji)) return res.status(400).json({ error: "Unknown reaction" });
      const m = await messageFor(uid, String(req.params.id));
      if (!m) return res.status(404).json({ error: "Message not found" });
      await db.execute(sql`INSERT INTO dm_reactions (message_id, user_id, emoji, is_super, created_at)
        VALUES (${m.id}, ${uid}, ${emoji}, ${isSuper}, now())
        ON CONFLICT (message_id, user_id)
        DO UPDATE SET emoji = EXCLUDED.emoji, is_super = EXCLUDED.is_super, created_at = now()`);
      const payload = { messageId: m.id, userId: uid, emoji, super: isSuper };
      sendToUser(m.peer, { type: "dm_reaction", data: payload });
      sendToUser(uid, { type: "dm_reaction", data: payload });
      res.json(payload);
    } catch (e: any) {
      console.error("Reaction error:", e?.message || e);
      res.status(500).json({ error: "Could not save the reaction" });
    }
  });

  app.delete("/api/dm/messages/:id/reaction", auth, async (req: Request, res: Response) => {
    try {
      await ensure();
      const uid = (req as any).rxUserId as string;
      const m = await messageFor(uid, String(req.params.id));
      if (!m) return res.status(404).json({ error: "Message not found" });
      await db.execute(sql`DELETE FROM dm_reactions WHERE message_id = ${m.id} AND user_id = ${uid}`);
      const payload = { messageId: m.id, userId: uid, emoji: null, super: false };
      sendToUser(m.peer, { type: "dm_reaction", data: payload });
      sendToUser(uid, { type: "dm_reaction", data: payload });
      res.json(payload);
    } catch (e: any) {
      console.error("Reaction delete error:", e?.message || e);
      res.status(500).json({ error: "Could not remove the reaction" });
    }
  });

  app.post("/api/dm/reactions", auth, async (req: Request, res: Response) => {
    try {
      await ensure();
      const uid = (req as any).rxUserId as string;
      const ids: string[] = (Array.isArray(req.body?.ids) ? req.body.ids : []).map(String).slice(0, 300);
      if (!ids.length) return res.json([]);
      const list = rowsOf(
        await db.execute(sql`SELECT r.message_id, r.user_id, r.emoji, r.is_super
          FROM dm_reactions r JOIN direct_messages m ON m.id = r.message_id
          WHERE r.message_id IN (${sql.join(ids.map((i) => sql`${i}`), sql`, `)})
            AND (m.sender_id = ${uid} OR m.recipient_id = ${uid})`),
      );
      res.json(
        list.map((r) => ({ messageId: String(r.message_id), userId: String(r.user_id), emoji: r.emoji, super: !!r.is_super })),
      );
    } catch (e: any) {
      console.error("Reactions list error:", e?.message || e);
      res.status(500).json({ error: "Could not load reactions" });
    }
  });
}
