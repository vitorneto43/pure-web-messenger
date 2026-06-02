import { supabase } from "@/integrations/supabase/client";
import { Capacitor } from "@capacitor/core";

let recordedThisSession = false;

function detectPlatform(): string {
  try {
    if (Capacitor.isNativePlatform()) {
      const p = Capacitor.getPlatform();
      if (p === "android") return "android";
      if (p === "ios") return "ios";
    }
  } catch {}
  return "web";
}

const APP_VERSION = "1.22"; // bump when releasing

export async function recordDeviceInfo(userId: string) {
  if (recordedThisSession) return;
  recordedThisSession = true;
  try {
    const platform = detectPlatform();
    let geo: { country?: string; region?: string; city?: string } = {};
    try {
      const r = await fetch("https://ipapi.co/json/", { cache: "no-store" });
      if (r.ok) {
        const j = await r.json();
        geo = {
          country: j.country_name ?? undefined,
          region: j.region ?? undefined,
          city: j.city ?? undefined,
        };
      }
    } catch {}
    await supabase
      .from("profiles")
      .update({
        device_platform: platform,
        app_version: APP_VERSION,
        ...(geo.country ? { country: geo.country } : {}),
        ...(geo.region ? { region: geo.region } : {}),
        ...(geo.city ? { city: geo.city } : {}),
      })
      .eq("id", userId);
  } catch (e) {
    console.warn("recordDeviceInfo failed", e);
  }
}
