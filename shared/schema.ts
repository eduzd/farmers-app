import { sql } from "drizzle-orm";
import { pgTable, text, varchar, integer, decimal, boolean, timestamp, jsonb, bigint } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const admins = pgTable("admins", {
  id: varchar("id")
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  username: text("username").notNull().unique(),
  password: text("password").notNull(),
  name: text("name"),
  email: text("email"),
  role: text("role").default("admin"),
  isActive: boolean("is_active").default(true),
  lastLogin: timestamp("last_login"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const apiKeys = pgTable("api_keys", {
  id: varchar("id")
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  provider: text("provider").notNull().default("google"),
  apiKey: text("api_key").notNull(),
  purpose: text("purpose").default("general"),
  priority: integer("priority").default(1),
  isActive: boolean("is_active").default(true),
  dailyLimit: integer("daily_limit").default(1000),
  monthlyLimit: integer("monthly_limit").default(30000),
  dailyUsage: integer("daily_usage").default(0),
  monthlyUsage: integer("monthly_usage").default(0),
  totalUsage: bigint("total_usage", { mode: "number" }).default(0),
  lastUsed: timestamp("last_used"),
  lastReset: timestamp("last_reset").defaultNow(),
  errorCount: integer("error_count").default(0),
  lastError: text("last_error"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const apiUsageLogs = pgTable("api_usage_logs", {
  id: varchar("id")
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  apiKeyId: varchar("api_key_id").references(() => apiKeys.id),
  endpoint: text("endpoint").notNull(),
  status: text("status").notNull(),
  responseTime: integer("response_time"),
  errorMessage: text("error_message"),
  userId: varchar("user_id"),
  metadata: jsonb("metadata").$type<Record<string, any>>(),
  createdAt: timestamp("created_at").defaultNow(),
});

export const appSettings = pgTable("app_settings", {
  id: varchar("id")
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  key: text("key").notNull().unique(),
  value: text("value"),
  category: text("category").default("general"),
  description: text("description"),
  updatedBy: varchar("updated_by").references(() => admins.id),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const adminSessions = pgTable("admin_sessions", {
  id: varchar("id")
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  adminId: varchar("admin_id").references(() => admins.id).notNull(),
  token: text("token").notNull().unique(),
  expiresAt: timestamp("expires_at").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
});

export const users = pgTable("users", {
  id: varchar("id")
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  username: text("username").notNull().unique(),
  password: text("password").notNull(),
  email: text("email").unique(),
  name: text("name"),
  avatar: text("avatar"),
  phone: text("phone"),
  role: text("role").default("user"),
  verified: boolean("verified").default(false),
  isSuperAdmin: boolean("is_super_admin").default(false),
  createdAt: timestamp("created_at").defaultNow(),
});

export const companies = pgTable("companies", {
  id: varchar("id")
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  ownerId: varchar("owner_id").references(() => users.id),
  name: text("name").notNull(),
  slug: text("slug").notNull().unique(),
  initials: text("initials").notNull(),
  description: text("description"),
  category: text("category").notNull(),
  logoUrl: text("logo_url"),
  bannerUrl: text("banner_url"),
  address: text("address"),
  phone: text("phone"),
  email: text("email"),
  website: text("website"),
  businessHours: text("business_hours"),
  verified: boolean("verified").default(false),
  rating: decimal("rating", { precision: 2, scale: 1 }).default("0"),
  ratingCount: integer("rating_count").default(0),
  reviewsCount: integer("reviews_count").default(0),
  productsCount: integer("products_count").default(0),
  followersCount: integer("followers_count").default(0),
  totalSales: integer("total_sales").default(0),
  responseRate: integer("response_rate").default(100),
  shipOnTime: integer("ship_on_time").default(100),
  establishedYear: integer("established_year"),
  returnPolicy: text("return_policy"),
  shippingPolicy: text("shipping_policy"),
  paymentMethods: jsonb("payment_methods").$type<string[]>().default([]),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const products = pgTable("products", {
  id: varchar("id")
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  companyId: varchar("company_id").references(() => companies.id).notNull(),
  name: text("name").notNull(),
  description: text("description"),
  price: decimal("price", { precision: 10, scale: 2 }).notNull(),
  currency: text("currency").default("BDT"),
  unit: text("unit").default("piece"),
  quantity: integer("quantity").default(0),
  category: text("category"),
  images: jsonb("images").$type<string[]>().default([]),
  tags: jsonb("tags").$type<string[]>().default([]),
  status: text("status").default("active"),
  rating: decimal("rating", { precision: 2, scale: 1 }).default("0"),
  reviewsCount: integer("reviews_count").default(0),
  salesCount: integer("sales_count").default(0),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const reviews = pgTable("reviews", {
  id: varchar("id")
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  productId: varchar("product_id").references(() => products.id),
  companyId: varchar("company_id").references(() => companies.id),
  userId: varchar("user_id").references(() => users.id).notNull(),
  rating: integer("rating").notNull(),
  title: text("title"),
  body: text("body"),
  photos: jsonb("photos").$type<string[]>().default([]),
  verified: boolean("verified").default(false),
  helpfulCount: integer("helpful_count").default(0),
  sellerReply: text("seller_reply"),
  sellerReplyDate: timestamp("seller_reply_date"),
  status: text("status").default("active"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const cartItems = pgTable("cart_items", {
  id: varchar("id")
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  userId: varchar("user_id").references(() => users.id).notNull(),
  productId: varchar("product_id").references(() => products.id).notNull(),
  companyId: varchar("company_id").references(() => companies.id).notNull(),
  quantity: integer("quantity").default(1),
  createdAt: timestamp("created_at").defaultNow(),
});

export const orders = pgTable("orders", {
  id: varchar("id")
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  userId: varchar("user_id").references(() => users.id).notNull(),
  companyId: varchar("company_id").references(() => companies.id).notNull(),
  status: text("status").default("pending"),
  subtotal: decimal("subtotal", { precision: 10, scale: 2 }).notNull(),
  shippingFee: decimal("shipping_fee", { precision: 10, scale: 2 }).default("0"),
  total: decimal("total", { precision: 10, scale: 2 }).notNull(),
  currency: text("currency").default("BDT"),
  shippingAddress: jsonb("shipping_address").$type<{
    name: string;
    phone: string;
    address: string;
    city: string;
    notes?: string;
  }>(),
  paymentMethod: text("payment_method"),
  paymentStatus: text("payment_status").default("pending"),
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const orderItems = pgTable("order_items", {
  id: varchar("id")
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  orderId: varchar("order_id").references(() => orders.id).notNull(),
  productId: varchar("product_id").references(() => products.id).notNull(),
  productName: text("product_name").notNull(),
  price: decimal("price", { precision: 10, scale: 2 }).notNull(),
  quantity: integer("quantity").notNull(),
  total: decimal("total", { precision: 10, scale: 2 }).notNull(),
});

export const conversations = pgTable("conversations", {
  id: varchar("id")
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  companyId: varchar("company_id").references(() => companies.id).notNull(),
  userId: varchar("user_id").references(() => users.id).notNull(),
  lastMessage: text("last_message"),
  lastMessageAt: timestamp("last_message_at"),
  unreadCompany: integer("unread_company").default(0),
  unreadUser: integer("unread_user").default(0),
  createdAt: timestamp("created_at").defaultNow(),
});

export const messages = pgTable("messages", {
  id: varchar("id")
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  conversationId: varchar("conversation_id").references(() => conversations.id).notNull(),
  senderId: varchar("sender_id").references(() => users.id).notNull(),
  senderType: text("sender_type").notNull(),
  content: text("content").notNull(),
  messageType: text("message_type").default("text"),
  attachments: jsonb("attachments").$type<string[]>().default([]),
  readAt: timestamp("read_at"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const companyFollowers = pgTable("company_followers", {
  id: varchar("id")
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  companyId: varchar("company_id").references(() => companies.id).notNull(),
  userId: varchar("user_id").references(() => users.id).notNull(),
  createdAt: timestamp("created_at").defaultNow(),
});

// ============================================
// MULTI-COMMUNITY TABLES
// ============================================

export const communities = pgTable("communities", {
  id: varchar("id")
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  slug: text("slug").notNull().unique(),
  nameBn: text("name_bn"),
  nameEn: text("name_en"),
  theme: jsonb("theme").$type<{
    light: { primary: string; accent: string; bg: string; text: string; card: string; border: string };
    dark: { primary: string; accent: string; bg: string; text: string; card: string; border: string };
  }>().notNull(),
  status: text("status").default("active"),
  visibility: text("visibility").default("public"),
  modules: jsonb("modules").$type<Record<string, any>>().default({}),
  iconUrl: text("icon_url"),
  bannerUrl: text("banner_url"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const communityMembers = pgTable("community_members", {
  communityId: varchar("community_id").references(() => communities.id, { onDelete: "cascade" }).notNull(),
  userId: varchar("user_id").references(() => users.id, { onDelete: "cascade" }).notNull(),
  role: text("role").default("member"),
  status: text("status").default("active"),
  joinedAt: timestamp("joined_at").defaultNow(),
});

export const userSettings = pgTable("user_settings", {
  userId: varchar("user_id").primaryKey().references(() => users.id, { onDelete: "cascade" }),
  defaultCommunityId: varchar("default_community_id").references(() => communities.id),
});

// Community Feed
export const posts = pgTable("posts", {
  id: varchar("id")
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  communityId: varchar("community_id").references(() => communities.id, { onDelete: "cascade" }).notNull(),
  authorId: varchar("author_id").references(() => users.id, { onDelete: "cascade" }).notNull(),
  content: text("content"),
  media: jsonb("media").$type<string[]>().default([]),
  createdAt: timestamp("created_at").defaultNow(),
});

export const postLikes = pgTable("post_likes", {
  postId: varchar("post_id").references(() => posts.id, { onDelete: "cascade" }).notNull(),
  oderId: varchar("user_id").references(() => users.id, { onDelete: "cascade" }).notNull(),
});

export const postComments = pgTable("post_comments", {
  id: varchar("id")
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  postId: varchar("post_id").references(() => posts.id, { onDelete: "cascade" }).notNull(),
  userId: varchar("user_id").references(() => users.id, { onDelete: "cascade" }).notNull(),
  body: text("body"),
  createdAt: timestamp("created_at").defaultNow(),
});

// Market (community scoped)
export const marketCategories = pgTable("market_categories", {
  id: varchar("id")
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  communityId: varchar("community_id").references(() => communities.id, { onDelete: "cascade" }).notNull(),
  nameBn: text("name_bn"),
  nameEn: text("name_en"),
  sortOrder: integer("sort_order").default(0),
});

export const marketItems = pgTable("market_items", {
  id: varchar("id")
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  communityId: varchar("community_id").references(() => communities.id, { onDelete: "cascade" }).notNull(),
  categoryId: varchar("category_id").references(() => marketCategories.id, { onDelete: "set null" }),
  sellerId: varchar("seller_id").references(() => users.id, { onDelete: "cascade" }).notNull(),
  itemType: text("item_type").notNull(),
  title: text("title"),
  description: text("description"),
  price: decimal("price", { precision: 10, scale: 2 }),
  priceModel: text("price_model").default("fixed"),
  delivery: text("delivery").default("physical"),
  stock: integer("stock").default(0),
  media: jsonb("media").$type<string[]>().default([]),
  status: text("status").default("active"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const communityOrders = pgTable("community_orders", {
  id: varchar("id")
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  communityId: varchar("community_id").references(() => communities.id, { onDelete: "cascade" }).notNull(),
  itemId: varchar("item_id").references(() => marketItems.id, { onDelete: "restrict" }).notNull(),
  buyerId: varchar("buyer_id").references(() => users.id, { onDelete: "cascade" }).notNull(),
  sellerId: varchar("seller_id").references(() => users.id, { onDelete: "cascade" }).notNull(),
  qty: integer("qty").default(1),
  total: decimal("total", { precision: 10, scale: 2 }),
  status: text("status").default("pending"),
  paymentRef: text("payment_ref"),
  createdAt: timestamp("created_at").defaultNow(),
});

// Community Tools
export const communityTools = pgTable("community_tools", {
  id: varchar("id")
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  communityId: varchar("community_id").references(() => communities.id, { onDelete: "cascade" }).notNull(),
  titleBn: text("title_bn"),
  titleEn: text("title_en"),
  toolType: text("tool_type"),
  routeKey: text("route_key"),
  config: jsonb("config").$type<Record<string, any>>().default({}),
  status: text("status").default("active"),
});

// Experts + Booking
export const experts = pgTable("experts", {
  id: varchar("id")
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  communityId: varchar("community_id").references(() => communities.id, { onDelete: "cascade" }).notNull(),
  name: text("name"),
  expertise: text("expertise"),
  specialty: text("specialty"),
  phone: text("phone"),
  address: text("address"),
  fee: decimal("fee", { precision: 10, scale: 2 }),
  schedule: jsonb("schedule").$type<Record<string, any>>(),
  verified: boolean("verified").default(false),
  createdAt: timestamp("created_at").defaultNow(),
});

export const bookings = pgTable("bookings", {
  id: varchar("id")
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  communityId: varchar("community_id").references(() => communities.id, { onDelete: "cascade" }).notNull(),
  expertId: varchar("expert_id").references(() => experts.id, { onDelete: "cascade" }).notNull(),
  oderId: varchar("user_id").references(() => users.id, { onDelete: "cascade" }).notNull(),
  bookingDate: text("booking_date"),
  timeSlot: text("time_slot"),
  status: text("status").default("requested"),
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow(),
});

// Community Chat
export const chatThreads = pgTable("chat_threads", {
  id: varchar("id")
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  communityId: varchar("community_id").references(() => communities.id, { onDelete: "cascade" }).notNull(),
  type: text("type").default("dm"),
  title: text("title"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const chatMembers = pgTable("chat_members", {
  threadId: varchar("thread_id").references(() => chatThreads.id, { onDelete: "cascade" }).notNull(),
  oderId: varchar("user_id").references(() => users.id, { onDelete: "cascade" }).notNull(),
});

// Email verification codes for OTP
export const verificationCodes = pgTable("verification_codes", {
  id: varchar("id")
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  email: text("email").notNull(),
  code: text("code").notNull(),
  type: text("type").default("signup"), // signup, password_reset, email_change
  expiresAt: timestamp("expires_at").notNull(),
  verified: boolean("verified").default(false),
  attempts: integer("attempts").default(0),
  createdAt: timestamp("created_at").defaultNow(),
});

// OAuth providers linked to users
export const userOAuthProviders = pgTable("user_oauth_providers", {
  id: varchar("id")
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  userId: varchar("user_id").references(() => users.id, { onDelete: "cascade" }).notNull(),
  provider: text("provider").notNull(), // google, apple, etc.
  providerId: text("provider_id").notNull(), // Google user ID
  email: text("email"),
  name: text("name"),
  avatar: text("avatar"),
  accessToken: text("access_token"),
  refreshToken: text("refresh_token"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const insertUserSchema = createInsertSchema(users).pick({
  username: true,
  password: true,
});

export const insertCompanySchema = createInsertSchema(companies).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertProductSchema = createInsertSchema(products).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertReviewSchema = createInsertSchema(reviews).omit({
  id: true,
  createdAt: true,
});

export const insertOrderSchema = createInsertSchema(orders).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertAdminSchema = createInsertSchema(admins).omit({
  id: true,
  createdAt: true,
  lastLogin: true,
});

export const insertApiKeySchema = createInsertSchema(apiKeys).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
  dailyUsage: true,
  monthlyUsage: true,
  totalUsage: true,
  lastUsed: true,
  lastReset: true,
  errorCount: true,
  lastError: true,
});

// Calculator Records for offline sync
export const calcRecords = pgTable("calc_records", {
  id: varchar("id")
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  userId: varchar("user_id").references(() => users.id, { onDelete: "cascade" }),
  deviceId: text("device_id"),
  localId: text("local_id"),
  recordType: text("record_type").notNull(),
  language: text("language").default("bn"),
  title: text("title"),
  inputsJson: text("inputs_json"),
  outputsJson: text("outputs_json"),
  notes: text("notes"),
  tagsJson: text("tags_json"),
  archived: boolean("archived").default(false),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Audit Logs table for admin actions
export const auditLogs = pgTable("audit_logs", {
  id: varchar("id")
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  adminId: varchar("admin_id").references(() => users.id),
  adminEmail: text("admin_email"),
  action: text("action").notNull(),
  targetType: text("target_type").notNull(),
  targetId: varchar("target_id"),
  details: text("details"),
  metadata: jsonb("metadata").$type<Record<string, any>>(),
  createdAt: timestamp("created_at").defaultNow(),
});

// Announcements table for admin broadcasts
export const announcements = pgTable("announcements", {
  id: varchar("id")
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  title: text("title").notNull(),
  message: text("message").notNull(),
  type: text("type").default("info"),
  active: boolean("active").default(true),
  targetAudience: text("target_audience").default("all"),
  createdBy: varchar("created_by").references(() => users.id),
  expiresAt: timestamp("expires_at"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof users.$inferSelect;
export type Company = typeof companies.$inferSelect;
export type Product = typeof products.$inferSelect;
export type Review = typeof reviews.$inferSelect;
export type Order = typeof orders.$inferSelect;
export type OrderItem = typeof orderItems.$inferSelect;
export type Conversation = typeof conversations.$inferSelect;
export type Message = typeof messages.$inferSelect;
export type Admin = typeof admins.$inferSelect;
export type ApiKey = typeof apiKeys.$inferSelect;
export type ApiUsageLog = typeof apiUsageLogs.$inferSelect;
export type AppSetting = typeof appSettings.$inferSelect;
export type AdminSession = typeof adminSessions.$inferSelect;

// Multi-community types
export type Community = typeof communities.$inferSelect;
export type CommunityMember = typeof communityMembers.$inferSelect;
export type UserSettings = typeof userSettings.$inferSelect;
export type Post = typeof posts.$inferSelect;
export type PostComment = typeof postComments.$inferSelect;
export type MarketCategory = typeof marketCategories.$inferSelect;
export type MarketItem = typeof marketItems.$inferSelect;
export type CommunityOrder = typeof communityOrders.$inferSelect;
export type CommunityTool = typeof communityTools.$inferSelect;
export type Expert = typeof experts.$inferSelect;
export type Booking = typeof bookings.$inferSelect;
export type ChatThread = typeof chatThreads.$inferSelect;
// ============================================
// REFERRAL PROGRAM TABLES
// ============================================

export const referralCodes = pgTable("referral_codes", {
  id: varchar("id")
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  userId: varchar("user_id").references(() => users.id, { onDelete: "cascade" }).notNull(),
  code: text("code").notNull().unique(),
  totalReferrals: integer("total_referrals").default(0),
  totalEarnings: decimal("total_earnings", { precision: 10, scale: 2 }).default("0"),
  isActive: boolean("is_active").default(true),
  createdAt: timestamp("created_at").defaultNow(),
});

export const referrals = pgTable("referrals", {
  id: varchar("id")
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  referrerId: varchar("referrer_id").references(() => users.id, { onDelete: "cascade" }).notNull(),
  refereeId: varchar("referee_id").references(() => users.id, { onDelete: "cascade" }).notNull(),
  referralCodeId: varchar("referral_code_id").references(() => referralCodes.id),
  status: text("status").default("pending"),
  level: integer("level").default(1),
  rewardAmount: decimal("reward_amount", { precision: 10, scale: 2 }).default("0"),
  rewardPaid: boolean("reward_paid").default(false),
  createdAt: timestamp("created_at").defaultNow(),
});

// ============================================
// GAMIFICATION & REWARDS TABLES
// ============================================

export const userPoints = pgTable("user_points", {
  id: varchar("id")
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  userId: varchar("user_id").references(() => users.id, { onDelete: "cascade" }).notNull(),
  totalPoints: integer("total_points").default(0),
  currentLevel: integer("current_level").default(1),
  levelName: text("level_name").default("নতুন কৃষক"),
  dailyLoginStreak: integer("daily_login_streak").default(0),
  lastLoginDate: timestamp("last_login_date"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const pointTransactions = pgTable("point_transactions", {
  id: varchar("id")
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  userId: varchar("user_id").references(() => users.id, { onDelete: "cascade" }).notNull(),
  points: integer("points").notNull(),
  type: text("type").notNull(),
  source: text("source").notNull(),
  description: text("description"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const badges = pgTable("badges", {
  id: varchar("id")
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  nameBn: text("name_bn"),
  description: text("description"),
  descriptionBn: text("description_bn"),
  icon: text("icon"),
  category: text("category").default("achievement"),
  requirement: text("requirement"),
  pointsRequired: integer("points_required").default(0),
  isActive: boolean("is_active").default(true),
  createdAt: timestamp("created_at").defaultNow(),
});

export const userBadges = pgTable("user_badges", {
  id: varchar("id")
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  userId: varchar("user_id").references(() => users.id, { onDelete: "cascade" }).notNull(),
  badgeId: varchar("badge_id").references(() => badges.id, { onDelete: "cascade" }).notNull(),
  earnedAt: timestamp("earned_at").defaultNow(),
});

// ============================================
// WALLET & PAYMENT TABLES
// ============================================

export const wallets = pgTable("wallets", {
  id: varchar("id")
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  userId: varchar("user_id").references(() => users.id, { onDelete: "cascade" }).notNull().unique(),
  balance: decimal("balance", { precision: 12, scale: 2 }).default("0"),
  currency: text("currency").default("BDT"),
  isActive: boolean("is_active").default(true),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const walletTransactions = pgTable("wallet_transactions", {
  id: varchar("id")
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  walletId: varchar("wallet_id").references(() => wallets.id, { onDelete: "cascade" }).notNull(),
  type: text("type").notNull(),
  amount: decimal("amount", { precision: 10, scale: 2 }).notNull(),
  balanceAfter: decimal("balance_after", { precision: 12, scale: 2 }),
  description: text("description"),
  referenceId: varchar("reference_id"),
  referenceType: text("reference_type"),
  status: text("status").default("completed"),
  createdAt: timestamp("created_at").defaultNow(),
});

// ============================================
// LEARNING CENTER TABLES
// ============================================

export const courses = pgTable("courses", {
  id: varchar("id")
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  title: text("title").notNull(),
  titleBn: text("title_bn"),
  description: text("description"),
  descriptionBn: text("description_bn"),
  thumbnail: text("thumbnail"),
  category: text("category"),
  duration: integer("duration"),
  difficulty: text("difficulty").default("beginner"),
  pointsReward: integer("points_reward").default(10),
  isPublished: boolean("is_published").default(false),
  createdAt: timestamp("created_at").defaultNow(),
});

export const courseLessons = pgTable("course_lessons", {
  id: varchar("id")
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  courseId: varchar("course_id").references(() => courses.id, { onDelete: "cascade" }).notNull(),
  title: text("title").notNull(),
  titleBn: text("title_bn"),
  content: text("content"),
  contentBn: text("content_bn"),
  videoUrl: text("video_url"),
  sortOrder: integer("sort_order").default(0),
  duration: integer("duration"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const quizzes = pgTable("quizzes", {
  id: varchar("id")
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  courseId: varchar("course_id").references(() => courses.id, { onDelete: "cascade" }),
  title: text("title").notNull(),
  titleBn: text("title_bn"),
  passingScore: integer("passing_score").default(60),
  pointsReward: integer("points_reward").default(5),
  createdAt: timestamp("created_at").defaultNow(),
});

export const quizQuestions = pgTable("quiz_questions", {
  id: varchar("id")
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  quizId: varchar("quiz_id").references(() => quizzes.id, { onDelete: "cascade" }).notNull(),
  question: text("question").notNull(),
  questionBn: text("question_bn"),
  options: jsonb("options").$type<string[]>().default([]),
  optionsBn: jsonb("options_bn").$type<string[]>().default([]),
  correctAnswer: integer("correct_answer").notNull(),
  sortOrder: integer("sort_order").default(0),
});

export const userCourseProgress = pgTable("user_course_progress", {
  id: varchar("id")
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  userId: varchar("user_id").references(() => users.id, { onDelete: "cascade" }).notNull(),
  courseId: varchar("course_id").references(() => courses.id, { onDelete: "cascade" }).notNull(),
  completedLessons: jsonb("completed_lessons").$type<string[]>().default([]),
  progress: integer("progress").default(0),
  isCompleted: boolean("is_completed").default(false),
  completedAt: timestamp("completed_at"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const userQuizAttempts = pgTable("user_quiz_attempts", {
  id: varchar("id")
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  userId: varchar("user_id").references(() => users.id, { onDelete: "cascade" }).notNull(),
  quizId: varchar("quiz_id").references(() => quizzes.id, { onDelete: "cascade" }).notNull(),
  score: integer("score").notNull(),
  passed: boolean("passed").default(false),
  answers: jsonb("answers").$type<Record<string, number>>(),
  createdAt: timestamp("created_at").defaultNow(),
});

// ============================================
// CONTRACT FARMING TABLES
// ============================================

export const contracts = pgTable("contracts", {
  id: varchar("id")
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  buyerId: varchar("buyer_id").references(() => users.id, { onDelete: "cascade" }).notNull(),
  sellerId: varchar("seller_id").references(() => users.id, { onDelete: "cascade" }).notNull(),
  productName: text("product_name").notNull(),
  quantity: decimal("quantity", { precision: 10, scale: 2 }).notNull(),
  unit: text("unit").default("kg"),
  agreedPrice: decimal("agreed_price", { precision: 10, scale: 2 }).notNull(),
  advanceAmount: decimal("advance_amount", { precision: 10, scale: 2 }).default("0"),
  deliveryDate: timestamp("delivery_date"),
  terms: text("terms"),
  status: text("status").default("pending"),
  buyerSignedAt: timestamp("buyer_signed_at"),
  sellerSignedAt: timestamp("seller_signed_at"),
  completedAt: timestamp("completed_at"),
  createdAt: timestamp("created_at").defaultNow(),
});

// ============================================
// FARM MANAGEMENT TABLES
// ============================================

export const farms = pgTable("farms", {
  id: varchar("id")
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  userId: varchar("user_id").references(() => users.id, { onDelete: "cascade" }).notNull(),
  name: text("name").notNull(),
  nameBn: text("name_bn"),
  location: text("location"),
  size: decimal("size", { precision: 10, scale: 2 }),
  sizeUnit: text("size_unit").default("bigha"),
  soilType: text("soil_type"),
  irrigationType: text("irrigation_type"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const farmActivities = pgTable("farm_activities", {
  id: varchar("id")
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  farmId: varchar("farm_id").references(() => farms.id, { onDelete: "cascade" }).notNull(),
  activityType: text("activity_type").notNull(),
  title: text("title").notNull(),
  description: text("description"),
  date: timestamp("date").defaultNow(),
  cost: decimal("cost", { precision: 10, scale: 2 }),
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const inventory = pgTable("inventory", {
  id: varchar("id")
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  userId: varchar("user_id").references(() => users.id, { onDelete: "cascade" }).notNull(),
  name: text("name").notNull(),
  nameBn: text("name_bn"),
  category: text("category").notNull(),
  quantity: decimal("quantity", { precision: 10, scale: 2 }).notNull(),
  unit: text("unit").default("kg"),
  minStock: decimal("min_stock", { precision: 10, scale: 2 }).default("0"),
  purchasePrice: decimal("purchase_price", { precision: 10, scale: 2 }),
  expiryDate: timestamp("expiry_date"),
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// ============================================
// AUCTION SYSTEM TABLES
// ============================================

export const auctions = pgTable("auctions", {
  id: varchar("id")
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  sellerId: varchar("seller_id").references(() => users.id, { onDelete: "cascade" }).notNull(),
  productName: text("product_name").notNull(),
  description: text("description"),
  images: jsonb("images").$type<string[]>().default([]),
  quantity: decimal("quantity", { precision: 10, scale: 2 }).notNull(),
  unit: text("unit").default("kg"),
  startingPrice: decimal("starting_price", { precision: 10, scale: 2 }).notNull(),
  reservePrice: decimal("reserve_price", { precision: 10, scale: 2 }),
  currentPrice: decimal("current_price", { precision: 10, scale: 2 }),
  startTime: timestamp("start_time").notNull(),
  endTime: timestamp("end_time").notNull(),
  status: text("status").default("upcoming"),
  winnerId: varchar("winner_id").references(() => users.id),
  totalBids: integer("total_bids").default(0),
  createdAt: timestamp("created_at").defaultNow(),
});

export const auctionBids = pgTable("auction_bids", {
  id: varchar("id")
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  auctionId: varchar("auction_id").references(() => auctions.id, { onDelete: "cascade" }).notNull(),
  bidderId: varchar("bidder_id").references(() => users.id, { onDelete: "cascade" }).notNull(),
  amount: decimal("amount", { precision: 10, scale: 2 }).notNull(),
  isWinning: boolean("is_winning").default(false),
  createdAt: timestamp("created_at").defaultNow(),
});

// ============================================
// QR CODE SYSTEM TABLES
// ============================================

export const qrCodes = pgTable("qr_codes", {
  id: varchar("id")
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  userId: varchar("user_id").references(() => users.id, { onDelete: "cascade" }),
  type: text("type").notNull(),
  referenceId: varchar("reference_id"),
  referenceType: text("reference_type"),
  data: text("data"),
  scansCount: integer("scans_count").default(0),
  isActive: boolean("is_active").default(true),
  expiresAt: timestamp("expires_at"),
  createdAt: timestamp("created_at").defaultNow(),
});

// ============================================
// TRUST SCORE & VERIFICATION TABLES
// ============================================

export const trustScores = pgTable("trust_scores", {
  id: varchar("id")
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  userId: varchar("user_id").references(() => users.id, { onDelete: "cascade" }).notNull().unique(),
  score: integer("score").default(50),
  totalTransactions: integer("total_transactions").default(0),
  successfulTransactions: integer("successful_transactions").default(0),
  positiveReviews: integer("positive_reviews").default(0),
  negativeReviews: integer("negative_reviews").default(0),
  verificationLevel: text("verification_level").default("basic"),
  lastUpdated: timestamp("last_updated").defaultNow(),
  createdAt: timestamp("created_at").defaultNow(),
});

export const verificationDocuments = pgTable("verification_documents", {
  id: varchar("id")
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  userId: varchar("user_id").references(() => users.id, { onDelete: "cascade" }).notNull(),
  documentType: text("document_type").notNull(),
  documentUrl: text("document_url"),
  status: text("status").default("pending"),
  verifiedAt: timestamp("verified_at"),
  verifiedBy: varchar("verified_by").references(() => users.id),
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow(),
});

// ============================================
// NOTIFICATIONS TABLE
// ============================================

export const notifications = pgTable("notifications", {
  id: varchar("id")
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  userId: varchar("user_id").references(() => users.id, { onDelete: "cascade" }).notNull(),
  title: text("title").notNull(),
  titleBn: text("title_bn"),
  message: text("message").notNull(),
  messageBn: text("message_bn"),
  type: text("type").default("info"),
  category: text("category").default("general"),
  referenceId: varchar("reference_id"),
  referenceType: text("reference_type"),
  isRead: boolean("is_read").default(false),
  createdAt: timestamp("created_at").defaultNow(),
});

// ============================================
// PRICE TRACKER TABLE
// ============================================

export const marketPrices = pgTable("market_prices", {
  id: varchar("id")
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  productName: text("product_name").notNull(),
  productNameBn: text("product_name_bn"),
  category: text("category"),
  price: decimal("price", { precision: 10, scale: 2 }).notNull(),
  unit: text("unit").default("kg"),
  market: text("market"),
  region: text("region"),
  priceDate: timestamp("price_date").defaultNow(),
  createdAt: timestamp("created_at").defaultNow(),
});

export const priceAlerts = pgTable("price_alerts", {
  id: varchar("id")
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  userId: varchar("user_id").references(() => users.id, { onDelete: "cascade" }).notNull(),
  productName: text("product_name").notNull(),
  targetPrice: decimal("target_price", { precision: 10, scale: 2 }).notNull(),
  alertType: text("alert_type").default("below"),
  isActive: boolean("is_active").default(true),
  triggeredAt: timestamp("triggered_at"),
  createdAt: timestamp("created_at").defaultNow(),
});

// ============================================
// CROP CALENDAR TABLE
// ============================================

export const cropCalendar = pgTable("crop_calendar", {
  id: varchar("id")
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  userId: varchar("user_id").references(() => users.id, { onDelete: "cascade" }).notNull(),
  cropName: text("crop_name").notNull(),
  cropNameBn: text("crop_name_bn"),
  farmId: varchar("farm_id").references(() => farms.id),
  plantingDate: timestamp("planting_date"),
  expectedHarvestDate: timestamp("expected_harvest_date"),
  actualHarvestDate: timestamp("actual_harvest_date"),
  status: text("status").default("planned"),
  notes: text("notes"),
  reminderEnabled: boolean("reminder_enabled").default(true),
  createdAt: timestamp("created_at").defaultNow(),
});

// ============================================
// COUPON & PROMO CODE SYSTEM
// ============================================

export const coupons = pgTable("coupons", {
  id: varchar("id")
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  code: text("code").notNull().unique(),
  nameBn: text("name_bn"),
  nameEn: text("name_en"),
  description: text("description"),
  discountType: text("discount_type").default("percentage"),
  discountValue: decimal("discount_value", { precision: 10, scale: 2 }).notNull(),
  minOrderAmount: decimal("min_order_amount", { precision: 10, scale: 2 }).default("0"),
  maxDiscountAmount: decimal("max_discount_amount", { precision: 10, scale: 2 }),
  usageLimit: integer("usage_limit"),
  usedCount: integer("used_count").default(0),
  perUserLimit: integer("per_user_limit").default(1),
  validFrom: timestamp("valid_from").defaultNow(),
  validUntil: timestamp("valid_until"),
  isActive: boolean("is_active").default(true),
  applicableCategories: jsonb("applicable_categories").$type<string[]>().default([]),
  applicableProducts: jsonb("applicable_products").$type<string[]>().default([]),
  companyId: varchar("company_id").references(() => companies.id),
  createdBy: varchar("created_by").references(() => users.id),
  createdAt: timestamp("created_at").defaultNow(),
});

export const couponUsage = pgTable("coupon_usage", {
  id: varchar("id")
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  couponId: varchar("coupon_id").references(() => coupons.id, { onDelete: "cascade" }).notNull(),
  userId: varchar("user_id").references(() => users.id, { onDelete: "cascade" }).notNull(),
  orderId: varchar("order_id").references(() => orders.id),
  discountAmount: decimal("discount_amount", { precision: 10, scale: 2 }).notNull(),
  usedAt: timestamp("used_at").defaultNow(),
});

// ============================================
// FLASH SALES SYSTEM
// ============================================

export const flashSales = pgTable("flash_sales", {
  id: varchar("id")
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  nameBn: text("name_bn"),
  nameEn: text("name_en"),
  description: text("description"),
  bannerImage: text("banner_image"),
  startTime: timestamp("start_time").notNull(),
  endTime: timestamp("end_time").notNull(),
  status: text("status").default("upcoming"),
  isActive: boolean("is_active").default(true),
  createdAt: timestamp("created_at").defaultNow(),
});

export const flashSaleItems = pgTable("flash_sale_items", {
  id: varchar("id")
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  flashSaleId: varchar("flash_sale_id").references(() => flashSales.id, { onDelete: "cascade" }).notNull(),
  productId: varchar("product_id").references(() => products.id, { onDelete: "cascade" }).notNull(),
  originalPrice: decimal("original_price", { precision: 10, scale: 2 }).notNull(),
  salePrice: decimal("sale_price", { precision: 10, scale: 2 }).notNull(),
  stockLimit: integer("stock_limit"),
  soldCount: integer("sold_count").default(0),
});

// ============================================
// PRE-ORDER SYSTEM
// ============================================

export const preOrders = pgTable("pre_orders", {
  id: varchar("id")
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  userId: varchar("user_id").references(() => users.id, { onDelete: "cascade" }).notNull(),
  productId: varchar("product_id").references(() => products.id, { onDelete: "cascade" }).notNull(),
  companyId: varchar("company_id").references(() => companies.id, { onDelete: "cascade" }).notNull(),
  quantity: integer("quantity").notNull(),
  priceAtOrder: decimal("price_at_order", { precision: 10, scale: 2 }).notNull(),
  advanceAmount: decimal("advance_amount", { precision: 10, scale: 2 }).default("0"),
  expectedDeliveryDate: timestamp("expected_delivery_date"),
  status: text("status").default("pending"),
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow(),
});

// ============================================
// PRODUCT VARIANTS SYSTEM
// ============================================

export const productVariants = pgTable("product_variants", {
  id: varchar("id")
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  productId: varchar("product_id").references(() => products.id, { onDelete: "cascade" }).notNull(),
  name: text("name").notNull(),
  nameBn: text("name_bn"),
  sku: text("sku"),
  price: decimal("price", { precision: 10, scale: 2 }).notNull(),
  compareAtPrice: decimal("compare_at_price", { precision: 10, scale: 2 }),
  quantity: integer("quantity").default(0),
  attributes: jsonb("attributes").$type<Record<string, string>>().default({}),
  image: text("image"),
  isActive: boolean("is_active").default(true),
  createdAt: timestamp("created_at").defaultNow(),
});

// ============================================
// BULK DISCOUNT SYSTEM
// ============================================

export const bulkDiscounts = pgTable("bulk_discounts", {
  id: varchar("id")
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  productId: varchar("product_id").references(() => products.id, { onDelete: "cascade" }),
  companyId: varchar("company_id").references(() => companies.id, { onDelete: "cascade" }),
  minQuantity: integer("min_quantity").notNull(),
  discountPercentage: decimal("discount_percentage", { precision: 5, scale: 2 }).notNull(),
  isActive: boolean("is_active").default(true),
  createdAt: timestamp("created_at").defaultNow(),
});

// ============================================
// WISHLIST ENHANCEMENTS
// ============================================

export const wishlists = pgTable("wishlists", {
  id: varchar("id")
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  userId: varchar("user_id").references(() => users.id, { onDelete: "cascade" }).notNull(),
  name: text("name").default("My Wishlist"),
  isPublic: boolean("is_public").default(false),
  createdAt: timestamp("created_at").defaultNow(),
});

export const wishlistItems = pgTable("wishlist_items", {
  id: varchar("id")
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  wishlistId: varchar("wishlist_id").references(() => wishlists.id, { onDelete: "cascade" }).notNull(),
  productId: varchar("product_id").references(() => products.id, { onDelete: "cascade" }).notNull(),
  addedAt: timestamp("added_at").defaultNow(),
  priceAtAdd: decimal("price_at_add", { precision: 10, scale: 2 }),
  notifyOnPriceDrop: boolean("notify_on_price_drop").default(true),
});

// ============================================
// ORDER TRACKING ENHANCEMENTS
// ============================================

export const orderTracking = pgTable("order_tracking", {
  id: varchar("id")
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  orderId: varchar("order_id").references(() => orders.id, { onDelete: "cascade" }).notNull(),
  status: text("status").notNull(),
  statusBn: text("status_bn"),
  location: text("location"),
  description: text("description"),
  updatedBy: varchar("updated_by").references(() => users.id),
  createdAt: timestamp("created_at").defaultNow(),
});

// ============================================
// REVIEW PHOTOS
// ============================================

export const reviewPhotos = pgTable("review_photos", {
  id: varchar("id")
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  reviewId: varchar("review_id").references(() => reviews.id, { onDelete: "cascade" }).notNull(),
  photoUrl: text("photo_url").notNull(),
  caption: text("caption"),
  sortOrder: integer("sort_order").default(0),
  createdAt: timestamp("created_at").defaultNow(),
});

// ============================================
// SAVED SEARCHES
// ============================================

export const savedSearches = pgTable("saved_searches", {
  id: varchar("id")
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  userId: varchar("user_id").references(() => users.id, { onDelete: "cascade" }).notNull(),
  query: text("query").notNull(),
  filters: jsonb("filters").$type<Record<string, any>>().default({}),
  notifyOnNewResults: boolean("notify_on_new_results").default(false),
  createdAt: timestamp("created_at").defaultNow(),
});

// ============================================
// RECENTLY VIEWED
// ============================================

export const recentlyViewed = pgTable("recently_viewed", {
  id: varchar("id")
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  userId: varchar("user_id").references(() => users.id, { onDelete: "cascade" }).notNull(),
  productId: varchar("product_id").references(() => products.id, { onDelete: "cascade" }).notNull(),
  viewedAt: timestamp("viewed_at").defaultNow(),
});

// Export types
export type VerificationCode = typeof verificationCodes.$inferSelect;
export type UserOAuthProvider = typeof userOAuthProviders.$inferSelect;
export type AuditLog = typeof auditLogs.$inferSelect;
export type Announcement = typeof announcements.$inferSelect;
export type CalcRecord = typeof calcRecords.$inferSelect;

// New feature types
export type ReferralCode = typeof referralCodes.$inferSelect;
export type Referral = typeof referrals.$inferSelect;
export type UserPoints = typeof userPoints.$inferSelect;
export type PointTransaction = typeof pointTransactions.$inferSelect;
export type Badge = typeof badges.$inferSelect;
export type UserBadge = typeof userBadges.$inferSelect;
export type Wallet = typeof wallets.$inferSelect;
export type WalletTransaction = typeof walletTransactions.$inferSelect;
export type Course = typeof courses.$inferSelect;
export type CourseLesson = typeof courseLessons.$inferSelect;
export type Quiz = typeof quizzes.$inferSelect;
export type QuizQuestion = typeof quizQuestions.$inferSelect;
export type UserCourseProgress = typeof userCourseProgress.$inferSelect;
export type UserQuizAttempt = typeof userQuizAttempts.$inferSelect;
export type Contract = typeof contracts.$inferSelect;
export type Farm = typeof farms.$inferSelect;
export type FarmActivity = typeof farmActivities.$inferSelect;
export type Inventory = typeof inventory.$inferSelect;
export type Auction = typeof auctions.$inferSelect;
export type AuctionBid = typeof auctionBids.$inferSelect;
export type QRCode = typeof qrCodes.$inferSelect;
export type TrustScore = typeof trustScores.$inferSelect;
export type VerificationDocument = typeof verificationDocuments.$inferSelect;
export type Notification = typeof notifications.$inferSelect;
export type MarketPrice = typeof marketPrices.$inferSelect;
export type PriceAlert = typeof priceAlerts.$inferSelect;
export type CropCalendar = typeof cropCalendar.$inferSelect;

// E-commerce types
export type Coupon = typeof coupons.$inferSelect;
export type CouponUsage = typeof couponUsage.$inferSelect;
export type FlashSale = typeof flashSales.$inferSelect;
export type FlashSaleItem = typeof flashSaleItems.$inferSelect;
export type PreOrder = typeof preOrders.$inferSelect;
export type ProductVariant = typeof productVariants.$inferSelect;
export type BulkDiscount = typeof bulkDiscounts.$inferSelect;
export type Wishlist = typeof wishlists.$inferSelect;
export type WishlistItem = typeof wishlistItems.$inferSelect;
export type OrderTracking = typeof orderTracking.$inferSelect;
export type ReviewPhoto = typeof reviewPhotos.$inferSelect;
export type SavedSearch = typeof savedSearches.$inferSelect;
export type RecentlyViewed = typeof recentlyViewed.$inferSelect;
