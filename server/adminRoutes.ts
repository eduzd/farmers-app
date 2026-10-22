import { config } from "./config";
import { Router, Request, Response, NextFunction } from "express";
import { db } from "./db";
import { admins, apiKeys, apiUsageLogs, appSettings, adminSessions, users, auditLogs, announcements, posts, experts } from "@shared/schema";
import { eq, desc, sql, and, gte, lte, count } from "drizzle-orm";
import { apiKeyManager } from "./services/apiKeyManager";
import { ensurePostReports } from "./communityRoutes";
import crypto from "crypto";
import jwt from "jsonwebtoken";

const JWT_SECRET = config.jwtSecret;

const router = Router();

const hashPassword = (password: string): string => {
  return crypto.createHash("sha256").update(password).digest("hex");
};

const generateToken = (): string => {
  return crypto.randomBytes(32).toString("hex");
};

const adminAuth = async (req: Request, res: Response, next: NextFunction) => {
  const token = req.headers.authorization?.replace("Bearer ", "");
  
  if (!token) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  try {
    const sessions = await db
      .select()
      .from(adminSessions)
      .where(and(
        eq(adminSessions.token, token),
        gte(adminSessions.expiresAt, new Date())
      ))
      .limit(1);

    if (sessions.length === 0) {
      // Not an admin-panel session. If it's a regular app JWT (the in-app super
      // admin dashboard), skip to the matching super-admin route below instead
      // of failing - e.g. GET /users is defined for both.
      try {
        jwt.verify(token, JWT_SECRET);
        return next("route");
      } catch {}
      return res.status(401).json({ error: "Session expired" });
    }

    const admin = await db
      .select()
      .from(admins)
      .where(eq(admins.id, sessions[0].adminId))
      .limit(1);

    if (admin.length === 0 || !admin[0].isActive) {
      return res.status(401).json({ error: "Admin not found or inactive" });
    }

    (req as any).admin = admin[0];
    next();
  } catch (error) {
    console.error("Admin auth error:", error);
    res.status(500).json({ error: "Authentication failed" });
  }
};

router.post("/login", async (req, res) => {
  try {
    const { username, password } = req.body;

    if (!username || !password) {
      return res.status(400).json({ error: "Username and password required" });
    }

    const hashedPassword = hashPassword(password);
    
    const admin = await db
      .select()
      .from(admins)
      .where(and(
        eq(admins.username, username),
        eq(admins.password, hashedPassword),
        eq(admins.isActive, true)
      ))
      .limit(1);

    if (admin.length === 0) {
      return res.status(401).json({ error: "Invalid credentials" });
    }

    const token = generateToken();
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

    await db.insert(adminSessions).values({
      adminId: admin[0].id,
      token,
      expiresAt,
    });

    await db
      .update(admins)
      .set({ lastLogin: new Date() })
      .where(eq(admins.id, admin[0].id));

    res.json({
      token,
      admin: {
        id: admin[0].id,
        username: admin[0].username,
        name: admin[0].name,
        role: admin[0].role,
      },
      expiresAt,
    });
  } catch (error) {
    console.error("Login error:", error);
    res.status(500).json({ error: "Login failed" });
  }
});

router.post("/logout", adminAuth, async (req, res) => {
  try {
    const token = req.headers.authorization?.replace("Bearer ", "");
    
    if (token) {
      await db
        .delete(adminSessions)
        .where(eq(adminSessions.token, token));
    }

    res.json({ success: true });
  } catch (error) {
    console.error("Logout error:", error);
    res.status(500).json({ error: "Logout failed" });
  }
});

router.get("/me", adminAuth, async (req, res) => {
  const admin = (req as any).admin;
  res.json({
    id: admin.id,
    username: admin.username,
    name: admin.name,
    email: admin.email,
    role: admin.role,
    lastLogin: admin.lastLogin,
  });
});

