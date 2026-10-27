// Profile photo and "about" details.
//
//  POST   /api/me/avatar    { imageBase64, mimeType }  JPEG/PNG/WebP up to 2 MB (signed in)
//  DELETE /api/me/avatar                               remove your photo (signed in)
//  GET    /api/avatars/:userId                         the photo (public, like any profile picture)
//  GET    /api/me/about                                your bio and location (signed in)
//  PUT    /api/me/about     { bio, location }          (signed in)
//  GET    /api/users/:userId/about                     someone's bio, location and join date (public)
//  POST   /api/users/:userId/report { reason, details } report a person (signed in)
//
// The photo is stored in the database, so it survives Render restarts. users.avatar is set
// to /api/avatars/<id>?v=<time>, which every place that already shows users.avatar picks up.
import type { Express, Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import { sql } from "drizzle-orm";
import { db, dbReady } from "./db";
import { config } from "./config";
import { ensurePostReports } from "./communityRoutes";

const MAX_BYTES = 2 * 1024 * 1024;
const rowsOf = (r: any): any[] => (Array.isArray(r) ? r : r?.rows || []);

function auth(req: Request, res: Response, next: NextFunction) {
  const h = req.headers.authorization;
  if (!h || !h.startsWith("Bearer ")) return res.status(401).json({ error: "Please sign in" });
  try {
    const d = jwt.verify(h.slice(7), config.jwtSecret) as any;
    if (!d?.userId) throw new Error("no user");
    (req as any).profileUserId = String(d.userId);
    next();
  } catch {
    res.status(401).json({ error: "Please sign in" });
  }
}

let ready: Promise<void> | null = null;
function ensureTables() {
  if (!ready) {
    ready = (async () => {
      await dbReady;
      await db.execute(sql`CREATE TABLE IF NOT EXISTS user_avatars (
        user_id TEXT PRIMARY KEY,
        mime TEXT NOT NULL,
        data BYTEA NOT NULL,
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )`);
      await db.execute(sql`CREATE TABLE IF NOT EXISTS user_about (
        user_id TEXT PRIMARY KEY,
        bio TEXT NOT NULL DEFAULT '',
        location TEXT NOT NULL DEFAULT '',
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )`);
    })().catch((e) => {
      ready = null;
      throw e;
    });
  }
  return ready;
}

/** Check the file really is the picture type it claims to be. */
function sniff(buf: Buffer): string | null {
  if (buf.length > 3 && buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return "image/jpeg";
  if (buf.length > 8 && buf.slice(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return "image/png";
  if (buf.length > 12 && buf.slice(0, 4).toString("ascii") === "RIFF" && buf.slice(8, 12).toString("ascii") === "WEBP") return "image/webp";
  return null;
}

const clean = (v: any, max: number) => String(v ?? "").replace(/[\u0000-\u0008\u000b-\u001f]/g, "").trim().slice(0, max);

export function registerProfileRoutes(app: Express) {
  app.post("/api/me/avatar", auth, async (req: Request, res: Response) => {
    try {
      await ensureTables();
      const uid = (req as any).profileUserId as string;
      let b64 = String(req.body?.imageBase64 || "");
      const m = /^data:([^;]+);base64,/.exec(b64);
      if (m) b64 = b64.slice(m[0].length);
      if (!b64) return res.status(400).json({ error: "No picture was sent" });
      if (b64.length > Math.ceil((MAX_BYTES * 4) / 3) + 8) return res.status(413).json({ error: "Picture is too big (max 2 MB)" });
      const buf = Buffer.from(b64, "base64");
      if (!buf.length || buf.length > MAX_BYTES) return res.status(413).json({ error: "Picture is too big (max 2 MB)" });
      const mime = sniff(buf);
      if (!mime) return res.status(415).json({ error: "Use a JPG, PNG or WebP picture" });
      const exists = rowsOf(await db.execute(sql`SELECT id FROM users WHERE id::text = ${uid} LIMIT 1`))[0];
      if (!exists) return res.status(404).json({ error: "Account not found" });
      await db.execute(sql`INSERT INTO user_avatars (user_id, mime, data, updated_at) VALUES (${uid}, ${mime}, ${buf}, NOW())
        ON CONFLICT (user_id) DO UPDATE SET mime = EXCLUDED.mime, data = EXCLUDED.data, updated_at = NOW()`);
      const avatar = `/api/avatars/${encodeURIComponent(uid)}?v=${Date.now()}`;
      await db.execute(sql`UPDATE users SET avatar = ${avatar} WHERE id::text = ${uid}`);
      res.json({ avatar });
    } catch (e: any) {
      console.error("Avatar upload error:", e?.message || e);
      res.status(500).json({ error: "Could not save the picture" });
    }
  });

  app.delete("/api/me/avatar", auth, async (req: Request, res: Response) => {
    try {
      await ensureTables();
      const uid = (req as any).profileUserId as string;
      await db.execute(sql`DELETE FROM user_avatars WHERE user_id = ${uid}`);
      await db.execute(sql`UPDATE users SET avatar = NULL WHERE id::text = ${uid}`);
      res.json({ avatar: null });
    } catch (e: any) {
      console.error("Avatar delete error:", e?.message || e);
      res.status(500).json({ error: "Could not remove the picture" });
    }
  });

  app.get("/api/avatars/:userId", async (req: Request, res: Response) => {
    try {
      await ensureTables();
      const r = rowsOf(await db.execute(sql`SELECT mime, data FROM user_avatars WHERE user_id = ${String(req.params.userId)} LIMIT 1`))[0];
      if (!r) return res.status(404).end();
      const data: Buffer = Buffer.isBuffer(r.data) ? r.data : Buffer.from(r.data);
      res.setHeader("Content-Type", String(r.mime));
      res.setHeader("X-Content-Type-Options", "nosniff");
      res.setHeader("Cache-Control", "public, max-age=86400");
      res.end(data);
    } catch (e: any) {
      console.error("Avatar get error:", e?.message || e);
      res.status(500).end();
    }
  });

  const aboutOf = async (uid: string) => {
    await ensureTables();
    const r = rowsOf(await db.execute(sql`SELECT bio, location FROM user_about WHERE user_id = ${uid} LIMIT 1`))[0];
    // "Member since" on the profile page. Only the date the account was made, nothing private.
    let joinedAt: string | null = null;
    try {
      const u = rowsOf(await db.execute(sql`SELECT created_at FROM users WHERE id::text = ${uid} LIMIT 1`))[0];
      if (u?.created_at) joinedAt = new Date(u.created_at).toISOString();
    } catch {}
    return { bio: r?.bio || "", location: r?.location || "", joinedAt };
  };

  app.get("/api/me/about", auth, async (req: Request, res: Response) => {
    try {
      res.json(await aboutOf((req as any).profileUserId));
    } catch (e: any) {
      res.status(500).json({ error: "Could not load your profile" });
    }
  });

  app.get("/api/users/:userId/about", async (req: Request, res: Response) => {
    try {
      res.json(await aboutOf(String(req.params.userId)));
    } catch (e: any) {
      res.status(500).json({ error: "Could not load the profile" });
    }
  });

  // Report a person from their profile page. Goes into the same moderation queue as post
  // reports (it counts in "Open reports" on the admin dashboard), marked as a profile report.
  const PROFILE_REPORT_REASONS = new Set(["spam", "scam", "harassment", "hate", "violence", "nudity", "misinfo", "impersonation", "other"]);
  app.post("/api/users/:userId/report", auth, async (req: Request, res: Response) => {
    try {
      const reporter = (req as any).profileUserId as string;
      const target = clean(req.params.userId, 80);
      if (!target) return res.status(400).json({ error: "Unknown person" });
      if (target === reporter) return res.status(400).json({ error: "You can't report yourself" });
      const reason = clean(req.body?.reason, 40);
      if (!PROFILE_REPORT_REASONS.has(reason)) return res.status(400).json({ error: "Pick a reason" });
      const details = clean(req.body?.details, 500);
      const u = rowsOf(await db.execute(sql`SELECT name FROM users WHERE id::text = ${target} LIMIT 1`))[0];
      if (!u) return res.status(404).json({ error: "This person no longer exists" });
      await ensurePostReports();
      const key = `profile:${target}`;
      const excerpt = `[Profile] ${String(u.name || "").slice(0, 100)}`;
      await db.execute(sql`INSERT INTO post_reports (post_id, reporter_id, post_author_id, post_excerpt, reason, details)
        VALUES (${key}, ${reporter}, ${target}, ${excerpt}, ${reason}, ${details || null})
        ON CONFLICT (post_id, reporter_id) DO UPDATE SET reason = EXCLUDED.reason, details = EXCLUDED.details, status = 'open', created_at = now()`);
      res.json({ ok: true });
    } catch (e: any) {
      console.error("Profile report error:", e?.message || e);
      res.status(500).json({ error: "Could not send the report" });
    }
  });

  app.put("/api/me/about", auth, async (req: Request, res: Response) => {
    try {
      await ensureTables();
      const uid = (req as any).profileUserId as string;
      const bio = clean(req.body?.bio, 300);
      const location = clean(req.body?.location, 80);
      await db.execute(sql`INSERT INTO user_about (user_id, bio, location, updated_at) VALUES (${uid}, ${bio}, ${location}, NOW())
        ON CONFLICT (user_id) DO UPDATE SET bio = EXCLUDED.bio, location = EXCLUDED.location, updated_at = NOW()`);
      res.json({ bio, location });
    } catch (e: any) {
      console.error("About save error:", e?.message || e);
      res.status(500).json({ error: "Could not save your profile" });
    }
  });
}
