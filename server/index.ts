import { registerCatalogRoutes } from "./catalogRoutes";
import { registerGuestOrderRoutes } from "./guestOrders";
import { turnStatus } from "./calls";
import { registerFeatureRoutes } from "./featureRoutes";
import { registerPushRoutes } from "./push";
import { registerNotificationTargetRoutes } from "./notificationTargets";
import { registerCheckoutRoutes } from "./checkoutRoutes";
import { registerLiveDataRoutes } from "./liveDataRoutes";
import { registerPaymentRoutes } from "./paymentRoutes";
import { registerMarketPriceRoutes } from "./marketPriceRoutes";
import { registerPlatformRoutes, platformGuard } from "./platformRoutes";
import { registerAdminAppRoutes } from "./adminAppRoutes";
import { registerModerationRoutes } from "./moderationRoutes";
import { registerPreviewRoutes } from "./previewRoutes";
import { config } from "./config";
import express from "express";
import type { Request, Response, NextFunction } from "express";
import * as fs from "fs";
import * as path from "path";
import { registerRoutes } from "./routes";
import adminRoutes from "./adminRoutes";
import communityRoutes from "./communityRoutes";
import authRoutes from "./authRoutes";
import { initDatabase } from "./db";

const app = express();
const log = (...args: unknown[]) => console.log(new Date().toLocaleTimeString(), ...args);

declare module "http" {
  interface IncomingMessage {
    rawBody: unknown;
  }
}

/** Browser origins allowed to call the API (native apps send no Origin). */
function isAllowedOrigin(origin: string): boolean {
  if (config.corsOrigins.includes(origin)) return true;
  if (process.env.REPLIT_DEV_DOMAIN && origin === `https://${process.env.REPLIT_DEV_DOMAIN}`) return true;
  if (process.env.PUBLIC_URL && origin === process.env.PUBLIC_URL.replace(/\/$/, "")) return true;
  try {
    const { hostname } = new URL(origin);
    if (hostname === "localhost" || hostname === "127.0.0.1") return true;
    // Phones and laptops on the same Wi-Fi during development.
    if (!config.isProd && /^(10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.)/.test(hostname)) return true;
  } catch {
    return false;
  }
  return false;
}

function setupCors(app: express.Application) {
  app.use((req, res, next) => {
    const origin = req.header("origin");
    if (origin && isAllowedOrigin(origin)) {
      res.header("Access-Control-Allow-Origin", origin);
      res.header("Access-Control-Allow-Methods", "GET, POST, PUT, PATCH, DELETE, OPTIONS");
      res.header("Access-Control-Allow-Headers", "Content-Type, Authorization, X-Guest-Key");
      res.header("Access-Control-Allow-Credentials", "true");
      res.header("Vary", "Origin");
    }
    if (req.method === "OPTIONS") return res.sendStatus(204);
    next();
  });
}

function setupBodyParsing(app: express.Application) {
  app.use(
    express.json({
      limit: "50mb",
      verify: (req, _res, buf) => {
        req.rawBody = buf;
      },
    }),
  );
  app.use(express.urlencoded({ extended: false, limit: "50mb" }));
}

/** Logs method, path, status and time. Response bodies are never logged (they can hold tokens). */
function setupRequestLogging(app: express.Application) {
  app.use((req, res, next) => {
    const start = Date.now();
    res.on("finish", () => {
      if (!req.path.startsWith("/api")) return;
      log(`${req.method} ${req.path} ${res.statusCode} in ${Date.now() - start}ms`);
    });
    next();
  });
}

/** Serves the Expo web export (npm run web:export) so one server hosts the API and the web app. */
function serveWebApp(app: express.Application) {
  const webDir = path.resolve(process.cwd(), "dist");
  app.use("/admin-assets", express.static(path.resolve(process.cwd(), "server", "admin-panel")));
  // Legacy API-key panel. /admin and /seller now open the Admin and Seller apps (same web export).
  app.get(["/admin-legacy", "/admin-legacy/*"], (_req, res) => {
    res.sendFile(path.resolve(process.cwd(), "server", "admin-panel", "index.html"));
  });

  if (!fs.existsSync(path.join(webDir, "index.html"))) {
    app.get("/", (_req, res) => {
      res.type("text/plain").send("Farmers API is running. Build the web app with `npm run web:export` to serve it here.");
    });
    return;
  }

  app.use(express.static(webDir, { index: false, maxAge: config.isProd ? "1h" : 0 }));
  app.get("*", (req, res, next) => {
    if (req.path.startsWith("/api") || req.path.startsWith("/ws")) return next();
    res.sendFile(path.join(webDir, "index.html"));
  });
  log(`Serving web app from ${webDir}`);
}

function setupErrorHandler(app: express.Application) {
  app.use((err: unknown, _req: Request, res: Response, _next: NextFunction) => {
    const error = err as { status?: number; statusCode?: number; message?: string };
    const status = error.status || error.statusCode || 500;
    if (status >= 500) console.error(err);
    if (!res.headersSent) {
      res.status(status).json({ message: status >= 500 ? "Internal Server Error" : error.message });
    }
  });
}

(async () => {
  await initDatabase();

  setupCors(app);
  setupBodyParsing(app);
  setupRequestLogging(app);
  app.use(platformGuard);

  app.get("/api/health", (_req, res) => {
    res.json({
      ok: true,
      time: new Date().toISOString(),
      version: (process.env.RENDER_GIT_COMMIT || "local").slice(0, 7),
      callRelay: turnStatus(),
    });
  });

  registerPlatformRoutes(app);
  registerAdminAppRoutes(app);
  registerModerationRoutes(app);
  registerPreviewRoutes(app);
  registerCatalogRoutes(app);
  registerGuestOrderRoutes(app);
  registerFeatureRoutes(app);
  registerPushRoutes(app);
  registerNotificationTargetRoutes(app);
  registerCheckoutRoutes(app);
  registerLiveDataRoutes(app);
  registerPaymentRoutes(app);
  registerMarketPriceRoutes(app);
  app.use("/api/admin", adminRoutes);
  app.use("/api", communityRoutes);
  app.use("/api/auth", authRoutes);

  const server = await registerRoutes(app);

  // Unknown API routes answer with JSON, not an HTML error page.
  app.use("/api", (req, res) => {
    res.status(404).json({ error: `Not found: ${req.method} ${req.originalUrl}` });
  });

  serveWebApp(app);
  setupErrorHandler(app);

  server.listen({ port: config.port, host: "0.0.0.0" }, () => {
    log(`Farmers server listening on http://localhost:${config.port}`);
  });
})().catch((err) => {
  console.error("Server failed to start:", err);
  process.exit(1);
});
