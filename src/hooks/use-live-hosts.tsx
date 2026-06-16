import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

/**
 * Returns a map of host_id → live_id for every host currently live.
 * Subscribes to realtime changes on live_sessions so avatars across the app
 * light up the moment someone goes live and stop when they end.
 *
 * Singleton-cached so dozens of avatars on the page don't each open a channel.
 */
type HostMap = Map<string, string>;

let cached: HostMap = new Map();
let listeners = new Set<(m: HostMap) => void>();
let channelRefCount = 0;
let channel: ReturnType<typeof supabase.channel> | null = null;
let loaded = false;

async function loadAll() {
  const { data } = await supabase
    .from("live_sessions")
    .select("id,host_id")
    .eq("status", "live");
  cached = new Map((data ?? []).map((r) => [r.host_id, r.id]));
  loaded = true;
  listeners.forEach((l) => l(new Map(cached)));
}

function ensureChannel() {
  channelRefCount++;
  if (channel) return;
  channel = supabase
    .channel("live-hosts-global")
    .on(
      "postgres_changes",
      { event: "*", schema: "public", table: "live_sessions" },
      (payload) => {
        const row = (payload.new ?? payload.old) as { id: string; host_id: string; status?: string } | null;
        if (!row) return;
        const next = new Map(cached);
        const newStatus = (payload.new as { status?: string } | null)?.status;
        if (payload.eventType === "DELETE" || newStatus === "ended") {
          next.delete(row.host_id);
        } else if (newStatus === "live") {
          next.set(row.host_id, row.id);
        }
        cached = next;
        listeners.forEach((l) => l(new Map(cached)));
      },
    )
    .subscribe();
  if (!loaded) loadAll();
}

function releaseChannel() {
  channelRefCount = Math.max(0, channelRefCount - 1);
  if (channelRefCount === 0 && channel) {
    supabase.removeChannel(channel);
    channel = null;
    loaded = false;
  }
}

export function useLiveHosts(): HostMap {
  const [map, setMap] = useState<HostMap>(cached);
  useEffect(() => {
    const listener = (m: HostMap) => setMap(m);
    listeners.add(listener);
    ensureChannel();
    if (loaded) setMap(new Map(cached));
    return () => {
      listeners.delete(listener);
      releaseChannel();
    };
  }, []);
  return map;
}

/** Convenience: returns liveId if this host is currently live, else null. */
export function useIsHostLive(hostId: string | null | undefined): string | null {
  const map = useLiveHosts();
  if (!hostId) return null;
  return map.get(hostId) ?? null;
}
