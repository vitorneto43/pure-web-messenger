import { useEffect, useRef } from "react";
import { useAuth } from "@/hooks/use-auth";
import {
  isPreviewOrIframe,
  registerServiceWorker,
  subscribeToPush,
  subscriptionToRow,
} from "@/lib/push-client";
import { saveSubscription } from "@/lib/push.functions";

const PROMPT_KEY = "wavechat_push_prompted_v1";

export function usePushSetup() {
  const { user } = useAuth();
  const ranRef = useRef(false);

  useEffect(() => {
    if (!user) return;
    if (ranRef.current) return;
    ranRef.current = true;

    (async () => {
      if (typeof window === "undefined") return;
      if (isPreviewOrIframe()) return;
      if (!("Notification" in window)) return;
      if (!("serviceWorker" in navigator)) return;
      if (!("PushManager" in window)) return;

      const reg = await registerServiceWorker();
      if (!reg) return;

      // If already granted and subscribed, just ensure server has it
      if (Notification.permission === "denied") return;
      if (Notification.permission === "default") {
        // Only prompt once per browser to avoid annoyance
        if (localStorage.getItem(PROMPT_KEY) === "asked") return;
        localStorage.setItem(PROMPT_KEY, "asked");
        const perm = await Notification.requestPermission();
        if (perm !== "granted") return;
      }

      const sub = await subscribeToPush(reg);
      if (!sub) return;
      const row = subscriptionToRow(sub);
      try {
        await saveSubscription({ data: row });
      } catch (e) {
        console.error("saveSubscription failed", e);
      }
    })();
  }, [user?.id]);
}
