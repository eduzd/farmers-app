import { config } from "./config";
import { Router, Request, Response } from "express";
import { db } from "./db";
import { users, verificationCodes, userOAuthProviders, appSettings, communityMembers, userSettings, communities } from "@shared/schema";
import { eq, and, gt, desc, sql } from "drizzle-orm";
import { verifyFirebaseIdToken, FirebaseTokenError } from "./firebaseAuth";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import crypto from "crypto";

const router = Router();
const JWT_SECRET = config.jwtSecret;
const ADMIN_EMAIL = config.adminEmail;

// Auth settings keys
const AUTH_SETTINGS = {
  GOOGLE_CLIENT_ID: "auth_google_client_id",
  GOOGLE_CLIENT_SECRET: "auth_google_client_secret",
  RESEND_API_KEY: "auth_resend_api_key",
  EMAIL_FROM: "auth_email_from",
  EMAIL_VERIFICATION_ENABLED: "auth_email_verification_enabled",
  GOOGLE_AUTH_ENABLED: "auth_google_enabled",
};

// Helper to get auth setting
async function getAuthSetting(key: string): Promise<string | null> {
  if (!db) return null;
  try {
    const result = await db.select().from(appSettings).where(eq(appSettings.key, key)).limit(1);
    return result[0]?.value || null;
  } catch (error) {
    console.error(`Failed to get auth setting ${key}:`, error);
    return null;
  }
}

// Helper to set auth setting
async function setAuthSetting(key: string, value: string, category = "auth"): Promise<boolean> {
  if (!db) return false;
  try {
    const existing = await db.select().from(appSettings).where(eq(appSettings.key, key)).limit(1);
    if (existing.length > 0) {
      await db.update(appSettings).set({ value, updatedAt: new Date() }).where(eq(appSettings.key, key));
    } else {
      await db.insert(appSettings).values({ key, value, category });
    }
    return true;
  } catch (error) {
    console.error(`Failed to set auth setting ${key}:`, error);
    return false;
  }
}

