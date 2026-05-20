// Public VAPID key (safe to ship to the client)
export const VAPID_PUBLIC_KEY =
  "BH2nPatnWjAX3Dtk8GP-ygwBj-0_NVkMm8ZElFMLBgINAhGTsi63m03NZV0ldUs8yReGAl4JA6_kCqECwPhRrEQ";

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(base64);
  const arr = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) arr[i] = raw.charCodeAt(i);
  return arr;
}

export function isPreviewOrIframe(): boolean {
  if (typeof window === "undefined") return true;
  try {
    if (window.self !== window.top) return true;
  } catch {
    return true;
  }
  const h = window.location.hostname;
  return h.includes("id-preview--") || h.includes("lovableproject.com");
}

export async function registerServiceWorker(): Promise<ServiceWorkerRegistration | null> {
  if (typeof navigator === "undefined" || !("serviceWorker" in navigator)) return null;
  if (isPreviewOrIframe()) return null;
  try {
    const reg = await navigator.serviceWorker.register("/sw.js");
    return reg;
  } catch (e) {
    console.error("SW registration failed", e);
    return null;
  }
}

export async function subscribeToPush(
  reg: ServiceWorkerRegistration
): Promise<PushSubscription | null> {
  try {
    const existing = await reg.pushManager.getSubscription();
    if (existing) return existing;
    return await reg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY).buffer as ArrayBuffer,
    });
  } catch (e) {
    console.error("Push subscribe failed", e);
    return null;
  }
}

export function subscriptionToRow(sub: PushSubscription) {
  const json = sub.toJSON();
  return {
    endpoint: sub.endpoint,
    p256dh: (json.keys as any)?.p256dh as string,
    auth: (json.keys as any)?.auth as string,
    user_agent: typeof navigator !== "undefined" ? navigator.userAgent : null,
  };
}
