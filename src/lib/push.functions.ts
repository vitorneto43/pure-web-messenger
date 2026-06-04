import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import webpush from "web-push";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { sendNativeMessage } from "./native-push.functions";

function configureWebPush() {
  webpush.setVapidDetails(
    process.env.VAPID_SUBJECT!,
    process.env.VAPID_PUBLIC_KEY!,
    process.env.VAPID_PRIVATE_KEY!,
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
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    // Upsert by endpoint; ensure the row belongs to this user
    const { error } = await supabase.from("push_subscriptions").upsert(
      {
        user_id: userId,
        endpoint: data.endpoint,
        p256dh: data.p256dh,
        auth: data.auth,
        user_agent: data.user_agent ?? null,
      },
      { onConflict: "endpoint" },
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
      .parse(input),
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
      type: "call",
      title: data.kind === "video" ? "Chamada de vídeo" : "Chamada de voz",
      body: `${data.callerName} está te ligando…`,
      callId: data.callId,
      conversationId: data.conversationId,
      kind: data.kind,
      timestamp: Date.now(),
    });

    let sent = 0;
    const toRemove: string[] = [];
    const logs: Array<Record<string, unknown>> = [];
    await Promise.all(
      subs.map(async (s) => {
        let ok = false; let status = 0; let errText: string | null = null;
        try {
          await webpush.sendNotification(
            { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } },
            payload,
            { TTL: 45, urgency: "high" },
          );
          sent++; ok = true;
        } catch (e: unknown) {
          const err = e as { statusCode?: number; body?: string; message?: string };
          status = err.statusCode ?? 0;
          errText = (err.body || err.message || "").slice(0, 500);
          if (status === 404 || status === 410) toRemove.push(s.id);
          else console.error("push send failed", status, err.body || err.message);
        }
        logs.push({
          channel: "web", kind: "call",
          recipient_id: data.calleeId, sender_id: userId,
          conversation_id: data.conversationId,
          success: ok, status_code: status || null, error: errText,
          endpoint: s.endpoint.slice(0, 200),
        });
      }),
    );

    if (toRemove.length) {
      await supabaseAdmin.from("push_subscriptions").delete().in("id", toRemove);
    }
    if (logs.length) {
      try { await supabaseAdmin.from("push_logs" as never).insert(logs as never); } catch {}
    }

    return { sent };
  });


export const sendMessagePush = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z
      .object({
        conversationId: z.string().uuid(),
        preview: z.string().max(200),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { userId } = context;
    configureWebPush();

    // Resolve sender display name + conversation info
    const [{ data: sender }, { data: conv }, { data: members }] = await Promise.all([
      supabaseAdmin.from("profiles").select("display_name, username").eq("id", userId).single(),
      supabaseAdmin
        .from("conversations")
        .select("id, name, is_group")
        .eq("id", data.conversationId)
        .single(),
      supabaseAdmin
        .from("conversation_members")
        .select("user_id")
        .eq("conversation_id", data.conversationId),
    ]);

    const recipientIds = (members ?? []).map((m) => m.user_id).filter((id) => id !== userId);
    if (recipientIds.length === 0) return { sent: 0 };

    const { data: subs, error } = await supabaseAdmin
      .from("push_subscriptions")
      .select("id, endpoint, p256dh, auth, user_id")
      .in("user_id", recipientIds);
    if (error) throw new Error(error.message);
    if (!subs || subs.length === 0) return { sent: 0 };

    const senderName = sender?.display_name || sender?.username || "Nova mensagem";
    const title = conv?.is_group ? `${conv.name ?? "Grupo"} • ${senderName}` : senderName;
    const body = data.preview?.trim() ? data.preview : "Enviou uma mensagem";

    // Compute per-recipient unread badge count (unread messages + unread notifications)
    const badgeByUser = new Map<string, number>();
    await Promise.all(
      recipientIds.map(async (rid) => {
        try {
          const { data: mems } = await supabaseAdmin
            .from("conversation_members")
            .select("conversation_id, last_read_at")
            .eq("user_id", rid);
          let unread = 0;
          if (mems && mems.length) {
            const convIds = mems.map((m) => m.conversation_id);
            const { data: msgs } = await supabaseAdmin
              .from("messages")
              .select("conversation_id, sender_id, created_at")
              .in("conversation_id", convIds)
              .neq("sender_id", rid)
              .order("created_at", { ascending: false })
              .limit(500);
            const readMap = new Map(mems.map((m) => [m.conversation_id, m.last_read_at]));
            for (const m of msgs ?? []) {
              const last = readMap.get(m.conversation_id);
              if (!last || new Date(m.created_at) > new Date(last as string)) unread += 1;
            }
          }
          const { count: notifUnread } = await supabaseAdmin
            .from("notifications")
            .select("id", { count: "exact", head: true })
            .eq("user_id", rid)
            .is("read_at", null);
          // +1 to account for this very message that's about to be delivered
          badgeByUser.set(rid, unread + (notifUnread ?? 0) + 1);
        } catch {
          badgeByUser.set(rid, 0);
        }
      }),
    );

    let sent = 0;
    const toRemove: string[] = [];
    const logs: Array<Record<string, unknown>> = [];
    await Promise.all(
      subs.map(async (s) => {
        const badge = badgeByUser.get(s.user_id) ?? 0;
        const payload = JSON.stringify({
          type: "message",
          title,
          body,
          conversationId: data.conversationId,
          badge,
        });
        let ok = false; let status = 0; let errText: string | null = null;
        try {
          await webpush.sendNotification(
            { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } },
            payload,
            { TTL: 60, urgency: "normal" },
          );
          sent++;
          ok = true;
        } catch (e: unknown) {
          const err = e as { statusCode?: number; body?: string; message?: string };
          status = err.statusCode ?? 0;
          errText = (err.body || err.message || "").slice(0, 500);
          if (status === 404 || status === 410) toRemove.push(s.id);
          else console.error("push send failed", status, err.body || err.message);
        }
        logs.push({
          channel: "web", kind: "message",
          recipient_id: s.user_id, sender_id: userId,
          conversation_id: data.conversationId,
          success: ok, status_code: status || null, error: errText,
          endpoint: s.endpoint.slice(0, 200),
        });
      }),
    );

    if (toRemove.length) {
      await supabaseAdmin.from("push_subscriptions").delete().in("id", toRemove);
    }
    if (logs.length) {
      try { await supabaseAdmin.from("push_logs" as never).insert(logs as never); } catch {}
    }

    // Fan out to native (Android FCM) tokens as well so closed app receives push.
    try {
      const { sendNativeMessage } = await import("./native-push.functions");
      await Promise.all(
        recipientIds.map((rid) =>
          sendNativeMessage({
            recipientId: rid,
            senderId: userId,
            conversationId: data.conversationId,
            title,
            body,
          }).catch(() => {}),
        ),
      );
    } catch (e) {
      console.error("native message push failed", e);
    }

    return { sent };
  });