// Generate 6-digit OTP
function generateOTP(): string {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

// Send email using Resend
async function sendVerificationEmail(email: string, code: string): Promise<boolean> {
  const apiKey = await getAuthSetting(AUTH_SETTINGS.RESEND_API_KEY);
  const fromEmail = await getAuthSetting(AUTH_SETTINGS.EMAIL_FROM) || "noreply@example.com";
  
  if (!apiKey) {
    console.log("Resend API key not configured, skipping email");
    return false;
  }

  try {
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        from: fromEmail,
        to: email,
        subject: "Your Verification Code",
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
            <h2 style="color: #16a34a;">Email Verification</h2>
            <p>Your verification code is:</p>
            <div style="background-color: #f0fdf4; border: 2px solid #16a34a; border-radius: 8px; padding: 20px; text-align: center; margin: 20px 0;">
              <span style="font-size: 32px; font-weight: bold; letter-spacing: 8px; color: #16a34a;">${code}</span>
            </div>
            <p style="color: #666;">This code will expire in 10 minutes.</p>
            <p style="color: #999; font-size: 12px;">If you didn't request this code, please ignore this email.</p>
          </div>
        `,
      }),
    });

    if (!response.ok) {
      const error = await response.json();
      console.error("Failed to send email:", error);
      return false;
    }

    return true;
  } catch (error) {
    console.error("Email send error:", error);
    return false;
  }
}

// Middleware to verify JWT token
function authenticateToken(req: Request, res: Response, next: any) {
  const authHeader = req.headers["authorization"];
  const token = authHeader && authHeader.split(" ")[1];

  if (!token) {
    return res.status(401).json({ error: "Access token required" });
  }

  jwt.verify(token, JWT_SECRET, (err: any, decoded: any) => {
    if (err) {
      return res.status(403).json({ error: "Invalid or expired token" });
    }
    (req as any).user = decoded;
    next();
  });
}

// Middleware to check super admin
async function requireSuperAdmin(req: Request, res: Response, next: any) {
  const userId = (req as any).user?.userId;
  if (!userId || !db) {
    return res.status(403).json({ error: "Access denied" });
  }

  try {
    const user = await db.select().from(users).where(eq(users.id, userId)).limit(1);
    if (!user[0]?.isSuperAdmin) {
      return res.status(403).json({ error: "Super admin access required" });
    }
    next();
  } catch (error) {
    res.status(500).json({ error: "Failed to verify admin status" });
  }
}

// ========================================
// PUBLIC AUTH ROUTES
// ========================================

// Signup - Step 1: Register and send OTP
router.post("/signup", async (req, res) => {
  if (config.firebaseProjectId) {
    return res.status(410).json({ error: "Sign-up now uses Firebase. Please update the app.", code: "use_firebase" });
  }
  if (!db) {
    return res.status(500).json({ error: "Database not available" });
  }

  try {
    const { email, password, name, username, communityIds } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: "Email and password are required" });
    }

    // Check if user exists
    const existingUser = await db.select().from(users).where(eq(users.email, email)).limit(1);
    if (existingUser.length > 0) {
      return res.status(400).json({ error: "Email already registered" });
    }

    const existingUsername = await db.select().from(users).where(eq(users.username, username || email.split("@")[0])).limit(1);
    if (existingUsername.length > 0) {
      return res.status(400).json({ error: "Username already taken" });
    }

    // Check if email verification is enabled
    const verificationEnabled = await getAuthSetting(AUTH_SETTINGS.EMAIL_VERIFICATION_ENABLED);
    
    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);

    if (verificationEnabled === "true") {
      // Generate OTP
      const otp = generateOTP();
      const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

      // Delete any existing codes for this email
      await db.delete(verificationCodes).where(eq(verificationCodes.email, email));

      // Save verification code
      await db.insert(verificationCodes).values({
        email,
        code: otp,
        type: "signup",
        expiresAt,
      });

      // Send email
      const emailSent = await sendVerificationEmail(email, otp);

      // Store pending user data in verification record (we'll create user after verification)
      return res.json({
        success: true,
        requiresVerification: true,
        email,
        emailSent,
        message: emailSent 
          ? "Verification code sent to your email" 
          : "Verification required. Code: " + otp, // For testing when email not configured
      });
    }

    // If verification not enabled, create user directly.
    // Nobody proved they own this email, so it never becomes super admin here
    // (otherwise anyone could sign up first with ADMIN_EMAIL).
    const [newUser] = await db.insert(users).values({
      email,
      username: username || email.split("@")[0],
      password: hashedPassword,
      name: name || email.split("@")[0],
      verified: false,
      isSuperAdmin: false,
    }).returning();

    // Add to default community if communityIds provided
    if (communityIds && communityIds.length > 0 && newUser) {
      for (const communityId of communityIds) {
        await db.insert(communityMembers).values({
          communityId,
          userId: newUser.id,
          role: "member",
        }).onConflictDoNothing();
      }

      // Set default community
      await db.insert(userSettings).values({
        userId: newUser.id,
        defaultCommunityId: communityIds[0],
      }).onConflictDoNothing();
    }

    // Generate JWT
    const token = jwt.sign(
      { userId: newUser.id, email: newUser.email },
      JWT_SECRET,
      { expiresIn: "30d" }
    );

    res.json({
      success: true,
      requiresVerification: false,
      token,
      user: {
        id: newUser.id,
        email: newUser.email,
        name: newUser.name,
        avatar: newUser.avatar,
        isSuperAdmin: newUser.isSuperAdmin,
      },
    });
  } catch (error: any) {
    console.error("Signup error:", error);
    res.status(500).json({ error: error.message || "Signup failed" });
  }
});

// Signup - Step 2: Verify OTP and complete registration
router.post("/verify-otp", async (req, res) => {
  if (config.firebaseProjectId) {
    return res.status(410).json({ error: "Sign-up now uses Firebase. Please update the app.", code: "use_firebase" });
  }
  if (!db) {
    return res.status(500).json({ error: "Database not available" });
  }

  try {
    const { email, code, password, name, username, communityIds } = req.body;

    if (!email || !code) {
      return res.status(400).json({ error: "Email and code are required" });
    }

    // Find valid verification code
    const [verification] = await db
      .select()
      .from(verificationCodes)
      .where(
        and(
          eq(verificationCodes.email, email),
          eq(verificationCodes.type, "signup"),
          eq(verificationCodes.verified, false),
          gt(verificationCodes.expiresAt, new Date())
        )
      )
      .orderBy(desc(verificationCodes.createdAt))
      .limit(1);

    if (!verification) {
      return res.status(400).json({ error: "Invalid or expired verification code" });
    }

    // Check attempts
    if ((verification.attempts || 0) >= 5) {
      return res.status(400).json({ error: "Too many attempts. Please request a new code." });
    }

    // Verify code
    if (verification.code !== code) {
      await db.update(verificationCodes)
        .set({ attempts: (verification.attempts || 0) + 1 })
        .where(eq(verificationCodes.id, verification.id));
      return res.status(400).json({ error: "Invalid verification code" });
    }

    // Mark as verified
    await db.update(verificationCodes)
      .set({ verified: true })
      .where(eq(verificationCodes.id, verification.id));

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);

    // Check if this is admin email
    const isAdminEmail = !!ADMIN_EMAIL && email.toLowerCase() === ADMIN_EMAIL.toLowerCase();

    // Create user
    const [newUser] = await db.insert(users).values({
      email,
      username: username || email.split("@")[0],
      password: hashedPassword,
      name: name || email.split("@")[0],
      verified: true,
      isSuperAdmin: isAdminEmail,
    }).returning();

    // Add to communities
    if (communityIds && communityIds.length > 0 && newUser) {
      for (const communityId of communityIds) {
        await db.insert(communityMembers).values({
          communityId,
          userId: newUser.id,
          role: "member",
        }).onConflictDoNothing();
      }

      await db.insert(userSettings).values({
        userId: newUser.id,
        defaultCommunityId: communityIds[0],
      }).onConflictDoNothing();
    }

    // Generate JWT
    const token = jwt.sign(
      { userId: newUser.id, email: newUser.email },
      JWT_SECRET,
      { expiresIn: "30d" }
    );

    res.json({
      success: true,
      token,
      user: {
        id: newUser.id,
        email: newUser.email,
        name: newUser.name,
        avatar: newUser.avatar,
        isSuperAdmin: newUser.isSuperAdmin,
      },
    });
  } catch (error: any) {
    console.error("OTP verification error:", error);
    res.status(500).json({ error: error.message || "Verification failed" });
  }
});

// Resend OTP
router.post("/resend-otp", async (req, res) => {
  if (config.firebaseProjectId) {
    return res.status(410).json({ error: "Sign-up now uses Firebase. Please update the app.", code: "use_firebase" });
  }
  if (!db) {
    return res.status(500).json({ error: "Database not available" });
  }

  try {
    const { email, type = "signup" } = req.body;

    if (!email) {
      return res.status(400).json({ error: "Email is required" });
    }

    // Delete old codes
    await db.delete(verificationCodes).where(eq(verificationCodes.email, email));

    // Generate new OTP
    const otp = generateOTP();
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000);

    await db.insert(verificationCodes).values({
      email,
      code: otp,
      type,
      expiresAt,
    });

    const emailSent = await sendVerificationEmail(email, otp);

    res.json({
      success: true,
      emailSent,
      message: emailSent 
        ? "New verification code sent" 
        : "Code: " + otp,
    });
  } catch (error: any) {
    console.error("Resend OTP error:", error);
    res.status(500).json({ error: error.message || "Failed to resend code" });
  }
});

// Login
router.post("/login", async (req, res) => {
  if (!db) {
    return res.status(500).json({ error: "Database not available" });
  }

  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: "Email and password are required" });
    }

    // Find user
    const [user] = await db.select().from(users).where(eq(users.email, email)).limit(1);
    if (!user) {
      return res.status(401).json({ error: "Invalid email or password" });
    }

    // Verify password
    const validPassword = await bcrypt.compare(password, user.password);
    if (!validPassword) {
      return res.status(401).json({ error: "Invalid email or password" });
    }

    // Get memberships
    const memberships = await db
      .select({
        id: communities.id,
        slug: communities.slug,
        nameBn: communities.nameBn,
        nameEn: communities.nameEn,
        theme: communities.theme,
        role: communityMembers.role,
      })
      .from(communityMembers)
      .innerJoin(communities, eq(communityMembers.communityId, communities.id))
      .where(eq(communityMembers.userId, user.id));

    // Get default community
    const [settings] = await db
      .select()
      .from(userSettings)
      .where(eq(userSettings.userId, user.id))
      .limit(1);

    // Generate JWT
    const token = jwt.sign(
      { userId: user.id, email: user.email },
      JWT_SECRET,
      { expiresIn: "30d" }
    );

    res.json({
      success: true,
      token,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        avatar: user.avatar,
        isSuperAdmin: user.isSuperAdmin,
      },
      memberships,
      defaultCommunityId: settings?.defaultCommunityId,
    });
  } catch (error: any) {
    console.error("Login error:", error);
    res.status(500).json({ error: error.message || "Login failed" });
  }
});

// Google OAuth login/signup
router.post("/google", async (req, res) => {
  if (!db) {
    return res.status(500).json({ error: "Database not available" });
  }

  try {
    const { idToken, accessToken } = req.body;

    if (!idToken) {
      return res.status(400).json({ error: "Google ID token is required" });
    }

    // Check if Google auth is enabled
    const googleEnabled = await getAuthSetting(AUTH_SETTINGS.GOOGLE_AUTH_ENABLED);
    if (googleEnabled !== "true") {
      return res.status(400).json({ error: "Google authentication is not enabled" });
    }

    const clientId = await getAuthSetting(AUTH_SETTINGS.GOOGLE_CLIENT_ID);
    if (!clientId) {
      return res.status(500).json({ error: "Google OAuth not configured" });
    }

    // Verify Google token
    const googleResponse = await fetch(
      `https://oauth2.googleapis.com/tokeninfo?id_token=${idToken}`
    );

    if (!googleResponse.ok) {
      return res.status(401).json({ error: "Invalid Google token" });
    }

    const googleUser = await googleResponse.json();

    // Verify audience matches our client ID
    if (googleUser.aud !== clientId) {
      return res.status(401).json({ error: "Token not intended for this app" });
    }

    // Only link or create accounts for emails Google has verified.
    if (googleUser.email_verified !== true && googleUser.email_verified !== "true") {
      return res.status(403).json({ error: "Google account email is not verified" });
    }

    const { sub: googleId, email, name, picture } = googleUser;

    // Check if OAuth provider already linked
    const [existingOAuth] = await db
      .select()
      .from(userOAuthProviders)
      .where(
        and(
          eq(userOAuthProviders.provider, "google"),
          eq(userOAuthProviders.providerId, googleId)
        )
      )
      .limit(1);

    let user;

    if (existingOAuth) {
      // User exists, get their data
      [user] = await db.select().from(users).where(eq(users.id, existingOAuth.userId)).limit(1);
    } else {
      // Check if email already exists
      const [existingUser] = await db.select().from(users).where(eq(users.email, email)).limit(1);

      if (existingUser) {
        // Link Google to existing account
        await db.insert(userOAuthProviders).values({
          userId: existingUser.id,
          provider: "google",
          providerId: googleId,
          email,
          name,
          avatar: picture,
          accessToken,
        });
        user = existingUser;
      } else {
        // Create new user
        const randomPassword = crypto.randomBytes(32).toString("hex");
        const hashedPassword = await bcrypt.hash(randomPassword, 10);

        [user] = await db.insert(users).values({
          email,
          username: email.split("@")[0] + "_" + Date.now().toString(36),
          password: hashedPassword,
          name,
          avatar: picture,
          verified: true, // Google verified the email
        }).returning();

        // Link Google provider
        await db.insert(userOAuthProviders).values({
          userId: user.id,
          provider: "google",
          providerId: googleId,
          email,
          name,
          avatar: picture,
          accessToken,
        });

        // Add to default community (farmer)
        const [defaultCommunity] = await db
          .select()
          .from(communities)
          .where(eq(communities.slug, "farmer"))
          .limit(1);

        if (defaultCommunity) {
          await db.insert(communityMembers).values({
            communityId: defaultCommunity.id,
            userId: user.id,
            role: "member",
          }).onConflictDoNothing();

          await db.insert(userSettings).values({
            userId: user.id,
            defaultCommunityId: defaultCommunity.id,
          }).onConflictDoNothing();
        }
      }
    }

    if (!user) {
      return res.status(500).json({ error: "Failed to create or find user" });
    }

    // Get memberships
    const memberships = await db
      .select({
        id: communities.id,
        slug: communities.slug,
        nameBn: communities.nameBn,
        nameEn: communities.nameEn,
        theme: communities.theme,
        role: communityMembers.role,
      })
      .from(communityMembers)
      .innerJoin(communities, eq(communityMembers.communityId, communities.id))
      .where(eq(communityMembers.userId, user.id));

    const [settings] = await db
      .select()
      .from(userSettings)
      .where(eq(userSettings.userId, user.id))
      .limit(1);

    // Generate JWT
    const token = jwt.sign(
      { userId: user.id, email: user.email },
      JWT_SECRET,
      { expiresIn: "30d" }
    );

    res.json({
      success: true,
      token,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        avatar: user.avatar,
        isSuperAdmin: user.isSuperAdmin,
      },
      memberships,
      defaultCommunityId: settings?.defaultCommunityId,
    });
  } catch (error: any) {
    console.error("Google auth error:", error);
    res.status(500).json({ error: error.message || "Google authentication failed" });
  }
});

