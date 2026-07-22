import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import webpush from "web-push";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { sendNativeFollowerContent } from "@/lib/native-push.functions";

// Reuses STATUS_PUSH_SECRET from Vault, same as the other push dispatchers.
let _cachedSecret: string | null = null;
async function getExpectedSecret(): Promise<string | null> {
  if (_cachedSecret) return _cachedSecret;
  try {
    const { data, error } = await (supabaseAdmin.rpc as any)("get_status_push_secret");
    if (error) return null;
    _cachedSecret = (data as string | null) ?? null;
    return _cachedSecret;
  } catch {
    return null;
  }
}

const BodySchema = z.object({
  kind: z.enum(["post", "status", "video", "short"]),
  content_id: z.string().uuid(),
  author_id: z.string().uuid(),
});

function configureWebPush() {
  webpush.setVapidDetails(
    process.env.VAPID_SUBJECT!,
    process.env.VAPID_PUBLIC_KEY!,
    process.env.VAPID_PRIVATE_KEY!,
  );
}

export const Route = createFileRoute("/api/public/follower-content-push")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const provided = request.headers.get("x-dispatch-secret") || "";
        const expected = await getExpectedSecret();
        if (!expected || !provided || provided !== expected) {
          return new Response("Unauthorized", { status: 401 });
        }

        let payload: unknown;
        try {
          payload = await request.json();
        } catch {
          return new Response("Bad JSON", { status: 400 });
        }
        const parsed = BodySchema.safeParse(payload);
        if (!parsed.success) return new Response("Invalid payload", { status: 400 });
        const { kind, content_id, author_id } = parsed.data;

        // Resolve preview + url based on kind, and enforce visibility.
        let title = "";
        let body = "";
        let url = "";

        if (kind === "post") {
          const { data: p } = await supabaseAdmin
            .from("posts")
            .select("user_id, content, caption, visibility")
            .eq("id", content_id)
            .maybeSingle();
          if (!p || (p as any).user_id !== author_id) {
            return new Response(JSON.stringify({ sent: 0 }), { status: 200 });
          }
          const vis = (p as any).visibility as string | null;
          if (vis && vis !== "public" && vis !== "followers") {
            return new Response(JSON.stringify({ sent: 0 }), { status: 200 });
          }
          body = String((p as any).caption ?? (p as any).content ?? "").slice(0, 140);
          url = `/p/${content_id}`;
        } else if (kind === "status") {
          const { data: s } = await supabaseAdmin
            .from("statuses")
            .select("user_id, content, caption")
            .eq("id", content_id)
            .maybeSingle();
          if (!s || (s as any).user_id !== author_id) {
            return new Response(JSON.stringify({ sent: 0 }), { status: 200 });
          }
          body = String((s as any).caption ?? (s as any).content ?? "").slice(0, 140);
          url = `/s/${content_id}`;
        } else {
          const { data: v } = await supabaseAdmin
            .from("videos")
            .select("owner_id, title, is_short, visibility")
            .eq("id", content_id)
            .maybeSingle();
          if (!v || (v as any).owner_id !== author_id) {
            return new Response(JSON.stringify({ sent: 0 }), { status: 200 });
          }
          const vis = String((v as any).visibility ?? "public");
          if (!["public", "followers"].includes(vis)) {
            return new Response(JSON.stringify({ sent: 0 }), { status: 200 });
          }
          body = String((v as any).title ?? "").slice(0, 140);
          url = (v as any).is_short ? `/waveshorts` : `/v/${content_id}`;
        }

        const { data: profile } = await supabaseAdmin
          .from("profiles")
          .select("display_name, username")
          .eq("id", author_id)
          .maybeSingle();
        const authorName =
          (profile as any)?.display_name || (profile as any)?.username || "Alguém";

        switch (kind) {
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
        if (!body) body = title;

        const { data: followers } = await supabaseAdmin
          .from("profile_follows")
          .select("follower_id")
          .eq("following_id", author_id);
        const recipientIds = (followers ?? []).map((f: any) => f.follower_id as string);
        if (recipientIds.length === 0) {
          return new Response(JSON.stringify({ sent: 0 }), { status: 200 });
        }

        // Web push
        let webSent = 0;
        const toRemove: string[] = [];
        try {
          const { data: subs } = await supabaseAdmin
            .from("push_subscriptions")
            .select("id, endpoint, p256dh, auth, user_id")
            .in("user_id", recipientIds);
          if (subs && subs.length) {
            configureWebPush();
            const pushPayload = JSON.stringify({
              type: "follow_content",
              kind,
              title,
              body,
              url,
            });
            await Promise.all(
              subs.map(async (s: any) => {
                try {
                  await webpush.sendNotification(
                    { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } },
                    pushPayload,
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
        } catch (e) {
          console.error("web follower-content push failed", e);
        }

        // Native (FCM)
        let nativeSent = 0;
        try {
          const r = await sendNativeFollowerContent({
            recipientIds,
            kind,
            contentId: content_id,
            url,
            title,
            body,
          });
          nativeSent = r.sent ?? 0;
        } catch (e) {
          console.error("native follower-content push failed", e);
        }

        return new Response(
          JSON.stringify({ sent: webSent + nativeSent, recipients: recipientIds.length }),
          { status: 200, headers: { "Content-Type": "application/json" } },
        );
      },
    },
  },
});
