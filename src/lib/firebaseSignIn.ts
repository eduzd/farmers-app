import {
  createUserWithEmailAndPassword,
  sendEmailVerification,
  signInWithEmailAndPassword,
  signOut,
  updateProfile,
  User as FirebaseUser,
} from "firebase/auth";
import {
  getFirebaseAuth,
  googleSignInAvailable,
  signInWithGooglePopup,
} from "./firebaseAuth";

export { googleSignInAvailable };

export type FirebaseStep =
  | { kind: "token"; idToken: string; name?: string | null }
  | { kind: "needs_verification"; email: string };

function current(): FirebaseUser | null {
  return getFirebaseAuth().currentUser;
}

/** Create an email/password account and send Firebase's verification email. */
export async function firebaseSignUp(
  name: string,
  email: string,
  password: string,
): Promise<FirebaseStep> {
  const cred = await createUserWithEmailAndPassword(
    getFirebaseAuth(),
    email,
    password,
  );
  if (name) {
    try {
      await updateProfile(cred.user, { displayName: name });
    } catch {
      // Name is cosmetic; the server also receives it at sign-in.
    }
  }
  await sendEmailVerification(cred.user);
  return { kind: "needs_verification", email: cred.user.email || email };
}

/** Sign in with email/password. Unverified accounts stay signed in to Firebase
 * (in memory) so the user can resend the email or confirm they've verified. */
export async function firebaseSignIn(
  email: string,
  password: string,
): Promise<FirebaseStep> {
  const cred = await signInWithEmailAndPassword(
    getFirebaseAuth(),
    email,
    password,
  );
  if (!cred.user.emailVerified) {
    return { kind: "needs_verification", email: cred.user.email || email };
  }
  return {
    kind: "token",
    idToken: await cred.user.getIdToken(),
    name: cred.user.displayName,
  };
}

/** After the user clicks the link: reload and get a fresh token that carries
 * email_verified = true. */
export async function firebaseCheckVerified(): Promise<FirebaseStep | null> {
  const user = current();
  if (!user) return null;
  await user.reload();
  if (!user.emailVerified)
    return { kind: "needs_verification", email: user.email || "" };
  return {
    kind: "token",
    idToken: await user.getIdToken(true),
    name: user.displayName,
  };
}

export async function firebaseResendVerification(): Promise<boolean> {
  const user = current();
  if (!user) return false;
  await sendEmailVerification(user);
  return true;
}

export async function firebaseGoogleSignIn(): Promise<FirebaseStep> {
  const cred = await signInWithGooglePopup();
  return {
    kind: "token",
    idToken: await cred.user.getIdToken(),
    name: cred.user.displayName,
  };
}

export async function firebaseSignOut(): Promise<void> {
  try {
    await signOut(getFirebaseAuth());
  } catch {
    // Nothing to sign out of.
  }
}

export function hasPendingFirebaseUser(): boolean {
  return !!current();
}

