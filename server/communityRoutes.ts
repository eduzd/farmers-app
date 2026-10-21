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
import { eq, and, desc } from "drizzle-orm";

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

router.get("/posts", async (req: Request, res: Response) => {
  if (!db) return res.status(500).json({ error: "Database not available" });

  try {
    const { communityId } = req.query;
    if (!communityId) {
      return res.status(400).json({ error: "communityId required" });
    }

    const result = await db
      .select({
        id: posts.id,
        content: posts.content,
        media: posts.media,
        createdAt: posts.createdAt,
        author: {
          id: users.id,
          name: users.name,
          avatar: users.avatar,
        },
      })
      .from(posts)
      .leftJoin(users, eq(posts.authorId, users.id))
      .where(eq(posts.communityId, communityId as string))
      .orderBy(desc(posts.createdAt))
      .limit(50);

    res.json(result);
  } catch (error) {
    console.error("Get posts error:", error);
    res.status(500).json({ error: "Failed to get posts" });
  }
});

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
  } catch (error) {
    console.error("Create post error:", error);
    res.status(500).json({ error: "Failed to create post" });
  }
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
