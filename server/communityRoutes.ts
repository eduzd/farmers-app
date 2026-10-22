import { config } from "./config";
import { Router, Request, Response, NextFunction } from "express";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { db, dbReady } from "./db";
import {
  users,
  communities,
  communityMembers,
  userSettings,
  posts,
  postLikes,
  postComments,
  marketCategories,
  marketItems,
  communityOrders,
  communityTools,
  experts,
  bookings,
  chatThreads,
  chatMembers,
} from "@shared/schema";
import { eq, and, desc, sql, inArray } from "drizzle-orm";
import { notify } from "./featureRoutes";
import { ensureProfileColumns } from "./profileColumns";

const router = Router();
const JWT_SECRET = config.jwtSecret;
const ADMIN_EMAIL = config.adminEmail;
const ADMIN_PASSWORD = config.adminPassword;

// Rate limiting for admin login attempts
const adminLoginAttempts = new Map<string, { count: number; lastAttempt: Date }>();
const MAX_ATTEMPTS = 5;
const LOCKOUT_MINUTES = 15;

interface JwtPayload {
  userId: string;
  email: string;
  isSuperAdmin: boolean;
}

declare global {
  namespace Express {
    interface Request {
      user?: JwtPayload;
    }
  }
}

// Middleware: Require Auth
function requireAuth(req: Request, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  const token = authHeader.split(" ")[1];
  try {
    const decoded = jwt.verify(token, JWT_SECRET) as JwtPayload;
    req.user = decoded;
    next();
  } catch (error) {
    return res.status(401).json({ error: "Invalid token" });
  }
}

/** The signed-in user's id when a valid token was sent, else null (for public reads). */
function optionalUserId(req: Request): string | null {
  const h = req.headers.authorization;
  if (!h || !h.startsWith("Bearer ")) return null;
  try {
    return (jwt.verify(h.split(" ")[1], JWT_SECRET) as JwtPayload).userId || null;
  } catch {
    return null;
  }
}

// Middleware: Require Super Admin
function requireSuperAdmin(req: Request, res: Response, next: NextFunction) {
  if (!req.user?.isSuperAdmin || !ADMIN_EMAIL || req.user.email !== ADMIN_EMAIL) {
    return res.status(403).json({ error: "Access denied. Super admin only." });
  }
  next();
}

// Admin user is created through normal signup process
// When user signs up with ADMIN_EMAIL, they are automatically marked as super admin

// Seed default communities
async function seedCommunities() {
  if (!db) return;

  try {
    const existingCommunities = await db.select().from(communities);
    if (existingCommunities.length > 0) return;

    const defaultCommunities = [
      {
        slug: "farmer",
        nameBn: "কৃষক",
        nameEn: "Farmer",
        theme: {
          light: { primary: "#16a34a", accent: "#22c55e", bg: "#ffffff", text: "#0f172a", card: "#f8fafc", border: "#e2e8f0" },
          dark: { primary: "#22c55e", accent: "#16a34a", bg: "#0b1220", text: "#e5e7eb", card: "#0f172a", border: "#1f2937" },
        },
        modules: {
          home: { showFeed: true, showExperts: true, showQuickTools: true },
          market: { enabled: true, allowedItemTypes: ["product", "service", "tool"] },
          chat: { enabled: true, dm: true, group: true },
          experts: { enabled: true, label_bn: "কৃষি বিশেষজ্ঞ", label_en: "Agri Experts" },
          booking: { enabled: true, mode: "appointment" },
        },
        status: "active",
        visibility: "public",
      },
      {
        slug: "health",
        nameBn: "স্বাস্থ্য",
        nameEn: "Health",
        theme: {
          light: { primary: "#2563eb", accent: "#3b82f6", bg: "#ffffff", text: "#0f172a", card: "#f8fafc", border: "#e2e8f0" },
          dark: { primary: "#3b82f6", accent: "#2563eb", bg: "#0b1220", text: "#e5e7eb", card: "#0f172a", border: "#1f2937" },
        },
        modules: {
          home: { showFeed: true, showExperts: true, showQuickTools: true },
          market: { enabled: true, allowedItemTypes: ["product", "service", "consultation"] },
          chat: { enabled: true, dm: true, group: true },
          experts: { enabled: true, label_bn: "ডাক্তার", label_en: "Doctors" },
          booking: { enabled: true, mode: "appointment" },
        },
        status: "active",
        visibility: "public",
      },
      {
        slug: "land",
        nameBn: "ভূমি",
        nameEn: "Land",
        theme: {
          light: { primary: "#ea580c", accent: "#f97316", bg: "#ffffff", text: "#0f172a", card: "#f8fafc", border: "#e2e8f0" },
          dark: { primary: "#f97316", accent: "#ea580c", bg: "#0b1220", text: "#e5e7eb", card: "#0f172a", border: "#1f2937" },
        },
        modules: {
          home: { showFeed: true, showExperts: true, showQuickTools: true },
          market: { enabled: true, allowedItemTypes: ["service", "document_fee", "consultation"] },
          chat: { enabled: true, dm: true, group: true },
          experts: { enabled: true, label_bn: "আইনজীবী/সার্ভেয়ার", label_en: "Lawyers/Surveyors" },
          booking: { enabled: true, mode: "appointment" },
        },
        status: "active",
        visibility: "public",
      },
    ];

    for (const community of defaultCommunities) {
      await db.insert(communities).values(community);
    }
    console.log("Default communities seeded successfully");
  } catch (error) {
    console.error("Error seeding communities:", error);
  }
}

// Initialize seeding
dbReady.then(seedCommunities);

// ============================================
// AUTH ROUTES
// ============================================

