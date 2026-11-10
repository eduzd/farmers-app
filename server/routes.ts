import { registerDmRoutes } from "./dmRoutes";
import { registerConnectRoutes } from "./connectRoutes";
import { registerProfileRoutes } from "./profileRoutes";
import { registerReactionRoutes } from "./reactionRoutes";
import { initCalls, handleCallMessage, onCallClientAuthed, onCallClientGone, registerCallRoutes } from "./calls";
import { initVoiceRooms, handleVoiceRoomMessage, onVoiceClientGone, registerVoiceRoomRoutes } from "./voiceRooms";
import type { Express } from "express";
import { createServer, type Server } from "node:http";
import { WebSocketServer, WebSocket } from "ws";
import { apiKeyManager } from "./services/apiKeyManager";
import { db, dbReady } from "./db";
import { apiUsageLogs, apiKeys, calcRecords } from "@shared/schema";
import { eq, and, or } from "drizzle-orm";
import jwt from "jsonwebtoken";
import { config } from "./config";
import type { Request, Response } from "express";

/**
 * Calculator records belong to the signed-in user. The account is taken only from a
 * valid Bearer token; a userId sent in the body or query is never trusted.
 * Returns the user id, or sends 401 and returns null.
 */
function calcRecordsUser(req: Request, res: Response): string | null {
  const h = req.headers.authorization;
  if (h && h.startsWith("Bearer ")) {
    try {
      const uid = (jwt.verify(h.slice(7), config.jwtSecret) as any)?.userId;
      if (typeof uid === "string" && uid) return uid;
    } catch {
      /* fall through to 401 */
    }
  }
  res.status(401).json({ error: "Sign in required" });
  return null;
}

/** A supplied userId that differs from the signed-in account is refused (403). */
function spoofedUserId(supplied: unknown, authUserId: string): boolean {
  return supplied !== undefined && supplied !== null && supplied !== "" && supplied !== authUserId;
}

async function loadApiKeysFromDB() {
  if (!db) return;
  try {
    const keys = await db.select().from(apiKeys);
    const formattedKeys = keys.map((k) => ({
      id: k.id,
      name: k.name,
      apiKey: k.apiKey,
      purpose: k.purpose || "general",
      priority: k.priority || 1,
      isActive: k.isActive || false,
      dailyLimit: k.dailyLimit || 1000,
      monthlyLimit: k.monthlyLimit || 30000,
      dailyUsage: k.dailyUsage || 0,
      monthlyUsage: k.monthlyUsage || 0,
      errorCount: k.errorCount || 0,
    }));
    apiKeyManager.loadKeysFromDB(formattedKeys);
    console.log(`Loaded ${keys.length} API keys from database`);
  } catch (error) {
    console.error("Failed to load API keys from DB:", error);
  }
}

async function logApiUsage(keyId: string, endpoint: string, status: string, responseTime?: number, errorMessage?: string) {
  if (!db) return;
  try {
    await db.insert(apiUsageLogs).values({
      apiKeyId: keyId,
      endpoint,
      status,
      responseTime,
      errorMessage,
    });

    if (status === "success") {
      await db.update(apiKeys)
        .set({
          dailyUsage: (await db.select().from(apiKeys).where(eq(apiKeys.id, keyId)))[0]?.dailyUsage! + 1 || 1,
          monthlyUsage: (await db.select().from(apiKeys).where(eq(apiKeys.id, keyId)))[0]?.monthlyUsage! + 1 || 1,
          lastUsed: new Date(),
        })
        .where(eq(apiKeys.id, keyId));
    }
  } catch (error) {
    console.error("Failed to log API usage:", error);
  }
}

dbReady.then(loadApiKeysFromDB);

interface ChatMessage {
  id: string;
  conversationId: string;
  senderId: string;
  senderType: "user" | "company";
  content: string;
  messageType: "text" | "image" | "voice";
  createdAt: string;
}

interface ChatClient {
  ws: WebSocket;
  userId: string;
  conversationIds: Set<string>;
}

// One person can be connected from several phones/tabs at once.
const chatClients = new Map<string, Set<ChatClient>>();

function addChatClient(userId: string, client: ChatClient) {
  let set = chatClients.get(userId);
  if (!set) chatClients.set(userId, (set = new Set()));
  set.add(client);
}

