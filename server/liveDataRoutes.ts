import type { Express, Request, Response } from "express";
import jwt from "jsonwebtoken";
import { sql } from "drizzle-orm";
import { db, dbReady } from "./db";
import { config } from "./config";
import { ensureProfileColumns } from "./profileColumns";
import { ensureRelations } from "./communityRoutes";

/**
 * Live data for screens that used to show made-up numbers or sample lists.
 * Everything here is read from the database; nothing is invented. An empty
 * database gives empty lists, and a failed query answers 500 (never a fake zero).
 *
 *  GET /api/users/search?q=&category=   people search (public profile fields only)
 *  GET /api/posts/:id/likers            who liked a post
 *  GET /api/trending?days=7             hashtags, communities and posts people are
 *                                       actually posting and reacting to
 *  GET /api/users/:id/posts            one person's posts, newest first
 *  GET /api/reviews-summary?ids=a,b     average rating and count per product (only
 *                                       products that have reviews are returned)
 */

const rows = (r: any): any[] => (Array.isArray(r) ? r : r?.rows || []);

function viewerId(req: Request): string | null {
  const h = req.headers.authorization;
  if (!h || !h.startsWith("Bearer ")) return null;
  try {
    return (jwt.verify(h.slice(7), config.jwtSecret) as any).userId || null;
  } catch {
    return null;
  }
}

