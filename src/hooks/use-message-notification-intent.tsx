import { useEffect } from "react";
import { useNavigate } from "@tanstack/react-router";

/**
 * Listens for the native Android intent forwarded by MainActivity when the
 * user taps a chat message notification. The payload has shape:
 *   { conversationId: string, callId?: string, action?: string, source?: string }
 * If conversationId is present and there is no call attached, navigate to the
 * conversation. Calls are handled separately in use-call.tsx.
 */
export function useMessageNotificationIntent() {
  const navigate = useNavigate();

  useEffect(() => {
    if (typeof window === "undefined") return;

    const handle = (raw: unknown) => {
      try {
        let detail: { conversationId?: string; callId?: string } | null = null;
        if (typeof raw === "string") detail = JSON.parse(raw);
        else if (raw && typeof raw === "object") detail = raw as { conversationId?: string };
        if (!detail) return;
        if (detail.callId) return; // calls go through use-call.tsx
        const id = detail.conversationId;
        if (!id) return;
        navigate({ to: "/chat/$conversationId", params: { conversationId: id } });
      } catch {
        /* ignore */
      }
    };

    const eventHandler = (e: Event) => {
      const ce = e as CustomEvent<unknown>;
      handle(ce.detail);
    };

    window.addEventListener("wavechat-android-intent", eventHandler);

    // MainActivity also stashes the intent in localStorage in case it fires
    // before listeners are attached (cold start).
    try {
      const pending = localStorage.getItem("wavechat_pending_call_intent");
      if (pending) {
        const parsed = JSON.parse(pending);
        if (parsed && parsed.conversationId && !parsed.callId) {
          localStorage.removeItem("wavechat_pending_call_intent");
          handle(parsed);
        }
      }
    } catch {
      /* ignore */
    }

    return () => window.removeEventListener("wavechat-android-intent", eventHandler);
  }, [navigate]);
}
