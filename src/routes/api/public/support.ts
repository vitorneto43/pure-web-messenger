import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";

const Schema = z.object({
  name: z.string().trim().min(2).max(100),
  email: z.string().trim().email().max(255),
  message: z.string().trim().min(10).max(2000),
});

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
};

export const Route = createFileRoute("/api/public/support")({
  server: {
    handlers: {
      OPTIONS: async () => new Response(null, { status: 204, headers: CORS }),
      POST: async ({ request }) => {
        try {
          const body = await request.json().catch(() => null);
          const parsed = Schema.safeParse(body);
          if (!parsed.success) {
            return new Response(
              JSON.stringify({ ok: false, error: parsed.error.issues[0]?.message ?? "invalid" }),
              { status: 400, headers: { "Content-Type": "application/json", ...CORS } },
            );
          }
          const data = parsed.data;
          const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

          // Try to associate with current user if a session bearer is present
          let userId: string | null = null;
          const auth = request.headers.get("authorization") ?? "";
          if (auth.startsWith("Bearer ")) {
            try {
              const token = auth.slice(7).trim();
              const { data: u } = await supabaseAdmin.auth.getUser(token);
              userId = u.user?.id ?? null;
            } catch {
              // ignore
            }
          }

          const userAgent = request.headers.get("user-agent");

          const { error } = await supabaseAdmin.from("support_tickets").insert({
            user_id: userId,
            name: data.name,
            email: data.email.toLowerCase(),
            message: data.message,
            status: "open",
            user_agent: userAgent,
          });
          if (error) {
            console.error("[api/support] insert failed", error);
            return new Response(JSON.stringify({ ok: false, error: "save_failed" }), {
              status: 500,
              headers: { "Content-Type": "application/json", ...CORS },
            });
          }

          // Confirmation email (best-effort)
          try {
            const React = await import("react");
            const { render } = await import("@react-email/components");
            const { template } = await import("@/lib/email-templates/support-received");
            const messageId = crypto.randomUUID();
            const element = React.createElement(template.component, {
              recipientName: data.name,
              originalMessage: data.message,
            });
            const html = await render(element);
            const plainText = await render(element, { plainText: true });

            await supabaseAdmin.from("email_send_log").insert({
              message_id: messageId,
              template_name: "support-received",
              recipient_email: data.email.toLowerCase(),
              status: "pending",
            });

            const subjectRaw: unknown = template.subject;
            const subject =
              typeof subjectRaw === "function"
                ? (subjectRaw as (d: Record<string, unknown>) => string)({})
                : (subjectRaw as string);

            await supabaseAdmin.rpc("enqueue_email", {
              queue_name: "transactional_emails",
              payload: {
                message_id: messageId,
                to: data.email.toLowerCase(),
                from: "WaveChat Suporte <noreply@notify.webconnectchat.com>",
                sender_domain: "notify.webconnectchat.com",
                subject,
                html,
                text: plainText,
                purpose: "transactional",
                label: "support-received",
                idempotency_key: `support-received-${messageId}`,
                queued_at: new Date().toISOString(),
              },
            });
          } catch (e) {
            console.error("[api/support] confirmation email failed", e);
          }

          return new Response(JSON.stringify({ ok: true }), {
            status: 200,
            headers: { "Content-Type": "application/json", ...CORS },
          });
        } catch (e) {
          console.error("[api/support] handler error", e);
          return new Response(JSON.stringify({ ok: false, error: "server_error" }), {
            status: 500,
            headers: { "Content-Type": "application/json", ...CORS },
          });
        }
      },
    },
  },
});
