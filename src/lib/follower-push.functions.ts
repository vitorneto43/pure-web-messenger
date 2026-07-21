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
 * Notifies every follower of the author that they just published new content
 * (post, story, WaveTube video or WaveShort). The caller must be authenticated
 * and must own the row referenced by `contentId` — server verifies via
 * user_id / owner_id before fanning out.
 *
 * Called fire-and-forget by the client right after a successful insert.
 */
export const notifyFollowersOfContent = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { kind: "post" | "status" | "video" | "short"; contentId: string }) =>
    z
      .object({
        kind: z.enum(["post", "status", "video", "short"]),
        contentId: z.string().uuid(),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const { userId } = context;
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    let title = "";
    let url = "";
    let preview = "";

    if (data.kind === "post") {
      const { data: p } = await supabaseAdmin
        .from("posts")
        .select("user_id, content, visibility")
        .eq("id", data.contentId)
        .maybeSingle();
      if (!p || (p as any).user_id !== userId) throw new Error("Forbidden");
      const vis = (p as any).visibility as string | null;
      if (vis && vis !== "public" && vis !== "followers") return { sent: 0 };
      preview = String((p as any).content ?? "").slice(0, 140);
      url = `/p/${data.contentId}`;
    } else if (data.kind === "status") {
      const { data: s } = await supabaseAdmin
        .from("statuses")
        .select("user_id, content, caption")
        .eq("id", data.contentId)
        .maybeSingle();
      if (!s || (s as any).user_id !== userId) throw new Error("Forbidden");
      preview = String((s as any).caption ?? (s as any).content ?? "").slice(0, 140);
      url = `/s/${data.contentId}`;
    } else {
      const { data: v } = await supabaseAdmin
        .from("videos")
        .select("owner_id, title, is_short, visibility")
        .eq("id", data.contentId)
        .maybeSingle();
      if (!v || (v as any).owner_id !== userId) throw new Error("Forbidden");
      const vis = String((v as any).visibility ?? "public");
      if (!["public", "followers"].includes(vis)) return { sent: 0 };
      preview = String((v as any).title ?? "").slice(0, 140);
      url = (v as any).is_short ? `/waveshorts` : `/v/${data.contentId}`;
    }

    const { data: profile } = await supabaseAdmin
      .from("profiles")
      .select("display_name, username")
      .eq("id", userId)
      .maybeSingle();
    const authorName =
      (profile as any)?.display_name || (profile as any)?.username || "Alguém";

    switch (data.kind) {
      case "post":
        title = `${authorName} publicou um novo post`;
        break;
      case "status":
        title = `${authorName} adicionou um novo story`;
        break;
      case "video":
        title = `${authorName} enviou um vídeo no WaveTube`;
        break;
      case "short":
        title = `${authorName} postou um Short`;
        break;
    }
    const body = preview || title;

    const { data: followers } = await supabaseAdmin
      .from("profile_follows")
      .select("follower_id")
      .eq("following_id", userId);
    const recipientIds = (followers ?? []).map((f: any) => f.follower_id as string);
    if (recipientIds.length === 0) return { sent: 0 };

    // ---- Web Push ----
    let webSent = 0;
    const toRemove: string[] = [];
    const { data: subs } = await supabaseAdmin
      .from("push_subscriptions")
      .select("id, endpoint, p256dh, auth, user_id")
      .in("user_id", recipientIds);
    if (subs && subs.length) {
      configureWebPush();
      const payload = JSON.stringify({
        type: "follow_content",
        kind: data.kind,
        title,
        body,
        url,
      });
      await Promise.all(
        subs.map(async (s: any) => {
          try {
            await webpush.sendNotification(
              { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } },
              payload,
              { TTL: 3600, urgency: "normal" },
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
      const { sendNativeFollowerContent } = await import("./native-push.functions");
      const r = await sendNativeFollowerContent({
        recipientIds,
        kind: data.kind,
        contentId: data.contentId,
        url,
        title,
        body,
      });
      nativeSent = r.sent ?? 0;
    } catch (e) {
      console.error("native follower push failed", e);
    }

    return { sent: webSent + nativeSent };
  });
