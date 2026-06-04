import { supabase } from "@/integrations/supabase/client";

const SESSION_KEY = "wc_session_id";

function getSessionId(): string {
  if (typeof window === "undefined") return "";
  try {
    let id = localStorage.getItem(SESSION_KEY);
    if (!id) {
      id = (crypto.randomUUID?.() ?? Math.random().toString(36).slice(2)) + "-" + Date.now();
      localStorage.setItem(SESSION_KEY, id);
    }
    return id;
  } catch {
    return "";
  }
}

export async function track(
  eventName: string,
  metadata: Record<string, unknown> = {},
): Promise<void> {
  if (typeof window === "undefined") return;
  try {
    const { data: auth } = await supabase.auth.getSession();
    const userId = auth?.session?.user?.id ?? null;
    await supabase.from("analytics_events").insert({
      user_id: userId,
      session_id: getSessionId(),
      event_name: eventName,
      path: window.location.pathname,
      referrer: document.referrer || null,
      user_agent: navigator.userAgent,
      metadata: metadata as never,
    });
  } catch (e) {
    console.warn("track failed", e);
  }
}

export function trackPageView() {
  void track("page_view");
}
