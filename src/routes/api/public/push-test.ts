import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";

// Temporary diagnostic endpoint (guarded by CRON_SECRET) to send a test
// FCM notification directly to a stored native token. Remove after debugging.
export const Route = createFileRoute("/api/public/push-test")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const auth = request.headers.get("x-cron-secret");
        if (!auth || auth !== process.env.CRON_SECRET) {
          return new Response("Unauthorized", { status: 401 });
        }
        const body = z
          .object({ tokenPrefix: z.string().min(8).max(64) })
          .parse(await request.json());

        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const { data: rows, error } = await (supabaseAdmin as any)
          .from("native_push_tokens")
          .select("token, user_id, updated_at")
          .like("token", `${body.tokenPrefix}%`);
        if (error) return Response.json({ error: error.message }, { status: 500 });
        if (!rows?.length) return Response.json({ error: "token not found" }, { status: 404 });

        const { sendNativeMessage } = await import("@/lib/native-push.functions");
        const results: unknown[] = [];
        for (const row of rows) {
          const r = await sendNativeMessage({
            recipientId: row.user_id,
            senderId: row.user_id,
            conversationId: "00000000-0000-0000-0000-000000000000",
            title: "Teste WaveChat",
            body: `Push de teste ${new Date().toISOString().slice(11, 19)} — token ${row.token.slice(0, 10)}…`,
            senderName: "Diagnóstico",
          });
          results.push({ user_id: row.user_id, updated_at: row.updated_at, sent: r.sent });
        }
        return Response.json({ results });
      },
    },
  },
});
