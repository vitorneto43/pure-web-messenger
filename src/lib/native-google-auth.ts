// Native Google sign-in for the Capacitor Android app.
//
// Google blocks OAuth flows inside generic WebViews, so on native we open the
// Lovable OAuth broker URL in a Chrome Custom Tab (`@capacitor/browser`) and
// listen for the deep-link callback (`com.wavechat.app://oauth-callback`).
// The broker appends `access_token` & `refresh_token` to the redirect URI,
// which we hand off to `supabase.auth.setSession()`.
//
// On the web we just return false and the caller falls back to the existing
// `lovable.auth.signInWithOAuth("google")` popup flow.

import { supabase } from "@/integrations/supabase/client";

export const NATIVE_OAUTH_REDIRECT_URI = "com.wavechat.app://oauth-callback";

export async function isNativePlatform(): Promise<boolean> {
  try {
    const { Capacitor } = await import("@capacitor/core");
    return Capacitor.isNativePlatform();
  } catch {
    return false;
  }
}

function generateState(): string {
  if (typeof crypto !== "undefined" && crypto.getRandomValues) {
    return [...crypto.getRandomValues(new Uint8Array(16))]
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("");
  }
  return Math.random().toString(36).slice(2) + Date.now().toString(36);
}

const STATE_KEY = "wavechat:native-oauth-state";

/**
 * Returns true if the native flow was launched (caller should NOT continue
 * with the web fallback). Returns false on web or if the native modules are
 * unavailable.
 */
export async function signInWithGoogleNative(): Promise<boolean> {
  if (!(await isNativePlatform())) return false;
  try {
    const { Browser } = await import("@capacitor/browser");
    const state = generateState();
    try {
      sessionStorage.setItem(STATE_KEY, state);
    } catch {
      /* ignore */
    }
    const params = new URLSearchParams({
      provider: "google",
      redirect_uri: NATIVE_OAUTH_REDIRECT_URI,
      state,
    });
    const base =
      (typeof window !== "undefined" ? window.location.origin : "") +
      "/~oauth/initiate";
    await Browser.open({ url: `${base}?${params.toString()}` });
    return true;
  } catch (e) {
    console.error("[native-google-auth] launch failed", e);
    return false;
  }
}

/**
 * Mount once at app boot. Listens for the deep-link callback, extracts tokens
 * and finalizes the Supabase session. Returns an unsubscribe function.
 */
export async function installNativeOAuthListener(): Promise<() => void> {
  if (!(await isNativePlatform())) return () => {};
  try {
    const { App } = await import("@capacitor/app");
    const { Browser } = await import("@capacitor/browser");
    const handle = await App.addListener("appUrlOpen", async (event) => {
      const url = event?.url || "";
      if (!url.startsWith(NATIVE_OAUTH_REDIRECT_URI)) return;
      try {
        const u = new URL(url);
        // Tokens can be in the query string or the hash fragment.
        const query = new URLSearchParams(u.search);
        const hash = new URLSearchParams((u.hash || "").replace(/^#/, ""));
        const access = query.get("access_token") || hash.get("access_token");
        const refresh = query.get("refresh_token") || hash.get("refresh_token");
        const err = query.get("error") || hash.get("error");
        if (err) {
          console.error("[native-google-auth] callback error", err);
          return;
        }
        if (access && refresh) {
          await supabase.auth.setSession({
            access_token: access,
            refresh_token: refresh,
          });
        }
      } finally {
        try {
          await Browser.close();
        } catch {
          /* ignore */
        }
      }
    });
    return () => {
      void handle.remove();
    };
  } catch (e) {
    console.warn("[native-google-auth] listener install failed", e);
    return () => {};
  }
}
