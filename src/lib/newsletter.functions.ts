import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const emailSchema = z.string().trim().email().max(255);

type AdminClient = { from: (table: string) => any };
type RoleRow = { role: string };
type NewsletterSubscriberRow = { user_id: string | null };

function isString(value: unknown): value is string {
  return typeof value === "string" && value.length > 0;
}

async function assertAdmin(supabaseAdmin: AdminClient, userId: string) {
  const { data, error } = await supabaseAdmin
    .from("user_roles")
    .select("role")
    .eq("user_id", userId);
  if (error) throw new Error("Falha ao verificar permissão");
  const ok = ((data ?? []) as RoleRow[]).some((r) =>
    ["moderator", "admin", "superadmin"].includes(r.role as string),
  );
  if (!ok) throw new Error("Acesso negado");
}

// Subscribe (auth optional — anonymous visitors can subscribe an email that
// is NOT tied to any account; logged-in users can subscribe only their own
// verified email).
export const subscribeNewsletter = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) =>
    z
      .object({
        email: emailSchema,
        source: z.string().max(40).optional(),
      })
      .parse(d),
  )
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const email = data.email.toLowerCase();

    // If the caller is authenticated, only allow linking to their OWN email.
    // Anonymous callers subscribe with user_id = null.
    let callerUserId: string | null = null;
    try {
      const { getRequestHeader } = await import("@tanstack/react-start/server");
      const authHeader = getRequestHeader("authorization") || "";
      const token = authHeader.replace(/^Bearer\s+/i, "").trim();
      if (token) {
        const { data: userRes } = await supabaseAdmin.auth.getUser(token);
        const authEmail = userRes?.user?.email?.toLowerCase() ?? null;
        if (userRes?.user?.id) {
          if (authEmail !== email) {
            throw new Error("Email does not match authenticated account");
          }
          callerUserId = userRes.user.id;
        }
      }
    } catch (e) {
      if (e instanceof Error && e.message.includes("does not match")) throw e;
      // ignore token parse errors — treat as anonymous
    }

    const { data: existing } = await supabaseAdmin
      .from("newsletter_subscribers")
      .select("id, status, user_id")
      .ilike("email", email)
      .maybeSingle();

    if (existing) {
      const patch: {
        status: string;
        unsubscribed_at: string | null;
        user_id?: string;
      } = { status: "active", unsubscribed_at: null };
      if (callerUserId && !existing.user_id) patch.user_id = callerUserId;
      await supabaseAdmin.from("newsletter_subscribers").update(patch).eq("id", existing.id);
      return { ok: true, already: true };
    }

    const { error } = await supabaseAdmin.from("newsletter_subscribers").insert({
      email,
      user_id: callerUserId,
      source: data.source ?? "widget",
      status: "active",
    });
    if (error) throw new Error(error.message);
    return { ok: true, already: false };
  });

// Public: feedback
export const submitNewsletterFeedback = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) =>
    z
      .object({
        message: z.string().trim().min(1).max(2000),
        email: emailSchema.optional().nullable(),
        userId: z.string().uuid().optional().nullable(),
      })
      .parse(d),
  )
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: inserted, error } = await supabaseAdmin
      .from("newsletter_feedback")
      .insert({
        message: data.message,
        email: data.email ?? null,
        user_id: data.userId ?? null,
      })
      .select("id, email")
      .single();
    if (error) throw new Error(error.message);

    // Confirmation email (if email provided)
    if (inserted?.email) {
      try {
        const React = await import("react");
        const { render } = await import("@react-email/components");
        const { template } = await import("@/lib/email-templates/support-received");
        const messageId = crypto.randomUUID();
        const element = React.createElement(template.component, {
          originalMessage: data.message,
        });
        const html = await render(element);
        const plainText = await render(element, { plainText: true });
        await supabaseAdmin.from("email_send_log").insert({
          message_id: messageId,
          template_name: "support-received",
          recipient_email: inserted.email.toLowerCase(),
          status: "pending",
        });
        const subjectRaw: unknown = template.subject;
        const subject = typeof subjectRaw === "function"
          ? (subjectRaw as (d: Record<string, any>) => string)({})
          : (subjectRaw as string);
        await supabaseAdmin.rpc("enqueue_email", {
          queue_name: "transactional_emails",
          payload: {
            message_id: messageId,
            to: inserted.email.toLowerCase(),
            from: "WaveChat <noreply@notify.webconnectchat.com>",
            sender_domain: "notify.webconnectchat.com",
            subject,
            html,
            text: plainText,
            purpose: "transactional",
            label: "newsletter-feedback-received",
            idempotency_key: `nl-fb-received-${inserted.id}`,
            queued_at: new Date().toISOString(),
          },
        });
      } catch (e) {
        console.error("[newsletter] confirmation email failed", e);
      }
    }
    return { ok: true };
  });

