import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import webpush from "web-push";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { sendNativeStatusInteraction } from "@/lib/native-push.functions";

// Shared anti-spam token. The value is stored in Supabase Vault (name
// STATUS_PUSH_SECRET) and read at request time via a SECURITY DEFINER RPC.
// The Postgres trigger that calls this endpoint reads the same vault value.
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
  status_id: z.string().uuid(),
  sender_id: z.string().uuid(),
  kind: z.enum(["comment", "reply", "status_reaction", "comment_reaction"]),
  comment_id: z.string().uuid().nullable().optional(),
  emoji: z.string().max(16).nullable().optional(),
  preview: z.string().max(200).nullable().optional(),
});

function configureWebPush() {
  webpush.setVapidDetails(
    process.env.VAPID_SUBJECT!,
    process.env.VAPID_PUBLIC_KEY!,
    process.env.VAPID_PRIVATE_KEY!,
  );
}

export const Route = createFileRoute("/api/public/status-push")({
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
        if (!parsed.success) {
          return new Response("Invalid payload", { status: 400 });
        }
        const data = parsed.data;

        // Resolve recipient
        let recipientId: string | null = null;
        if (data.kind === "status_reaction" || data.kind === "comment") {
          const { data: st } = await supabaseAdmin
            .from("statuses")
            .select("user_id")
            .eq("id", data.status_id)
            .maybeSingle();
          recipientId = (st as any)?.user_id ?? null;
        } else if (
          data.kind === "reply" ||
          data.kind === "comment_reaction"
        ) {
          if (!data.comment_id) {
            return new Response(JSON.stringify({ sent: 0 }), { status: 200 });
          }
          const { data: c } = await supabaseAdmin
            .from("status_comments")
            .select("user_id")
            .eq("id", data.comment_id)
            .maybeSingle();
          recipientId = (c as any)?.user_id ?? null;
        }
        if (!recipientId || recipientId === data.sender_id) {
          return new Response(JSON.stringify({ sent: 0 }), { status: 200 });
        }

        // Sender display name
        const { data: sender } = await supabaseAdmin
          .from("profiles")
          .select("display_name, username")
          .eq("id", data.sender_id)
          .single();
        const senderName =
          (sender as any)?.display_name ||
          (sender as any)?.username ||
          "Alguém";

        let title = "";
        let body = (data.preview ?? "").trim();
        switch (data.kind) {
          case "comment":
            title = `${senderName} comentou no seu status`;
            break;
          case "reply":
            title = `${senderName} respondeu seu comentário`;
            break;
          case "status_reaction":
            title = `${senderName} reagiu ao seu status${
              data.emoji ? " " + data.emoji : ""
            }`;
            body = "";
            break;
          case "comment_reaction":
            title = `${senderName} reagiu ao seu comentário${
              data.emoji ? " " + data.emoji : ""
            }`;
            body = "";
            break;
        }

        // Native FCM (system notification — what shows outside the app)
        let nativeSent = 0;
        try {
          const r = await sendNativeStatusInteraction({
            recipientId,
            senderId: data.sender_id,
            statusId: data.status_id,
            title,
            body: body || title,
            kind: data.kind,
          });
          nativeSent = r.sent ?? 0;
        } catch (e) {
          console.error("native status push failed", e);
        }

        // Web push (browsers)
        let webSent = 0;
        try {
          const { data: subs } = await supabaseAdmin
            .from("push_subscriptions")
            .select("id, endpoint, p256dh, auth")
            .eq("user_id", recipientId);
          if (subs && subs.length) {
            configureWebPush();
            const url = `/s/${data.status_id}`;
            const pushPayload = JSON.stringify({
              type: "message",
              title,
              body,
              url,
            });
            const toRemove: string[] = [];
            await Promise.all(
              subs.map(async (s) => {
                try {
                  await webpush.sendNotification(
                    {
                      endpoint: s.endpoint,
                      keys: { p256dh: s.p256dh, auth: s.auth },
                    },
                    pushPayload,
                    { TTL: 60, urgency: "normal" },
                  );
                  webSent++;
                } catch (e: unknown) {
                  const err = e as { statusCode?: number };
                  if (err.statusCode === 404 || err.statusCode === 410) {
                    toRemove.push(s.id);
                  }
                }
              }),
            );
            if (toRemove.length) {
              await supabaseAdmin
                .from("push_subscriptions")
                .delete()
                .in("id", toRemove);
            }
          }
        } catch (e) {
          console.error("web status push failed", e);
        }

        return new Response(
          JSON.stringify({ sent: nativeSent + webSent }),
          {
            status: 200,
            headers: { "Content-Type": "application/json" },
          },
        );
      },
    },
  },
});
