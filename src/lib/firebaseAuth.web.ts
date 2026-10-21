// Web Firebase Auth: in-memory persistence (the app keeps its own session
// token) and the popup resolver for Google sign-in.
import {
  Auth,
  GoogleAuthProvider,
  browserPopupRedirectResolver,
  getAuth,
  inMemoryPersistence,
  initializeAuth,
  signInWithPopup,
  UserCredential,
} from "firebase/auth";
import { getFirebaseApp } from "./firebaseConfig";

let auth: Auth | null = null;

export function getFirebaseAuth(): Auth {
  if (auth) return auth;
  const app = getFirebaseApp();
  try {
    auth = initializeAuth(app, {
      persistence: inMemoryPersistence,
      popupRedirectResolver: browserPopupRedirectResolver,
    });
  } catch {
    auth = getAuth(app);
  }
  return auth;
}

export const googleSignInAvailable = true;

export async function signInWithGooglePopup(): Promise<UserCredential> {
  const provider = new GoogleAuthProvider();
  provider.setCustomParameters({ prompt: "select_account" });
  return signInWithPopup(getFirebaseAuth(), provider);
}
