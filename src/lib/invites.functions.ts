import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

const CHANNELS = ["whatsapp", "facebook", "instagram", "tiktok", "kwai", "share", "copy", "other"] as const;
type Channel = (typeof CHANNELS)[number];

function normChannel(c: unknown): Channel {
  return (CHANNELS as readonly string[]).includes(c as string) ? (c as Channel) : "other";
}

// Public: record a click on /invite/:id
export const recordInviteClick = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) =>
    z
      .object({
        inviterId: z.string().uuid(),
        channel: z.string().optional(),
        referrer: z.string().optional(),
        userAgent: z.string().optional(),
        utm: z.record(z.string(), z.any()).optional(),
      })
      .parse(input),
  )
  .handler(async ({ data }) => {
    const { createClient } = await import("@supabase/supabase-js");
    const sb = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_PUBLISHABLE_KEY!, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const { data: row, error } = await sb
      .from("invite_clicks")
      .insert({
        inviter_id: data.inviterId,
        channel: normChannel(data.channel),
        referrer: data.referrer ?? null,
        user_agent: data.userAgent ?? null,
        utm: data.utm ?? {},
      })
      .select("id")
      .single();
    if (error) return { ok: false as const };
    return { ok: true as const, clickId: row.id };
  });

// Public: read inviter profile for the invite landing
export const getInviterProfile = createServerFn({ method: "GET" })
  .inputValidator((input: unknown) => z.object({ inviterId: z.string().uuid() }).parse(input))
  .handler(async ({ data }) => {
    const { createClient } = await import("@supabase/supabase-js");
    const sb = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_PUBLISHABLE_KEY!, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const { data: p } = await sb
      .from("profiles")
      .select("id, username, display_name, avatar_url")
      .eq("id", data.inviterId)
      .maybeSingle();
    return p ?? null;
  });

// Authenticated: link this user as having been invited
export const attachInviter = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        inviterId: z.string().uuid(),
        channel: z.string().optional(),
        clickId: z.string().uuid().optional(),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    if (data.inviterId === userId) return { ok: false as const, reason: "self" };
    // already linked?
    const { data: existing } = await supabase
      .from("invite_signups")
      .select("id")
      .eq("invited_user_id", userId)
      .maybeSingle();
    if (existing) return { ok: true as const, alreadyLinked: true };
    const { error } = await supabase.from("invite_signups").insert({
      inviter_id: data.inviterId,
      invited_user_id: userId,
      channel: normChannel(data.channel),
      click_id: data.clickId ?? null,
    });
    if (error) return { ok: false as const, reason: error.message };
    // Best-effort: mirror invited_by on profile
    await supabase.from("profiles").update({ invited_by: data.inviterId }).eq("id", userId);
    return { ok: true as const };
  });

export const getMyInviteStats = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase.rpc("get_my_invite_stats");
    if (error) throw error;
    return (data ?? {}) as {
      clicks?: number;
      signups?: number;
      active?: number;
      by_channel?: Record<string, number>;
      signups_by_channel?: Record<string, number>;
    };
  });

export const getAmbassadorLevel = createServerFn({ method: "GET" })
  .inputValidator((input: unknown) => z.object({ userId: z.string().uuid() }).parse(input))
  .handler(async ({ data }) => {
    const { createClient } = await import("@supabase/supabase-js");
    const sb = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_PUBLISHABLE_KEY!, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const { data: row, error } = await sb.rpc("get_ambassador_level", { _user_id: data.userId });
    if (error) throw error;
    return row as {
      invited: number;
      tier: { id: string; name: string; icon: string; min_invites: number } | null;
      next: { id: string; name: string; icon: string; min_invites: number } | null;
    };
  });

export const getTopAmbassadors = createServerFn({ method: "GET" })
  .inputValidator((input: unknown) => z.object({ limit: z.number().min(1).max(200).optional() }).parse(input ?? {}))
  .handler(async ({ data }) => {
    const { createClient } = await import("@supabase/supabase-js");
    const sb = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_PUBLISHABLE_KEY!, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const { data: rows, error } = await sb.rpc("get_top_ambassadors", { _limit: data.limit ?? 50 });
    if (error) throw error;
    return (rows ?? []) as Array<{
      user_id: string;
      username: string;
      display_name: string;
      avatar_url: string | null;
      invited: number;
      tier_name: string | null;
      tier_icon: string | null;
    }>;
  });