// Authenticated user: list newsletters (sent only)
export const listSentNewsletters = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async () => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data } = await supabaseAdmin
      .from("newsletter_posts")
      .select("id, title, summary, content, media_url, media_type, cta_label, cta_url, sent_at")
      .eq("status", "sent")
      .order("sent_at", { ascending: false })
      .limit(20);
    return { items: data ?? [] };
  });

// Admin: list all posts
export const adminListNewsletters = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    await assertAdmin(supabaseAdmin, context.userId);
    const { data } = await supabaseAdmin
      .from("newsletter_posts")
      .select("*")
      .order("created_at", { ascending: false });
    return { items: data ?? [] };
  });

// Admin: create/update draft
export const adminUpsertNewsletter = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        id: z.string().uuid().optional(),
        title: z.string().trim().min(2).max(200),
        summary: z.string().trim().max(400).optional().nullable(),
        content: z.string().trim().min(2).max(20000),
        media_url: z.string().url().max(2000).optional().nullable(),
        media_type: z.enum(["image", "video"]).optional().nullable(),
        cta_label: z.string().trim().max(60).optional().nullable(),
        cta_url: z.string().url().max(2000).optional().nullable(),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    await assertAdmin(supabaseAdmin, context.userId);
    if (data.id) {
      const { error } = await supabaseAdmin
        .from("newsletter_posts")
        .update({
          title: data.title,
          summary: data.summary ?? null,
          content: data.content,
          media_url: data.media_url ?? null,
          media_type: data.media_type ?? null,
          cta_label: data.cta_label ?? null,
          cta_url: data.cta_url ?? null,
        })
        .eq("id", data.id)
        .eq("status", "draft");
      if (error) throw new Error(error.message);
      return { ok: true, id: data.id };
    }
    const { data: row, error } = await supabaseAdmin
      .from("newsletter_posts")
      .insert({
        title: data.title,
        summary: data.summary ?? null,
        content: data.content,
        media_url: data.media_url ?? null,
        media_type: data.media_type ?? null,
        cta_label: data.cta_label ?? null,
        cta_url: data.cta_url ?? null,
        status: "draft",
        created_by: context.userId,
      })
      .select("id")
      .single();
    if (error) throw new Error(error.message);
    return { ok: true, id: row.id };
  });