router.get("/dashboard", adminAuth, async (req, res) => {
  try {
    const apiKeyStats = apiKeyManager.getStats();
    
    const userCount = await db
      .select({ count: sql<number>`count(*)` })
      .from(users);

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const todayLogs = await db
      .select({ count: sql<number>`count(*)` })
      .from(apiUsageLogs)
      .where(gte(apiUsageLogs.createdAt, today));

    const successLogs = await db
      .select({ count: sql<number>`count(*)` })
      .from(apiUsageLogs)
      .where(and(
        gte(apiUsageLogs.createdAt, today),
        eq(apiUsageLogs.status, "success")
      ));

    const recentLogs = await db
      .select()
      .from(apiUsageLogs)
      .orderBy(desc(apiUsageLogs.createdAt))
      .limit(10);

    res.json({
      stats: {
        totalUsers: userCount[0]?.count || 0,
        totalApiKeys: apiKeyStats.totalKeys,
        activeApiKeys: apiKeyStats.activeKeys,
        availableApiKeys: apiKeyStats.availableKeys,
        todayApiCalls: todayLogs[0]?.count || 0,
        todaySuccessRate: todayLogs[0]?.count 
          ? Math.round((successLogs[0]?.count || 0) / todayLogs[0].count * 100) 
          : 100,
      },
      apiKeyStats: apiKeyStats.keys,
      recentLogs,
    });
  } catch (error) {
    console.error("Dashboard error:", error);
    res.status(500).json({ error: "Failed to load dashboard" });
  }
});

router.get("/api-keys", adminAuth, async (req, res) => {
  try {
    const keys = await db
      .select({
        id: apiKeys.id,
        name: apiKeys.name,
        provider: apiKeys.provider,
        purpose: apiKeys.purpose,
        priority: apiKeys.priority,
        isActive: apiKeys.isActive,
        dailyLimit: apiKeys.dailyLimit,
        monthlyLimit: apiKeys.monthlyLimit,
        dailyUsage: apiKeys.dailyUsage,
        monthlyUsage: apiKeys.monthlyUsage,
        totalUsage: apiKeys.totalUsage,
        lastUsed: apiKeys.lastUsed,
        errorCount: apiKeys.errorCount,
        lastError: apiKeys.lastError,
        createdAt: apiKeys.createdAt,
      })
      .from(apiKeys)
      .orderBy(apiKeys.priority);

    res.json(keys);
  } catch (error) {
    console.error("Get API keys error:", error);
    res.status(500).json({ error: "Failed to get API keys" });
  }
});

router.post("/api-keys", adminAuth, async (req, res) => {
  try {
    const { name, apiKey, provider, purpose, priority, dailyLimit, monthlyLimit, isActive } = req.body;

    if (!name || !apiKey) {
      return res.status(400).json({ error: "Name and API key required" });
    }

    const [newKey] = await db
      .insert(apiKeys)
      .values({
        name,
        apiKey,
        provider: provider || "google",
        purpose: purpose || "general",
        priority: priority || 1,
        dailyLimit: dailyLimit || 1000,
        monthlyLimit: monthlyLimit || 30000,
        isActive: isActive !== false,
      })
      .returning();

    apiKeyManager.addKey({
      id: newKey.id,
      name: newKey.name,
      apiKey: newKey.apiKey,
      purpose: newKey.purpose || "general",
      priority: newKey.priority || 1,
      isActive: newKey.isActive || true,
      dailyLimit: newKey.dailyLimit || 1000,
      monthlyLimit: newKey.monthlyLimit || 30000,
      dailyUsage: 0,
      monthlyUsage: 0,
      errorCount: 0,
    });

    res.json({
      id: newKey.id,
      name: newKey.name,
      provider: newKey.provider,
      purpose: newKey.purpose,
      priority: newKey.priority,
      isActive: newKey.isActive,
      dailyLimit: newKey.dailyLimit,
      monthlyLimit: newKey.monthlyLimit,
      createdAt: newKey.createdAt,
    });
  } catch (error) {
    console.error("Create API key error:", error);
    res.status(500).json({ error: "Failed to create API key" });
  }
});

