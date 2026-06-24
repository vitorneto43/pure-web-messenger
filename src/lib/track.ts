import { supabase } from "@/integrations/supabase/client";

const SESSION_KEY = "wc_session_id";
const ATTRIBUTION_KEY = "wc_session_attribution";

type SessionAttribution = {
  utm_source?: string;
  utm_medium?: string;
  utm_campaign?: string;
  utm_term?: string;
  utm_content?: string;
  fbclid?: string;
  gclid?: string;
  ttclid?: string;
  msclkid?: string;
  landing_referrer?: string;
  landing_path?: string;
};

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

function classifySource(attr: SessionAttribution, referrer: string): string {
  if (attr.utm_source) return attr.utm_source.toLowerCase();
  if (attr.fbclid) return "facebook";
  if (attr.gclid) return "google";
  if (attr.ttclid) return "tiktok";
  if (attr.msclkid) return "bing";
  if (referrer) {
    try {
      const host = new URL(referrer).hostname.toLowerCase().replace(/^www\./, "");
      if (host.includes("facebook") || host.includes("fb.")) return "facebook";
      if (host.includes("instagram")) return "instagram";
      if (host.includes("google")) return "google";
      if (host.includes("tiktok")) return "tiktok";
      if (host.includes("bing")) return "bing";
      if (host.includes("youtube")) return "youtube";
      if (host.includes("twitter") || host.includes("t.co") || host.includes("x.com"))
        return "twitter";
      if (host.includes("whatsapp")) return "whatsapp";
      return host;
    } catch {
      /* ignore */
    }
  }
  return "direct";
}

function captureSessionAttribution(): SessionAttribution {
  if (typeof window === "undefined") return {};
  try {
    const params = new URLSearchParams(window.location.search);
    const urlAttr: SessionAttribution = {};
    const keys = [
      "utm_source",
      "utm_medium",
      "utm_campaign",
      "utm_term",
      "utm_content",
      "fbclid",
      "gclid",
      "ttclid",
      "msclkid",
    ] as const;
    for (const k of keys) {
      const v = params.get(k);
      if (v) (urlAttr as Record<string, string>)[k] = v;
    }

    const stored = localStorage.getItem(ATTRIBUTION_KEY);
    const existing: SessionAttribution = stored ? JSON.parse(stored) : {};

    // First-touch: keep existing if present, otherwise persist URL params
    const hasExisting = Object.keys(existing).length > 0;
    if (!hasExisting && Object.keys(urlAttr).length > 0) {
      const next: SessionAttribution = {
        ...urlAttr,
        landing_referrer: document.referrer || undefined,
        landing_path: window.location.pathname,
      };
      localStorage.setItem(ATTRIBUTION_KEY, JSON.stringify(next));
      return next;
    }
    return existing;
  } catch {
    return {};
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
    const language =
      (typeof navigator !== "undefined" &&
        (navigator.language || (navigator.languages && navigator.languages[0]))) ||
      null;
    const referrer = document.referrer || null;
    const attribution = captureSessionAttribution();
    const source = classifySource(attribution, referrer || "");
    await supabase.from("analytics_events").insert({
      user_id: userId,
      session_id: getSessionId(),
      event_name: eventName,
      path: window.location.pathname,
      referrer,
      user_agent: navigator.userAgent,
      metadata: {
        language,
        source,
        ...attribution,
        ...metadata,
      } as never,
    });
  } catch (e) {
    console.warn("track failed", e);
  }
}

export function trackPageView() {
  void track("page_view");
}
