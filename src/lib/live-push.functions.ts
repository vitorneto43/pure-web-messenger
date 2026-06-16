import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import webpush from "web-push";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

function configureWebPush() {
  webpush.setVapidDetails(
    process.env.VAPID_SUBJECT!,
    process.env.VAPID_PUBLIC_KEY!,
    process.env.VAPID_PRIVATE_KEY!,
  );
}

/**
 * Notifies all followers of the host that they just went live.
 * Called by the host's client right after start_live succeeds.
 * Caller must own the live (server-verified via host_id).
 */
export const notifyLiveStart = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { liveId: string }) => z.object({ liveId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { userId } = context;
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: live } = await supabaseAdmin
      .from("live_sessions")
      .select("id,host_id,title,status")
      .eq("id", data.liveId)
      .maybeSingle();
    if (!live || live.host_id !== userId) throw new Error("Forbidden");
    if (live.status !== "live") return { sent: 0 };

    const { data: host } = await supabaseAdmin
      .from("profiles")
      .select("display_name,username,avatar_url")
      .eq("id", userId)
      .maybeSingle();
    const hostName = host?.display_name || host?.username || "Alguém";

    const { data: followers } = await supabaseAdmin
      .from("profile_follows")
      .select("follower_id")
      .eq("following_id", userId);
    const followerIds = (followers ?? []).map((f) => f.follower_id);
    if (followerIds.length === 0) return { sent: 0 };

    const title = `🔴 ${hostName} está ao vivo`;
    const body = live.title?.trim() || "Entre agora e participe da live!";
    const url = `/live/${live.id}`;

    // ---- Web Push ----
    const { data: subs } = await supabaseAdmin
      .from("push_subscriptions")
      .select("id,endpoint,p256dh,auth,user_id")
      .in("user_id", followerIds);

    let webSent = 0;
    const toRemove: string[] = [];
    if (subs && subs.length) {
      configureWebPush();
      const payload = JSON.stringify({ type: "live_start", title, body, url });
      await Promise.all(
        subs.map(async (s) => {
          try {
            await webpush.sendNotification(
              { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } },
              payload,
              { TTL: 600, urgency: "high" },
            );
            webSent++;
          } catch (e: unknown) {
            const err = e as { statusCode?: number };
            if (err.statusCode === 404 || err.statusCode === 410) toRemove.push(s.id);
          }
        }),
      );
      if (toRemove.length) {
        await supabaseAdmin.from("push_subscriptions").delete().in("id", toRemove);
      }
    }

    // ---- Native (FCM) ----
    let nativeSent = 0;
    try {
      const { sendNativeLiveStart } = await import("./native-push.functions");
      const r = await sendNativeLiveStart({
        recipientIds: followerIds,
        liveId: live.id,
        title,
        body,
      });
      nativeSent = r.sent ?? 0;
    } catch (e) {
      console.error("native live push failed", e);
    }

    return { sent: webSent + nativeSent };
  });