// ========================================
// FIREBASE SIGN-IN (email/password + Google)
// ========================================
// The app signs in with Firebase, then trades the Firebase ID token for the
// app's own session token here. Every other route keeps using that session
// token, so ownership checks (calculator records, orders, admin) don't change.
//
// Account rules:
// - Only verified emails are accepted (Google emails come verified; email/
//   password accounts must click Firebase's verification link first).
// - A Firebase account is tied to one app account by its Firebase uid.
// - The first time a verified email matches an existing app account, they are
//   linked. If that old account never verified its email, its old password is
//   replaced so whoever registered it without owning the email loses access.
// - Admin rights are never granted to an existing account here; a new account
//   is super admin only when its verified email is ADMIN_EMAIL.
const FIREBASE_PROVIDER = "firebase";

async function sessionPayload(user: typeof users.$inferSelect) {
  const memberships = await db!
    .select({
      id: communities.id,
      slug: communities.slug,
      nameBn: communities.nameBn,
      nameEn: communities.nameEn,
      theme: communities.theme,
      role: communityMembers.role,
    })
    .from(communityMembers)
    .innerJoin(communities, eq(communityMembers.communityId, communities.id))
    .where(eq(communityMembers.userId, user.id));

  const [settings] = await db!
    .select()
    .from(userSettings)
    .where(eq(userSettings.userId, user.id))
    .limit(1);

  const token = jwt.sign({ userId: user.id, email: user.email }, JWT_SECRET, { expiresIn: "30d" });

  return {
    success: true,
    token,
    user: {
      id: user.id,
      email: user.email,
      name: user.name,
      avatar: user.avatar,
      username: user.username,
      isSuperAdmin: user.isSuperAdmin,
    },
    memberships,
    defaultCommunityId: settings?.defaultCommunityId,
  };
}