// Admin: delete draft
export const adminDeleteNewsletter = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    await assertAdmin(supabaseAdmin, context.userId);
    const { error } = await supabaseAdmin
      .from("newsletter_posts")
      .delete()
      .eq("id", data.id)
      .eq("status", "draft");
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// Admin: send newsletter
export const adminSendNewsletter = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    await assertAdmin(supabaseAdmin, context.userId);
    const { data: post, error: postError } = await supabaseAdmin
      .from("newsletter_posts")
      .select("*")
      .eq("id", data.id)
      .maybeSingle();
    if (postError) throw new Error(postError.message);
    if (!post) throw new Error("Newsletter não encontrada");
    if (post.status === "sent") throw new Error("Newsletter já enviada");

    const { data: subs, error: subsError } = await supabaseAdmin
      .from("newsletter_subscribers")
      .select("user_id")
      .eq("status", "active")
      .not("user_id", "is", null);
    if (subsError) throw new Error(subsError.message);

    const userIds = Array.from(
      new Set(((subs ?? []) as NewsletterSubscriberRow[]).map((s) => s.user_id).filter(isString)),
    );
    if (userIds.length > 0) {
      const { error: notifError } = await supabaseAdmin.from("notifications").insert(
        userIds.map((userId) => ({
          user_id: userId,
          type: "newsletter",
          title: post.title,
          body: post.summary ?? post.content.slice(0, 200),
          data: {
            post_id: post.id,
            media_url: post.media_url,
            media_type: post.media_type,
            cta_label: post.cta_label,
            cta_url: post.cta_url,
            content: post.content,
          },
        })),
      );
      if (notifError) throw new Error(notifError.message);
    }

    const { error: updateError } = await supabaseAdmin
      .from("newsletter_posts")
      .update({ status: "sent", sent_at: new Date().toISOString(), recipients_count: userIds.length })
      .eq("id", data.id);
    if (updateError) throw new Error(updateError.message);
    return { ok: true, recipients: userIds.length };
  });

// Admin: stats
export const adminNewsletterStats = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    await assertAdmin(supabaseAdmin, context.userId);
    const [total, active, linked, feedback, unhandled] = await Promise.all([
      supabaseAdmin.from("newsletter_subscribers").select("id", { count: "exact", head: true }),
      supabaseAdmin.from("newsletter_subscribers").select("id", { count: "exact", head: true }).eq("status", "active"),
      supabaseAdmin.from("newsletter_subscribers").select("id", { count: "exact", head: true }).eq("status", "active").not("user_id", "is", null),
      supabaseAdmin.from("newsletter_feedback").select("id", { count: "exact", head: true }),
      supabaseAdmin.from("newsletter_feedback").select("id", { count: "exact", head: true }).eq("handled", false),
    ]);
    const firstError = [total, active, linked, feedback, unhandled].find((r) => r.error)?.error;
    if (firstError) throw new Error(firstError.message);
    return {
      total_subscribers: total.count ?? 0,
      active_subscribers: active.count ?? 0,
      reachable_in_app: linked.count ?? 0,
      feedback_total: feedback.count ?? 0,
      feedback_unhandled: unhandled.count ?? 0,
    };
  });

// Admin: bulk subscribe all confirmed users (one-click "inscrever todo mundo")
export const adminBulkSubscribeAllUsers = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    await assertAdmin(supabaseAdmin, context.userId);

    const { data: users, error: usersError } = await supabaseAdmin
      .from("profiles_private")
      .select("user_id, email");
    if (usersError) throw new Error(usersError.message);

    type UserRow = { user_id: string; email: string | null };
    const rows = ((users ?? []) as UserRow[])
      .filter((u) => u.email && u.user_id)
      .map((u) => ({
        email: (u.email as string).toLowerCase(),
        user_id: u.user_id,
        source: "admin_bulk",
        status: "active" as const,
      }));

    if (rows.length === 0) return { inserted: 0, total: 0 };

    // Fetch existing emails (case-insensitive unique index exists on lower(email))
    const { data: existing, error: existingError } = await supabaseAdmin
      .from("newsletter_subscribers")
      .select("email, id, user_id, status");
    if (existingError) throw new Error(existingError.message);
    const existingSet = new Set(
      ((existing ?? []) as { email: string }[]).map((r) => r.email.toLowerCase()),
    );
    const toInsert = rows.filter((r) => !existingSet.has(r.email));

    // Reactivate any inactive matching records
    const emailsToReactivate = rows
      .filter((r) => existingSet.has(r.email))
      .map((r) => r.email);
    if (emailsToReactivate.length > 0) {
      await supabaseAdmin
        .from("newsletter_subscribers")
        .update({ status: "active", unsubscribed_at: null })
        .in("email", emailsToReactivate)
        .neq("status", "active");
    }

    let inserted = 0;
    if (toInsert.length > 0) {
      const { error: insertError, count } = await supabaseAdmin
        .from("newsletter_subscribers")
        .insert(toInsert, { count: "exact" });
      if (insertError) throw new Error(insertError.message);
      inserted = count ?? toInsert.length;
    }

    return { inserted, total: rows.length };
  });



