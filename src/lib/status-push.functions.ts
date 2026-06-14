import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import webpush from "web-push";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

function configureWebPush() {
  webpush.setVapidDetails(
    process.env.VAPID_SUBJECT!,
    process.env.VAPID_PUBLIC_KEY!,
    process.env.VAPID_PRIVATE_KEY!,
  );
}

/**
 * Sends a web push for an Instagram-style status interaction (comment, reply,
 * reaction on a status, or reaction on a comment). The recipient is derived
 * server-side from the relevant row so the client cannot spoof who is notified.
 */
export const sendStatusPush = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z
      .object({
        statusId: z.string().uuid(),
        kind: z.enum(["comment", "reply", "status_reaction", "comment_reaction"]),
        commentId: z.string().uuid().optional(),
        emoji: z.string().max(16).optional(),
        preview: z.string().max(200).optional(),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { userId } = context;

    // Resolve recipient by kind
    let recipientId: string | null = null;
    if (data.kind === "status_reaction" || data.kind === "comment") {
      const { data: st } = await supabaseAdmin
        .from("statuses")
        .select("user_id")
        .eq("id", data.statusId)
        .maybeSingle();
      recipientId = (st as any)?.user_id ?? null;
    } else if (data.kind === "reply") {
      if (!data.commentId) return { sent: 0 };
      // commentId here is the PARENT comment id
      const { data: c } = await supabaseAdmin
        .from("status_comments")
        .select("user_id")
        .eq("id", data.commentId)
        .maybeSingle();
      recipientId = (c as any)?.user_id ?? null;
    } else if (data.kind === "comment_reaction") {
      if (!data.commentId) return { sent: 0 };
      const { data: c } = await supabaseAdmin
        .from("status_comments")
        .select("user_id")
        .eq("id", data.commentId)
        .maybeSingle();
      recipientId = (c as any)?.user_id ?? null;
    }

    if (!recipientId || recipientId === userId) return { sent: 0 };

    // Sender display name
    const { data: sender } = await supabaseAdmin
      .from("profiles")
      .select("display_name, username")
      .eq("id", userId)
      .single();
    const senderName =
      (sender as any)?.display_name || (sender as any)?.username || "Alguém";

    let title = "";
    let body = data.preview?.trim() ?? "";
    switch (data.kind) {
      case "comment":
        title = `${senderName} comentou no seu status`;
        break;
      case "reply":
        title = `${senderName} respondeu seu comentário`;
        break;
      case "status_reaction":
        title = `${senderName} reagiu ao seu status${data.emoji ? " " + data.emoji : ""}`;
        body = "";
        break;
      case "comment_reaction":
        title = `${senderName} reagiu ao seu comentário${data.emoji ? " " + data.emoji : ""}`;
        body = "";
        break;
    }

    // Unread notifications badge for the recipient (+1 for this incoming)
    let badge = 1;
    try {
      const { count } = await supabaseAdmin
        .from("notifications")
        .select("id", { count: "exact", head: true })
        .eq("user_id", recipientId)
        .is("read_at", null);
      badge = (count ?? 0) + 1;
    } catch {}

    const { data: subs, error } = await supabaseAdmin
      .from("push_subscriptions")
      .select("id, endpoint, p256dh, auth, user_id")
      .eq("user_id", recipientId);
    if (error) throw new Error(error.message);
    if (!subs || subs.length === 0) return { sent: 0 };

    configureWebPush();

    const url = `/s/${data.statusId}`;
    const payload = JSON.stringify({
      type: "message", // reuse SW message handling (click → data.url)
      title,
      body,
      url,
      badge,
    });

    let sent = 0;
    const toRemove: string[] = [];
    await Promise.all(
      subs.map(async (s) => {
        try {
          await webpush.sendNotification(
            { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } },
            payload,
            { TTL: 60, urgency: "normal" },
          );
          sent++;
        } catch (e: unknown) {
          const err = e as { statusCode?: number; body?: string };
          if (err.statusCode === 404 || err.statusCode === 410) toRemove.push(s.id);
          else console.error("status push failed", err.statusCode, err.body);
        }
      }),
    );

    if (toRemove.length) {
      await supabaseAdmin.from("push_subscriptions").delete().in("id", toRemove);
    }

    // Also send native (FCM) push so Android/iOS show a system notification
    // outside the app — the user explicitly wants OS-level notifications.
    let nativeSent = 0;
    try {
      const { sendNativeStatusInteraction } = await import("./native-push.functions");
      const r = await sendNativeStatusInteraction({
        recipientId: recipientId,
        senderId: userId,
        statusId: data.statusId,
        title,
        body: body || title,
        kind: data.kind,
      });
      nativeSent = r.sent ?? 0;
    } catch (e) {
      console.error("native status push failed", e);
    }

    return { sent: sent + nativeSent };
  });

