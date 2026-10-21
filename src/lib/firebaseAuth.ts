// Native (Android / iOS) Firebase Auth.
// The app keeps its own session token after sign-in, so Firebase only needs to
// remember the user for the length of a sign-in (in-memory persistence). That
// avoids storing a second long-lived credential on the phone.
import {
  Auth,
  getAuth,
  initializeAuth,
  inMemoryPersistence,
  UserCredential,
} from "firebase/auth";
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

/** Google sign-in on the phone needs the Android app registered in Firebase
 * plus a native Google sign-in module, which aren't set up yet. */
export const googleSignInAvailable = false;

export async function signInWithGooglePopup(): Promise<UserCredential> {
  const err: any = new Error(
    "Google sign-in isn't available in the phone app yet.",
  );
  err.code = "app/google-unavailable";
  throw err;
}