const MESSAGES: Record<string, { en: string; bn: string }> = {
  "auth/email-already-in-use": {
    en: "An account with this email already exists. Sign in instead.",
    bn: "এই ইমেইলে আগে থেকেই অ্যাকাউন্ট আছে। সাইন ইন করুন।",
  },
  "auth/invalid-email": {
    en: "That email address doesn't look right.",
    bn: "ইমেইল ঠিকানাটি সঠিক নয়।",
  },
  "auth/weak-password": {
    en: "Password is too weak. Use at least 6 characters.",
    bn: "পাসওয়ার্ড দুর্বল। কমপক্ষে ৬ অক্ষর দিন।",
  },
  "auth/invalid-credential": {
    en: "Wrong email or password.",
    bn: "ইমেইল বা পাসওয়ার্ড ভুল।",
  },
  "auth/wrong-password": {
    en: "Wrong email or password.",
    bn: "ইমেইল বা পাসওয়ার্ড ভুল।",
  },
  "auth/user-not-found": {
    en: "Wrong email or password.",
    bn: "ইমেইল বা পাসওয়ার্ড ভুল।",
  },
  "auth/user-disabled": {
    en: "This account has been disabled.",
    bn: "এই অ্যাকাউন্টটি বন্ধ করা হয়েছে।",
  },
  "auth/too-many-requests": {
    en: "Too many attempts. Please wait a few minutes and try again.",
    bn: "অনেকবার চেষ্টা হয়েছে। কিছুক্ষণ পরে আবার চেষ্টা করুন।",
  },
  "auth/network-request-failed": {
    en: "No internet connection. Check your network and try again.",
    bn: "ইন্টারনেট সংযোগ নেই। আবার চেষ্টা করুন।",
  },
  "auth/popup-closed-by-user": {
    en: "Google sign-in was cancelled.",
    bn: "Google সাইন ইন বাতিল হয়েছে।",
  },
  "auth/cancelled-popup-request": {
    en: "Google sign-in was cancelled.",
    bn: "Google সাইন ইন বাতিল হয়েছে।",
  },
  "auth/popup-blocked": {
    en: "Your browser blocked the Google window. Allow pop-ups and try again.",
    bn: "ব্রাউজার Google উইন্ডো আটকে দিয়েছে। পপ-আপ চালু করে আবার চেষ্টা করুন।",
  },
  "auth/unauthorized-domain": {
    en: "Google sign-in isn't allowed on this web address yet.",
    bn: "এই ওয়েব ঠিকানায় এখনও Google সাইন ইন চালু হয়নি।",
  },
  "auth/operation-not-allowed": {
    en: "This sign-in method is turned off.",
    bn: "এই সাইন ইন পদ্ধতি বন্ধ আছে।",
  },
  "app/play-services": {
    en: "Google Play services is missing or out of date on this phone. Update it, or use email.",
    bn: "এই ফোনে Google Play services নেই বা পুরোনো। আপডেট করুন, অথবা ইমেইল ব্যবহার করুন।",
  },
  "app/google-config": {
    en: "Google sign-in isn't set up for this version of the app yet. Please use email for now.",
    bn: "অ্যাপের এই সংস্করণে Google সাইন ইন এখনও সেট আপ হয়নি। আপাতত ইমেইল ব্যবহার করুন।",
  },
  "app/google-no-token": {
    en: "Google sign-in didn't finish. Please try again.",
    bn: "Google সাইন ইন শেষ হয়নি। আবার চেষ্টা করুন।",
  },
  "app/google-failed": {
    en: "Google sign-in failed. Please try again or use email.",
    bn: "Google সাইন ইন হয়নি। আবার চেষ্টা করুন অথবা ইমেইল ব্যবহার করুন।",
  },
  "auth/account-exists-with-different-credential": {
    en: "This email already has an account with a password. Sign in with email and password.",
    bn: "এই ইমেইলে পাসওয়ার্ড দিয়ে অ্যাকাউন্ট আছে। ইমেইল ও পাসওয়ার্ড দিয়ে সাইন ইন করুন।",
  },
  "app/google-unavailable": {
    en: "Google sign-in is coming to the phone app soon. Please use email for now.",
    bn: "ফোন অ্যাপে Google সাইন ইন শীঘ্রই আসছে। আপাতত ইমেইল ব্যবহার করুন।",
  },
};

export function firebaseErrorMessage(
  error: any,
  lang: "en" | "bn" = "en",
): string {
  const m = error?.code ? MESSAGES[error.code] : undefined;
  if (m) return m[lang];
  return lang === "bn"
    ? "কিছু একটা সমস্যা হয়েছে। আবার চেষ্টা করুন।"
    : "Something went wrong. Please try again.";
}

export function isBadCredentials(error: any): boolean {
  return [
    "auth/invalid-credential",
    "auth/wrong-password",
    "auth/user-not-found",
  ].includes(error?.code);
}
