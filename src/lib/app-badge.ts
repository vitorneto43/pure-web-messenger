// Web App Badging API — shows a number on the installed PWA / Chrome icon.
// Works on Chrome desktop (installed PWA), Edge, and Android. Silent on unsupported.
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
}
