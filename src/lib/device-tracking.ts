import { supabase } from "@/integrations/supabase/client";
import { Capacitor } from "@capacitor/core";
import { collectDeviceFingerprintRaw } from "./device-fingerprint";
import { recordDeviceFingerprint } from "./security.functions";

let recordedThisSession = false;

function detectPlatform(): string {
  try {
    if (Capacitor.isNativePlatform()) {
      const p = Capacitor.getPlatform();
      if (p === "android") return "android";
      if (p === "ios") return "ios";
    }
  } catch {}
  // Fallback: TWA / Android WebView (instalado via Play Store sem Capacitor nativo)
  try {
    const ua = typeof navigator !== "undefined" ? navigator.userAgent : "";
    if (/Android/i.test(ua) && /(wv|WebView)/.test(ua)) return "android";
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
      .from("profiles_private")
      .upsert({
        user_id: userId,
        device_platform: platform,
        app_version: APP_VERSION,
        ...(geo.country ? { country: geo.country } : {}),
        ...(geo.region ? { region: geo.region } : {}),
        ...(geo.city ? { city: geo.city } : {}),
      }, { onConflict: "user_id" });

    // Registra fingerprint do dispositivo + IP no sistema de segurança
    try {
      const raw = await collectDeviceFingerprintRaw();
      await recordDeviceFingerprint({ data: raw });
    } catch (e) {
      console.warn("recordDeviceFingerprint failed", e);
    }
  } catch (e) {
    console.warn("recordDeviceInfo failed", e);
  }
}
