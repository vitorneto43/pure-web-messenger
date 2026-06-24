import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

async function assertAdmin(userId: string) {
  const { data } = await supabaseAdmin
    .from("user_roles")
    .select("role")
    .eq("user_id", userId);
  const roles = (data ?? []).map((r: any) => r.role);
  if (!roles.some((r) => r === "admin" || r === "superadmin" || r === "moderator")) {
    throw new Error("Acesso negado");
  }
}

export type AdminLiveItem = {
  id: string;
  host_id: string;
  host_username: string | null;
  host_display_name: string | null;
  host_avatar_url: string | null;
  title: string;
  status: string;
  started_at: string;
  ended_at: string | null;
  duration_seconds: number | null;
  viewer_count: number;
  peak_viewers: number;
  total_reactions: number;
  total_gift_coins: number;
  chat_messages: number;
  unique_viewers: number;
  has_recording: boolean;
  will_record: boolean;
};

export const getAdminLives = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<{
    items: AdminLiveItem[];
    totals: {
      total: number;
      active: number;
      ended: number;
      total_peak_viewers: number;
      total_reactions: number;
      total_gift_coins: number;
      unique_hosts: number;
    };
  }> => {
    await assertAdmin(context.userId);

    const { data: lives } = await supabaseAdmin
      .from("live_sessions")
      .select("id,host_id,title,status,started_at,ended_at,viewer_count,peak_viewers,total_reactions,total_gift_coins,will_record")
      .order("started_at", { ascending: false })
      .limit(200);

    const list = lives ?? [];
    const hostIds = Array.from(new Set(list.map((l: any) => l.host_id)));
    const liveIds = list.map((l: any) => l.id);

    const [profilesRes, chatRes, viewersRes, recRes] = await Promise.all([
      hostIds.length
        ? supabaseAdmin
            .from("profiles")
            .select("id,username,display_name,avatar_url")
            .in("id", hostIds)
        : Promise.resolve({ data: [] as any[] }),
      liveIds.length
        ? supabaseAdmin
            .from("live_chat_messages")
            .select("live_id")
            .in("live_id", liveIds)
        : Promise.resolve({ data: [] as any[] }),
      liveIds.length
        ? supabaseAdmin
            .from("live_viewers")
            .select("live_id,viewer_id")
            .in("live_id", liveIds)
        : Promise.resolve({ data: [] as any[] }),
      liveIds.length
        ? supabaseAdmin
            .from("live_recordings")
            .select("live_id")
            .in("live_id", liveIds)
        : Promise.resolve({ data: [] as any[] }),
    ]);

    const profileMap = new Map(
      (profilesRes.data ?? []).map((p: any) => [p.id, p]),
    );
    const chatCount = new Map<string, number>();
    for (const m of chatRes.data ?? []) {
      chatCount.set(m.live_id, (chatCount.get(m.live_id) ?? 0) + 1);
    }
    const viewersMap = new Map<string, Set<string>>();
    for (const v of viewersRes.data ?? []) {
      if (!viewersMap.has(v.live_id)) viewersMap.set(v.live_id, new Set());
      viewersMap.get(v.live_id)!.add(v.viewer_id);
    }
    const recSet = new Set((recRes.data ?? []).map((r: any) => r.live_id));

    const items: AdminLiveItem[] = list.map((l: any) => {
      const p = profileMap.get(l.host_id);
      const dur =
        l.ended_at && l.started_at
          ? Math.max(
              0,
              Math.round(
                (new Date(l.ended_at).getTime() -
                  new Date(l.started_at).getTime()) /
                  1000,
              ),
            )
          : null;
      return {
        id: l.id,
        host_id: l.host_id,
        host_username: p?.username ?? null,
        host_display_name: p?.display_name ?? null,
        host_avatar_url: p?.avatar_url ?? null,
        title: l.title ?? "",
        status: l.status,
        started_at: l.started_at,
        ended_at: l.ended_at,
        duration_seconds: dur,
        viewer_count: l.viewer_count ?? 0,
        peak_viewers: l.peak_viewers ?? 0,
        total_reactions: l.total_reactions ?? 0,
        total_gift_coins: l.total_gift_coins ?? 0,
        chat_messages: chatCount.get(l.id) ?? 0,
        unique_viewers: viewersMap.get(l.id)?.size ?? 0,
        has_recording: recSet.has(l.id),
        will_record: !!l.will_record,
      };
    });

    return {
      items,
      totals: {
        total: items.length,
        active: items.filter((i) => i.status === "live").length,
        ended: items.filter((i) => i.status === "ended").length,
        total_peak_viewers: items.reduce((s, i) => s + i.peak_viewers, 0),
        total_reactions: items.reduce((s, i) => s + i.total_reactions, 0),
        total_gift_coins: items.reduce((s, i) => s + i.total_gift_coins, 0),
        unique_hosts: new Set(items.map((i) => i.host_id)).size,
      },
    };
  });
