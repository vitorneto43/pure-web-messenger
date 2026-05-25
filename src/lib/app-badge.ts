import { setNativeBadge } from "@/integrations/native-call";

// Web App Badging API + Capacitor native bridge.
// - Web/PWA: navigator.setAppBadge (Chrome installed PWA, Edge, Android Chrome PWA).
// - Native Android app: ShortcutBadger via WaveChatCall.setBadge plugin method
//   (Samsung One UI, MIUI/HyperOS POCO/Xiaomi, EMUI Huawei, Sony, LG, Pixel).
export function setAppBadge(count: number) {
  const n = Math.max(0, count | 0);

  // Native Android launcher badge
  void setNativeBadge(n);

  try {
    const nav = navigator as Navigator & {
      setAppBadge?: (n?: number) => Promise<void>;
      clearAppBadge?: () => Promise<void>;
    };
    if (n > 0 && nav.setAppBadge) {
      void nav.setAppBadge(n);
    } else if (nav.clearAppBadge) {
      void nav.clearAppBadge();
    }
  } catch {
    /* ignore */
  }

  // Also notify the service worker so it can set the badge from its own context
  // and persist the count for push-driven updates when the page is closed.
  try {
    if ("serviceWorker" in navigator && navigator.serviceWorker.controller) {
      navigator.serviceWorker.controller.postMessage({ type: "set-badge", count: n });
    } else if ("serviceWorker" in navigator) {
      navigator.serviceWorker.ready.then((reg) => {
        reg.active?.postMessage({ type: "set-badge", count: n });
      }).catch(() => {});
    }
  } catch {
    /* ignore */
  }
}