router.put("/api-keys/:id", adminAuth, async (req, res) => {
  try {
    const { id } = req.params;
    const { name, apiKey, purpose, priority, dailyLimit, monthlyLimit, isActive } = req.body;

    const updateData: any = { updatedAt: new Date() };
    if (name !== undefined) updateData.name = name;
    if (apiKey !== undefined) updateData.apiKey = apiKey;
    if (purpose !== undefined) updateData.purpose = purpose;
    if (priority !== undefined) updateData.priority = priority;
    if (dailyLimit !== undefined) updateData.dailyLimit = dailyLimit;
    if (monthlyLimit !== undefined) updateData.monthlyLimit = monthlyLimit;
    if (isActive !== undefined) updateData.isActive = isActive;

    const [updated] = await db
      .update(apiKeys)
      .set(updateData)
      .where(eq(apiKeys.id, id))
      .returning();

    if (!updated) {
      return res.status(404).json({ error: "API key not found" });
    }

    apiKeyManager.updateKey(id, {
      name: updated.name,
      apiKey: updated.apiKey,
      purpose: updated.purpose || "general",
      priority: updated.priority || 1,
      isActive: updated.isActive || false,
      dailyLimit: updated.dailyLimit || 1000,
      monthlyLimit: updated.monthlyLimit || 30000,
    });

    res.json({
      id: updated.id,
      name: updated.name,
      purpose: updated.purpose,
      priority: updated.priority,
      isActive: updated.isActive,
      dailyLimit: updated.dailyLimit,
      monthlyLimit: updated.monthlyLimit,
    });
  } catch (error) {
    console.error("Update API key error:", error);
    res.status(500).json({ error: "Failed to update API key" });
  }
});

router.delete("/api-keys/:id", adminAuth, async (req, res) => {
  try {
    const { id } = req.params;

    await db.delete(apiKeys).where(eq(apiKeys.id, id));
    apiKeyManager.removeKey(id);

    res.json({ success: true });
  } catch (error) {
    console.error("Delete API key error:", error);
    res.status(500).json({ error: "Failed to delete API key" });
  }
});

router.post("/api-keys/:id/reset-usage", adminAuth, async (req, res) => {
  try {
    const { id } = req.params;
    const { type } = req.body;

    const updateData: any = { updatedAt: new Date() };
    
    if (type === "daily" || type === "all") {
      updateData.dailyUsage = 0;
      updateData.errorCount = 0;
    }
    if (type === "monthly" || type === "all") {
      updateData.monthlyUsage = 0;
    }

    await db
      .update(apiKeys)
      .set(updateData)
      .where(eq(apiKeys.id, id));

    res.json({ success: true });
  } catch (error) {
    console.error("Reset usage error:", error);
    res.status(500).json({ error: "Failed to reset usage" });
  }
});

router.get("/api-keys/stats", adminAuth, async (req, res) => {
  try {
    const stats = apiKeyManager.getStats();
    res.json(stats);
  } catch (error) {
    console.error("Get stats error:", error);
    res.status(500).json({ error: "Failed to get stats" });
  }
});

router.get("/users", adminAuth, async (req, res) => {
  try {
    const { page = "1", limit = "20", search } = req.query;
    const pageNum = parseInt(page as string);
    const limitNum = parseInt(limit as string);
    const offset = (pageNum - 1) * limitNum;

    let query = db.select().from(users);
    
    const allUsers = await query.limit(limitNum).offset(offset);
    const countResult = await db.select({ count: sql<number>`count(*)` }).from(users);

    res.json({
      users: allUsers.map((u: any) => ({
        id: u.id,
        username: u.username,
        name: u.name,
        email: u.email,
        phone: u.phone,
        role: u.role,
        verified: u.verified,
        createdAt: u.createdAt,
      })),
      total: countResult[0]?.count || 0,
      page: pageNum,
      totalPages: Math.ceil((countResult[0]?.count || 0) / limitNum),
    });
  } catch (error) {
    console.error("Get users error:", error);
    res.status(500).json({ error: "Failed to get users" });
  }
});