async function uniqueUsername(email: string): Promise<string> {
  const base = (email.split("@")[0] || "user").toLowerCase().replace(/[^a-z0-9_.]/g, "").slice(0, 20) || "user";
  const [taken] = await db!.select({ id: users.id }).from(users).where(eq(users.username, base)).limit(1);
  if (!taken) return base;
  return `${base}_${crypto.randomBytes(3).toString("hex")}`;
}

async function findUserByEmail(email: string) {
  const [u] = await db!
    .select()
    .from(users)
    .where(sql`lower(${users.email}) = ${email.toLowerCase()}`)
    .limit(1);
  return u;
}

router.post("/firebase", async (req, res) => {
  if (!db) {
    return res.status(500).json({ error: "Database not available" });
  }
  if (!config.firebaseProjectId) {
    return res.status(400).json({ error: "Firebase sign-in is not enabled" });
  }

  let identity;
  try {
    identity = await verifyFirebaseIdToken(req.body?.idToken);
  } catch (error: any) {
    if (error instanceof FirebaseTokenError) {
      return res.status(401).json({ error: error.message, code: "invalid_token" });
    }
    console.error("Firebase token check failed:", error);
    return res.status(503).json({ error: "Couldn't check the sign-in right now. Please try again." });
  }

  if (!identity.email) {
    return res.status(400).json({ error: "This sign-in has no email address", code: "no_email" });
  }
  if (!identity.emailVerified) {
    return res.status(403).json({
      error: "Please verify your email first. Check your inbox for the link.",
      code: "email_not_verified",
    });
  }

  const email = identity.email;
  const displayName = typeof req.body?.name === "string" ? req.body.name.trim().slice(0, 80) : "";

  try {
    let isNewUser = false;
    let user: typeof users.$inferSelect | undefined;

    const [link] = await db
      .select()
      .from(userOAuthProviders)
      .where(and(eq(userOAuthProviders.provider, FIREBASE_PROVIDER), eq(userOAuthProviders.providerId, identity.uid)))
      .limit(1);

    if (link) {
      [user] = await db.select().from(users).where(eq(users.id, link.userId)).limit(1);
    }

    if (!user) {
      const existing = await findUserByEmail(email);
      if (existing) {
        if (!existing.verified) {
          // Nobody had proved they own this email. The verified owner takes it
          // over and the old, unproven password stops working.
          const freshPassword = await bcrypt.hash(crypto.randomBytes(32).toString("hex"), 10);
          await db.update(users).set({ verified: true, password: freshPassword }).where(eq(users.id, existing.id));
          existing.verified = true;
        }
        user = existing;
      } else {
        const isAdminEmail = !!ADMIN_EMAIL && email === ADMIN_EMAIL.toLowerCase();
        const randomPassword = await bcrypt.hash(crypto.randomBytes(32).toString("hex"), 10);
        try {
          [user] = await db
            .insert(users)
            .values({
              email,
              username: await uniqueUsername(email),
              password: randomPassword,
              name: displayName || identity.name || email.split("@")[0],
              avatar: identity.picture,
              verified: true,
              isSuperAdmin: isAdminEmail,
            })
            .returning();
          isNewUser = true;
        } catch (e) {
          // Two sign-ins racing for the same email: use the row that won.
          user = await findUserByEmail(email);
          if (!user) throw e;
        }

        if (isNewUser && user) {
          const [defaultCommunity] = await db.select().from(communities).where(eq(communities.slug, "farmer")).limit(1);
          if (defaultCommunity) {
            await db.insert(communityMembers).values({ communityId: defaultCommunity.id, userId: user.id, role: "member" }).onConflictDoNothing();
            await db.insert(userSettings).values({ userId: user.id, defaultCommunityId: defaultCommunity.id }).onConflictDoNothing();
          }
        }
      }

      if (!user) {
        return res.status(500).json({ error: "Failed to create or find user" });
      }

      await db.insert(userOAuthProviders).values({
        userId: user.id,
        provider: FIREBASE_PROVIDER,
        providerId: identity.uid,
        email,
        name: identity.name,
        avatar: identity.picture,
      });
    }

    if (!user) {
      return res.status(500).json({ error: "Failed to create or find user" });
    }

    res.json({ ...(await sessionPayload(user)), isNewUser });
  } catch (error: any) {
    console.error("Firebase sign-in error:", error);
    res.status(500).json({ error: "Sign-in failed. Please try again." });
  }
});

