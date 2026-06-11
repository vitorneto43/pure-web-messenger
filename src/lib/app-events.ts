import { Capacitor } from "@capacitor/core";
import { track } from "@/lib/track";

function isNativeAndroid(): boolean {
  try {
    if (Capacitor.isNativePlatform() && Capacitor.getPlatform() === "android") return true;
  } catch {}
  // Fallback: TWA / WebView on Android still counts as app
  try {
    const ua = typeof navigator !== "undefined" ? navigator.userAgent : "";
    if (/Android/i.test(ua) && /(wv|WebView)/.test(ua)) return true;
  } catch {}
  return false;
}

const K_INSTALL = "wc_evt_app_install";
const K_FIRST_OPEN = "wc_evt_app_first_open";

/** Fires once per device install (persisted in localStorage). */
export function recordAppInstallOnce() {
  if (!isNativeAndroid()) return;
  try {
    if (localStorage.getItem(K_INSTALL)) return;
    localStorage.setItem(K_INSTALL, String(Date.now()));
    void track("app_install", { platform: "android" });
  } catch {}
}

/** Fires once per device on the first authenticated open. */
export function recordAppFirstOpenOnce(userId: string) {
  if (!isNativeAndroid()) return;
  try {
    if (localStorage.getItem(K_FIRST_OPEN)) return;
    localStorage.setItem(K_FIRST_OPEN, String(Date.now()));
    void track("app_first_open", { platform: "android", user_id: userId });
  } catch {}
}

/** Fires on every login from the native app. */
export function recordAppLogin(userId: string) {
  if (!isNativeAndroid()) return;
  void track("app_login", { platform: "android", user_id: userId });
}

/** Fires on signup completion from the native app. */
export function recordAppSignup(userId?: string) {
  if (!isNativeAndroid()) return;
  void track("app_signup", { platform: "android", user_id: userId });
}