router.put("/users/:id", adminAuth, async (req, res) => {
  try {
    const { id } = req.params;
    const { role, verified } = req.body;

    const updateData: any = {};
    if (role !== undefined) updateData.role = role;
    if (verified !== undefined) updateData.verified = verified;

    const [updated] = await db
      .update(users)
      .set(updateData)
      .where(eq(users.id, id))
      .returning();

    if (!updated) {
      return res.status(404).json({ error: "User not found" });
    }

    res.json({
      id: updated.id,
      username: updated.username,
      role: updated.role,
      verified: updated.verified,
    });
  } catch (error) {
    console.error("Update user error:", error);
    res.status(500).json({ error: "Failed to update user" });
  }
});

router.get("/settings", adminAuth, async (req, res) => {
  try {
    const settings = await db.select().from(appSettings);
    
    const settingsMap: Record<string, any> = {};
    settings.forEach((s: any) => {
      settingsMap[s.key] = {
        value: s.value,
        category: s.category,
        description: s.description,
      };
    });

    res.json(settingsMap);
  } catch (error) {
    console.error("Get settings error:", error);
    res.status(500).json({ error: "Failed to get settings" });
  }
});

router.put("/settings/:key", adminAuth, async (req, res) => {
  try {
    const { key } = req.params;
    const { value, category, description } = req.body;
    const admin = (req as any).admin;

    const existing = await db
      .select()
      .from(appSettings)
      .where(eq(appSettings.key, key))
      .limit(1);

    if (existing.length > 0) {
      await db
        .update(appSettings)
        .set({
          value,
          category,
          description,
          updatedBy: admin.id,
          updatedAt: new Date(),
        })
        .where(eq(appSettings.key, key));
    } else {
      await db.insert(appSettings).values({
        key,
        value,
        category,
        description,
        updatedBy: admin.id,
      });
    }

    res.json({ success: true });
  } catch (error) {
    console.error("Update setting error:", error);
    res.status(500).json({ error: "Failed to update setting" });
  }
});

router.get("/logs", adminAuth, async (req, res) => {
  try {
    const { page = "1", limit = "50", status, apiKeyId } = req.query;
    const pageNum = parseInt(page as string);
    const limitNum = parseInt(limit as string);
    const offset = (pageNum - 1) * limitNum;

    let conditions = [];
    if (status) conditions.push(eq(apiUsageLogs.status, status as string));
    if (apiKeyId) conditions.push(eq(apiUsageLogs.apiKeyId, apiKeyId as string));

    const logs = await db
      .select()
      .from(apiUsageLogs)
      .where(conditions.length > 0 ? and(...conditions) : undefined)
      .orderBy(desc(apiUsageLogs.createdAt))
      .limit(limitNum)
      .offset(offset);

    const countResult = await db
      .select({ count: sql<number>`count(*)` })
      .from(apiUsageLogs)
      .where(conditions.length > 0 ? and(...conditions) : undefined);

    res.json({
      logs,
      total: countResult[0]?.count || 0,
      page: pageNum,
      totalPages: Math.ceil((countResult[0]?.count || 0) / limitNum),
    });
  } catch (error) {
    console.error("Get logs error:", error);
    res.status(500).json({ error: "Failed to get logs" });
  }
});

