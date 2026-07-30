import { initializeApp, getApps, getApp, type FirebaseApp } from "firebase/app";
import {
  getAnalytics,
  isSupported,
  type Analytics,
} from "firebase/analytics";

/**
 * Firebase Web config. Values are publishable (safe in the client bundle).
 * Provide them via env vars (VITE_FIREBASE_*) — falls back to the WaveChat
 * Firebase project defaults extracted from google-services.json.
 * NOTE: measurementId (G-XXXXXXX) is required for Firebase Analytics on web.
 */
const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY ?? "AIzaSyAosGpXh4GdEXFTqNhMSP_ICeZlvxGiry4",
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN ?? "wavechat-fe92e.firebaseapp.com",
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID ?? "wavechat-fe92e",
  storageBucket:
    import.meta.env.VITE_FIREBASE_STORAGE_BUCKET ?? "wavechat-fe92e.firebasestorage.app",
  messagingSenderId: import.meta.env.VITE_FIREBASE_SENDER_ID ?? "209558207951",
  appId: import.meta.env.VITE_FIREBASE_APP_ID ?? "1:209558207951:web:cbce670d8b97f8f6f2a6ba",
  measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID ?? "G-4MD3Q2SLZW",
};

export function isFirebaseAnalyticsConfigured(): boolean {
  return Boolean(firebaseConfig.appId && firebaseConfig.measurementId);
}

let appInstance: FirebaseApp | null = null;
let analyticsPromise: Promise<Analytics | null> | null = null;

export function getFirebaseApp(): FirebaseApp | null {
  if (typeof window === "undefined") return null;
  if (!isFirebaseAnalyticsConfigured()) return null;
  if (appInstance) return appInstance;
  appInstance = getApps().length ? getApp() : initializeApp(firebaseConfig);
  return appInstance;
}

/** Lazily resolves the Analytics instance (null when unsupported/not configured). */
export function getFirebaseAnalytics(): Promise<Analytics | null> {
  if (analyticsPromise) return analyticsPromise;
  analyticsPromise = (async () => {
    try {
      const app = getFirebaseApp();
      if (!app) return null;
      if (!(await isSupported())) return null;
      return getAnalytics(app);
    } catch (e) {
      console.warn("Firebase Analytics init failed", e);
      return null;
    }
  })();
  return analyticsPromise;
}
