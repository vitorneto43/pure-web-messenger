import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

const emailSchema = z.string().trim().email().max(255);

async function assertAdmin(userId: string) {
  const { data, error } = await supabaseAdmin
    .from("user_roles")
    .select("role")
    .eq("user_id", userId);
  if (error) throw new Error("Falha ao verificar permissão");
  const ok = (data ?? []).some((r) =>
    ["moderator", "admin", "superadmin"].includes(r.role as string),
  );
  if (!ok) throw new Error("Acesso negado");
}

// Public: subscribe
export const subscribeNewsletter = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) =>
    z
      .object({
        email: emailSchema,
        userId: z.string().uuid().optional().nullable(),
        source: z.string().max(40).optional(),
      })
      .parse(d),
  )
  .handler(async ({ data }) => {
    const email = data.email.toLowerCase();
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
      if (data.userId && !existing.user_id) patch.user_id = data.userId;
      await supabaseAdmin.from("newsletter_subscribers").update(patch).eq("id", existing.id);
      return { ok: true, already: true };
    }

    const { error } = await supabaseAdmin.from("newsletter_subscribers").insert({
      email,
      user_id: data.userId ?? null,
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
    const { error } = await supabaseAdmin.from("newsletter_feedback").insert({
      message: data.message,
      email: data.email ?? null,
      user_id: data.userId ?? null,
    });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// Authenticated user: list newsletters (sent only)
export const listSentNewsletters = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async () => {
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
    await assertAdmin(context.userId);
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
    await assertAdmin(context.userId);
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
    await assertAdmin(context.userId);
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
    await assertAdmin(context.userId);
    const { data: r, error } = await supabaseAdmin.rpc("admin_send_newsletter", {
      _post_id: data.id,
    });
    if (error) throw new Error(error.message);
    return r as { ok: boolean; recipients: number };
  });

// Admin: stats
export const adminNewsletterStats = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context.userId);
    const { data, error } = await supabaseAdmin.rpc("admin_newsletter_stats");
    if (error) throw new Error(error.message);
    return data as {
      total_subscribers: number;
      active_subscribers: number;
      reachable_in_app: number;
      feedback_total: number;
      feedback_unhandled: number;
    };
  });

// Admin: list subscribers
export const adminListSubscribers = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context.userId);
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
    await assertAdmin(context.userId);
    const { data } = await supabaseAdmin
      .from("newsletter_feedback")
      .select("id, message, email, user_id, handled, created_at")
      .order("created_at", { ascending: false })
      .limit(300);
    return { items: data ?? [] };
  });

// Admin: mark feedback handled
export const adminToggleFeedback = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({ id: z.string().uuid(), handled: z.boolean() }).parse(d),
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context.userId);
    const { error } = await supabaseAdmin
      .from("newsletter_feedback")
      .update({ handled: data.handled })
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
