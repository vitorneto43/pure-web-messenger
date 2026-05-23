import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

// Legacy FCM HTTP API endpoint (simpler than HTTP v1, still works for now)
const FCM_LEGACY_URL = "https://fcm.googleapis.com/fcm/send";

function getFcmServerKey(): string {
  const key = process.env.FCM_SERVER_KEY;
  if (!key) throw new Error("FCM_SERVER_KEY not configured");
  return key;
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
    const serverKey = getFcmServerKey();

    const { data: tokens, error } = await (supabaseAdmin as any)
      .from("native_push_tokens")
      .select("token")
      .eq("user_id", data.calleeId);
    if (error) throw new Error(error.message);
    if (!tokens || tokens.length === 0) return { sent: 0 };

    const payload = {
      data: {
        type: "call",
        callId: data.callId,
        conversationId: data.conversationId,
        kind: data.kind,
        callerName: data.callerName,
        timestamp: String(Date.now()),
      },
      priority: "high",
    };

    let sent = 0;
    const toRemove: string[] = [];
    await Promise.all(
      tokens.map(async (t: { token: string }) => {
        try {
          const res = await fetch(FCM_LEGACY_URL, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `key=${serverKey}`,
            },
            body: JSON.stringify({ to: t.token, ...payload }),
          });
          const body = await res.json().catch(() => ({}));
          if (res.ok && body.success) {
            sent++;
          } else if (
            body.results?.[0]?.error === "NotRegistered" ||
            body.results?.[0]?.error === "InvalidRegistration"
          ) {
            toRemove.push(t.token);
          } else {
            console.error("FCM send failed", res.status, body);
          }
        } catch (e) {
          console.error("FCM send exception", e);
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
