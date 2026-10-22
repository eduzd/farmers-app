import type { Express, Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import { sql } from "drizzle-orm";
import { db, dbReady } from "./db";
import { config } from "./config";

/**
 * Phone push notifications (Expo push service).
 *  POST   /api/me/push-tokens {token, platform?, notify?, vibrate?}
 *                                                 save this device's Expo push token for the signed-in user,
 *                                                 plus the phone's notification settings (Settings > Notifications):
 *                                                 notify=false -> no pushes to this phone,
 *                                                 vibrate=false -> pushes go to the Android "quiet" channel (no vibration).
 *                                                 Left out = keep what is saved (new tokens: on + vibrate).
 *  DELETE /api/me/push-tokens {token}             remove one of your own tokens (on logout)
 *  GET    /api/me/push-tokens                     list your own tokens (masked)
 * The user always comes from the sign-in token, never from the request body.
 * sendPush() is called by notify(), so every in-app notification (new order for the
 * seller, order status for the buyer, admin announcements, messages...) also goes to
 * the user's phones. It never throws and never blocks the request.
 *
 * Env: EXPO_ACCESS_TOKEN (optional, only if "enhanced push security" is on in Expo),
 *      PUSH_DISABLED=1 to skip sending, EXPO_PUSH_URL to point at a test server.
 */

const rows = (r: any): any[] => (Array.isArray(r) ? r : r?.rows || []);
const TOKEN_RE = /^Expo(nent)?PushToken\[[A-Za-z0-9_\-]{8,200}\]$/;
const MAX_TOKENS_PER_USER = 10;
const pushUrl = () => process.env.EXPO_PUSH_URL || "https://exp.host/--/api/v2/push/send";

let ready: Promise<void> | null = null;
function ensurePushTable() {
  if (!ready) {
    ready = (async () => {
      await dbReady;
      await db.execute(sql`CREATE TABLE IF NOT EXISTS push_tokens (
        token varchar PRIMARY KEY, user_id varchar NOT NULL, platform varchar,
        created_at timestamp NOT NULL DEFAULT now(), updated_at timestamp NOT NULL DEFAULT now())`);
      await db.execute(sql`CREATE INDEX IF NOT EXISTS push_tokens_user_idx ON push_tokens (user_id)`);
      await db.execute(sql`ALTER TABLE push_tokens ADD COLUMN IF NOT EXISTS notify boolean NOT NULL DEFAULT true`);
      await db.execute(sql`ALTER TABLE push_tokens ADD COLUMN IF NOT EXISTS vibrate boolean NOT NULL DEFAULT true`);
    })().catch((e) => {
      ready = null;
      throw e;
    });
  }
  return ready;
}

function auth(req: Request, res: Response, next: NextFunction) {
  const h = req.headers.authorization;
  let uid: string | null = null;
  if (h && h.startsWith("Bearer ")) {
    try {
      uid = (jwt.verify(h.slice(7), config.jwtSecret) as any).userId || null;
    } catch {
      uid = null;
    }
  }
  if (!uid) return res.status(401).json({ error: "Please log in first" });
  (req as any).uid = uid;
  next();
}

const mask = (t: string) => t.slice(0, 20) + "…" + t.slice(-4);
const optBool = (v: unknown): boolean | null => (typeof v === "boolean" ? v : null);

/** Android channels made by the app (src/lib/notificationService.ts). */
export const PUSH_CHANNEL_VIBRATE = "default";
export const PUSH_CHANNEL_QUIET = "quiet";

export function registerPushRoutes(app: Express) {
  app.post("/api/me/push-tokens", auth, async (req, res) => {
    try {
      const uid = (req as any).uid as string;
      const token = typeof req.body?.token === "string" ? req.body.token.trim() : "";
      if (!TOKEN_RE.test(token)) return res.status(400).json({ error: "Not a valid Expo push token" });
      if (req.body?.userId && String(req.body.userId) !== uid) {
        return res.status(403).json({ error: "You can only register tokens for your own account" });
      }
      const platform = ["android", "ios", "web"].includes(req.body?.platform) ? req.body.platform : null;
      const notify = optBool(req.body?.notify);
      const vibrate = optBool(req.body?.vibrate);
      await ensurePushTable();
      // A device token belongs to whoever is signed in on that device now.
      // The on/off + vibration settings belong to the phone; keep them unless sent.
      await db.execute(sql`INSERT INTO push_tokens (token, user_id, platform, notify, vibrate)
        VALUES (${token}, ${uid}, ${platform}, COALESCE(${notify}::boolean, true), COALESCE(${vibrate}::boolean, true))
        ON CONFLICT (token) DO UPDATE SET user_id = ${uid}, platform = ${platform},
          notify = COALESCE(${notify}::boolean, push_tokens.notify),
          vibrate = COALESCE(${vibrate}::boolean, push_tokens.vibrate), updated_at = now()`);
      // Keep only the newest few devices per user.
      await db.execute(sql`DELETE FROM push_tokens WHERE user_id = ${uid} AND token NOT IN (
        SELECT token FROM push_tokens WHERE user_id = ${uid} ORDER BY updated_at DESC LIMIT ${MAX_TOKENS_PER_USER})`);
      res.json({ success: true });
    } catch (e: any) {
      console.error("[push] save token", e?.message);
      res.status(500).json({ error: "Could not save push token" });
    }
  });

  app.delete("/api/me/push-tokens", auth, async (req, res) => {
    try {
      const uid = (req as any).uid as string;
      const token = typeof req.body?.token === "string" ? req.body.token.trim() : "";
      if (!token) return res.status(400).json({ error: "token is required" });
      await ensurePushTable();
      const r = rows(await db.execute(sql`DELETE FROM push_tokens WHERE token = ${token} AND user_id = ${uid} RETURNING token`));
      if (!r.length) return res.status(404).json({ error: "Token not found" });
      res.json({ success: true });
    } catch (e: any) {
      console.error("[push] delete token", e?.message);
      res.status(500).json({ error: "Could not remove push token" });
    }
  });

  app.get("/api/me/push-tokens", auth, async (req, res) => {
    try {
      await ensurePushTable();
      const r = rows(await db.execute(sql`SELECT token, platform, notify, vibrate, updated_at FROM push_tokens WHERE user_id = ${(req as any).uid} ORDER BY updated_at DESC`));
      res.json({
        tokens: r.map((x: any) => ({
          token: mask(x.token), platform: x.platform || null, notify: x.notify !== false, vibrate: x.vibrate !== false, updatedAt: x.updated_at,
        })),
      });
    } catch (e: any) {
      console.error("[push] list tokens", e?.message);
      res.status(500).json({ error: "Could not load push tokens" });
    }
  });
}

/** Send a push to every phone the user is signed in on. Never throws. */
export async function sendPush(userId: string | null | undefined, title: string, body: string, data: any = {}) {
  if (!userId || process.env.PUSH_DISABLED === "1") return;
  try {
    await ensurePushTable();
    // Phones that turned notifications off get nothing; the others get the channel
    // that matches their vibration setting.
    const devices = rows(await db.execute(sql`SELECT token, vibrate FROM push_tokens WHERE user_id = ${userId} AND notify IS NOT FALSE`));
    if (!devices.length) return;
    const messages = devices.map((d: any) => ({
      to: d.token as string, title: title.slice(0, 200), body: body.slice(0, 500), data, sound: "default",
      channelId: d.vibrate === false ? PUSH_CHANNEL_QUIET : PUSH_CHANNEL_VIBRATE, priority: "high",
    }));
    const headers: Record<string, string> = { Accept: "application/json", "Content-Type": "application/json" };
    if (process.env.EXPO_ACCESS_TOKEN) headers.Authorization = `Bearer ${process.env.EXPO_ACCESS_TOKEN}`;
    for (let i = 0; i < messages.length; i += 100) {
      const chunk = messages.slice(i, i + 100);
      const resp = await fetch(pushUrl(), { method: "POST", headers, body: JSON.stringify(chunk) });
      const out: any = await resp.json().catch(() => null);
      const tickets: any[] = Array.isArray(out?.data) ? out.data : [];
      // Forget tokens Expo says are dead (app uninstalled, etc.).
      for (let j = 0; j < tickets.length; j++) {
        if (tickets[j]?.status === "error" && tickets[j]?.details?.error === "DeviceNotRegistered") {
          await db.execute(sql`DELETE FROM push_tokens WHERE token = ${chunk[j].to}`);
        }
      }
      if (!resp.ok) console.error("[push] expo responded", resp.status);
    }
  } catch (e: any) {
    console.error("[push]", e?.message);
  }
}
