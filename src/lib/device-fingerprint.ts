// Geração de fingerprint do dispositivo NO CLIENTE.
// Combina sinais permitidos (plataforma, classe de UA, faixa de tela, timezone,
// device id nativo quando disponível) e produz uma string estável que será
// hasheada no servidor com um pepper antes de ser persistida. Nunca enviamos
// o IP cru nem identificadores brutos sensíveis para a UI/banco.

import { Capacitor } from "@capacitor/core";

function detectPlatform(): string {
  try {
    if (Capacitor.isNativePlatform()) return Capacitor.getPlatform();
  } catch {}
  return "web";
}

function uaClass(): string {
  const ua = typeof navigator !== "undefined" ? navigator.userAgent : "";
  if (/Android/i.test(ua)) return "android";
  if (/iPhone|iPad|iPod/i.test(ua)) return "ios";
  if (/Windows/i.test(ua)) return "windows";
  if (/Macintosh|Mac OS X/i.test(ua)) return "mac";
  if (/Linux/i.test(ua)) return "linux";
  return "other";
}

function screenBucket(): string {
  if (typeof window === "undefined") return "0";
  const w = window.screen?.width ?? 0;
  const h = window.screen?.height ?? 0;
  // Buckets de 200px reduzem identificação 1:1
  return `${Math.floor(w / 200)}x${Math.floor(h / 200)}`;
}

function tz(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || "?";
  } catch {
    return "?";
  }
}

async function nativeDeviceId(): Promise<string | null> {
  // @capacitor/device é opcional. Se não estiver instalado, retornamos null.
  try {
    if (!Capacitor.isNativePlatform()) return null;
    const mod: any = await import(/* @vite-ignore */ "@capacitor/device" as string).catch(() => null);
    if (!mod?.Device?.getId) return null;
    const info = await mod.Device.getId();
    return info?.identifier ?? null;
  } catch {
    return null;
  }
}

export interface DeviceFingerprintRaw {
  platform: string;
  ua_class: string;
  screen_bucket: string;
  tz: string;
  native_id: string | null;
}

export async function collectDeviceFingerprintRaw(): Promise<DeviceFingerprintRaw> {
  return {
    platform: detectPlatform(),
    ua_class: uaClass(),
    screen_bucket: screenBucket(),
    tz: tz(),
    native_id: await nativeDeviceId(),
  };
}
