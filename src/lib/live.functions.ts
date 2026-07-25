import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { createClient } from "@supabase/supabase-js";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { Database } from "@/integrations/supabase/types";

function publicClient() {
  return createClient<Database>(process.env.SUPABASE_URL!, process.env.SUPABASE_PUBLISHABLE_KEY!, {
    auth: { storage: undefined, persistSession: false, autoRefreshToken: false },
  });
}

// ============ Public reads (SSR-safe) ============

export const getTopHostsWeekly = createServerFn({ method: "GET" })
  .inputValidator((d: { limit?: number } | undefined) =>
    z.object({ limit: z.number().int().min(1).max(100).optional() }).parse(d ?? {}),
  )
  .handler(async ({ data }) => {
    const sb = publicClient();
    const { data: rows, error } = await sb.rpc("get_top_hosts_weekly", { p_limit: data.limit ?? 10 });
    if (error) throw new Error(error.message);
    return rows ?? [];
  });


type LiveListItem = {
  id: string;
  title: string | null;
  cover_url: string | null;
  viewer_count: number | null;
  host_id: string;
  started_at: string | null;
  total_gift_coins: number | null;
  host: { id: string; username: string | null; display_name: string | null; avatar_url: string | null } | null;
};

export const getActiveLives = createServerFn({ method: "GET" })
  .inputValidator((d: { ecosystemId?: string } | undefined) =>
    z.object({ ecosystemId: z.string().uuid().optional() }).parse(d ?? {}),
  )
  .handler(async ({ data: input }) => {
    const sb = publicClient();
    // Best-effort: end any live whose host hasn't pinged in 2 minutes so the
    // feed/stories don't keep showing ghost broadcasts after a tab close/crash.
    try {
      await sb.rpc("cleanup_stale_lives", { p_minutes: 2 });
    } catch (e) {
      console.warn("cleanup_stale_lives failed", e);
    }

    if (input.ecosystemId) {
      const { data: rows, error } = await sb.rpc("get_ecosystem_active_lives", {
        _ecosystem_id: input.ecosystemId,
        _limit: 50,
      });
      if (error) throw new Error(error.message);
      return ((rows ?? []) as any[]).map((l) => ({
        id: l.id,
        title: l.title,
        cover_url: l.cover_url,
        viewer_count: l.viewer_count,
        host_id: l.host_id,
        started_at: l.started_at,
        total_gift_coins: l.total_gift_coins,
        host: {
          id: l.host_id,
          username: l.host_username,
          display_name: l.host_display_name,
          avatar_url: l.host_avatar_url,
        },
      })) as LiveListItem[];
    }

    // Public feed: native public lives + ecosystem lives explicitly cross-posted.
    const { data: lives, error } = await sb
      .from("live_sessions")
      .select("id,title,cover_url,viewer_count,host_id,started_at,total_gift_coins,ecosystem_id,public_crosspost")
      .eq("status", "live")
      .or("ecosystem_id.is.null,public_crosspost.eq.true")
      .order("viewer_count", { ascending: false })
      .limit(50);
    if (error) throw new Error(error.message);
    const hostIds = Array.from(new Set((lives ?? []).map((l) => l.host_id)));
    let hostsById = new Map<string, { id: string; username: string | null; display_name: string | null; avatar_url: string | null }>();
    if (hostIds.length) {
      const { data: hosts } = await sb
        .from("profiles")
        .select("id,username,display_name,avatar_url")
        .in("id", hostIds);
      hostsById = new Map((hosts ?? []).map((h) => [h.id, h]));
    }
    return (lives ?? []).map((l) => ({ ...l, host: hostsById.get(l.host_id) ?? null })) as LiveListItem[];
  });

export const getLive = createServerFn({ method: "GET" })
  .inputValidator((d: { liveId: string }) => z.object({ liveId: z.string().uuid() }).parse(d))
  .handler(async ({ data }) => {
    const sb = publicClient();
    const { data: live, error } = await sb
      .from("live_sessions")
      .select("id,title,cover_url,host_id,status,viewer_count,peak_viewers,total_gift_coins,started_at,ended_at,livekit_room")
      .eq("id", data.liveId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!live) return null;
    const { data: host } = await sb
      .from("profiles")
      .select("id,username,display_name,avatar_url")
      .eq("id", live.host_id)
      .maybeSingle();
    return { ...live, host: host ?? null };
  });

// ============ LiveKit tokens ============

// Viewers — public, anonymous identity is fine.
export const mintViewerToken = createServerFn({ method: "POST" })
  .inputValidator((d: { liveId: string; displayName?: string }) =>
    z.object({ liveId: z.string().uuid(), displayName: z.string().max(60).optional() }).parse(d),
  )
  .handler(async ({ data }) => {
    const sb = publicClient();
    const { data: live, error } = await sb
      .from("live_sessions")
      .select("livekit_room,status")
      .eq("id", data.liveId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!live) throw new Error("Live not found");
    if (live.status !== "live") throw new Error("Live ended");
    const rnd = crypto.randomUUID().slice(0, 12);
    const { createLiveKitToken } = await import("./livekit-token.server");
    return createLiveKitToken({
      identity: `viewer_${rnd}`,
      name: data.displayName?.trim() || "Espectador",
      room: live.livekit_room,
      canPublish: false,
    });
  });

// Host — auth required, must own the live.
export const mintHostToken = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { liveId: string }) => z.object({ liveId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: live, error } = await supabase
      .from("live_sessions")
      .select("livekit_room,host_id,status")
      .eq("id", data.liveId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!live) throw new Error("Live not found");
    if (live.host_id !== userId) throw new Error("Not the host");
    if (live.status !== "live") throw new Error("Live ended");
    const { data: profile } = await supabase
      .from("profiles")
      .select("display_name,username")
      .eq("id", userId)
      .maybeSingle();
    const { createLiveKitToken } = await import("./livekit-token.server");
    return createLiveKitToken({
      identity: `host_${userId}`,
      name: profile?.display_name || profile?.username || "Host",
      room: live.livekit_room,
      canPublish: true,
    });
  });

// Guest — auth required + must have an approved stage request.
export const mintGuestToken = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { liveId: string }) => z.object({ liveId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: live } = await supabase
      .from("live_sessions")
      .select("livekit_room,host_id,status")
      .eq("id", data.liveId)
      .maybeSingle();
    if (!live) throw new Error("Live not found");
    if (live.status !== "live") throw new Error("Live ended");

    const isHost = live.host_id === userId;
    if (!isHost) {
      const { data: req } = await supabase
        .from("live_stage_requests")
        .select("status")
        .eq("live_id", data.liveId)
        .eq("user_id", userId)
        .maybeSingle();
      if (!req || req.status !== "approved") throw new Error("Stage not approved");
    }
    const { data: profile } = await supabase
      .from("profiles")
      .select("display_name,username")
      .eq("id", userId)
      .maybeSingle();
    const { createLiveKitToken } = await import("./livekit-token.server");
    return createLiveKitToken({
      identity: `guest_${userId}`,
      name: profile?.display_name || profile?.username || "Convidado",
      room: live.livekit_room,
      canPublish: true,
    });
  });