function removeChatClient(userId: string, client: ChatClient) {
  const set = chatClients.get(userId);
  if (!set) return;
  set.delete(client);
  if (!set.size) chatClients.delete(userId);
}

function userOnline(userId: string) {
  const set = chatClients.get(userId);
  return !!set && [...set].some((c) => c.ws.readyState === WebSocket.OPEN);
}

function sendToUser(userId: string, message: any, except?: WebSocket) {
  const set = chatClients.get(userId);
  if (!set) return false;
  let sent = false;
  const text = JSON.stringify(message);
  for (const c of set) {
    if (c.ws === except) continue;
    if (c.ws.readyState === WebSocket.OPEN) {
      c.ws.send(text);
      sent = true;
    }
  }
  return sent;
}


const farmingResponses = [
  "For healthy crop growth, ensure proper spacing between plants and maintain consistent watering schedules.",
  "Consider using organic fertilizers like compost or manure to improve soil health naturally.",
  "Crop rotation is essential - it prevents soil depletion and reduces pest buildup.",
  "Monitor your crops regularly for early signs of disease or pest infestation.",
  "Proper drainage is crucial - waterlogged soil can lead to root rot and fungal diseases.",
  "For livestock health, maintain clean housing and provide balanced nutrition.",
  "Fish farming requires regular water quality monitoring - check pH, ammonia, and oxygen levels.",
  "Companion planting can naturally repel pests and improve crop yields.",
  "Keep detailed records of planting dates, treatments, and yields to improve future seasons.",
  "During dry seasons, consider mulching to retain soil moisture and regulate temperature.",
];

// No sample shops: these endpoints answer with empty lists until real shops are stored on the server.
const demoCompanies: any[] = [];

const demoProducts: Record<string, Array<{
  id: string;
  name: string;
  description: string;
  price: number;
  unit: string;
  quantity: number;
  category: string;
  status: string;
}>> = {};

