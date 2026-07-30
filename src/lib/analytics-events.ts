import { Capacitor } from "@capacitor/core";
import { logEvent, setUserId, setUserProperties } from "firebase/analytics";
import { getFirebaseAnalytics, isFirebaseAnalyticsConfigured } from "@/lib/firebase";
import { track } from "@/lib/track";

/**
 * Canonical WaveChat funnel events (Firebase naming best practices:
 * snake_case, <= 40 chars, params <= 100 chars).
 */
export type WaveChatEvent =
  | "app_open"
  | "view_login"
  | "start_signup"
  | "signup_success"
  | "login_success"
  | "view_feed"
  | "create_post"
  | "create_story"
  | "send_message"
  | "join_group"
  | "start_live"
  | "start_call";

export const APP_VERSION: string = import.meta.env.VITE_APP_VERSION ?? "1.30";

const INSTALL_SOURCE_KEY = "wc_install_source";
const ATTRIBUTION_KEY = "wc_session_attribution";
const COUNTRY_KEY = "wc_country";

function safeLocalStorage(): Storage | null {
  try {
    return typeof window === "undefined" ? null : window.localStorage;
  } catch {
    return null;
  }
}

export function getPlatform(): string {
  try {
    if (Capacitor.isNativePlatform()) return Capacitor.getPlatform(); // android | ios
  } catch {}
  try {
    const ua = typeof navigator !== "undefined" ? navigator.userAgent : "";
    if (/Android/i.test(ua) && /(wv|WebView)/.test(ua)) return "android_twa";
    if (
      typeof window !== "undefined" &&
      window.matchMedia?.("(display-mode: standalone)")?.matches
    )
      return "pwa";
  } catch {}
  return "web";
}

export function getDeviceLanguage(): string {
  try {
    return navigator.language || navigator.languages?.[0] || "unknown";
  } catch {
    return "unknown";
  }
}

/** Best-effort country: stored profile country → locale region → timezone hint. */
export function getCountry(): string {
  const ls = safeLocalStorage();
  const stored = ls?.getItem(COUNTRY_KEY);
  if (stored) return stored.toUpperCase();
  try {
    const loc = new Intl.Locale(getDeviceLanguage());
    if (loc.region) return loc.region.toUpperCase();
  } catch {}
  return "unknown";
}

export function setCountry(country: string | null | undefined) {
  if (!country) return;
  try {
    safeLocalStorage()?.setItem(COUNTRY_KEY, country);
  } catch {}
}

/** Where the install/visit came from (utm_source, referrer host, or store). */
export function getInstallSource(): string {
  const ls = safeLocalStorage();
  try {
    const cached = ls?.getItem(INSTALL_SOURCE_KEY);
    if (cached) return cached;
    let source = "unknown";
    const attrRaw = ls?.getItem(ATTRIBUTION_KEY);
    if (attrRaw) {
      const attr = JSON.parse(attrRaw) as Record<string, string>;
      source =
        attr.utm_source ||
        (attr.fbclid && "facebook") ||
        (attr.gclid && "google") ||
        (attr.ttclid && "tiktok") ||
        source;
    }
    if (source === "unknown") {
      const platform = getPlatform();
      if (platform === "android" || platform === "android_twa") source = "play_store";
      else if (typeof document !== "undefined" && document.referrer) {
        try {
          source = new URL(document.referrer).hostname.replace(/^www\./, "");
        } catch {}
      } else source = "direct";
    }
    ls?.setItem(INSTALL_SOURCE_KEY, source);
    return source;
  } catch {
    return "unknown";
  }
}

export function commonParams(): Record<string, string> {
  return {
    country: getCountry(),
    device_language: getDeviceLanguage(),
    platform: getPlatform(),
    app_version: APP_VERSION,
    install_source: getInstallSource(),
  };
}

/**
 * Logs an event to Firebase Analytics (when configured) and to the internal
 * analytics table, always enriched with the common funnel parameters.
 */
export function logAppEvent(
  name: WaveChatEvent | (string & {}),
  params: Record<string, unknown> = {},
) {
  if (typeof window === "undefined") return;
  const payload = { ...commonParams(), ...params };
  void track(name, payload);
  if (!isFirebaseAnalyticsConfigured()) return;
  void (async () => {
    try {
      const analytics = await getFirebaseAnalytics();
      if (!analytics) return;
      logEvent(analytics, name as string, payload);
    } catch (e) {
      console.warn("firebase logEvent failed", e);
    }
  })();
}

/** Identify the user for retention (D1/D7/D30) and cohort analysis. */
export function identifyUser(userId: string | null) {
  if (!isFirebaseAnalyticsConfigured()) return;
  void (async () => {
    try {
      const analytics = await getFirebaseAnalytics();
      if (!analytics) return;
      setUserId(analytics, userId);
      if (userId) setUserProperties(analytics, commonParams());
    } catch (e) {
      console.warn("firebase identify failed", e);
    }
  })();
}