// Admin: list subscribers
export const adminListSubscribers = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    await assertAdmin(supabaseAdmin, context.userId);
    const { data } = await supabaseAdmin
      .from("newsletter_subscribers")
      .select("id, email, status, source, user_id, created_at")
      .order("created_at", { ascending: false })
      .limit(500);
    return { items: data ?? [] };
  });

// Admin: list feedback
export const adminListFeedback = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    await assertAdmin(supabaseAdmin, context.userId);
    const { data } = await supabaseAdmin
      .from("newsletter_feedback")
      .select("id, message, email, user_id, handled, created_at, reply, replied_at, replied_by")
      .order("created_at", { ascending: false })
      .limit(300);
    return { items: data ?? [] };
  });

// Admin: reply to feedback (notifies the user in-app)
export const adminReplyFeedback = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        id: z.string().uuid(),
        reply: z.string().trim().min(1).max(4000),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    await assertAdmin(supabaseAdmin, context.userId);

    const { data: fb, error: fbError } = await supabaseAdmin
      .from("newsletter_feedback")
      .select("id, user_id, message, email")
      .eq("id", data.id)
      .maybeSingle();
    if (fbError) throw new Error(fbError.message);
    if (!fb) throw new Error("Feedback não encontrado");

    const { error: updateError } = await supabaseAdmin
      .from("newsletter_feedback")
      .update({
        reply: data.reply,
        replied_at: new Date().toISOString(),
        replied_by: context.userId,
        handled: true,
      })
      .eq("id", data.id);
    if (updateError) throw new Error(updateError.message);

    if (fb.user_id) {
      await supabaseAdmin.from("notifications").insert({
        user_id: fb.user_id,
        type: "newsletter_reply",
        title: "Resposta da redação da newsletter",
        body: data.reply.slice(0, 200),
        data: {
          feedback_id: fb.id,
          original_message: fb.message,
          reply: data.reply,
        },
      });
    }

    // Reply email to user (if email provided)
    if (fb.email) {
      try {
        const React = await import("react");
        const { render } = await import("@react-email/components");
        const { template } = await import("@/lib/email-templates/support-reply");
        const messageId = crypto.randomUUID();
        const element = React.createElement(template.component, {
          originalMessage: fb.message,
          replyMessage: data.reply,
        });
        const html = await render(element);
        const plainText = await render(element, { plainText: true });
        await supabaseAdmin.from("email_send_log").insert({
          message_id: messageId,
          template_name: "support-reply",
          recipient_email: fb.email.toLowerCase(),
          status: "pending",
        });
        const subjectRaw: unknown = template.subject;
        const subject = typeof subjectRaw === "function"
          ? (subjectRaw as (d: Record<string, any>) => string)({})
          : (subjectRaw as string);
        await supabaseAdmin.rpc("enqueue_email", {
          queue_name: "transactional_emails",
          payload: {
            message_id: messageId,
            to: fb.email.toLowerCase(),
            from: "WaveChat <noreply@notify.webconnectchat.com>",
            sender_domain: "notify.webconnectchat.com",
            subject,
            html,
            text: plainText,
            purpose: "transactional",
            label: "newsletter-feedback-reply",
            idempotency_key: `nl-fb-reply-${fb.id}-${Date.now()}`,
            queued_at: new Date().toISOString(),
          },
        });
      } catch (e) {
        console.error("[newsletter] reply email failed", e);
      }
    }

    return { ok: true, notified: !!fb.user_id };
  });

// Admin: mark feedback handled
export const adminToggleFeedback = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({ id: z.string().uuid(), handled: z.boolean() }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    await assertAdmin(supabaseAdmin, context.userId);
    const { error } = await supabaseAdmin
      .from("newsletter_feedback")
      .update({ handled: data.handled })
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
