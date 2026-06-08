// Native Google sign-in for the Capacitor Android app.
//
// Uses the native Google Sign-In SDK via @codetrix-studio/capacitor-google-auth
// — opens the system Google account picker INSIDE the app (no browser, no
// website redirect). The plugin returns an idToken which we hand to Supabase
// via `signInWithIdToken({ provider: 'google' })`.
//
// IMPORTANT — for this to work the Android build needs the Google Web OAuth
// Client ID configured in capacitor.config.ts under
// plugins.GoogleAuth.serverClientId, AND that same Client ID must be added
// to the Supabase Auth Google provider as an authorized client ID.

import { supabase } from "@/integrations/supabase/client";

export async function isNativePlatform(): Promise<boolean> {
  try {
    const { Capacitor } = await import("@capacitor/core");
    return Capacitor.isNativePlatform();
  } catch {
    return false;
  }
}

let initialized = false;

async function ensureInit() {
  if (initialized) return;
  const { GoogleAuth } = await import("@codetrix-studio/capacitor-google-auth");
  // Plugin reads serverClientId / scopes from capacitor.config.ts.
  // initialize() is a no-op on Android once the plugin is registered, but it's
  // required on web. Calling it here keeps the API uniform.
  try {
    await GoogleAuth.initialize();
  } catch {
    /* already initialized */
  }
  initialized = true;
}

/**
 * Returns true if a session was established natively (caller should NOT fall
 * back to the web flow). Throws on user-visible errors.
 */
export async function signInWithGoogleNative(): Promise<boolean> {
  if (!(await isNativePlatform())) return false;
  await ensureInit();
  const { GoogleAuth } = await import("@codetrix-studio/capacitor-google-auth");

  const user = await GoogleAuth.signIn();
  const idToken = user?.authentication?.idToken;
  if (!idToken) {
    throw new Error("Google não retornou idToken. Verifique a configuração do Web Client ID.");
  }

  const { error } = await supabase.auth.signInWithIdToken({
    provider: "google",
    token: idToken,
  });
  if (error) throw error;
  return true;
}

/**
 * Legacy hook kept so AuthProvider's import doesn't break. The native plugin
 * handles the whole flow synchronously inside the app — no deep-link callback
 * to listen for anymore.
 */
export async function installNativeOAuthListener(): Promise<() => void> {
  return () => {};
}
