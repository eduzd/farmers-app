// Native (Android / iOS) Firebase Auth.
// The app keeps its own session token after sign-in, so Firebase only needs to
// remember the user for the length of a sign-in (in-memory persistence). That
// avoids storing a second long-lived credential on the phone.
import {
  Auth,
  getAuth,
  GoogleAuthProvider,
  initializeAuth,
  inMemoryPersistence,
  signInWithCredential,
  UserCredential,
} from "firebase/auth";
import { Platform } from "react-native";
import {
  GoogleSignin,
  isCancelledResponse,
  isErrorWithCode,
  isSuccessResponse,
  statusCodes,
} from "@react-native-google-signin/google-signin";
import { getFirebaseApp } from "./firebaseConfig";

let auth: Auth | null = null;

export function getFirebaseAuth(): Auth {
  if (auth) return auth;
  const app = getFirebaseApp();
  try {
    auth = initializeAuth(app, { persistence: inMemoryPersistence });
  } catch {
    auth = getAuth(app);
  }
  return auth;
}

/**
 * Web OAuth client of the Farms Firebase project (the "client_type 3" entry in
 * google-services.json). Google returns an ID token for this audience, which
 * Firebase accepts. The Android OAuth client (package com.farmers.app + the
 * APK's SHA-1) must also exist in the same Google Cloud project, otherwise
 * Google answers with DEVELOPER_ERROR.
 */
const GOOGLE_WEB_CLIENT_ID =
  process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID ||
  "441067005442-gar7kt0k06p5gt0um32c5h61i317vstn.apps.googleusercontent.com";

/** Android only for now: iOS needs its own OAuth client + URL scheme. */
export const googleSignInAvailable = Platform.OS === "android";

let configured = false;
function ensureConfigured() {
  if (configured) return;
  GoogleSignin.configure({
    webClientId: GOOGLE_WEB_CLIENT_ID,
    offlineAccess: false,
  });
  configured = true;
}

function appError(code: string, message: string): Error {
  const err: any = new Error(message);
  err.code = code;
  return err;
}

export async function signInWithGooglePopup(): Promise<UserCredential> {
  if (!googleSignInAvailable) {
    throw appError(
      "app/google-unavailable",
      "Google sign-in isn't available on this device yet.",
    );
  }
  ensureConfigured();
  try {
    await GoogleSignin.hasPlayServices({
      showPlayServicesUpdateDialog: true,
    });
    // Always show the account picker instead of silently reusing the last
    // Google account (matters on shared family phones).
    try {
      await GoogleSignin.signOut();
    } catch {
      // Nothing to sign out of.
    }
    const response = await GoogleSignin.signIn();
    if (isCancelledResponse(response)) {
      throw appError("auth/popup-closed-by-user", "Google sign-in cancelled");
    }
    if (!isSuccessResponse(response) || !response.data.idToken) {
      throw appError("app/google-no-token", "Google didn't return a sign-in token");
    }
    const credential = GoogleAuthProvider.credential(response.data.idToken);
    const result = await signInWithCredential(getFirebaseAuth(), credential);
    // The app keeps its own session; drop Google's cached account.
    GoogleSignin.signOut().catch(() => {});
    return result;
  } catch (error: any) {
    if (error?.code && String(error.code).startsWith("auth/")) throw error;
    if (error?.code && String(error.code).startsWith("app/")) throw error;
    if (isErrorWithCode(error)) {
      switch (error.code) {
        case statusCodes.SIGN_IN_CANCELLED:
          throw appError("auth/popup-closed-by-user", "Google sign-in cancelled");
        case statusCodes.IN_PROGRESS:
          throw appError("auth/cancelled-popup-request", "Google sign-in already open");
        case statusCodes.PLAY_SERVICES_NOT_AVAILABLE:
          throw appError("app/play-services", "Google Play services missing");
        default:
          // "10" / DEVELOPER_ERROR = OAuth client / SHA-1 not registered.
          throw appError(
            String(error.code) === "10" || /DEVELOPER_ERROR/i.test(error.message || "")
              ? "app/google-config"
              : "app/google-failed",
            error.message || "Google sign-in failed",
          );
      }
    }
    throw error;
  }
}

export async function googleSignOut(): Promise<void> {
  if (!googleSignInAvailable || !configured) return;
  try {
    await GoogleSignin.signOut();
  } catch {
    // ignore
  }
}
