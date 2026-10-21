import jwt from "jsonwebtoken";
import { config } from "./config";

/**
 * Verifies Firebase Authentication ID tokens without firebase-admin, following
 * Firebase's "verify ID tokens using a third-party JWT library" rules:
 * RS256, kid from Google's securetoken certs, aud = project ID,
 * iss = https://securetoken.google.com/<project ID>, non-empty sub,
 * exp in the future and auth_time in the past.
 */

const GOOGLE_CERTS_URL =
  "https://www.googleapis.com/robot/v1/metadata/x509/securetoken@system.gserviceaccount.com";

// Test-only override of the certificate source. Ignored in production so a
// stray env var can never make the server trust other keys.
function certsUrl(): string {
  if (!config.isProd && process.env.FIREBASE_CERTS_URL_FOR_TESTS) {
    return process.env.FIREBASE_CERTS_URL_FOR_TESTS;
  }
  return GOOGLE_CERTS_URL;
}

let certCache: {
  certs: Record<string, string>;
  expiresAt: number;
  url: string;
} | null = null;

async function getCerts(): Promise<Record<string, string>> {
  const url = certsUrl();
  if (certCache && certCache.url === url && certCache.expiresAt > Date.now()) {
    return certCache.certs;
  }
  const res = await fetch(url);
  if (!res.ok)
    throw new Error(`Could not fetch Firebase signing keys (${res.status})`);
  const certs = (await res.json()) as Record<string, string>;
  const maxAge = /max-age=(\d+)/.exec(res.headers.get("cache-control") || "");
  const ttlMs = maxAge ? parseInt(maxAge[1], 10) * 1000 : 60 * 60 * 1000;
  certCache = { certs, expiresAt: Date.now() + ttlMs, url };
  return certs;
}

export interface FirebaseIdentity {
  uid: string;
  email: string | null;
  emailVerified: boolean;
  name: string | null;
  picture: string | null;
  signInProvider: string | null;
}

export class FirebaseTokenError extends Error {}

export async function verifyFirebaseIdToken(
  idToken: string,
): Promise<FirebaseIdentity> {
  const projectId = config.firebaseProjectId;
  if (!projectId)
    throw new FirebaseTokenError(
      "Firebase sign-in is not configured on the server",
    );
  if (
    typeof idToken !== "string" ||
    idToken.length < 20 ||
    idToken.length > 8192
  ) {
    throw new FirebaseTokenError("Invalid sign-in token");
  }

  const decoded = jwt.decode(idToken, { complete: true });
  if (!decoded || typeof decoded === "string" || !decoded.header) {
    throw new FirebaseTokenError("Invalid sign-in token");
  }
  const { alg, kid } = decoded.header;
  if (alg !== "RS256" || !kid)
    throw new FirebaseTokenError("Invalid sign-in token");

  let certs = await getCerts();
  if (!certs[kid]) {
    // Keys rotate; refresh once before giving up.
    certCache = null;
    certs = await getCerts();
  }
  const cert = certs[kid];
  if (!cert) throw new FirebaseTokenError("Invalid sign-in token");

  let payload: any;
  try {
    payload = jwt.verify(idToken, cert, {
      algorithms: ["RS256"],
      audience: projectId,
      issuer: `https://securetoken.google.com/${projectId}`,
      clockTolerance: 5,
    });
  } catch {
    throw new FirebaseTokenError("Invalid or expired sign-in token");
  }

  const nowSec = Math.floor(Date.now() / 1000);
  if (
    typeof payload.sub !== "string" ||
    payload.sub.length === 0 ||
    payload.sub.length > 128
  ) {
    throw new FirebaseTokenError("Invalid sign-in token");
  }
  if (typeof payload.auth_time !== "number" || payload.auth_time > nowSec + 5) {
    throw new FirebaseTokenError("Invalid sign-in token");
  }
  if (typeof payload.iat !== "number" || payload.iat > nowSec + 5) {
    throw new FirebaseTokenError("Invalid sign-in token");
  }

  return {
    uid: payload.sub,
    email:
      typeof payload.email === "string"
        ? payload.email.trim().toLowerCase()
        : null,
    emailVerified: payload.email_verified === true,
    name: typeof payload.name === "string" ? payload.name : null,
    picture: typeof payload.picture === "string" ? payload.picture : null,
    signInProvider: payload.firebase?.sign_in_provider ?? null,
  };
}