export const listAmbassadorTiers = createServerFn({ method: "GET" }).handler(async () => {
  const { createClient } = await import("@supabase/supabase-js");
  const sb = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_PUBLISHABLE_KEY!, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data, error } = await sb
    .from("ambassador_tiers")
    .select("id, name, icon, min_invites, active, sort_order")
    .order("min_invites", { ascending: true });
  if (error) throw error;
  return data ?? [];
});

// ----- ADMIN -----

async function assertAdmin(supabase: any, userId: string) {
  const { data, error } = await supabase.rpc("has_role", { _user_id: userId, _role: "admin" });
  if (error || !data) throw new Error("forbidden");
}

export const getAdminInviteOverview = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context.supabase, context.userId);
    const { data, error } = await context.supabase.rpc("get_admin_invite_overview");
    if (error) throw error;
    return data as {
      total_clicks: number;
      total_signups: number;
      unique_inviters: number;
      by_channel: Record<string, number>;
      signups_by_channel: Record<string, number>;
      daily: Array<{ day: string; clicks: number; signups: number }>;
    };
  });

export const listInviteRelations = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({ search: z.string().optional(), limit: z.number().min(1).max(500).optional() }).parse(input ?? {}),
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    let q = supabaseAdmin
      .from("invite_signups")
      .select(
        "id, channel, created_at, inviter:inviter_id(id, username, display_name), invited:invited_user_id(id, username, display_name)",
      )
      .order("created_at", { ascending: false })
      .limit(data.limit ?? 200);
    const { data: rows, error } = await q;
    if (error) throw error;
    const s = (data.search ?? "").toLowerCase().trim();
    const list = (rows ?? []) as any[];
    return s
      ? list.filter(
          (r) =>
            r.inviter?.username?.toLowerCase().includes(s) ||
            r.inviter?.display_name?.toLowerCase().includes(s) ||
            r.invited?.username?.toLowerCase().includes(s) ||
            r.invited?.display_name?.toLowerCase().includes(s),
        )
      : list;
  });

export const upsertAmbassadorTier = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        id: z.string().uuid().optional(),
        name: z.string().min(1).max(60),
        icon: z.string().min(1).max(8),
        min_invites: z.number().int().min(1),
        active: z.boolean().optional(),
        sort_order: z.number().int().optional(),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const payload = {
      name: data.name,
      icon: data.icon,
      min_invites: data.min_invites,
      active: data.active ?? true,
      sort_order: data.sort_order ?? data.min_invites,
    };
    if (data.id) {
      const { error } = await supabaseAdmin.from("ambassador_tiers").update(payload).eq("id", data.id);
      if (error) throw error;
    } else {
      const { error } = await supabaseAdmin.from("ambassador_tiers").insert(payload);
      if (error) throw error;
    }
    return { ok: true };
  });

export const deleteAmbassadorTier = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    await assertAdmin(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.from("ambassador_tiers").delete().eq("id", data.id);
    if (error) throw error;
    return { ok: true };
  });

export const getAmbassadorSettings = createServerFn({ method: "GET" }).handler(async () => {
  const { createClient } = await import("@supabase/supabase-js");
  const sb = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_PUBLISHABLE_KEY!, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data } = await sb
    .from("ambassador_settings")
    .select("ranking_public, rewards_enabled")
    .eq("id", true)
    .maybeSingle();
  return data ?? { ranking_public: true, rewards_enabled: true };
});

export const updateAmbassadorSettings = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({ ranking_public: z.boolean().optional(), rewards_enabled: z.boolean().optional() }).parse(input),
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin
      .from("ambassador_settings")
      .update({ ...data, updated_at: new Date().toISOString() })
      .eq("id", true);
    if (error) throw error;
    return { ok: true };
  });
