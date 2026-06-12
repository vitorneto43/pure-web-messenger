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
  const raw = process.env.FIREBASE_SERVICE_ACCOUNT_JSON?.trim();
  if (!raw) throw new Error("FIREBASE_SERVICE_ACCOUNT_JSON not configured");
  let parsed: ServiceAccount | null = null;
  const candidates = [
    raw,
    raw.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/i, ""),
  ];
  for (const candidate of candidates) {
    try {
      const value = JSON.parse(candidate);
      parsed = typeof value === "string" ? JSON.parse(value) : value;
      break;
    } catch {}
  }
  if (!parsed) throw new Error("FIREBASE_SERVICE_ACCOUNT_JSON is not valid JSON");
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

async function sendNativePayloadToUser(
  userId: string,
  dataPayload: Record<string, string>,
  ttl = "45s",
  notification?: { title: string; body: string },
  logMeta?: { senderId?: string | null; conversationId?: string | null; kind?: string },
) {
  const sa = loadServiceAccount();
  const accessToken = await getAccessToken(sa);
  const endpoint = `https://fcm.googleapis.com/v1/projects/${sa.project_id}/messages:send`;

  const { data: tokens, error } = await (supabaseAdmin as any)
    .from("native_push_tokens")
    .select("token")
    .eq("user_id", userId);
  if (error) throw new Error(error.message);
  if (!tokens || tokens.length === 0) return { sent: 0 };

  let sent = 0;
  const toRemove: string[] = [];
  const logs: Array<Record<string, unknown>> = [];
  await Promise.all(
    tokens.map(async (t: { token: string }) => {
      let status = 0;
      let ok = false;
      let errText: string | null = null;
      try {
        const message: Record<string, unknown> = {
          token: t.token,
          data: dataPayload,
          android: {
            priority: "HIGH",
            ttl,
            direct_boot_ok: true,
            ...(notification
              ? {
                  notification: {
                    channel_id: "messages",
                    default_sound: true,
                    default_vibrate_timings: true,
                    notification_priority: "PRIORITY_HIGH",
                  },
                }
              : {}),
          },
          apns: {
            headers: {
              "apns-priority": "10",
              "apns-push-type": "alert",
            },
            payload: {
              aps: {
                "content-available": 1,
                sound: dataPayload.type === "call" ? "default" : undefined,
                ...(notification
                  ? { alert: { title: notification.title, body: notification.body } }
                  : {}),
              },
            },
          },
          ...(notification ? { notification } : {}),
        };
        const res = await fetch(endpoint, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${accessToken}`,
          },
          body: JSON.stringify({ message }),
        });
        status = res.status;
        if (res.ok) {
          sent++;
          ok = true;
        } else {
          const body = await res.text().catch(() => "");
          errText = body.slice(0, 500);
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
        errText = e instanceof Error ? e.message : String(e);
        console.error("FCM v1 send exception", e);
      }
      logs.push({
        channel: "native",
        kind: logMeta?.kind ?? dataPayload.type ?? "message",
        recipient_id: userId,
        sender_id: logMeta?.senderId ?? null,
        conversation_id: logMeta?.conversationId ?? null,
        success: ok,
        status_code: status || null,
        error: errText,
        endpoint: t.token.slice(0, 32),
      });
    }),
  );

  if (toRemove.length) {
    await (supabaseAdmin as any).from("native_push_tokens").delete().in("token", toRemove);
  }
  if (logs.length) {
    try { await (supabaseAdmin as any).from("push_logs").insert(logs); } catch {}
  }

  return { sent };
}

export async function sendNativeMessage(args: {
  recipientId: string;
  senderId: string;
  conversationId: string;
  title: string;
  body: string;
  senderName?: string;
  badge?: number;
}) {
  // Data-only payload: forces FCM to deliver to WaveChatMessagingService even when
  // the app is in background or killed. The native service then posts a
  // MessagingStyle notification on the "messages_v2" channel (sound + vibration
  // + heads-up + lockscreen public) and updates the launcher badge. We keep it
  // data-only on purpose so the OS never auto-renders a duplicate.
  return sendNativePayloadToUser(
    args.recipientId,
    {
      type: "message",
      conversationId: args.conversationId,
      title: args.title,
      body: args.body,
      senderName: args.senderName ?? args.title,
      badge: String(args.badge ?? 0),
      timestamp: String(Date.now()),
    },
    "120s",
    undefined,
    { senderId: args.senderId, conversationId: args.conversationId, kind: "message" },
  );
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
    // Data-only payload: this is required so Android calls WaveChatMessagingService
    // while the app is closed; a notification payload would bypass our native
    // Telecom/phone-call UI and only show a normal notification.
    const dataPayload = {
      type: "call",
      callId: data.callId,
      conversationId: data.conversationId,
      kind: data.kind,
      callerName: data.callerName,
      timestamp: String(Date.now()),
    };
    return sendNativePayloadToUser(data.calleeId, dataPayload, "45s");
  });

export const sendNativeCallCancelPush = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z
      .object({
        callId: z.string().uuid(),
        calleeId: z.string().uuid(),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { data: call, error } = await (supabaseAdmin as any)
      .from("calls")
      .select("id")
      .eq("id", data.callId)
      .eq("caller_id", context.userId)
      .eq("callee_id", data.calleeId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!call) throw new Error("Call not found");

    const cancelled = await sendNativePayloadToUser(
      data.calleeId,
      {
        type: "call_cancel",
        callId: data.callId,
        timestamp: String(Date.now()),
      },
      "30s",
    );
    const ended = await sendNativePayloadToUser(
      data.calleeId,
      {
        type: "call_end",
        callId: data.callId,
        timestamp: String(Date.now()),
      },
      "30s",
    );
    return { sent: (cancelled.sent ?? 0) + (ended.sent ?? 0) };
  });
