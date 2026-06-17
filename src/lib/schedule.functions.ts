import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const futureDate = z
  .string()
  .datetime()
  .refine((s) => new Date(s).getTime() > Date.now() + 30_000, "Escolha um horário futuro (mínimo 30s)");

// ============ Posts ============

export const schedulePost = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        kind: z.enum(["text", "image", "video"]),
        content: z.string().max(2000).optional().nullable(),
        media_url: z.string().url().optional().nullable(),
        thumbnail_url: z.string().url().optional().nullable(),
        caption: z.string().max(2000).optional().nullable(),
        background: z.string().max(200).optional().nullable(),
        hashtags: z.array(z.string()).max(12).default([]),
        music_track_id: z.string().uuid().optional().nullable(),
        visibility: z.enum(["public", "followers"]).default("public"),
        scheduled_at: futureDate,
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: row, error } = await supabase
      .from("scheduled_posts")
      .insert({ ...data, user_id: userId })
      .select("id,scheduled_at")
      .single();
    if (error) throw new Error(error.message);
    return row;
  });

export const listMyScheduledPosts = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("scheduled_posts")
      .select("*")
      .eq("user_id", context.userId)
      .in("status", ["pending", "failed"])
      .order("scheduled_at", { ascending: true });
    if (error) throw new Error(error.message);
    return data ?? [];
  });

export const cancelScheduledPost = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { id: string }) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("scheduled_posts")
      .update({ status: "cancelled" })
      .eq("id", data.id)
      .eq("user_id", context.userId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// ============ Statuses ============

export const scheduleStatus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        kind: z.enum(["text", "image", "video"]),
        content: z.string().max(2000).optional().nullable(),
        media_url: z.string().url().optional().nullable(),
        caption: z.string().max(2000).optional().nullable(),
        background: z.string().max(200).optional().nullable(),
        description: z.string().max(2000).optional().nullable(),
        hashtags: z.array(z.string()).max(12).default([]),
        cta_url: z.string().url().optional().nullable(),
        cta_label: z.string().max(30).optional().nullable(),
        music_track_id: z.string().uuid().optional().nullable(),
        music_start_sec: z.number().int().min(0).default(0),
        music_duration_sec: z.number().int().min(1).max(60).default(15),
        music_volume: z.number().min(0).max(1).default(0.8),
        scheduled_at: futureDate,
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const { data: row, error } = await context.supabase
      .from("scheduled_statuses")
      .insert({ ...data, user_id: context.userId })
      .select("id,scheduled_at")
      .single();
    if (error) throw new Error(error.message);
    return row;
  });

export const listMyScheduledStatuses = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("scheduled_statuses")
      .select("*")
      .eq("user_id", context.userId)
      .in("status", ["pending", "failed"])
      .order("scheduled_at", { ascending: true });
    if (error) throw new Error(error.message);
    return data ?? [];
  });

export const cancelScheduledStatus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { id: string }) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("scheduled_statuses")
      .update({ status: "cancelled" })
      .eq("id", data.id)
      .eq("user_id", context.userId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// ============ Lives ============

export const scheduleLive = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        title: z.string().min(1).max(120),
        description: z.string().max(500).optional().nullable(),
        cover_url: z.string().url().optional().nullable(),
        scheduled_at: futureDate,
        will_record: z.boolean().default(false),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const { data: row, error } = await context.supabase
      .from("scheduled_lives")
      .insert({ ...data, host_id: context.userId })
      .select("id,scheduled_at")
      .single();
    if (error) throw new Error(error.message);
    return row;
  });

export const cancelScheduledLive = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { id: string }) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("scheduled_lives")
      .update({ status: "cancelled" })
      .eq("id", data.id)
      .eq("host_id", context.userId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const listMyScheduledLives = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("scheduled_lives")
      .select("*")
      .eq("host_id", context.userId)
      .in("status", ["scheduled", "reminded", "missed"])
      .order("scheduled_at", { ascending: true });
    if (error) throw new Error(error.message);
    return data ?? [];
  });

export const listUpcomingLives = createServerFn({ method: "GET" }).handler(async () => {
  const { createClient } = await import("@supabase/supabase-js");
  const sb = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_PUBLISHABLE_KEY!, {
    auth: { storage: undefined, persistSession: false, autoRefreshToken: false },
  });
  const { data, error } = await sb
    .from("scheduled_lives")
    .select("id,title,description,cover_url,scheduled_at,host_id,will_record")
    .in("status", ["scheduled", "reminded"])
    .gte("scheduled_at", new Date().toISOString())
    .lte("scheduled_at", new Date(Date.now() + 14 * 24 * 3600 * 1000).toISOString())
    .order("scheduled_at", { ascending: true })
    .limit(40);
  if (error) throw new Error(error.message);
  const ids = Array.from(new Set((data ?? []).map((r) => r.host_id)));
  let hostsById = new Map<string, { id: string; username: string | null; display_name: string | null; avatar_url: string | null }>();
  if (ids.length) {
    const { data: hosts } = await sb.from("profiles").select("id,username,display_name,avatar_url").in("id", ids);
    hostsById = new Map((hosts ?? []).map((h) => [h.id, h]));
  }
  return (data ?? []).map((r) => ({ ...r, host: hostsById.get(r.host_id) ?? null }));
});
