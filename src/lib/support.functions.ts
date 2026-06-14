import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const SubmitSchema = z.object({
  name: z.string().trim().min(2).max(100),
  email: z.string().trim().email().max(255),
  message: z.string().trim().min(10).max(2000),
});

export const submitSupportTicket = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => SubmitSchema.parse(data))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    // Try to associate with current user if a session is present
    let userId: string | null = null;
    try {
      const { getRequestHeader } = await import("@tanstack/react-start/server");
      const auth = getRequestHeader("authorization");
      if (auth?.startsWith("Bearer ")) {
        const token = auth.slice(7).trim();
        const { data: u } = await supabaseAdmin.auth.getUser(token);
        userId = u.user?.id ?? null;
      }
    } catch {
      // ignore — anonymous submission is OK
    }

    const { error } = await supabaseAdmin.from("support_tickets").insert({
      user_id: userId,
      name: data.name,
      email: data.email.toLowerCase(),
      message: data.message,
      status: "open",
    });

    if (error) {
      console.error("[support] insert failed", error);
      throw new Error("Falha ao enviar mensagem");
    }

    // Send confirmation email to the user
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
          ? (subjectRaw as (d: Record<string, any>) => string)({})
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
      console.error("[support] confirmation email failed", e);
      // Don't fail the submit — ticket is already saved
    }

    return { ok: true };
  });

export const listSupportTickets = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { status?: string } | undefined) => d ?? {})
  .handler(async ({ context, data }) => {
    const { supabase, userId } = context;

    // Check admin
    const { data: roleRow } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", userId)
      .eq("role", "admin")
      .maybeSingle();
    if (!roleRow) throw new Error("Forbidden");

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    let q = supabaseAdmin
      .from("support_tickets")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(200);
    if (data.status && data.status !== "all") q = q.eq("status", data.status);
    const { data: rows, error } = await q;
    if (error) throw new Error(error.message);
    return { tickets: rows ?? [] };
  });

const ReplySchema = z.object({
  ticketId: z.string().uuid(),
  reply: z.string().trim().min(1).max(5000),
});

export const replySupportTicket = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => ReplySchema.parse(d))
  .handler(async ({ context, data }) => {
    const { supabase, userId } = context;

    const { data: roleRow } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", userId)
      .eq("role", "admin")
      .maybeSingle();
    if (!roleRow) throw new Error("Forbidden");

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: ticket, error: fetchErr } = await supabaseAdmin
      .from("support_tickets")
      .select("*")
      .eq("id", data.ticketId)
      .maybeSingle();
    if (fetchErr || !ticket) throw new Error("Ticket não encontrado");

    const { error: updErr } = await supabaseAdmin
      .from("support_tickets")
      .update({
        admin_reply: data.reply,
        replied_at: new Date().toISOString(),
        replied_by: userId,
        status: "replied",
      })
      .eq("id", data.ticketId);
    if (updErr) throw new Error(updErr.message);

    // Send reply email via transactional template
    try {
      const React = await import("react");
      const { render } = await import("@react-email/components");
      const { template } = await import("@/lib/email-templates/support-reply");
      const messageId = crypto.randomUUID();

      const element = React.createElement(template.component, {
        recipientName: ticket.name,
        originalMessage: ticket.message,
        replyMessage: data.reply,
      });
      const html = await render(element);
      const plainText = await render(element, { plainText: true });

      await supabaseAdmin.from("email_send_log").insert({
        message_id: messageId,
        template_name: "support-reply",
        recipient_email: ticket.email,
        status: "pending",
      });

      const subjectRaw: unknown = template.subject;
      const subject =
        typeof subjectRaw === "function"
          ? (subjectRaw as (d: Record<string, any>) => string)({})
          : (subjectRaw as string);

      await supabaseAdmin.rpc("enqueue_email", {
        queue_name: "transactional_emails",
        payload: {
          message_id: messageId,
          to: ticket.email,
          from: "WaveChat Suporte <noreply@notify.webconnectchat.com>",
          sender_domain: "notify.webconnectchat.com",
          subject,
          html,
          text: plainText,
          purpose: "transactional",
          label: "support-reply",
          idempotency_key: `support-reply-${data.ticketId}-${Date.now()}`,
          queued_at: new Date().toISOString(),
        },
      });
    } catch (e) {
      console.error("[support] reply email failed", e);
      // Don't fail the whole op — reply is still saved
    }

    return { ok: true };
  });

const StatusSchema = z.object({
  ticketId: z.string().uuid(),
  status: z.enum(["open", "replied", "closed"]),
});

export const setSupportTicketStatus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => StatusSchema.parse(d))
  .handler(async ({ context, data }) => {
    const { supabase, userId } = context;
    const { data: roleRow } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", userId)
      .eq("role", "admin")
      .maybeSingle();
    if (!roleRow) throw new Error("Forbidden");

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin
      .from("support_tickets")
      .update({ status: data.status })
      .eq("id", data.ticketId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