router.post("/setup", async (req, res) => {
  try {
    const existingAdmins = await db.select().from(admins).limit(1);
    
    if (existingAdmins.length > 0) {
      return res.status(400).json({ error: "Admin already exists" });
    }

    const { username, password, name, email } = req.body;

    if (!username || !password) {
      return res.status(400).json({ error: "Username and password required" });
    }

    const hashedPassword = hashPassword(password);

    const [newAdmin] = await db
      .insert(admins)
      .values({
        username,
        password: hashedPassword,
        name: name || "Admin",
        email,
        role: "superadmin",
      })
      .returning();

    res.json({
      success: true,
      message: "Admin created successfully",
      admin: {
        id: newAdmin.id,
        username: newAdmin.username,
        name: newAdmin.name,
        role: newAdmin.role,
      },
    });
  } catch (error) {
    console.error("Setup error:", error);
    res.status(500).json({ error: "Failed to create admin" });
  }
});

router.get("/check-setup", async (req, res) => {
  try {
    const existingAdmins = await db.select().from(admins).limit(1);
    res.json({ needsSetup: existingAdmins.length === 0 });
  } catch (error) {
    res.json({ needsSetup: true });
  }
});

// ===== CONTROL TOWER API ENDPOINTS =====

// Middleware to verify super admin via JWT
const requireSuperAdmin = async (req: Request, res: Response, next: NextFunction) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  const token = authHeader.split(" ")[1];
  try {
    const decoded = jwt.verify(token, JWT_SECRET) as any;
    const user = await db.select().from(users).where(eq(users.id, decoded.userId)).limit(1);
    
    if (!user[0] || !user[0].isSuperAdmin) {
      return res.status(403).json({ error: "Super admin access required" });
    }
    
    (req as any).adminUser = user[0];
    next();
  } catch (error) {
    return res.status(401).json({ error: "Invalid token" });
  }
};

// Helper to log admin actions
async function logAdminAction(adminId: string, adminEmail: string, action: string, targetType: string, targetId?: string, details?: string) {
  try {
    await db.insert(auditLogs).values({
      adminId,
      adminEmail,
      action,
      targetType,
      targetId,
      details,
    });
  } catch (error) {
    console.error("Failed to log admin action:", error);
  }
}

// Dashboard Stats
router.get("/dashboard/stats", requireSuperAdmin, async (req, res) => {
  try {
    const [totalUsersResult] = await db.select({ count: count() }).from(users);
    const [totalPostsResult] = await db.select({ count: count() }).from(posts);
    const [totalExpertsResult] = await db.select({ count: count() }).from(experts);

    // Active users in last 24h - simplified
    const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const [activeUsersResult] = await db.select({ count: count() }).from(users).where(gte(users.createdAt, yesterday));

    res.json({
      totalUsers: totalUsersResult?.count || 0,
      activeUsers24h: activeUsersResult?.count || 0,
      totalPosts: totalPostsResult?.count || 0,
      openReports: await (async () => {
        try {
          await ensurePostReports();
          const r: any = await db.execute(sql`SELECT count(*)::int AS n FROM post_reports WHERE status = 'open'`);
          return (Array.isArray(r) ? r : r?.rows || [])[0]?.n ?? 0;
        } catch {
          return 0;
        }
      })(),
      totalOrders: 0,
      totalExperts: totalExpertsResult?.count || 0,
    });
  } catch (error) {
    console.error("Dashboard stats error:", error);
    res.status(500).json({ error: "Failed to load stats" });
  }
});

// Content moderation: latest posts with author, and delete
router.get("/posts", requireSuperAdmin, async (_req, res) => {
  try {
    const rows = await db
      .select({
        id: posts.id,
        content: posts.content,
        media: posts.media,
        createdAt: posts.createdAt,
        authorId: posts.authorId,
        authorName: users.name,
        authorEmail: users.email,
      })
      .from(posts)
      .leftJoin(users, eq(posts.authorId, users.id))
      .orderBy(desc(posts.createdAt))
      .limit(100);
    res.json(rows);
  } catch (error) {
    console.error("Admin posts error:", error);
    res.status(500).json({ error: "Failed to load posts" });
  }
});