// Get current user info
router.get("/me", authenticateToken, async (req, res) => {
  if (!db) {
    return res.status(500).json({ error: "Database not available" });
  }

  try {
    const userId = (req as any).user?.userId;
    const [user] = await db.select().from(users).where(eq(users.id, userId)).limit(1);

    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    const memberships = await db
      .select({
        id: communities.id,
        slug: communities.slug,
        nameBn: communities.nameBn,
        nameEn: communities.nameEn,
        theme: communities.theme,
        role: communityMembers.role,
      })
      .from(communityMembers)
      .innerJoin(communities, eq(communityMembers.communityId, communities.id))
      .where(eq(communityMembers.userId, user.id));

    const [settings] = await db
      .select()
      .from(userSettings)
      .where(eq(userSettings.userId, user.id))
      .limit(1);

    res.json({
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        avatar: user.avatar,
        isSuperAdmin: user.isSuperAdmin,
      },
      memberships,
      defaultCommunityId: settings?.defaultCommunityId,
    });
  } catch (error: any) {
    console.error("Get me error:", error);
    res.status(500).json({ error: error.message || "Failed to get user info" });
  }
});

// Get auth configuration status (public)
router.get("/config", async (req, res) => {
  try {
    const googleEnabled = await getAuthSetting(AUTH_SETTINGS.GOOGLE_AUTH_ENABLED);
    const emailVerificationEnabled = await getAuthSetting(AUTH_SETTINGS.EMAIL_VERIFICATION_ENABLED);
    const googleClientId = await getAuthSetting(AUTH_SETTINGS.GOOGLE_CLIENT_ID);

    res.json({
      firebaseEnabled: !!config.firebaseProjectId,
      googleAuthEnabled: googleEnabled === "true" && !!googleClientId,
      emailVerificationEnabled: emailVerificationEnabled === "true",
      googleClientId: googleEnabled === "true" ? googleClientId : null,
    });
  } catch (error: any) {
    console.error("Get auth config error:", error);
    res.status(500).json({ error: "Failed to get auth config" });
  }
});

