import { useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "./use-auth";

/**
 * While the user has any active (not expired, not ended) live_locations rows,
 * watch geolocation and push updates to all of them.
 * Mounted once at the authenticated layout level.
 */
export function useLiveLocationBroadcast() {
  const { user } = useAuth();

  useEffect(() => {
    if (!user) return;
    if (!navigator.geolocation) return;

    let watchId: number | null = null;
    let activeIds: string[] = [];
    let cancelled = false;

    async function refreshActive() {
      const { data } = await (supabase as any)
        .from("live_locations")
        .select("id,expires_at,ended_at")
        .eq("user_id", user!.id)
        .is("ended_at", null)
        .gt("expires_at", new Date().toISOString());
      if (cancelled) return;
      activeIds = (data ?? []).map((r: any) => r.id);
      if (activeIds.length > 0 && watchId === null) {
        watchId = navigator.geolocation.watchPosition(
          async (pos) => {
            if (activeIds.length === 0) return;
            const { latitude, longitude, accuracy, heading, speed } = pos.coords;
            await (supabase as any)
              .from("live_locations")
              .update({
                latitude,
                longitude,
                accuracy,
                heading,
                speed,
                updated_at: new Date().toISOString(),
              })
              .in("id", activeIds);
          },
          (err) => console.warn("[live-loc] watch error", err),
          { enableHighAccuracy: true, maximumAge: 5000, timeout: 30000 },
        );
      } else if (activeIds.length === 0 && watchId !== null) {
        navigator.geolocation.clearWatch(watchId);
        watchId = null;
      }
    }

    refreshActive();
    const interval = setInterval(refreshActive, 30_000);

    // Listen for inserts/updates on user's rows to react fast
    const ch = supabase
      .channel(`live-loc-self-${user.id}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "live_locations",
          filter: `user_id=eq.${user.id}`,
        },
        () => refreshActive(),
      )
      .subscribe();

    return () => {
      cancelled = true;
      clearInterval(interval);
      if (watchId !== null) navigator.geolocation.clearWatch(watchId);
      supabase.removeChannel(ch);
    };
  }, [user?.id]);
}
