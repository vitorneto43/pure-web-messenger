// Web App Badging API — shows a number on the installed PWA / Chrome icon.
// Works on Chrome desktop (installed PWA), Edge, and Android Chrome (installed PWA).
// Requires the app to be installed to the home screen for the badge to appear on the icon.
export function setAppBadge(count: number) {
  try {
    const nav = navigator as Navigator & {
      setAppBadge?: (n?: number) => Promise<void>;
      clearAppBadge?: () => Promise<void>;
    };
    if (count > 0 && nav.setAppBadge) {
      void nav.setAppBadge(count);
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
      navigator.serviceWorker.controller.postMessage({
        type: "set-badge",
        count: Math.max(0, count | 0),
      });
    } else if ("serviceWorker" in navigator) {
      navigator.serviceWorker.ready.then((reg) => {
        reg.active?.postMessage({
          type: "set-badge",
          count: Math.max(0, count | 0),
        });
      }).catch(() => {});
    }
  } catch {
    /* ignore */
  }
}
