import { useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "./use-auth";

/**
 * While the user has any active (not expired, not ended) live_locations rows,
 * watch geolocation and push updates to all of them.
 * Mounted once at the authenticated layout level.
 *
 * Uses Capacitor Geolocation when running in the native Android app
 * (navigator.geolocation is unreliable in the system WebView) and falls back
 * to the web API on browsers.
 */
export function useLiveLocationBroadcast() {
  const { user } = useAuth();

  useEffect(() => {
    if (!user) return;

    let webWatchId: number | null = null;
    let nativeWatchId: string | null = null;
    let activeIds: string[] = [];
    let cancelled = false;

    async function pushUpdate(coords: {
      latitude: number;
      longitude: number;
      accuracy?: number | null;
      heading?: number | null;
      speed?: number | null;
    }) {
      if (activeIds.length === 0) return;
      await (supabase as any)
        .from("live_locations")
        .update({
          latitude: coords.latitude,
          longitude: coords.longitude,
          accuracy: coords.accuracy ?? null,
          heading: coords.heading ?? null,
          speed: coords.speed ?? null,
          updated_at: new Date().toISOString(),
        })
        .in("id", activeIds);
    }

    async function startWatch() {
      try {
        const { Capacitor } = await import("@capacitor/core");
        if (Capacitor.isNativePlatform()) {
          const { Geolocation } = await import("@capacitor/geolocation");
          const perm = await Geolocation.checkPermissions();
          if (perm.location !== "granted" && perm.coarseLocation !== "granted") {
            const req = await Geolocation.requestPermissions({
              permissions: ["location", "coarseLocation"],
            });
            if (req.location !== "granted" && req.coarseLocation !== "granted") return;
          }
          const id = await Geolocation.watchPosition(
            { enableHighAccuracy: true, timeout: 30000 },
            (pos, err) => {
              if (err) {
                console.warn("[live-loc] native watch error", err);
                return;
              }
              if (!pos) return;
              void pushUpdate(pos.coords);
            },
          );
          nativeWatchId = id;
          return;
        }
      } catch (e) {
        console.warn("[live-loc] native unavailable, falling back to web", e);
      }
      if (!navigator.geolocation) return;
      webWatchId = navigator.geolocation.watchPosition(
        (pos) => void pushUpdate(pos.coords),
        (err) => console.warn("[live-loc] watch error", err),
        { enableHighAccuracy: true, maximumAge: 5000, timeout: 30000 },
      );
    }

    async function stopWatch() {
      if (webWatchId !== null) {
        navigator.geolocation.clearWatch(webWatchId);
        webWatchId = null;
      }
      if (nativeWatchId !== null) {
        try {
          const { Geolocation } = await import("@capacitor/geolocation");
          await Geolocation.clearWatch({ id: nativeWatchId });
        } catch {
          /* ignore */
        }
        nativeWatchId = null;
      }
    }

    async function refreshActive() {
      const { data } = await (supabase as any)
        .from("live_locations")
        .select("id,expires_at,ended_at")
        .eq("user_id", user!.id)
        .is("ended_at", null)
        .gt("expires_at", new Date().toISOString());
      if (cancelled) return;
      activeIds = (data ?? []).map((r: any) => r.id);
      if (activeIds.length > 0 && webWatchId === null && nativeWatchId === null) {
        await startWatch();
      } else if (activeIds.length === 0) {
        await stopWatch();
      }
    }

    refreshActive();
    const interval = setInterval(refreshActive, 30_000);

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
      void stopWatch();
      supabase.removeChannel(ch);
    };
  }, [user?.id]);
}
