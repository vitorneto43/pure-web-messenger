import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import webpush from "web-push";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { sendNativeLiveJoin } from "@/lib/native-push.functions";

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
  live_id: z.string().uuid(),
  viewer_id: z.string().uuid(),
});

function configureWebPush() {
  webpush.setVapidDetails(
    process.env.VAPID_SUBJECT!,
    process.env.VAPID_PUBLIC_KEY!,
    process.env.VAPID_PRIVATE_KEY!,
  );
}

export const Route = createFileRoute("/api/public/live-join-push")({
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
        const { live_id, viewer_id } = parsed.data;

        const { data: live } = await supabaseAdmin
          .from("live_sessions")
          .select("host_id, title, status")
          .eq("id", live_id)
          .maybeSingle();
        if (!live || (live as any).status !== "live") {
          return new Response(JSON.stringify({ sent: 0 }), { status: 200 });
        }
        const hostId = (live as any).host_id as string;
        if (!hostId || hostId === viewer_id) {
          return new Response(JSON.stringify({ sent: 0 }), { status: 200 });
        }

        const { data: viewer } = await supabaseAdmin
          .from("profiles")
          .select("display_name, username")
          .eq("id", viewer_id)
          .single();
        const viewerName =
          (viewer as any)?.display_name || (viewer as any)?.username || "Alguém";

        const liveTitle = ((live as any).title || "").trim();
        const title = `${viewerName} entrou na sua live`;
        const body = liveTitle ? `"${liveTitle.slice(0, 60)}"` : "Sua transmissão ganhou um novo espectador";

        let nativeSent = 0;
        try {
          const r = await sendNativeLiveJoin({
            recipientId: hostId,
            viewerId: viewer_id,
            liveId: live_id,
            title,
            body,
          });
          nativeSent = r.sent ?? 0;
        } catch (e) {
          console.error("native live-join push failed", e);
        }

        let webSent = 0;
        try {
          const { data: subs } = await supabaseAdmin
            .from("push_subscriptions")
            .select("id, endpoint, p256dh, auth")
            .eq("user_id", hostId);
          if (subs && subs.length) {
            configureWebPush();
            const url = `/live/${live_id}`;
            const pushPayload = JSON.stringify({ type: "message", title, body, url });
            const toRemove: string[] = [];
            await Promise.all(
              subs.map(async (s) => {
                try {
                  await webpush.sendNotification(
                    { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } },
                    pushPayload,
                    { TTL: 60, urgency: "normal" },
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
          console.error("web live-join push failed", e);
        }

        return new Response(JSON.stringify({ sent: nativeSent + webSent }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        });
      },
    },
  },
});