let ready: Promise<void> | null = null;
function ensureTables(): Promise<void> {
  if (!ready) {
    ready = (async () => {
      await dbReady;
      await ensureProfileColumns();
      await ensureRelations();
      await db.execute(sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS banned boolean NOT NULL DEFAULT false`);
      await db.execute(sql`CREATE TABLE IF NOT EXISTS follows (
        follower_id varchar NOT NULL, followee_id varchar NOT NULL, created_at timestamp NOT NULL DEFAULT now(),
        PRIMARY KEY (follower_id, followee_id))`);
      await db.execute(sql`CREATE TABLE IF NOT EXISTS item_reviews (
        id varchar PRIMARY KEY, target_id varchar NOT NULL, target_owner_id varchar, user_id varchar NOT NULL,
        rating integer NOT NULL, comment text, created_at timestamp NOT NULL DEFAULT now())`);
    })().catch((e) => {
      ready = null;
      throw e;
    });
  }
  return ready;
}

/** Public card for a person: no email, no phone. */
function personOut(u: any) {
  return {
    id: String(u.id),
    name: u.name || u.username || "",
    avatar: u.avatar || null,
    verified: !!u.verified,
    profileRole: u.profile_role || null,
    farmingCategory: u.farming_category || null,
    followerCount: Number(u.follower_count || 0),
    followingCount: Number(u.following_count || 0),
    isFollowing: !!u.is_following,
  };
}

const personCols = (uid: string | null) => sql`
  u.id, u.name, u.username, u.avatar, u.verified, u.profile_role, u.farming_category,
  (SELECT count(*)::int FROM follows f WHERE f.followee_id = u.id) AS follower_count,
  (SELECT count(*)::int FROM follows f WHERE f.follower_id = u.id) AS following_count,
  ${uid ? sql`EXISTS (SELECT 1 FROM follows f WHERE f.follower_id = ${uid} AND f.followee_id = u.id)` : sql`false`} AS is_following`;

/** Leave out people the viewer blocked and people who blocked the viewer. */
const notBlocked = (uid: string | null) =>
  uid
    ? sql`NOT EXISTS (SELECT 1 FROM user_relations ur WHERE ur.kind = 'block'
        AND ((ur.user_id = ${uid} AND ur.target_id = u.id) OR (ur.user_id = u.id AND ur.target_id = ${uid})))`
    : sql`TRUE`;

const HASHTAG = /#[\p{L}\p{N}_]{2,40}/gu;

export function registerLiveDataRoutes(app: Express) {
  const wrap =
    (label: string, fn: (req: Request, res: Response) => Promise<any>) =>
    async (req: Request, res: Response) => {
      if (!db) return res.status(500).json({ error: "Database not available" });
      try {
        await ensureTables();
        await fn(req, res);
      } catch (e) {
        console.error(`[live-data] ${label}:`, e);
        if (!res.headersSent) res.status(500).json({ error: `Could not load ${label}` });
      }
    };

  app.get(
    "/api/users/search",
    wrap("people", async (req, res) => {
      const uid = viewerId(req);
      const q = String(req.query.q || "").trim().slice(0, 60);
      const category = String(req.query.category || "all");
      const limit = Math.min(50, Math.max(1, Number(req.query.limit) || 30));
      const like = `%${q.replace(/[%_\\]/g, (m) => "\\" + m)}%`;
      const match = q
        ? sql`(u.name ILIKE ${like} OR u.username ILIKE ${like} OR coalesce(u.farming_category, '') ILIKE ${like} OR coalesce(u.expert_title, '') ILIKE ${like})`
        : sql`TRUE`;
      const cat =
        category === "experts"
          ? sql`u.profile_role = 'expert'`
          : category && category !== "all"
            ? sql`u.farming_category = ${category}`
            : sql`TRUE`;
      await db.execute(sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS expert_title text`);
      const r = rows(
        await db.execute(sql`SELECT ${personCols(uid)} FROM users u
          WHERE coalesce(u.banned, false) = false
            AND coalesce(u.is_super_admin, false) = false
            AND ${uid ? sql`u.id <> ${uid}` : sql`TRUE`}
            AND ${match} AND ${cat} AND ${notBlocked(uid)}
          ORDER BY follower_count DESC, u.created_at DESC NULLS LAST
          LIMIT ${limit}`),
      );
      res.json(r.map(personOut));
    }),
  );

  app.get(
    "/api/posts/:id/likers",
    wrap("likes", async (req, res) => {
      const uid = viewerId(req);
      const post = rows(await db.execute(sql`SELECT id FROM posts WHERE id = ${req.params.id} LIMIT 1`))[0];
      if (!post) return res.status(404).json({ error: "This post was removed" });
      const r = rows(
        await db.execute(sql`SELECT ${personCols(uid)} FROM post_likes pl JOIN users u ON u.id = pl.user_id
          WHERE pl.post_id = ${post.id} AND coalesce(u.banned, false) = false AND ${notBlocked(uid)}
          ORDER BY u.name NULLS LAST LIMIT 500`),
      );
      res.json(r.map(personOut));
    }),
  );

  app.get(
    "/api/trending",
    wrap("trending", async (req, res) => {
      const uid = viewerId(req);
      const days = Math.min(30, Math.max(1, Number(req.query.days) || 7));
      const hidden = uid
        ? sql`NOT EXISTS (SELECT 1 FROM user_relations ur WHERE
            (ur.user_id = ${uid} AND ur.target_id = p.author_id AND ur.kind IN ('mute', 'block'))
            OR (ur.user_id = p.author_id AND ur.target_id = ${uid} AND ur.kind = 'block'))`
        : sql`TRUE`;

      // Hashtags: this period against the period before it.
      const textRows = rows(
        await db.execute(sql`SELECT p.content, p.created_at >= now() - make_interval(days => ${days}) AS recent
          FROM posts p WHERE p.created_at >= now() - make_interval(days => ${days * 2}) AND p.content LIKE '%#%'`),
      );
      const now = new Map<string, number>();
      const before = new Map<string, number>();
      for (const t of textRows) {
        const seen = new Set<string>();
        for (const m of String(t.content || "").match(HASHTAG) || []) {
          const tag = m.toLowerCase();
          if (seen.has(tag)) continue;
          seen.add(tag);
          const map = t.recent ? now : before;
          map.set(tag, (map.get(tag) || 0) + 1);
        }
      }
      const hashtags = [...now.entries()]
        .sort((a, b) => b[1] - a[1])
        .slice(0, 20)
        .map(([tag, count]) => {
          const prev = before.get(tag) || 0;
          return { tag, postsCount: count, previousCount: prev, growth: prev ? Math.round(((count - prev) / prev) * 100) : null };
        });

      // Communities with the most posts in the period.
      const topics = rows(
        await db.execute(sql`SELECT c.id, c.name_bn, c.name_en, c.slug, count(p.id)::int AS posts_count
          FROM posts p JOIN communities c ON c.id = p.community_id
          WHERE p.created_at >= now() - make_interval(days => ${days})
          GROUP BY c.id, c.name_bn, c.name_en, c.slug ORDER BY posts_count DESC LIMIT 10`),
      ).map((c) => ({ id: String(c.id), nameBn: c.name_bn || c.name_en || c.slug, nameEn: c.name_en || c.name_bn || c.slug, slug: c.slug, postsCount: Number(c.posts_count) }));

      // Posts with the most likes and comments in the period (at least one reaction).
      const posts = rows(
        await db.execute(sql`SELECT * FROM (
            SELECT p.id, p.content, p.media, p.created_at,
              (SELECT count(*)::int FROM post_likes pl WHERE pl.post_id = p.id) AS like_count,
              (SELECT count(*)::int FROM post_comments pc WHERE pc.post_id = p.id) AS comment_count,
              ${uid ? sql`EXISTS (SELECT 1 FROM post_likes pl2 WHERE pl2.post_id = p.id AND pl2.user_id = ${uid})` : sql`false`} AS liked_by_me,
              u.id AS author_id, u.name AS author_name, u.avatar AS author_avatar,
              u.profile_role AS author_role, u.farming_category AS author_category
            FROM posts p LEFT JOIN users u ON u.id = p.author_id
            WHERE p.created_at >= now() - make_interval(days => ${days}) AND ${hidden}
              AND coalesce(u.banned, false) = false
          ) t WHERE like_count + comment_count > 0
          ORDER BY like_count + 2 * comment_count DESC, created_at DESC LIMIT 20`),
      ).map((p) => ({
        id: String(p.id),
        content: p.content,
        media: p.media,
        createdAt: p.created_at,
        likeCount: Number(p.like_count),
        commentCount: Number(p.comment_count),
        likedByMe: !!p.liked_by_me,
        author: p.author_id
          ? { id: String(p.author_id), name: p.author_name, avatar: p.author_avatar, profileRole: p.author_role, farmingCategory: p.author_category }
          : null,
      }));

      res.json({ days, hashtags, topics, posts });
    }),
  );

  app.get(
    "/api/users/:id/posts",
    wrap("posts", async (req, res) => {
      const uid = viewerId(req);
      const authorId = String(req.params.id);
      if (uid && uid !== authorId) {
        const blocked = rows(
          await db.execute(sql`SELECT 1 FROM user_relations WHERE kind = 'block'
            AND ((user_id = ${uid} AND target_id = ${authorId}) OR (user_id = ${authorId} AND target_id = ${uid})) LIMIT 1`),
        )[0];
        if (blocked) return res.json([]);
      }
      const r = rows(
        await db.execute(sql`SELECT p.id, p.content, p.media, p.created_at,
            (SELECT count(*)::int FROM post_likes pl WHERE pl.post_id = p.id) AS like_count,
            (SELECT count(*)::int FROM post_comments pc WHERE pc.post_id = p.id) AS comment_count,
            ${uid ? sql`EXISTS (SELECT 1 FROM post_likes pl2 WHERE pl2.post_id = p.id AND pl2.user_id = ${uid})` : sql`false`} AS liked_by_me,
            u.id AS author_id, u.name AS author_name, u.avatar AS author_avatar,
            u.profile_role AS author_role, u.farming_category AS author_category
          FROM posts p JOIN users u ON u.id = p.author_id
          WHERE p.author_id = ${authorId} AND coalesce(u.banned, false) = false
          ORDER BY p.created_at DESC LIMIT 100`),
      );
      res.json(
        r.map((p) => ({
          id: String(p.id),
          content: p.content,
          media: p.media,
          createdAt: p.created_at,
          likeCount: Number(p.like_count),
          commentCount: Number(p.comment_count),
          likedByMe: !!p.liked_by_me,
          author: { id: String(p.author_id), name: p.author_name, avatar: p.author_avatar, profileRole: p.author_role, farmingCategory: p.author_category },
        })),
      );
    }),
  );

  app.get(
    "/api/reviews-summary",
    wrap("ratings", async (req, res) => {
      const ids = String(req.query.ids || "")
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean)
        .slice(0, 300);
      if (!ids.length) return res.json({});
      const r = rows(
        await db.execute(sql`SELECT target_id, avg(rating)::float AS a, count(*)::int AS n FROM item_reviews
          WHERE target_id IN (${sql.join(ids.map((i) => sql`${i}`), sql`, `)}) GROUP BY target_id`),
      );
      const out: Record<string, { average: number; count: number }> = {};
      for (const x of r) out[String(x.target_id)] = { average: Math.round(Number(x.a) * 10) / 10, count: Number(x.n) };
      res.json(out);
    }),
  );
}