router.delete("/posts/:postId", requireSuperAdmin, async (req, res) => {
  try {
    const { postId } = req.params;
    const adminUser = (req as any).adminUser;
    await db.delete(posts).where(eq(posts.id, postId));
    await logAdminAction(adminUser.id, adminUser.email, "DELETE_POST", "post", postId, "Post removed by admin");
    res.json({ success: true });
  } catch (error) {
    console.error("Admin delete post error:", error);
    res.status(500).json({ error: "Failed to delete post" });
  }
});

// Post reports from users (newest first) and resolving them.
router.get("/reports", requireSuperAdmin, async (_req, res) => {
  try {
    await ensurePostReports();
    const r: any = await db.execute(sql`SELECT r.id, r.post_id, r.reason, r.details, r.status, r.created_at, r.post_excerpt,
        rep.name AS reporter_name, au.name AS author_name,
        (SELECT count(*)::int FROM post_reports x WHERE x.post_id = r.post_id) AS report_count
      FROM post_reports r LEFT JOIN users rep ON rep.id = r.reporter_id LEFT JOIN users au ON au.id = r.post_author_id
      ORDER BY (r.status = 'open') DESC, r.created_at DESC LIMIT 200`);
    res.json(Array.isArray(r) ? r : r?.rows || []);
  } catch (error) {
    console.error("Admin reports error:", error);
    res.status(500).json({ error: "Failed to load reports" });
  }
});

router.post("/reports/:id/resolve", requireSuperAdmin, async (req, res) => {
  try {
    await ensurePostReports();
    const status = req.body?.status === "dismissed" ? "dismissed" : "resolved";
    await db.execute(sql`UPDATE post_reports SET status = ${status} WHERE id = ${req.params.id}`);
    const adminUser = (req as any).adminUser;
    await logAdminAction(adminUser.id, adminUser.email, "RESOLVE_REPORT", "report", req.params.id, status);
    res.json({ success: true });
  } catch (error) {
    console.error("Admin resolve report error:", error);
    res.status(500).json({ error: "Failed to update report" });
  }
});

// Users List
router.get("/users", requireSuperAdmin, async (req, res) => {
  try {
    const allUsers = await db
      .select({
        id: users.id,
        email: users.email,
        name: users.name,
        username: users.username,
        verified: users.verified,
        isSuperAdmin: users.isSuperAdmin,
        createdAt: users.createdAt,
      })
      .from(users)
      .orderBy(desc(users.createdAt))
      .limit(100);

    res.json(allUsers);
  } catch (error) {
    console.error("Users list error:", error);
    res.status(500).json({ error: "Failed to load users" });
  }
});

// Ban User
router.post("/users/:userId/ban", requireSuperAdmin, async (req, res) => {
  try {
    const { userId } = req.params;
    const adminUser = (req as any).adminUser;

    await db.update(users).set({ verified: false }).where(eq(users.id, userId));
    
    await logAdminAction(adminUser.id, adminUser.email, "BAN_USER", "user", userId, "User banned by admin");

    res.json({ success: true });
  } catch (error) {
    console.error("Ban user error:", error);
    res.status(500).json({ error: "Failed to ban user" });
  }
});

// Unban User
router.post("/users/:userId/unban", requireSuperAdmin, async (req, res) => {
  try {
    const { userId } = req.params;
    const adminUser = (req as any).adminUser;

    await db.update(users).set({ verified: true }).where(eq(users.id, userId));
    
    await logAdminAction(adminUser.id, adminUser.email, "UNBAN_USER", "user", userId, "User unbanned by admin");

    res.json({ success: true });
  } catch (error) {
    console.error("Unban user error:", error);
    res.status(500).json({ error: "Failed to unban user" });
  }
});

