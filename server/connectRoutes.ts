import type { Express, Request, Response } from "express";
import jwt from "jsonwebtoken";
import { sql } from "drizzle-orm";
import { db, dbReady } from "./db";
import { config } from "./config";
import { ensureProfileColumns } from "./profileColumns";
import { ensureRelations } from "./communityRoutes";

/**
 * Connect: the directory of real professionals on Farmers (vets, fish doctors, crop and soil
 * specialists, feed experts...). Only accounts that picked the "expert" role when they set up
 * their account are listed; ordinary farmer, buyer and company accounts never appear here.
 * Nothing is seeded or made up: an empty database gives an empty list.
 *
 *  GET /api/connect/fields                       the specialty list (labels in English and Bangla)
 *  GET /api/connect/professionals?field=&q=      experts, newest first (max 100). Public profile fields only:
 *                                                id, name, avatar, field, title, about, verified. No phone, no email.
 *                                                Signed in: people you blocked / who blocked you are left out, and you
 *                                                are left out of your own list.
 *  GET /api/me/expert-profile                    my specialty, title and about
 *  PUT /api/me/expert-profile { field, title, about }   expert accounts only (403 otherwise)
 */

export const EXPERT_FIELDS: { id: string; label: string; labelBn: string }[] = [
  { id: "vet", label: "Animal doctor (vet)", labelBn: "পশু চিকিৎসক" },
  { id: "fish", label: "Fish health", labelBn: "মাছের রোগ বিশেষজ্ঞ" },
  { id: "poultry", label: "Poultry doctor", labelBn: "পোল্ট্রি চিকিৎসক" },
  { id: "crops", label: "Crop & plant doctor", labelBn: "ফসল ও গাছের ডাক্তার" },
  { id: "soil", label: "Soil & fertilizer", labelBn: "মাটি ও সার" },
  { id: "feed", label: "Feed & nutrition", labelBn: "খাদ্য ও পুষ্টি" },
  { id: "dairy", label: "Dairy & cattle", labelBn: "দুগ্ধ ও গবাদি পশু" },
  { id: "other", label: "Other specialist", labelBn: "অন্যান্য বিশেষজ্ঞ" },
];
const FIELD_IDS = new Set(EXPERT_FIELDS.map((f) => f.id));

const rows = (r: any): any[] => (Array.isArray(r) ? r : r?.rows || []);

function userIdFrom(req: Request): string | null {
  const h = req.headers.authorization;
  if (!h || !h.startsWith("Bearer ")) return null;
  try {
    return (jwt.verify(h.slice(7), config.jwtSecret) as any).userId || null;
  } catch {
    return null;
  }
}

let ready: Promise<void> | null = null;
function ensureColumns(): Promise<void> {
  if (!ready) {
    ready = (async () => {
      await dbReady;
      await ensureProfileColumns();
      await db.execute(sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS expert_field text`);
      await db.execute(sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS expert_title text`);
      await db.execute(sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS expert_about text`);
      await db.execute(sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS banned boolean NOT NULL DEFAULT false`);
    })().catch((e) => {
      ready = null;
      throw e;
    });
  }
  return ready;
}

const clean = (v: unknown, max: number) => String(v ?? "").replace(/\s+/g, " ").trim().slice(0, max);

export function registerConnectRoutes(app: Express) {
  app.get("/api/connect/fields", (_req, res) => res.json(EXPERT_FIELDS));

  app.get("/api/connect/professionals", async (req: Request, res: Response) => {
    try {
      await ensureColumns();
      const me = userIdFrom(req);
      const field = typeof req.query.field === "string" && FIELD_IDS.has(req.query.field) ? req.query.field : null;
      const q = clean(req.query.q, 60).toLowerCase();
      const like = `%${q.replace(/[%_\\]/g, "")}%`;
      if (me) await ensureRelations();
      const r = rows(
        await db.execute(sql`
          SELECT u.id, u.name, u.username, u.avatar, u.verified, u.expert_field, u.expert_title, u.expert_about, u.created_at
          FROM users u
          WHERE u.profile_role = 'expert' AND COALESCE(u.banned, false) = false
            ${field ? sql`AND u.expert_field = ${field}` : sql``}
            ${q ? sql`AND (lower(COALESCE(u.name, u.username, '')) LIKE ${like} OR lower(COALESCE(u.expert_title, '')) LIKE ${like} OR lower(COALESCE(u.expert_about, '')) LIKE ${like})` : sql``}
            ${me ? sql`AND u.id <> ${me} AND NOT EXISTS (SELECT 1 FROM user_relations ur WHERE ur.kind = 'block'
                 AND ((ur.user_id = ${me} AND ur.target_id = u.id) OR (ur.user_id = u.id AND ur.target_id = ${me})))` : sql``}
          ORDER BY u.verified DESC NULLS LAST, u.created_at DESC NULLS LAST
          LIMIT 100`)
      );
      res.json({
        fields: EXPERT_FIELDS,
        professionals: r.map((u: any) => {
          const name = u.name || u.username || "Expert";
          return {
            id: u.id,
            name,
            avatar: u.avatar || null,
            verified: !!u.verified,
            field: u.expert_field || null,
            title: u.expert_title || null,
            about: u.expert_about || null,
          };
        }),
      });
    } catch (e: any) {
      console.error("[connect] list error:", e?.message || e);
      res.status(500).json({ error: "Couldn't load experts" });
    }
  });

  app.get("/api/me/expert-profile", async (req: Request, res: Response) => {
    const me = userIdFrom(req);
    if (!me) return res.status(401).json({ error: "Please sign in" });
    try {
      await ensureColumns();
      const u = rows(await db.execute(sql`SELECT profile_role, expert_field, expert_title, expert_about FROM users WHERE id = ${me} LIMIT 1`))[0];
      if (!u) return res.status(404).json({ error: "Account not found" });
      res.json({ isExpert: u.profile_role === "expert", field: u.expert_field || null, title: u.expert_title || null, about: u.expert_about || null });
    } catch (e: any) {
      console.error("[connect] get profile error:", e?.message || e);
      res.status(500).json({ error: "Couldn't load your expert profile" });
    }
  });

  app.put("/api/me/expert-profile", async (req: Request, res: Response) => {
    const me = userIdFrom(req);
    if (!me) return res.status(401).json({ error: "Please sign in" });
    try {
      await ensureColumns();
      const u = rows(await db.execute(sql`SELECT profile_role FROM users WHERE id = ${me} LIMIT 1`))[0];
      if (!u) return res.status(404).json({ error: "Account not found" });
      if (u.profile_role !== "expert") return res.status(403).json({ error: "Only expert accounts are listed in Connect", code: "NOT_EXPERT" });
      const b = req.body || {};
      const field = FIELD_IDS.has(String(b.field)) ? String(b.field) : null;
      const title = clean(b.title, 80) || null;
      const about = clean(b.about, 300) || null;
      await db.execute(sql`UPDATE users SET expert_field = ${field}, expert_title = ${title}, expert_about = ${about} WHERE id = ${me}`);
      res.json({ isExpert: true, field, title, about });
    } catch (e: any) {
      console.error("[connect] save profile error:", e?.message || e);
      res.status(500).json({ error: "Couldn't save your expert profile" });
    }
  });
}