// ========================================
// ADMIN AUTH SETTINGS ROUTES
// ========================================

// Get all auth settings (admin only)
router.get("/admin/settings", authenticateToken, requireSuperAdmin, async (req, res) => {
  try {
    const googleClientId = await getAuthSetting(AUTH_SETTINGS.GOOGLE_CLIENT_ID);
    const googleClientSecret = await getAuthSetting(AUTH_SETTINGS.GOOGLE_CLIENT_SECRET);
    const resendApiKey = await getAuthSetting(AUTH_SETTINGS.RESEND_API_KEY);
    const emailFrom = await getAuthSetting(AUTH_SETTINGS.EMAIL_FROM);
    const emailVerificationEnabled = await getAuthSetting(AUTH_SETTINGS.EMAIL_VERIFICATION_ENABLED);
    const googleAuthEnabled = await getAuthSetting(AUTH_SETTINGS.GOOGLE_AUTH_ENABLED);

    res.json({
      google: {
        enabled: googleAuthEnabled === "true",
        clientId: googleClientId ? "***" + googleClientId.slice(-8) : null,
        clientSecretSet: !!googleClientSecret,
      },
      email: {
        verificationEnabled: emailVerificationEnabled === "true",
        resendApiKeySet: !!resendApiKey,
        fromAddress: emailFrom,
      },
    });
  } catch (error: any) {
    console.error("Get admin settings error:", error);
    res.status(500).json({ error: "Failed to get settings" });
  }
});

