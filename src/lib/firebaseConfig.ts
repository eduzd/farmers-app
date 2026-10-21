import { initializeApp, getApps, getApp, FirebaseApp } from "firebase/app";

/**
 * Public Firebase web config for the "Farms" project (farms-31bf9).
 * These values are meant to ship in the app; they identify the project and are
 * not secrets. Access is controlled by Firebase Auth and by the server, which
 * verifies every Firebase ID token before issuing its own session.
 * EXPO_PUBLIC_FIREBASE_* variables override them for another project.
 */
export const firebaseConfig = {
  apiKey:
    process.env.EXPO_PUBLIC_FIREBASE_API_KEY ||
    "AIzaSyDRAUJu7szUfeoPXMq_i-4fQTFOL6S3f0E",
  authDomain:
    process.env.EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN ||
    "farms-31bf9.firebaseapp.com",
  projectId: process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID || "farms-31bf9",
  storageBucket:
    process.env.EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET ||
    "farms-31bf9.firebasestorage.app",
  messagingSenderId:
    process.env.EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID || "441067005442",
  appId:
    process.env.EXPO_PUBLIC_FIREBASE_APP_ID ||
    "1:441067005442:web:aafb8819ae0611ddbd691b",
};

export function getFirebaseApp(): FirebaseApp {
  return getApps().length ? getApp() : initializeApp(firebaseConfig);
}
