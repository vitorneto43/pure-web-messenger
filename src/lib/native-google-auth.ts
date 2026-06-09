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

  let user: Awaited<ReturnType<typeof GoogleAuth.signIn>>;
  try {
    user = await GoogleAuth.signIn();
  } catch (e: unknown) {
    // The plugin often rejects with a plain object { code, message, ... }
    // whose .message is just "Something went wrong" — surface every field.
    const obj = (e ?? {}) as Record<string, unknown>;
    const code = obj.code ?? obj.errorCode ?? "?";
    const msg = obj.message ?? (e instanceof Error ? e.message : String(e));
    let dump = "";
    try { dump = JSON.stringify(e, Object.getOwnPropertyNames(obj)); } catch { dump = String(e); }
    console.error("[google-native] signIn failed", { code, msg, dump, raw: e });
    throw new Error(`GoogleAuth.signIn falhou [code=${code}]: ${msg} :: ${dump}`);
  }

  const idToken = user?.authentication?.idToken;
  if (!idToken) {
    console.error("[google-native] no idToken in response", user);
    throw new Error(
      `Google não retornou idToken. Resposta: ${JSON.stringify(user)?.slice(0, 300)}`,
    );
  }

  const { data, error } = await supabase.auth.signInWithIdToken({
    provider: "google",
    token: idToken,
  });
  if (error) {
    console.error("[google-native] supabase signInWithIdToken failed", error);
    throw new Error(`Supabase rejeitou idToken: ${error.message} (status=${error.status ?? "?"})`);
  }
  console.log("[google-native] sign-in OK", { userId: data.user?.id });
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