// Audit Logs
router.get("/audit-logs", requireSuperAdmin, async (req, res) => {
  try {
    const logs = await db
      .select()
      .from(auditLogs)
      .orderBy(desc(auditLogs.createdAt))
      .limit(50);

    res.json(logs);
  } catch (error) {
    console.error("Audit logs error:", error);
    res.status(500).json({ error: "Failed to load audit logs" });
  }
});

// Announcements List
router.get("/announcements", requireSuperAdmin, async (req, res) => {
  try {
    const allAnnouncements = await db
      .select()
      .from(announcements)
      .orderBy(desc(announcements.createdAt))
      .limit(20);

    res.json(allAnnouncements);
  } catch (error) {
    console.error("Announcements error:", error);
    res.status(500).json({ error: "Failed to load announcements" });
  }
});

// Create Announcement
router.post("/announcements", requireSuperAdmin, async (req, res) => {
  try {
    const { title, message, type } = req.body;
    const adminUser = (req as any).adminUser;

    const [newAnnouncement] = await db
      .insert(announcements)
      .values({
        title,
        message,
        type: type || "info",
        createdBy: adminUser.id,
      })
      .returning();

    await logAdminAction(adminUser.id, adminUser.email, "CREATE_ANNOUNCEMENT", "announcement", newAnnouncement.id, title);

    res.json(newAnnouncement);
  } catch (error) {
    console.error("Create announcement error:", error);
    res.status(500).json({ error: "Failed to create announcement" });
  }
});

// App Settings
router.get("/app-settings", requireSuperAdmin, async (req, res) => {
  try {
    const settings = await db.select().from(appSettings);
    
    const settingsMap: Record<string, string> = {};
    settings.forEach((s) => {
      if (s.key && s.value) settingsMap[s.key] = s.value;
    });

    res.json({
      maintenanceMode: settingsMap["maintenance_mode"] === "true",
      maintenanceMessage: settingsMap["maintenance_message"] || "",
      featureFlags: {
        chatEnabled: settingsMap["feature_chat"] !== "false",
        marketplaceEnabled: settingsMap["feature_marketplace"] !== "false",
        commentsEnabled: settingsMap["feature_comments"] !== "false",
        uploadsEnabled: settingsMap["feature_uploads"] !== "false",
      },
    });
  } catch (error) {
    console.error("App settings error:", error);
    res.status(500).json({ error: "Failed to load app settings" });
  }
});

// Update App Settings
router.put("/app-settings", requireSuperAdmin, async (req, res) => {
  try {
    const { maintenanceMode, maintenanceMessage, featureFlags } = req.body;
    const adminUser = (req as any).adminUser;

    const settingsToUpdate = [
      { key: "maintenance_mode", value: String(maintenanceMode) },
      { key: "maintenance_message", value: maintenanceMessage || "" },
      { key: "feature_chat", value: String(featureFlags?.chatEnabled ?? true) },
      { key: "feature_marketplace", value: String(featureFlags?.marketplaceEnabled ?? true) },
      { key: "feature_comments", value: String(featureFlags?.commentsEnabled ?? true) },
      { key: "feature_uploads", value: String(featureFlags?.uploadsEnabled ?? true) },
    ];

    for (const setting of settingsToUpdate) {
      const existing = await db.select().from(appSettings).where(eq(appSettings.key, setting.key)).limit(1);
      if (existing.length > 0) {
        await db.update(appSettings).set({ value: setting.value, updatedAt: new Date() }).where(eq(appSettings.key, setting.key));
      } else {
        await db.insert(appSettings).values({ key: setting.key, value: setting.value, category: "app" });
      }
    }

    await logAdminAction(adminUser.id, adminUser.email, "UPDATE_APP_SETTINGS", "settings", undefined, JSON.stringify({ maintenanceMode, featureFlags }));

    res.json({ success: true });
  } catch (error) {
    console.error("Update app settings error:", error);
    res.status(500).json({ error: "Failed to update app settings" });
  }
});

export default router;