// Update Google OAuth settings
router.post("/admin/settings/google", authenticateToken, requireSuperAdmin, async (req, res) => {
  try {
    const { clientId, clientSecret, enabled } = req.body;

    if (clientId !== undefined) {
      await setAuthSetting(AUTH_SETTINGS.GOOGLE_CLIENT_ID, clientId);
    }
    if (clientSecret !== undefined) {
      await setAuthSetting(AUTH_SETTINGS.GOOGLE_CLIENT_SECRET, clientSecret);
    }
    if (enabled !== undefined) {
      await setAuthSetting(AUTH_SETTINGS.GOOGLE_AUTH_ENABLED, enabled ? "true" : "false");
    }

    res.json({ success: true, message: "Google settings updated" });
  } catch (error: any) {
    console.error("Update Google settings error:", error);
    res.status(500).json({ error: "Failed to update Google settings" });
  }
});

// Update Email verification settings
router.post("/admin/settings/email", authenticateToken, requireSuperAdmin, async (req, res) => {
  try {
    const { resendApiKey, fromAddress, verificationEnabled } = req.body;

    if (resendApiKey !== undefined) {
      await setAuthSetting(AUTH_SETTINGS.RESEND_API_KEY, resendApiKey);
    }
    if (fromAddress !== undefined) {
      await setAuthSetting(AUTH_SETTINGS.EMAIL_FROM, fromAddress);
    }
    if (verificationEnabled !== undefined) {
      await setAuthSetting(AUTH_SETTINGS.EMAIL_VERIFICATION_ENABLED, verificationEnabled ? "true" : "false");
    }

    res.json({ success: true, message: "Email settings updated" });
  } catch (error: any) {
    console.error("Update email settings error:", error);
    res.status(500).json({ error: "Failed to update email settings" });
  }
});

// Test email configuration
router.post("/admin/settings/test-email", authenticateToken, requireSuperAdmin, async (req, res) => {
  try {
    const { testEmail } = req.body;

    if (!testEmail) {
      return res.status(400).json({ error: "Test email address required" });
    }

    const testCode = "123456";
    const sent = await sendVerificationEmail(testEmail, testCode);

    if (sent) {
      res.json({ success: true, message: "Test email sent successfully" });
    } else {
      res.status(400).json({ error: "Failed to send test email. Check your Resend API key." });
    }
  } catch (error: any) {
    console.error("Test email error:", error);
    res.status(500).json({ error: "Failed to send test email" });
  }
});

export default router;
