import { useEffect } from "react";
import { useNavigate, useRouterState } from "@tanstack/react-router";

/**
 * Global deep-link handler for push notifications (native + web SW).
 *
 * Guarantees:
 *  - If the app was cold-launched by a push (history.length <= 1), seed a
 *    Home entry BEFORE pushing the target route so the back button (both
 *    the physical Android button and the in-app UI back) returns to Home
 *    instead of exiting the app or landing on a blank page.
 *  - If the user is already on the target route, do nothing (avoid stacking
 *    duplicate instances).
 *  - Accepts either { url: "/p/xyz" } or route-specific fields.
 *
 * Sources that dispatch `wavechat-push-deeplink`:
 *  - Android native tap handler (native-call.ts pushNotificationActionPerformed)
 *  - Service worker `notificationclick` (via postMessage in the future)
 *
 * Cold-start payloads may be persisted to localStorage("wavechat_pending_push_deeplink")
 * so they survive the interval before this hook mounts.
 */
const STORAGE_KEY = "wavechat_pending_push_deeplink";

export function usePushDeepLink() {
  const navigate = useNavigate();
  const currentPath = useRouterState({ select: (s) => s.location.pathname });

  useEffect(() => {
    if (typeof window === "undefined") return;

    const go = (rawUrl: string) => {
      try {
        if (!rawUrl || typeof rawUrl !== "string") return;
        // Only allow same-origin absolute paths
        const path = rawUrl.startsWith("http")
          ? new URL(rawUrl).pathname + new URL(rawUrl).search
          : rawUrl;
        if (!path.startsWith("/")) return;
        // Already on the same post/status — no-op
        if (path.split("?")[0] === currentPath) return;

        // If we have no prior history (cold start from a push), seed a
        // Home entry so back navigation has somewhere to go.
        try {
          if (window.history.length <= 1) {
            window.history.replaceState(window.history.state, "", "/");
          }
        } catch {
          /* ignore */
        }

        // Route via TanStack navigate (pushes onto history).
        navigate({ to: path });
      } catch {
        /* ignore */
      }
    };

    const handle = (raw: unknown) => {
      try {
        let detail: { url?: string; postId?: string; statusId?: string } | null = null;
        if (typeof raw === "string") detail = JSON.parse(raw);
        else if (raw && typeof raw === "object") detail = raw as never;
        if (!detail) return;
        const url =
          detail.url ||
          (detail.postId ? `/p/${detail.postId}` : undefined) ||
          (detail.statusId ? `/s/${detail.statusId}` : undefined);
        if (!url) return;
        go(url);
      } catch {
        /* ignore */
      }
    };

    const listener = (e: Event) => handle((e as CustomEvent<unknown>).detail);
    window.addEventListener("wavechat-push-deeplink", listener);

    // Cold-start pending intent
    try {
      const pending = localStorage.getItem(STORAGE_KEY);
      if (pending) {
        localStorage.removeItem(STORAGE_KEY);
        handle(pending);
      }
    } catch {
      /* ignore */
    }

    return () => window.removeEventListener("wavechat-push-deeplink", listener);
  }, [navigate, currentPath]);
}