// Signup
router.post("/auth/signup", async (req: Request, res: Response) => {
  if (!db) return res.status(500).json({ error: "Database not available" });
  // New accounts are created through Firebase (verified email or Google),
  // see POST /api/auth/firebase. This old route stays only for when Firebase
  // is switched off with FIREBASE_PROJECT_ID="".
  if (config.firebaseProjectId) {
    return res.status(410).json({ error: "Sign-up now uses Firebase. Please update the app.", code: "use_firebase" });
  }

  try {
    const { email, password, name, username, communityIds } = req.body;

    // Check if user exists
    const existingUser = await db
      .select()
      .from(users)
      .where(eq(users.email, email))
      .limit(1);

    if (existingUser.length > 0) {
      return res.status(400).json({ error: "Email already registered" });
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    
    // Nobody has proved they own this email, so it never becomes super admin
    // here (otherwise anyone could sign up first with ADMIN_EMAIL). A new
    // admin account comes from a verified Firebase sign-in instead.
    const newUser = await db
      .insert(users)
      .values({
        username: username || email.split("@")[0],
        email,
        password: hashedPassword,
        name,
        isSuperAdmin: false,
      })
      .returning();

    const userId = newUser[0].id;
    const userIsSuperAdmin = newUser[0].isSuperAdmin || false;

    // Join communities
    if (communityIds && communityIds.length > 0) {
      for (const communityId of communityIds) {
        await db.insert(communityMembers).values({
          communityId,
          userId,
          role: "member",
          status: "active",
        });
      }

      // Set default community (first selected)
      await db.insert(userSettings).values({
        userId,
        defaultCommunityId: communityIds[0],
      });
    }

    const token = jwt.sign(
      { userId, email, isSuperAdmin: userIsSuperAdmin },
      JWT_SECRET,
      { expiresIn: "7d" }
    );

    res.status(201).json({
      token,
      user: {
        id: userId,
        email,
        name,
        isSuperAdmin: userIsSuperAdmin,
      },
    });
  } catch (error) {
    console.error("Signup error:", error);
    res.status(500).json({ error: "Signup failed" });
  }
});

// Login
router.post("/auth/login", async (req: Request, res: Response) => {
  if (!db) return res.status(500).json({ error: "Database not available" });

  try {
    const { email, password } = req.body;

    // Rate limiting for admin email
    if (ADMIN_EMAIL && email === ADMIN_EMAIL) {
      const attempts = adminLoginAttempts.get(email);
      if (attempts) {
        const timeSinceLastAttempt = Date.now() - attempts.lastAttempt.getTime();
        if (attempts.count >= MAX_ATTEMPTS && timeSinceLastAttempt < LOCKOUT_MINUTES * 60 * 1000) {
          return res.status(429).json({
            error: `Too many login attempts. Please try again in ${Math.ceil((LOCKOUT_MINUTES * 60 * 1000 - timeSinceLastAttempt) / 60000)} minutes.`,
          });
        }
        if (timeSinceLastAttempt > LOCKOUT_MINUTES * 60 * 1000) {
          adminLoginAttempts.delete(email);
        }
      }
    }

    const user = await db
      .select()
      .from(users)
      .where(eq(users.email, email))
      .limit(1);

    if (user.length === 0) {
      return res.status(401).json({ error: "Invalid email or password" });
    }

    const isValidPassword = await bcrypt.compare(password, user[0].password);
    if (!isValidPassword) {
      // Track failed attempts for admin
      if (ADMIN_EMAIL && email === ADMIN_EMAIL) {
        const attempts = adminLoginAttempts.get(email) || { count: 0, lastAttempt: new Date() };
        attempts.count += 1;
        attempts.lastAttempt = new Date();
        adminLoginAttempts.set(email, attempts);
      }
      return res.status(401).json({ error: "Invalid email or password" });
    }

    // Clear failed attempts on successful login
    if (ADMIN_EMAIL && email === ADMIN_EMAIL) {
      adminLoginAttempts.delete(email);
    }

    const token = jwt.sign(
      {
        userId: user[0].id,
        email: user[0].email,
        isSuperAdmin: user[0].isSuperAdmin || false,
      },
      JWT_SECRET,
      { expiresIn: "7d" }
    );

    // Get user memberships
    const memberships = await db
      .select()
      .from(communityMembers)
      .where(eq(communityMembers.userId, user[0].id));

    const settings = await db
      .select()
      .from(userSettings)
      .where(eq(userSettings.userId, user[0].id))
      .limit(1);

    res.json({
      token,
      user: {
        id: user[0].id,
        email: user[0].email,
        name: user[0].name,
        avatar: user[0].avatar,
        isSuperAdmin: user[0].isSuperAdmin || false,
      },
      memberships,
      defaultCommunityId: settings[0]?.defaultCommunityId,
    });
  } catch (error) {
    console.error("Login error:", error);
    res.status(500).json({ error: "Login failed" });
  }
});

// Get current user
router.get("/me", requireAuth, async (req: Request, res: Response) => {
  if (!db) return res.status(500).json({ error: "Database not available" });

  try {
    const user = await db
      .select()
      .from(users)
      .where(eq(users.id, req.user!.userId))
      .limit(1);

    if (user.length === 0) {
      return res.status(404).json({ error: "User not found" });
    }

    const memberships = await db
      .select({
        communityId: communityMembers.communityId,
        role: communityMembers.role,
        status: communityMembers.status,
        community: communities,
      })
      .from(communityMembers)
      .leftJoin(communities, eq(communityMembers.communityId, communities.id))
      .where(eq(communityMembers.userId, user[0].id));

    const settings = await db
      .select()
      .from(userSettings)
      .where(eq(userSettings.userId, user[0].id))
      .limit(1);

    res.json({
      user: {
        id: user[0].id,
        email: user[0].email,
        name: user[0].name,
        avatar: user[0].avatar,
        isSuperAdmin: user[0].isSuperAdmin || false,
      },
      memberships,
      defaultCommunityId: settings[0]?.defaultCommunityId,
    });
  } catch (error) {
    console.error("Get me error:", error);
    res.status(500).json({ error: "Failed to get user" });
  }
});

// ============================================
// COMMUNITY ROUTES
// ============================================

// Get all public communities
router.get("/communities", async (req: Request, res: Response) => {
  if (!db) return res.status(500).json({ error: "Database not available" });

  try {
    const result = await db
      .select()
      .from(communities)
      .where(eq(communities.status, "active"));
    res.json(result);
  } catch (error) {
    console.error("Get communities error:", error);
    res.status(500).json({ error: "Failed to get communities" });
  }
});

// Join community
router.post("/communities/:id/join", requireAuth, async (req: Request, res: Response) => {
  if (!db) return res.status(500).json({ error: "Database not available" });

  try {
    const { id } = req.params;
    const userId = req.user!.userId;

    // Check if already a member
    const existing = await db
      .select()
      .from(communityMembers)
      .where(and(
        eq(communityMembers.communityId, id),
        eq(communityMembers.userId, userId)
      ))
      .limit(1);

    if (existing.length > 0) {
      return res.status(400).json({ error: "Already a member" });
    }

    await db.insert(communityMembers).values({
      communityId: id,
      userId,
      role: "member",
      status: "active",
    });

    res.json({ success: true });
  } catch (error) {
    console.error("Join community error:", error);
    res.status(500).json({ error: "Failed to join community" });
  }
});

// Leave community
router.post("/communities/:id/leave", requireAuth, async (req: Request, res: Response) => {
  if (!db) return res.status(500).json({ error: "Database not available" });

  try {
    const { id } = req.params;
    const userId = req.user!.userId;

    await db
      .delete(communityMembers)
      .where(and(
        eq(communityMembers.communityId, id),
        eq(communityMembers.userId, userId)
      ));

    res.json({ success: true });
  } catch (error) {
    console.error("Leave community error:", error);
    res.status(500).json({ error: "Failed to leave community" });
  }
});

// ============================================
// POSTS (Community scoped)
// ============================================

// Posts with real like and comment counts, and the author's profile badge.
function postSelect(uid: string | null) {
  return {
    id: posts.id,
    content: posts.content,
    media: posts.media,
    createdAt: posts.createdAt,
    commentCount: sql<number>`(SELECT count(*)::int FROM post_comments pc WHERE pc.post_id = ${posts.id})`,
    likeCount: sql<number>`(SELECT count(*)::int FROM post_likes pl WHERE pl.post_id = ${posts.id})`,
    likedByMe: uid
      ? sql<boolean>`EXISTS (SELECT 1 FROM post_likes pl2 WHERE pl2.post_id = ${posts.id} AND pl2.user_id = ${uid})`
      : sql<boolean>`false`,
    savedByMe: uid
      ? sql<boolean>`EXISTS (SELECT 1 FROM post_saves ps WHERE ps.post_id = ${posts.id} AND ps.user_id = ${uid})`
      : sql<boolean>`false`,
    author: {
      id: users.id,
      name: users.name,
      avatar: users.avatar,
      profileRole: sql<string | null>`${users}.profile_role`,
      farmingCategory: sql<string | null>`${users}.farming_category`,
    },
  };
}

router.get("/posts", async (req: Request, res: Response) => {
  if (!db) return res.status(500).json({ error: "Database not available" });

  try {
    const { communityId } = req.query;
    if (!communityId) {
      return res.status(400).json({ error: "communityId required" });
    }
    await ensureProfileColumns();
    const uid = optionalUserId(req);
    if (uid) await Promise.all([ensureRelations(), ensureSaves()]);
    // Signed in: leave out people you muted or blocked, and people who blocked you.
    const hidden = uid
      ? sql`NOT EXISTS (SELECT 1 FROM user_relations ur WHERE
          (ur.user_id = ${uid} AND ur.target_id = ${posts.authorId} AND ur.kind IN ('mute', 'block'))
          OR (ur.user_id = ${posts.authorId} AND ur.target_id = ${uid} AND ur.kind = 'block'))`
      : sql`TRUE`;

    const result = await db
      .select(postSelect(uid))
      .from(posts)
      .leftJoin(users, eq(posts.authorId, users.id))
      .where(and(eq(posts.communityId, communityId as string), hidden))
      .orderBy(desc(posts.createdAt))
      .limit(50);

    res.json(result);
  } catch (error) {
    console.error("Get posts error:", error);
    res.status(500).json({ error: "Failed to get posts" });
  }
});

// One post (opening a like/comment notification).
router.get("/posts/:id", async (req: Request, res: Response) => {
  if (!db) return res.status(500).json({ error: "Database not available" });
  try {
    await ensureProfileColumns();
    await ensureSaves();
    const result = await db
      .select(postSelect(optionalUserId(req)))
      .from(posts)
      .leftJoin(users, eq(posts.authorId, users.id))
      .where(eq(posts.id, req.params.id))
      .limit(1);
    if (!result[0]) return res.status(404).json({ error: "This post was removed" });
    res.json(result[0]);
  } catch (error) {
    console.error("Get post error:", error);
    res.status(500).json({ error: "Failed to get post" });
  }
});

// POST /api/posts/:id/like { liked: boolean }  (signed in). The author gets a notification
// the first time someone likes their post (not for their own likes, and at most once an hour
// per person per post, so like/unlike tapping doesn't spam them).
const recentLikeNotices = new Map<string, number>();
router.post("/posts/:id/like", requireAuth, async (req: Request, res: Response) => {
  if (!db) return res.status(500).json({ error: "Database not available" });
  try {
    await ensureProfileColumns();
    const uid = req.user!.userId;
    const post = rowsOf(await db.execute(sql`SELECT id, author_id, content FROM posts WHERE id = ${req.params.id} LIMIT 1`))[0];
    if (!post) return res.status(404).json({ error: "This post was removed" });
    const liked = req.body?.liked !== false;
    if (liked) {
      const ins = rowsOf(
        await db.execute(sql`INSERT INTO post_likes (post_id, user_id) VALUES (${post.id}, ${uid})
          ON CONFLICT DO NOTHING RETURNING post_id`),
      );
      const key = `${post.id}:${uid}`;
      const last = recentLikeNotices.get(key) || 0;
      if (ins.length && post.author_id && post.author_id !== uid && Date.now() - last > 60 * 60 * 1000) {
        recentLikeNotices.set(key, Date.now());
        if (recentLikeNotices.size > 5000) recentLikeNotices.clear();
        const u = rowsOf(await db.execute(sql`SELECT name, username FROM users WHERE id = ${uid} LIMIT 1`))[0] || {};
        const who = u.name || u.username || "Someone";
        const snippet = String(post.content || "").trim().slice(0, 140) || "Your post";
        void notify(post.author_id, "like", `${who} liked your post`, snippet, { postId: post.id });
      }
    } else {
      await db.execute(sql`DELETE FROM post_likes WHERE post_id = ${post.id} AND user_id = ${uid}`);
    }
    const c = rowsOf(await db.execute(sql`SELECT count(*)::int AS n FROM post_likes WHERE post_id = ${post.id}`))[0];
    res.json({ liked, likes: Number(c?.n || 0) });
  } catch (error) {
    console.error("Like post error:", error);
    res.status(500).json({ error: "Couldn't save your like" });
  }
});

/**
 * Tell everyone who follows the author that they posted (in-app notification + push).
 * Followers who muted or blocked the author, or whom the author blocked, are skipped.
 * Runs after the reply is sent so posting stays fast.
 */
async function notifyFollowersOfPost(authorId: string, post: any) {
  try {
    if (!post?.id) return;
    await ensureRelations().catch(() => {});
    const author = rowsOf(await db.execute(sql`SELECT name, username FROM users WHERE id = ${authorId} LIMIT 1`))[0];
    const who = author?.name || author?.username || "Someone you follow";
    const text = String(post.content || "").replace(/\s+/g, " ").trim();
    const body = text ? text.slice(0, 140) : "Shared a new post";
    let followers: any[] = [];
    try {
      followers = rowsOf(await db.execute(sql`
        SELECT f.follower_id AS id FROM follows f
        WHERE f.followee_id = ${authorId} AND f.follower_id <> ${authorId}
          AND NOT EXISTS (SELECT 1 FROM user_relations ur WHERE
               (ur.user_id = f.follower_id AND ur.target_id = ${authorId} AND ur.kind IN ('mute', 'block'))
            OR (ur.user_id = ${authorId} AND ur.target_id = f.follower_id AND ur.kind = 'block'))
        LIMIT 5000`));
    } catch {
      return; // no follows table yet = nobody follows anyone
    }
    for (const f of followers) {
      await notify(String(f.id), "new_post", `${who} shared a new post`, body, { postId: post.id, userId: authorId });
    }
  } catch (e: any) {
    console.error("[posts] follower notify error:", e?.message || e);
  }
}

router.post("/posts", requireAuth, async (req: Request, res: Response) => {
  if (!db) return res.status(500).json({ error: "Database not available" });

  try {
    const { communityId, content, media } = req.body;
    const userId = req.user!.userId;

    const newPost = await db
      .insert(posts)
      .values({
        communityId,
        authorId: userId,
        content,
        media: media || [],
      })
      .returning();

    res.status(201).json(newPost[0]);
    void notifyFollowersOfPost(userId, newPost[0]);
  } catch (error) {
    console.error("Create post error:", error);
    res.status(500).json({ error: "Failed to create post" });
  }
});

// Comments on shared posts.
//  GET  /api/posts/:id/comments   oldest first
//  POST /api/posts/:id/comments   { body }   (signed in; the comment is in your name)
const rowsOf = (r: any): any[] => (Array.isArray(r) ? r : r?.rows || []);
const isoOf = (v: any) => {
  if (!v) return null;
  if (v instanceof Date) return v.toISOString();
  const s = String(v);
  return new Date(/[zZ]|[+-]\d\d:?\d\d$/.test(s) ? s : s.replace(" ", "T") + "Z").toISOString();
};
function commentOut(c: any) {
  const name = c.name || c.username || "Member";
  return { id: c.id, postId: c.post_id, userId: c.user_id, userName: name, avatar: c.avatar || null, body: c.body || "", createdAt: isoOf(c.created_at) };
}

router.get("/posts/:id/comments", async (req: Request, res: Response) => {
  if (!db) return res.status(500).json({ error: "Database not available" });
  try {
    const r = rowsOf(await db.execute(sql`SELECT c.id, c.post_id, c.user_id, c.body, c.created_at, u.name, u.username, u.avatar
      FROM post_comments c LEFT JOIN users u ON u.id = c.user_id
      WHERE c.post_id = ${req.params.id} ORDER BY c.created_at ASC LIMIT 500`));
    res.json(r.map(commentOut));
  } catch (error) {
    console.error("Get comments error:", error);
    res.status(500).json({ error: "Failed to get comments" });
  }
});

router.post("/posts/:id/comments", requireAuth, async (req: Request, res: Response) => {
  if (!db) return res.status(500).json({ error: "Database not available" });
  try {
    const body = String(req.body?.body ?? "").trim().slice(0, 2000);
    if (!body) return res.status(400).json({ error: "Comment is empty" });
    const uid = req.user!.userId;
    const post = rowsOf(await db.execute(sql`SELECT id, author_id FROM posts WHERE id = ${req.params.id} LIMIT 1`))[0];
    if (!post) return res.status(404).json({ error: "This post was removed" });
    const ins = rowsOf(await db.execute(sql`INSERT INTO post_comments (post_id, user_id, body) VALUES (${post.id}, ${uid}, ${body})
      RETURNING id, post_id, user_id, body, created_at`))[0];
    const u = rowsOf(await db.execute(sql`SELECT name, username, avatar FROM users WHERE id = ${uid} LIMIT 1`))[0] || {};
    const out = commentOut({ ...ins, ...u });
    if (post.author_id && post.author_id !== uid) {
      void notify(post.author_id, "comment", `${out.userName} commented on your post`, body.slice(0, 140), { postId: post.id, commentId: String(ins.id) });
    }
    res.status(201).json(out);
  } catch (error) {
    console.error("Create comment error:", error);
    res.status(500).json({ error: "Failed to add comment" });
  }
});

// Deleting your own post, and reporting someone else's.
//  DELETE /api/posts/:id          (signed in; only the post's author — anyone else gets 403)
//  POST   /api/posts/:id/report   { reason, details? }  (signed in; one report per person per post)
const REPORT_REASONS = new Set(["spam", "harassment", "hate_speech", "violence", "misinformation", "inappropriate", "copyright", "scam", "other"]);
let reportsReady: Promise<void> | null = null;
export function ensurePostReports() {
  if (!reportsReady) {
    reportsReady = (async () => {
      await db.execute(sql`CREATE TABLE IF NOT EXISTS post_reports (
        id varchar PRIMARY KEY DEFAULT gen_random_uuid(),
        post_id varchar NOT NULL,
        reporter_id varchar NOT NULL,
        post_author_id varchar,
        post_excerpt text,
        reason text NOT NULL,
        details text,
        status text NOT NULL DEFAULT 'open',
        created_at timestamp NOT NULL DEFAULT now(),
        UNIQUE (post_id, reporter_id)
      )`);
    })().catch((e) => {
      reportsReady = null;
      throw e;
    });
  }
  return reportsReady;
}

router.delete("/posts/:id", requireAuth, async (req: Request, res: Response) => {
  if (!db) return res.status(500).json({ error: "Database not available" });
  try {
    const uid = req.user!.userId;
    const post = rowsOf(await db.execute(sql`SELECT id, author_id FROM posts WHERE id = ${req.params.id} LIMIT 1`))[0];
    if (!post) return res.status(404).json({ error: "This post was already removed" });
    if (post.author_id !== uid) return res.status(403).json({ error: "You can only delete your own posts" });
    // The author check is repeated in the DELETE itself so it can never remove someone else's post.
    const gone = rowsOf(await db.execute(sql`DELETE FROM posts WHERE id = ${post.id} AND author_id = ${uid} RETURNING id`));
    if (!gone.length) return res.status(403).json({ error: "You can only delete your own posts" });
    res.json({ ok: true, id: post.id });
  } catch (error) {
    console.error("Delete post error:", error);
    res.status(500).json({ error: "Failed to delete post" });
  }
});

// PATCH /api/posts/:id { content }  (signed in; only the post's author)
router.patch("/posts/:id", requireAuth, async (req: Request, res: Response) => {
  if (!db) return res.status(500).json({ error: "Database not available" });
  try {
    const uid = req.user!.userId;
    const content = String(req.body?.content ?? "").trim().slice(0, 5000);
    const post = rowsOf(await db.execute(sql`SELECT id, author_id, media FROM posts WHERE id = ${req.params.id} LIMIT 1`))[0];
    if (!post) return res.status(404).json({ error: "This post was removed" });
    if (post.author_id !== uid) return res.status(403).json({ error: "You can only edit your own posts" });
    const media = Array.isArray(post.media) ? post.media : [];
    if (!content && !media.length) return res.status(400).json({ error: "Post is empty" });
    const out = rowsOf(await db.execute(sql`UPDATE posts SET content = ${content} WHERE id = ${post.id} AND author_id = ${uid} RETURNING id, content`))[0];
    if (!out) return res.status(403).json({ error: "You can only edit your own posts" });
    res.json({ ok: true, id: out.id, content: out.content });
  } catch (error) {
    console.error("Edit post error:", error);
    res.status(500).json({ error: "Failed to edit post" });
  }
});

// Mute and block. Muting hides that person's posts from your feed. Blocking hides posts
// both ways and stops direct messages between you.
//  GET    /api/relations                     -> { muted: string[], blocked: string[] }
//  POST   /api/relations { kind, targetId }  kind = "mute" | "block"
//  DELETE /api/relations/:kind/:targetId
let relationsReady: Promise<void> | null = null;
export function ensureRelations() {
  if (!relationsReady) {
    relationsReady = (async () => {
      await db.execute(sql`CREATE TABLE IF NOT EXISTS user_relations (
        user_id varchar NOT NULL,
        target_id varchar NOT NULL,
        kind text NOT NULL,
        created_at timestamp NOT NULL DEFAULT now(),
        PRIMARY KEY (user_id, target_id, kind)
      )`);
    })().catch((e) => {
      relationsReady = null;
      throw e;
    });
  }
  return relationsReady;
}
/** True when either person has blocked the other. */
export async function isBlockedBetween(a: string, b: string): Promise<boolean> {
  await ensureRelations();
  const r = rowsOf(await db.execute(sql`SELECT 1 FROM user_relations WHERE kind = 'block'
    AND ((user_id = ${a} AND target_id = ${b}) OR (user_id = ${b} AND target_id = ${a})) LIMIT 1`));
  return r.length > 0;
}

router.get("/relations", requireAuth, async (req: Request, res: Response) => {
  if (!db) return res.status(500).json({ error: "Database not available" });
  try {
    await ensureRelations();
    const r = rowsOf(await db.execute(sql`SELECT target_id, kind FROM user_relations WHERE user_id = ${req.user!.userId}`));
    res.json({ muted: r.filter((x) => x.kind === "mute").map((x) => x.target_id), blocked: r.filter((x) => x.kind === "block").map((x) => x.target_id) });
  } catch (error) {
    console.error("Get relations error:", error);
    res.status(500).json({ error: "Failed to load" });
  }
});

router.post("/relations", requireAuth, async (req: Request, res: Response) => {
  if (!db) return res.status(500).json({ error: "Database not available" });
  try {
    const uid = req.user!.userId;
    const kind = String(req.body?.kind ?? "");
    const targetId = String(req.body?.targetId ?? "").trim();
    if (kind !== "mute" && kind !== "block") return res.status(400).json({ error: "kind must be mute or block" });
    if (!targetId || targetId === uid) return res.status(400).json({ error: "Pick someone else" });
    const target = rowsOf(await db.execute(sql`SELECT id FROM users WHERE id = ${targetId} LIMIT 1`))[0];
    if (!target) return res.status(404).json({ error: "User not found" });
    await ensureRelations();
    await db.execute(sql`INSERT INTO user_relations (user_id, target_id, kind) VALUES (${uid}, ${targetId}, ${kind}) ON CONFLICT DO NOTHING`);
    res.status(201).json({ ok: true, kind, targetId });
  } catch (error) {
    console.error("Add relation error:", error);
    res.status(500).json({ error: "Failed to save" });
  }
});

router.delete("/relations/:kind/:targetId", requireAuth, async (req: Request, res: Response) => {
  if (!db) return res.status(500).json({ error: "Database not available" });
  try {
    await ensureRelations();
    await db.execute(sql`DELETE FROM user_relations WHERE user_id = ${req.user!.userId} AND target_id = ${req.params.targetId} AND kind = ${req.params.kind}`);
    res.json({ ok: true });
  } catch (error) {
    console.error("Remove relation error:", error);
    res.status(500).json({ error: "Failed to save" });
  }
});

// Saved posts (shown under Saved posts on your profile).
//  POST /api/posts/:id/save { saved: boolean }  (signed in)
//  GET  /api/me/saved-posts                     newest save first
let savesReady: Promise<void> | null = null;
function ensureSaves() {
  if (!savesReady) {
    savesReady = (async () => {
      await db.execute(sql`CREATE TABLE IF NOT EXISTS post_saves (
        user_id varchar NOT NULL,
        post_id varchar NOT NULL,
        created_at timestamp NOT NULL DEFAULT now(),
        PRIMARY KEY (user_id, post_id)
      )`);
    })().catch((e) => {
      savesReady = null;
      throw e;
    });
  }
  return savesReady;
}

router.post("/posts/:id/save", requireAuth, async (req: Request, res: Response) => {
  if (!db) return res.status(500).json({ error: "Database not available" });
  try {
    const uid = req.user!.userId;
    const saved = req.body?.saved !== false;
    await ensureSaves();
    if (saved) {
      const post = rowsOf(await db.execute(sql`SELECT id FROM posts WHERE id = ${req.params.id} LIMIT 1`))[0];
      if (!post) return res.status(404).json({ error: "This post was removed" });
      await db.execute(sql`INSERT INTO post_saves (user_id, post_id) VALUES (${uid}, ${post.id}) ON CONFLICT DO NOTHING`);
    } else {
      await db.execute(sql`DELETE FROM post_saves WHERE user_id = ${uid} AND post_id = ${req.params.id}`);
    }
    res.json({ ok: true, saved });
  } catch (error) {
    console.error("Save post error:", error);
    res.status(500).json({ error: "Failed to save post" });
  }
});

router.get("/me/saved-posts", requireAuth, async (req: Request, res: Response) => {
  if (!db) return res.status(500).json({ error: "Database not available" });
  try {
    const uid = req.user!.userId;
    await Promise.all([ensureProfileColumns(), ensureSaves(), ensureRelations()]);
    const ids = rowsOf(await db.execute(sql`SELECT post_id FROM post_saves WHERE user_id = ${uid} ORDER BY created_at DESC LIMIT 200`)).map((r) => String(r.post_id));
    if (!ids.length) return res.json([]);
    const result = await db
      .select(postSelect(uid))
      .from(posts)
      .leftJoin(users, eq(posts.authorId, users.id))
      .where(inArray(posts.id, ids));
    const order = new Map(ids.map((id, i) => [id, i]));
    result.sort((x: any, y: any) => (order.get(x.id) ?? 0) - (order.get(y.id) ?? 0));
    res.json(result);
  } catch (error) {
    console.error("Saved posts error:", error);
    res.status(500).json({ error: "Failed to load saved posts" });
  }
});

router.post("/posts/:id/report", requireAuth, async (req: Request, res: Response) => {
  if (!db) return res.status(500).json({ error: "Database not available" });
  try {
    const uid = req.user!.userId;
    const reason = String(req.body?.reason ?? "").trim();
    if (!REPORT_REASONS.has(reason)) return res.status(400).json({ error: "Pick a reason for the report" });
    const details = String(req.body?.details ?? "").trim().slice(0, 1000) || null;
    const post = rowsOf(await db.execute(sql`SELECT id, author_id, content FROM posts WHERE id = ${req.params.id} LIMIT 1`))[0];
    if (!post) return res.status(404).json({ error: "This post was removed" });
    if (post.author_id === uid) return res.status(400).json({ error: "You can't report your own post" });
    await ensurePostReports();
    const ins = rowsOf(await db.execute(sql`INSERT INTO post_reports (post_id, reporter_id, post_author_id, post_excerpt, reason, details)
      VALUES (${post.id}, ${uid}, ${post.author_id}, ${String(post.content || "").slice(0, 280)}, ${reason}, ${details})
      ON CONFLICT (post_id, reporter_id) DO NOTHING RETURNING id`));
    res.status(ins.length ? 201 : 200).json({ ok: true, alreadyReported: !ins.length });
  } catch (error) {
    console.error("Report post error:", error);
    res.status(500).json({ error: "Failed to send report" });
  }
});

// Online presence. The app beats every 30s while it is open and in the foreground, and says
// "away" when it goes to the background or signs out. Someone counts as online only while
// their last beat is under 70s old, so a phone that loses signal or is killed drops off on
// its own. Kept in memory: after a server restart everyone shows offline until their next beat.
//  POST /api/presence/beat  { state: "active" | "away" }  (signed in, your own status only)
//  POST /api/presence/query { ids: string[] } -> { online: string[] }  (signed in)
const PRESENCE_TTL_MS = 70_000;
const lastBeat = new Map<string, number>();
export function isUserPresent(userId: string): boolean {
  const t = lastBeat.get(userId);
  return !!t && Date.now() - t < PRESENCE_TTL_MS;
}
const presenceSweep: any = setInterval(() => {
  const now = Date.now();
  for (const [k, t] of lastBeat) if (now - t >= PRESENCE_TTL_MS) lastBeat.delete(k);
}, 60_000);
presenceSweep.unref?.();

router.post("/presence/beat", requireAuth, (req: Request, res: Response) => {
  const uid = req.user!.userId;
  if (req.body?.state === "away") lastBeat.delete(uid);
  else lastBeat.set(uid, Date.now());
  res.json({ ok: true });
});

// "known" = the ids that are real accounts, so the app can show a gray (offline) dot for them
// and no dot at all for sample people who have no account.
router.post("/presence/query", requireAuth, async (req: Request, res: Response) => {
  const ids: unknown = req.body?.ids;
  if (!Array.isArray(ids)) return res.status(400).json({ error: "ids must be a list" });
  const uniq = [...new Set(ids.filter((x) => typeof x === "string" && x.length > 0 && x.length < 100))].slice(0, 300) as string[];
  let known: string[] = [];
  try {
    if (db && uniq.length) {
      const r: any = await db.execute(sql`SELECT id FROM users WHERE id IN (${sql.join(uniq.map((x) => sql`${x}`), sql`, `)})`);
      known = (Array.isArray(r) ? r : r?.rows || []).map((x: any) => String(x.id));
    }
  } catch {
    known = [];
  }
  const online = uniq.filter(isUserPresent);
  res.json({ online, known: [...new Set([...known, ...online])], ttlMs: PRESENCE_TTL_MS });
});

// ============================================
// MARKET (Community scoped)
// ============================================

router.get("/market/categories", async (req: Request, res: Response) => {
  if (!db) return res.status(500).json({ error: "Database not available" });

  try {
    const { communityId } = req.query;
    if (!communityId) {
      return res.status(400).json({ error: "communityId required" });
    }

    const result = await db
      .select()
      .from(marketCategories)
      .where(eq(marketCategories.communityId, communityId as string))
      .orderBy(marketCategories.sortOrder);

    res.json(result);
  } catch (error) {
    console.error("Get market categories error:", error);
    res.status(500).json({ error: "Failed to get categories" });
  }
});

router.get("/market/items", async (req: Request, res: Response) => {
  if (!db) return res.status(500).json({ error: "Database not available" });

  try {
    const { communityId, categoryId } = req.query;
    if (!communityId) {
      return res.status(400).json({ error: "communityId required" });
    }

    let query = db
      .select({
        id: marketItems.id,
        title: marketItems.title,
        description: marketItems.description,
        price: marketItems.price,
        priceModel: marketItems.priceModel,
        itemType: marketItems.itemType,
        media: marketItems.media,
        stock: marketItems.stock,
        status: marketItems.status,
        seller: {
          id: users.id,
          name: users.name,
          avatar: users.avatar,
        },
      })
      .from(marketItems)
      .leftJoin(users, eq(marketItems.sellerId, users.id))
      .where(eq(marketItems.communityId, communityId as string))
      .orderBy(desc(marketItems.createdAt));

    const result = await query;
    res.json(result);
  } catch (error) {
    console.error("Get market items error:", error);
    res.status(500).json({ error: "Failed to get items" });
  }
});

// ============================================
// TOOLS (Community scoped)
// ============================================

router.get("/tools", async (req: Request, res: Response) => {
  if (!db) return res.status(500).json({ error: "Database not available" });

  try {
    const { communityId } = req.query;
    if (!communityId) {
      return res.status(400).json({ error: "communityId required" });
    }

    const result = await db
      .select()
      .from(communityTools)
      .where(and(
        eq(communityTools.communityId, communityId as string),
        eq(communityTools.status, "active")
      ));

    res.json(result);
  } catch (error) {
    console.error("Get tools error:", error);
    res.status(500).json({ error: "Failed to get tools" });
  }
});

// ============================================
// EXPERTS (Community scoped)
// ============================================

router.get("/experts", async (req: Request, res: Response) => {
  if (!db) return res.status(500).json({ error: "Database not available" });

  try {
    const { communityId } = req.query;
    if (!communityId) {
      return res.status(400).json({ error: "communityId required" });
    }

    const result = await db
      .select()
      .from(experts)
      .where(eq(experts.communityId, communityId as string));

    res.json(result);
  } catch (error) {
    console.error("Get experts error:", error);
    res.status(500).json({ error: "Failed to get experts" });
  }
});

// ============================================
// BOOKINGS (Community scoped)
// ============================================

router.get("/bookings", requireAuth, async (req: Request, res: Response) => {
  if (!db) return res.status(500).json({ error: "Database not available" });

  try {
    const { communityId } = req.query;
    if (!communityId) {
      return res.status(400).json({ error: "communityId required" });
    }

    const userId = req.user!.userId;
    const isSuperAdmin = req.user!.isSuperAdmin;

    let result;
    if (isSuperAdmin) {
      result = await db
        .select()
        .from(bookings)
        .where(eq(bookings.communityId, communityId as string))
        .orderBy(desc(bookings.createdAt));
    } else {
      result = await db
        .select()
        .from(bookings)
        .where(and(
          eq(bookings.communityId, communityId as string),
          eq(bookings.oderId, userId)
        ))
        .orderBy(desc(bookings.createdAt));
    }

    res.json(result);
  } catch (error) {
    console.error("Get bookings error:", error);
    res.status(500).json({ error: "Failed to get bookings" });
  }
});

router.post("/bookings", requireAuth, async (req: Request, res: Response) => {
  if (!db) return res.status(500).json({ error: "Database not available" });

  try {
    const { communityId, expertId, bookingDate, timeSlot, notes } = req.body;
    const userId = req.user!.userId;

    const newBooking = await db
      .insert(bookings)
      .values({
        communityId,
        expertId,
        oderId: userId,
        bookingDate,
        timeSlot,
        notes,
        status: "requested",
      })
      .returning();

    res.status(201).json(newBooking[0]);
  } catch (error) {
    console.error("Create booking error:", error);
    res.status(500).json({ error: "Failed to create booking" });
  }
});

// ============================================
// ADMIN ROUTES (Super Admin Only)
// ============================================

// Create community
router.post("/admin/communities", requireAuth, requireSuperAdmin, async (req: Request, res: Response) => {
  if (!db) return res.status(500).json({ error: "Database not available" });

  try {
    const { slug, nameBn, nameEn, theme, modules, visibility } = req.body;

    const newCommunity = await db
      .insert(communities)
      .values({
        slug,
        nameBn,
        nameEn,
        theme,
        modules: modules || {},
        visibility: visibility || "public",
        status: "active",
      })
      .returning();

    res.status(201).json(newCommunity[0]);
  } catch (error) {
    console.error("Create community error:", error);
    res.status(500).json({ error: "Failed to create community" });
  }
});

// Update community
router.patch("/admin/communities/:id", requireAuth, requireSuperAdmin, async (req: Request, res: Response) => {
  if (!db) return res.status(500).json({ error: "Database not available" });

  try {
    const { id } = req.params;
    const updates = req.body;

    const updated = await db
      .update(communities)
      .set(updates)
      .where(eq(communities.id, id))
      .returning();

    res.json(updated[0]);
  } catch (error) {
    console.error("Update community error:", error);
    res.status(500).json({ error: "Failed to update community" });
  }
});

// Create market category
router.post("/admin/market/categories", requireAuth, requireSuperAdmin, async (req: Request, res: Response) => {
  if (!db) return res.status(500).json({ error: "Database not available" });

  try {
    const { communityId, nameBn, nameEn, sortOrder } = req.body;

    const newCategory = await db
      .insert(marketCategories)
      .values({ communityId, nameBn, nameEn, sortOrder: sortOrder || 0 })
      .returning();

    res.status(201).json(newCategory[0]);
  } catch (error) {
    console.error("Create category error:", error);
    res.status(500).json({ error: "Failed to create category" });
  }
});

// Create market item
router.post("/admin/market/items", requireAuth, requireSuperAdmin, async (req: Request, res: Response) => {
  if (!db) return res.status(500).json({ error: "Database not available" });

  try {
    const { communityId, categoryId, title, description, price, priceModel, itemType, delivery, stock, media } = req.body;

    const newItem = await db
      .insert(marketItems)
      .values({
        communityId,
        categoryId,
        sellerId: req.user!.userId,
        title,
        description,
        price,
        priceModel: priceModel || "fixed",
        itemType: itemType || "product",
        delivery: delivery || "physical",
        stock: stock || 0,
        media: media || [],
        status: "active",
      })
      .returning();

    res.status(201).json(newItem[0]);
  } catch (error) {
    console.error("Create item error:", error);
    res.status(500).json({ error: "Failed to create item" });
  }
});

// Create tool
router.post("/admin/tools", requireAuth, requireSuperAdmin, async (req: Request, res: Response) => {
  if (!db) return res.status(500).json({ error: "Database not available" });

  try {
    const { communityId, titleBn, titleEn, toolType, routeKey, config } = req.body;

    const newTool = await db
      .insert(communityTools)
      .values({
        communityId,
        titleBn,
        titleEn,
        toolType,
        routeKey,
        config: config || {},
        status: "active",
      })
      .returning();

    res.status(201).json(newTool[0]);
  } catch (error) {
    console.error("Create tool error:", error);
    res.status(500).json({ error: "Failed to create tool" });
  }
});

// Create expert
router.post("/admin/experts", requireAuth, requireSuperAdmin, async (req: Request, res: Response) => {
  if (!db) return res.status(500).json({ error: "Database not available" });

  try {
    const { communityId, name, expertise, specialty, phone, address, fee, schedule, verified } = req.body;

    const newExpert = await db
      .insert(experts)
      .values({
        communityId,
        name,
        expertise,
        specialty,
        phone,
        address,
        fee,
        schedule,
        verified: verified || false,
      })
      .returning();

    res.status(201).json(newExpert[0]);
  } catch (error) {
    console.error("Create expert error:", error);
    res.status(500).json({ error: "Failed to create expert" });
  }
});

// Update booking status
router.patch("/admin/bookings/:id", requireAuth, requireSuperAdmin, async (req: Request, res: Response) => {
  if (!db) return res.status(500).json({ error: "Database not available" });

  try {
    const { id } = req.params;
    const { status } = req.body;

    const updated = await db
      .update(bookings)
      .set({ status })
      .where(eq(bookings.id, id))
      .returning();

    res.json(updated[0]);
  } catch (error) {
    console.error("Update booking error:", error);
    res.status(500).json({ error: "Failed to update booking" });
  }
});

export default router;
