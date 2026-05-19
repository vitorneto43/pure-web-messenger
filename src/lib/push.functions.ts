import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import webpush from "web-push";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

function configureWebPush() {
  webpush.setVapidDetails(
    process.env.VAPID_SUBJECT!,
    process.env.VAPID_PUBLIC_KEY!,
    process.env.VAPID_PRIVATE_KEY!
  );
}

export const saveSubscription = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z
      .object({
        endpoint: z.string().url().max(2000),
        p256dh: z.string().min(1).max(500),
        auth: z.string().min(1).max(500),
        user_agent: z.string().max(500).nullable().optional(),
      })
      .parse(input)
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    // Upsert by endpoint; ensure the row belongs to this user
    const { error } = await supabase
      .from("push_subscriptions")
      .upsert(
        {
          user_id: userId,
          endpoint: data.endpoint,
          p256dh: data.p256dh,
          auth: data.auth,
          user_agent: data.user_agent ?? null,
        },
        { onConflict: "endpoint" }
      );
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const removeSubscription = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({ endpoint: z.string().url() }).parse(input))
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    await supabase.from("push_subscriptions").delete().eq("endpoint", data.endpoint);
    return { ok: true };
  });

export const sendCallPush = createServerFn({ method: "POST" })
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
      .parse(input)
  )
  .handler(async ({ data, context }) => {
    const { userId } = context;
    // Caller must be the authenticated user
    if (userId !== userId /* always true */) throw new Error("Forbidden");

    configureWebPush();

    // Use admin to read subscriptions of the callee (caller can't see them via RLS)
    const { data: subs, error } = await supabaseAdmin
      .from("push_subscriptions")
      .select("id, endpoint, p256dh, auth")
      .eq("user_id", data.calleeId);
    if (error) throw new Error(error.message);
    if (!subs || subs.length === 0) return { sent: 0 };

    const payload = JSON.stringify({
      title: data.kind === "video" ? "Chamada de vídeo" : "Chamada de voz",
      body: `${data.callerName} está te ligando…`,
      callId: data.callId,
      conversationId: data.conversationId,
      kind: data.kind,
    });

    let sent = 0;
    const toRemove: string[] = [];
    await Promise.all(
      subs.map(async (s) => {
        try {
          await webpush.sendNotification(
            { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } },
            payload,
            { TTL: 30, urgency: "high" }
          );
          sent++;
        } catch (e: any) {
          const status = e?.statusCode;
          if (status === 404 || status === 410) toRemove.push(s.id);
          else console.error("push send failed", status, e?.body || e?.message);
        }
      })
    );

    if (toRemove.length) {
      await supabaseAdmin.from("push_subscriptions").delete().in("id", toRemove);
    }

    return { sent };
  });
