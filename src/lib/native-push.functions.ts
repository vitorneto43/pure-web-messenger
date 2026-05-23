import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

// FCM HTTP v1 — the legacy /fcm/send API was shut down by Google in June 2024.
// We now sign a short-lived OAuth2 access token from the service account JSON
// and POST to https://fcm.googleapis.com/v1/projects/{project_id}/messages:send.

interface ServiceAccount {
  client_email: string;
  private_key: string;
  project_id: string;
  token_uri?: string;
}

let cachedToken: { token: string; exp: number } | null = null;

function loadServiceAccount(): ServiceAccount {
  const raw = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
  if (!raw) throw new Error("FIREBASE_SERVICE_ACCOUNT_JSON not configured");
  let parsed: ServiceAccount;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new Error("FIREBASE_SERVICE_ACCOUNT_JSON is not valid JSON");
  }
  if (!parsed.client_email || !parsed.private_key || !parsed.project_id) {
    throw new Error("FIREBASE_SERVICE_ACCOUNT_JSON missing required fields");
  }
  return parsed;
}

function base64url(input: ArrayBuffer | Uint8Array | string): string {
  let bytes: Uint8Array;
  if (typeof input === "string") {
    bytes = new TextEncoder().encode(input);
  } else if (input instanceof ArrayBuffer) {
    bytes = new Uint8Array(input);
  } else {
    bytes = input;
  }
  let str = "";
  for (let i = 0; i < bytes.length; i++) str += String.fromCharCode(bytes[i]);
  return btoa(str).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function pemToArrayBuffer(pem: string): ArrayBuffer {
  const b64 = pem
    .replace(/-----BEGIN [^-]+-----/g, "")
    .replace(/-----END [^-]+-----/g, "")
    .replace(/\s+/g, "");
  const binary = atob(b64);
  const buf = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) buf[i] = binary.charCodeAt(i);
  return buf.buffer;
}

async function getAccessToken(sa: ServiceAccount): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  if (cachedToken && cachedToken.exp - 60 > now) return cachedToken.token;

  const header = { alg: "RS256", typ: "JWT" };
  const claim = {
    iss: sa.client_email,
    scope: "https://www.googleapis.com/auth/firebase.messaging",
    aud: sa.token_uri || "https://oauth2.googleapis.com/token",
    iat: now,
    exp: now + 3600,
  };

  const signingInput = `${base64url(JSON.stringify(header))}.${base64url(JSON.stringify(claim))}`;

  const keyBuf = pemToArrayBuffer(sa.private_key.replace(/\\n/g, "\n"));
  const key = await crypto.subtle.importKey(
    "pkcs8",
    keyBuf,
    { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sig = await crypto.subtle.sign(
    "RSASSA-PKCS1-v1_5",
    key,
    new TextEncoder().encode(signingInput),
  );
  const jwt = `${signingInput}.${base64url(sig)}`;

  const res = await fetch(claim.aud, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion: jwt,
    }),
  });
  if (!res.ok) {
    const txt = await res.text().catch(() => "");
    throw new Error(`OAuth2 token exchange failed ${res.status}: ${txt}`);
  }
  const body = (await res.json()) as { access_token: string; expires_in: number };
  cachedToken = { token: body.access_token, exp: now + (body.expires_in ?? 3600) };
  return body.access_token;
}

export const saveNativeToken = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z
      .object({
        token: z.string().min(1).max(1000),
        platform: z.enum(["android", "ios"]),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { userId } = context;
    const { error } = await (supabaseAdmin as any)
      .from("native_push_tokens")
      .upsert(
        {
          user_id: userId,
          token: data.token,
          platform: data.platform,
        },
        { onConflict: "token" },
      );
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const removeNativeToken = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({ token: z.string().min(1) }).parse(input))
  .handler(async ({ data }) => {
    const { error } = await (supabaseAdmin as any)
      .from("native_push_tokens")
      .delete()
      .eq("token", data.token);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const sendNativeCallPush = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z
      .object({
        callId: z.string().uuid(),
        calleeId: z.string().uuid(),
        conversationId: z.string().uuid(),
        kind: z.enum(["audio", "video"]),
        callerName: z.string().min(1).max(120),
      })
      .parse(input),
  )
  .handler(async ({ data }) => {
    const sa = loadServiceAccount();
    const accessToken = await getAccessToken(sa);
    const endpoint = `https://fcm.googleapis.com/v1/projects/${sa.project_id}/messages:send`;

    const { data: tokens, error } = await (supabaseAdmin as any)
      .from("native_push_tokens")
      .select("token")
      .eq("user_id", data.calleeId);
    if (error) throw new Error(error.message);
    if (!tokens || tokens.length === 0) return { sent: 0 };

    // data-only payload so our Android service decides how to display the
    // full-screen call UI (no system notification banner shown by FCM itself)
    const dataPayload = {
      type: "call",
      callId: data.callId,
      conversationId: data.conversationId,
      kind: data.kind,
      callerName: data.callerName,
      timestamp: String(Date.now()),
    };

    let sent = 0;
    const toRemove: string[] = [];
    await Promise.all(
      tokens.map(async (t: { token: string }) => {
        try {
          const res = await fetch(endpoint, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${accessToken}`,
            },
            body: JSON.stringify({
              message: {
                token: t.token,
                notification: {
                  title: data.kind === "video" ? "Chamada de vídeo" : "Chamada de voz",
                  body: `${data.callerName} está te ligando…`,
                },
                data: dataPayload,
                android: {
                  priority: "HIGH",
                  ttl: "45s",
                  // direct_boot_ok lets the message reach the device even
                  // before the user unlocks after reboot
                  direct_boot_ok: true,
                  notification: {
                    channel_id: "wavechat_calls_alert_v8",
                    notification_priority: "PRIORITY_MAX",
                    visibility: "PUBLIC",
                    sound: "default",
                    default_vibrate_timings: false,
                    vibrate_timings: ["0s", "0.9s", "0.35s", "0.9s", "1.2s"],
                    sticky: true,
                    tag: data.callId,
                  },
                },
                apns: {
                  headers: {
                    "apns-priority": "10",
                    "apns-push-type": "alert",
                  },
                  payload: {
                    aps: {
                      "content-available": 1,
                      sound: "default",
                    },
                  },
                },
              },
            }),
          });
          if (res.ok) {
            sent++;
          } else {
            const body = await res.text().catch(() => "");
            // UNREGISTERED / INVALID_ARGUMENT for the token field => prune
            if (
              res.status === 404 ||
              res.status === 410 ||
              body.includes("UNREGISTERED") ||
              body.includes("registration-token-not-registered")
            ) {
              toRemove.push(t.token);
            } else {
              console.error("FCM v1 send failed", res.status, body);
            }
          }
        } catch (e) {
          console.error("FCM v1 send exception", e);
        }
      }),
    );

    if (toRemove.length) {
      await (supabaseAdmin as any)
        .from("native_push_tokens")
        .delete()
        .in("token", toRemove);
    }

    return { sent };
  });