export async function registerRoutes(app: Express): Promise<Server> {
  registerDmRoutes(app, sendToUser);
  registerConnectRoutes(app);
  registerCallRoutes(app);
  registerVoiceRoomRoutes(app);
  registerProfileRoutes(app);
  registerReactionRoutes(app, sendToUser);
  
  // AI endpoints (chat, disease detector, voice) live in server/aiRoutes.ts and use the admin's AI settings.

  // Calculator Records Sync API
  app.post("/api/calc-records/sync", async (req, res) => {
    try {
      if (!db) {
        return res.status(503).json({ error: "Database not available" });
      }

      const authUserId = calcRecordsUser(req, res);
      if (!authUserId) return;

      const {
        localId,
        userId: suppliedUserId,
        deviceId,
        recordType,
        createdAt,
        updatedAt,
        language,
        title,
        inputsJson,
        outputsJson,
        notes,
        tagsJson,
        archived,
      } = req.body;

      if (spoofedUserId(suppliedUserId, authUserId)) {
        return res.status(403).json({ error: "You can only sync your own records" });
      }
      const userId = authUserId;

      if (!recordType || !inputsJson || !outputsJson) {
        return res.status(400).json({ error: "Missing required fields" });
      }

      // Only ever match records owned by the signed-in user.
      const existingByLocalId = localId
        ? await db
            .select()
            .from(calcRecords)
            .where(and(eq(calcRecords.localId, String(localId)), eq(calcRecords.userId, userId)))
        : [];

      if (existingByLocalId.length > 0) {
        const existing = existingByLocalId[0];
        await db
          .update(calcRecords)
          .set({
            recordType,
            language: language || "bn",
            title: title || null,
            inputsJson,
            outputsJson,
            notes: notes || null,
            tagsJson: tagsJson || null,
            archived: archived || false,
            updatedAt: new Date(),
          })
          .where(and(eq(calcRecords.id, existing.id), eq(calcRecords.userId, userId)));

        return res.json({ id: existing.id, action: "updated" });
      }

      const result = await db
        .insert(calcRecords)
        .values({
          localId: localId ? String(localId) : null,
          userId,
          deviceId: deviceId || null,
          recordType,
          language: language || "bn",
          title: title || null,
          inputsJson,
          outputsJson,
          notes: notes || null,
          tagsJson: tagsJson || null,
          archived: archived || false,
          createdAt: createdAt ? new Date(createdAt) : new Date(),
          updatedAt: updatedAt ? new Date(updatedAt) : new Date(),
        })
        .returning({ id: calcRecords.id });

      res.json({ id: result[0].id, action: "created" });
    } catch (error) {
      console.error("Sync calc record error:", error);
      res.status(500).json({ error: "Failed to sync record" });
    }
  });

  app.get("/api/calc-records", async (req, res) => {
    try {
      if (!db) {
        return res.status(503).json({ error: "Database not available" });
      }

      const authUserId = calcRecordsUser(req, res);
      if (!authUserId) return;

      const { userId: suppliedUserId, limit = "100" } = req.query;
      if (spoofedUserId(suppliedUserId, authUserId)) {
        return res.status(403).json({ error: "You can only read your own records" });
      }

      const n = Math.min(Math.max(parseInt(String(limit), 10) || 100, 1), 500);
      const records = await db
        .select()
        .from(calcRecords)
        .where(eq(calcRecords.userId, authUserId))
        .limit(n);

      res.json(records);
    } catch (error) {
      console.error("Get calc records error:", error);
      res.status(500).json({ error: "Failed to get records" });
    }
  });

  // A calculation deleted on the phone or website: remove this account's copy, matched by the
  // device's own id (also catches an upload whose reply was lost) or the server id. Deleting
  // something already gone is fine, so a retry after a dropped connection never fails.
  app.delete("/api/calc-records/local/:localId", async (req, res) => {
    try {
      if (!db) {
        return res.status(503).json({ error: "Database not available" });
      }

      const authUserId = calcRecordsUser(req, res);
      if (!authUserId) return;

      const localId = String(req.params.localId || "").slice(0, 200);
      if (!localId) return res.status(400).json({ error: "Missing record id" });
      const serverId = typeof req.query.serverId === "string" ? req.query.serverId.slice(0, 200) : "";

      const match = serverId
        ? or(eq(calcRecords.localId, localId), eq(calcRecords.id, localId), eq(calcRecords.id, serverId))
        : or(eq(calcRecords.localId, localId), eq(calcRecords.id, localId));
      const deleted = await db
        .delete(calcRecords)
        .where(and(eq(calcRecords.userId, authUserId), match))
        .returning({ id: calcRecords.id });

      res.json({ success: true, deleted: deleted.length });
    } catch (error) {
      console.error("Delete calc record error:", error);
      res.status(500).json({ error: "Failed to delete record" });
    }
  });

  app.delete("/api/calc-records/:id", async (req, res) => {
    try {
      if (!db) {
        return res.status(503).json({ error: "Database not available" });
      }

      const authUserId = calcRecordsUser(req, res);
      if (!authUserId) return;

      const { id } = req.params;
      const deleted = await db
        .delete(calcRecords)
        .where(and(eq(calcRecords.id, id), eq(calcRecords.userId, authUserId)))
        .returning({ id: calcRecords.id });

      if (deleted.length === 0) {
        return res.status(404).json({ error: "Record not found" });
      }
      res.json({ success: true });
    } catch (error) {
      console.error("Delete calc record error:", error);
      res.status(500).json({ error: "Failed to delete record" });
    }
  });

  app.get("/api/companies", async (req, res) => {
    try {
      const { search, category, page = "1", limit = "20" } = req.query;
      let companies = [...demoCompanies];

      if (search && typeof search === "string") {
        const query = search.toLowerCase();
        companies = companies.filter(
          (c) =>
            c.name.toLowerCase().includes(query) ||
            c.description.toLowerCase().includes(query)
        );
      }

      if (category && category !== "all" && typeof category === "string") {
        companies = companies.filter((c) => c.category === category);
      }

      const pageNum = parseInt(page as string);
      const limitNum = parseInt(limit as string);
      const start = (pageNum - 1) * limitNum;
      const paginatedCompanies = companies.slice(start, start + limitNum);

      res.json({
        companies: paginatedCompanies,
        total: companies.length,
        page: pageNum,
        totalPages: Math.ceil(companies.length / limitNum),
      });
    } catch (error) {
      console.error("Get companies error:", error);
      res.status(500).json({ error: "Failed to get companies" });
    }
  });

  app.get("/api/companies/:id", async (req, res) => {
    try {
      const { id } = req.params;
      const company = demoCompanies.find((c) => c.id === id);

      if (!company) {
        return res.status(404).json({ error: "Company not found" });
      }

      res.json(company);
    } catch (error) {
      console.error("Get company error:", error);
      res.status(500).json({ error: "Failed to get company" });
    }
  });

  app.get("/api/companies/:id/products", async (req, res) => {
    try {
      const { id } = req.params;
      const { page = "1", limit = "20" } = req.query;
      
      const products = demoProducts[id] || [];
      const pageNum = parseInt(page as string);
      const limitNum = parseInt(limit as string);
      const start = (pageNum - 1) * limitNum;
      const paginatedProducts = products.slice(start, start + limitNum);

      res.json({
        products: paginatedProducts,
        total: products.length,
        page: pageNum,
        totalPages: Math.ceil(products.length / limitNum),
      });
    } catch (error) {
      console.error("Get products error:", error);
      res.status(500).json({ error: "Failed to get products" });
    }
  });

  app.get("/api/products/:id", async (req, res) => {
    try {
      const { id } = req.params;
      
      for (const companyId of Object.keys(demoProducts)) {
        const product = demoProducts[companyId].find((p) => p.id === id);
        if (product) {
          const company = demoCompanies.find((c) => c.id === companyId);
          return res.json({ ...product, company });
        }
      }

      res.status(404).json({ error: "Product not found" });
    } catch (error) {
      console.error("Get product error:", error);
      res.status(500).json({ error: "Failed to get product" });
    }
  });

  app.get("/api/seed-data", async (req, res) => {
    try {
      const companiesWithProducts = demoCompanies.map((company) => ({
        ...company,
        products: demoProducts[company.id] || [],
      }));

      res.json({
        companies: companiesWithProducts,
        message: "Seed data retrieved successfully",
      });
    } catch (error) {
      console.error("Seed data error:", error);
      res.status(500).json({ error: "Failed to get seed data" });
    }
  });

  // bKash Payment Gateway Configuration
  const BKASH_CONFIG = {
    sandbox: {
      baseUrl: "https://tokenized.sandbox.bka.sh/v1.2.0-beta/tokenized",
      username: process.env.BKASH_USERNAME || "sandboxTokenizedUser02",
      password: process.env.BKASH_PASSWORD || "sandboxTokenizedUser02@12345",
      appKey: process.env.BKASH_APP_KEY || "4f6o0cjiki2rfm34kfdadl1eqq",
      appSecret: process.env.BKASH_APP_SECRET || "2is7hdktrekvrbljjh44ll3d9l1dtjo4pasmjvs5vl5qr3fug4b",
    },
    production: {
      baseUrl: "https://tokenized.pay.bka.sh/v1.2.0-beta/tokenized",
      username: process.env.BKASH_USERNAME || "",
      password: process.env.BKASH_PASSWORD || "",
      appKey: process.env.BKASH_APP_KEY || "",
      appSecret: process.env.BKASH_APP_SECRET || "",
    },
  };

  const isSandbox = process.env.BKASH_SANDBOX !== "false";
  const bkashConfig = isSandbox ? BKASH_CONFIG.sandbox : BKASH_CONFIG.production;

  let bkashToken: { idToken: string; refreshToken: string; expiresAt: number } | null = null;

  async function getBkashToken(): Promise<string> {
    const now = Date.now();
    if (bkashToken && bkashToken.expiresAt > now + 60000) {
      return bkashToken.idToken;
    }

    try {
      const response = await fetch(`${bkashConfig.baseUrl}/checkout/token/grant`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          username: bkashConfig.username,
          password: bkashConfig.password,
        },
        body: JSON.stringify({
          app_key: bkashConfig.appKey,
          app_secret: bkashConfig.appSecret,
        }),
      });

      const data = await response.json();
      if (data.id_token) {
        bkashToken = {
          idToken: data.id_token,
          refreshToken: data.refresh_token,
          expiresAt: now + (data.expires_in * 1000),
        };
        return data.id_token;
      }
      throw new Error(data.statusMessage || "Failed to get bKash token");
    } catch (error) {
      console.error("bKash token error:", error);
      throw error;
    }
  }

  // Store pending payments in memory (in production, use database)
  const pendingPayments = new Map<string, {
    paymentId: string;
    amount: string;
    invoiceNumber: string;
    paymentType: "welfare" | "summit";
    userId: string;
    createdAt: Date;
  }>();

  // Public base URL of this server (PUBLIC_URL in .env wins, else the request's own host,
  // which also works behind a tunnel / reverse proxy).
  function publicBaseUrl(req: any): string {
    if (process.env.PUBLIC_URL) return process.env.PUBLIC_URL.replace(/\/$/, "");
    const proto = (req.headers["x-forwarded-proto"] as string)?.split(",")[0] || req.protocol || "http";
    const host = (req.headers["x-forwarded-host"] as string) || req.headers.host || `localhost:${process.env.PORT || 5000}`;
    return `${proto}://${host}`;
  }

  // Simple result pages bKash redirects to after checkout.
  const paymentPage = (title: string, body: string, color: string) => `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${title}</title>
<style>body{font-family:"DM Sans",system-ui,sans-serif;background:#F3FAFF;margin:0;display:flex;min-height:100vh;align-items:center;justify-content:center;padding:24px;box-sizing:border-box}
.c{background:#fff;border-radius:12px;padding:32px 24px;max-width:420px;width:100%;text-align:center;border:1px solid #D6EAF8}
h1{color:${color};font-size:22px;margin:0 0 12px}p{color:#4A5568;line-height:1.5;word-break:break-word}a{display:inline-block;margin-top:16px;background:#202936;color:#fff;padding:12px 24px;border-radius:12px;text-decoration:none;font-weight:700}</style></head>
<body><div class="c"><h1>${title}</h1><p>${body}</p><a href="/">Back to Farmers</a></div></body></html>`;
  const esc = (v: unknown) => String(v ?? "").replace(/[<>&"']/g, (c) => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;", '"': "&quot;", "'": "&#39;" }[c] as string));
  app.get("/payment-success", (req, res) => {
    res.type("html").send(paymentPage("Payment successful", `Amount: ৳${esc(req.query.amount)}<br>Transaction ID: ${esc(req.query.trxId)}<br>You can close this page and return to the app.`, "#00875A"));
  });
  app.get("/payment-failed", (req, res) => {
    res.type("html").send(paymentPage("Payment failed", `Reason: ${esc(req.query.reason || "unknown")}. No money was taken. Please try again.`, "#DA2F2F"));
  });
  app.get("/payment-cancelled", (_req, res) => {
    res.type("html").send(paymentPage("Payment cancelled", "You cancelled the payment. No money was taken.", "#B25E09"));
  });

  // bKash Create Payment
  app.post("/api/bkash/create-payment", async (req, res) => {
    try {
      const { amount, paymentType, userId, callbackUrl } = req.body;
      
      if (!amount || !paymentType || !userId) {
        return res.status(400).json({ error: "Missing required fields" });
      }

      const idToken = await getBkashToken();
      const invoiceNumber = `INV${Date.now()}${Math.random().toString(36).substr(2, 9)}`;

      const response = await fetch(`${bkashConfig.baseUrl}/checkout/create`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${idToken}`,
          "X-APP-Key": bkashConfig.appKey,
        },
        body: JSON.stringify({
          mode: "0011",
          payerReference: userId,
          callbackURL: callbackUrl || `${publicBaseUrl(req)}/api/bkash/callback`,
          amount: amount.toString(),
          currency: "BDT",
          intent: "sale",
          merchantInvoiceNumber: invoiceNumber,
        }),
      });

      const data = await response.json();
      
      if (data.paymentID) {
        pendingPayments.set(data.paymentID, {
          paymentId: data.paymentID,
          amount: amount.toString(),
          invoiceNumber,
          paymentType,
          userId,
          createdAt: new Date(),
        });

        res.json({
          success: true,
          paymentID: data.paymentID,
          bkashURL: data.bkashURL,
          invoiceNumber,
        });
      } else {
        res.status(400).json({
          success: false,
          error: data.statusMessage || "Failed to create payment",
        });
      }
    } catch (error) {
      console.error("bKash create payment error:", error);
      res.status(500).json({ error: "Failed to create payment" });
    }
  });

  // bKash Execute Payment
  app.post("/api/bkash/execute-payment", async (req, res) => {
    try {
      const { paymentID } = req.body;
      
      if (!paymentID) {
        return res.status(400).json({ error: "Payment ID is required" });
      }

      const idToken = await getBkashToken();

      const response = await fetch(`${bkashConfig.baseUrl}/checkout/execute`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${idToken}`,
          "X-APP-Key": bkashConfig.appKey,
        },
        body: JSON.stringify({ paymentID }),
      });

      const data = await response.json();
      
      if (data.transactionStatus === "Completed") {
        const pendingPayment = pendingPayments.get(paymentID);
        if (pendingPayment) {
          pendingPayments.delete(paymentID);
        }

        res.json({
          success: true,
          transactionId: data.trxID,
          amount: data.amount,
          paymentExecuteTime: data.paymentExecuteTime,
          customerMsisdn: data.customerMsisdn,
          paymentType: pendingPayment?.paymentType,
        });
      } else {
        res.status(400).json({
          success: false,
          error: data.statusMessage || "Payment execution failed",
          transactionStatus: data.transactionStatus,
        });
      }
    } catch (error) {
      console.error("bKash execute payment error:", error);
      res.status(500).json({ error: "Failed to execute payment" });
    }
  });

  // bKash Callback Handler
  app.get("/api/bkash/callback", async (req, res) => {
    const { paymentID, status } = req.query;
    
    if (status === "success" && paymentID) {
      try {
        const idToken = await getBkashToken();

        const response = await fetch(`${bkashConfig.baseUrl}/checkout/execute`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${idToken}`,
            "X-APP-Key": bkashConfig.appKey,
          },
          body: JSON.stringify({ paymentID }),
        });

        const data = await response.json();
        const pendingPayment = pendingPayments.get(paymentID as string);
        
        if (data.transactionStatus === "Completed") {
          pendingPayments.delete(paymentID as string);
          res.redirect(`/payment-success?trxId=${data.trxID}&amount=${data.amount}&type=${pendingPayment?.paymentType || ""}`);
        } else {
          res.redirect(`/payment-failed?reason=${encodeURIComponent(data.statusMessage || "Payment failed")}`);
        }
      } catch (error) {
        console.error("bKash callback error:", error);
        res.redirect("/payment-failed?reason=callback_error");
      }
    } else if (status === "cancel") {
      res.redirect("/payment-cancelled");
    } else {
      res.redirect(`/payment-failed?reason=${status || "unknown"}`);
    }
  });

  // bKash Query Payment Status
  app.get("/api/bkash/payment-status/:paymentID", async (req, res) => {
    try {
      const { paymentID } = req.params;
      const idToken = await getBkashToken();

      const response = await fetch(`${bkashConfig.baseUrl}/checkout/payment/status?paymentID=${paymentID}`, {
        method: "GET",
        headers: {
          Authorization: `Bearer ${idToken}`,
          "X-APP-Key": bkashConfig.appKey,
        },
      });

      const data = await response.json();
      res.json(data);
    } catch (error) {
      console.error("bKash status check error:", error);
      res.status(500).json({ error: "Failed to check payment status" });
    }
  });

  // Push tokens and sending live in server/push.ts (signed-in users only).

  const httpServer = createServer(app);

  const wss = new WebSocketServer({ server: httpServer, path: "/ws/chat", maxPayload: 256 * 1024 });
  initCalls({ sendToUser, userOnline });
  initVoiceRooms({ sendToUser, userOnline });

  // Keep idle sockets alive through Render's proxy and drop dead ones.
  const heartbeat = setInterval(() => {
    wss.clients.forEach((ws: any) => {
      if (ws.isAlive === false) return ws.terminate();
      ws.isAlive = false;
      try { ws.ping(); } catch {}
    });
  }, 30000);
  wss.on("close", () => clearInterval(heartbeat));

  wss.on("connection", (ws: WebSocket) => {
    let clientId: string | null = null;
    let client: ChatClient | null = null;
    (ws as any).isAlive = true;
    ws.on("pong", () => { (ws as any).isAlive = true; });
    const reply = (m: any) => { if (ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify(m)); };

    ws.on("message", (data: Buffer) => {
      try {
        const message = JSON.parse(data.toString());

        if (message.type === "ping") return reply({ type: "pong" });

        if (message.type === "auth") {
          // The socket belongs to whoever owns the sign-in token. A bare userId is not
          // accepted any more: anyone could have claimed someone else's id and read their messages.
          let uid: string | null = null;
          try {
            const decoded = jwt.verify(String(message.token || ""), config.jwtSecret) as any;
            uid = decoded?.userId ? String(decoded.userId) : null;
          } catch {
            uid = null;
          }
          if (!uid) return reply({ type: "auth_failed", reason: "invalid_token" });
          if (client && clientId) removeChatClient(clientId, client);
          clientId = uid;
          client = { ws, userId: uid, conversationIds: new Set() };
          addChatClient(uid, client);
          reply({ type: "auth_success", userId: uid });
          // Deliver a call that is still ringing for this person (e.g. after opening the push).
          onCallClientAuthed(uid, ws);
          return;
        }

        if (!clientId) return reply({ type: "error", reason: "not_authenticated" });

        const mtype = String(message.type || "");
        if (mtype.startsWith("call_") || mtype.startsWith("webrtc_")) {
          // In-app voice calls: see server/calls.ts (who may call whom, and relaying set-up messages).
          void handleCallMessage(clientId, ws, message, reply).catch((e) => console.error("Call message error:", e?.message || e));
          return;
        }
        if (mtype.startsWith("vr_")) {
          // Voice rooms: see server/voiceRooms.ts (stage, hands, host controls, WebRTC relay).
          void handleVoiceRoomMessage(clientId, ws, message, reply).catch((e) => console.error("Voice room message error:", e?.message || e));
          return;
        }

        switch (message.type) {
          default:
            // join_conversation / send_message / typing from the old unused chat hook are
            // no longer relayed: direct messages go through the /api/dm routes, which check
            // who is in the conversation.
            break;
        }
      } catch (error) {
        console.error("WebSocket message error:", error);
      }
    });

    const cleanup = () => {
      if (clientId && client) removeChatClient(clientId, client);
      // A person whose last socket closed gets a short grace period before their call ends.
      if (clientId) onCallClientGone(clientId);
      if (clientId) onVoiceClientGone(clientId, ws);
      client = null;
    };
    ws.on("close", cleanup);
    ws.on("error", (error) => {
      console.error("WebSocket error:", (error as any)?.message || error);
      cleanup();
    });
  });

  console.log("WebSocket server initialized at /ws/chat");

  const liveAudioWss = new WebSocketServer({ noServer: true });
  const liveAudioSessions = new Map<WebSocket, any>();

  httpServer.on("upgrade", (request, socket, head) => {
    const pathname = request.url?.split("?")[0];
    
    if (pathname === "/ws/live-audio") {
      liveAudioWss.handleUpgrade(request, socket, head, (ws) => {
        liveAudioWss.emit("connection", ws, request);
      });
    }
  });

  liveAudioWss.on("connection", async (clientWs) => {
    console.log("Live audio client connected");
    
    const { createGeminiLiveSession, connectToGeminiLive, sendAudioToGemini, endGeminiSession, sendTextToGemini } = await import("./services/geminiLiveAudio");
    
    const session = createGeminiLiveSession(clientWs, "Charon");
    liveAudioSessions.set(clientWs, session);

    const connected = await connectToGeminiLive(session);
    if (!connected) {
      clientWs.send(JSON.stringify({ type: "error", message: "Failed to connect to AI" }));
      clientWs.close();
      return;
    }

    clientWs.on("message", (data) => {
      try {
        const message = JSON.parse(data.toString());
        
        switch (message.type) {
          case "audio":
            sendAudioToGemini(session, message.data, message.mimeType || "audio/pcm");
            break;
          case "text":
            sendTextToGemini(session, message.text);
            break;
          case "end":
            endGeminiSession(session);
            break;
        }
      } catch (error) {
        console.error("Live audio message error:", error);
      }
    });

    clientWs.on("close", () => {
      console.log("Live audio client disconnected");
      endGeminiSession(session);
      liveAudioSessions.delete(clientWs);
    });

    clientWs.on("error", (error) => {
      console.error("Live audio WebSocket error:", error);
      endGeminiSession(session);
      liveAudioSessions.delete(clientWs);
    });
  });

  console.log("Live Audio WebSocket initialized at /ws/live-audio");

  return httpServer;
}
