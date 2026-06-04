// Captures UTM / ad click IDs from the current URL and stores them in
// localStorage so we can attach them to the signup metadata even if the user
// browses around before creating an account.

const KEY = "wc_signup_attribution";
const MAX_AGE_DAYS = 30;

export type SignupAttribution = {
  source: string;
  medium?: string;
  campaign?: string;
  referrer?: string;
  landing?: string;
  ts: number;
};

function classify(params: URLSearchParams, referrer: string): string {
  const utm = (params.get("utm_source") || "").toLowerCase();
  const gclid = params.get("gclid");
  const fbclid = params.get("fbclid");
  const ttclid = params.get("ttclid");
  const msclkid = params.get("msclkid");

  if (gclid || /google|adwords|gads/.test(utm)) return "Google Ads";
  if (fbclid || /facebook|meta|instagram|fb|ig/.test(utm)) return "Meta Ads";
  if (ttclid || /tiktok/.test(utm)) return "TikTok Ads";
  if (msclkid || /bing|microsoft/.test(utm)) return "Microsoft Ads";
  if (utm) return utm;

  if (referrer) {
    try {
      const host = new URL(referrer).hostname.toLowerCase();
      if (host.includes("google")) return "Google (orgânico)";
      if (host.includes("facebook") || host.includes("instagram")) return "Meta (orgânico)";
      if (host.includes("tiktok")) return "TikTok (orgânico)";
      if (host.includes("bing")) return "Bing (orgânico)";
      if (host.includes("youtube")) return "YouTube";
      if (host.includes("twitter") || host.includes("x.com")) return "Twitter/X";
      if (host.includes("linkedin")) return "LinkedIn";
      return host;
    } catch {
      // ignore
    }
  }
  return "direto";
}

export function captureUtmFromUrl() {
  if (typeof window === "undefined") return;
  try {
    const params = new URLSearchParams(window.location.search);
    const referrer = document.referrer || "";
    const hasUtm =
      params.has("utm_source") ||
      params.has("utm_medium") ||
      params.has("utm_campaign") ||
      params.has("gclid") ||
      params.has("fbclid") ||
      params.has("ttclid") ||
      params.has("msclkid");

    const existing = readAttribution();

    // Only overwrite when fresh ad params arrive; keep first-touch otherwise.
    if (!hasUtm && existing) return;
    if (!hasUtm && !referrer && !existing) {
      // Direct visit, store baseline so we don't lose the landing page.
      const data: SignupAttribution = {
        source: "direto",
        landing: window.location.pathname,
        ts: Date.now(),
      };
      localStorage.setItem(KEY, JSON.stringify(data));
      return;
    }

    const data: SignupAttribution = {
      source: classify(params, referrer),
      medium: params.get("utm_medium") || (hasUtm ? "cpc" : referrer ? "referral" : "direct"),
      campaign: params.get("utm_campaign") || undefined,
      referrer: referrer || undefined,
      landing: window.location.pathname + window.location.search,
      ts: Date.now(),
    };
    localStorage.setItem(KEY, JSON.stringify(data));
  } catch {
    // ignore
  }
}

export function readAttribution(): SignupAttribution | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    const data = JSON.parse(raw) as SignupAttribution;
    const ageMs = Date.now() - (data.ts ?? 0);
    if (ageMs > MAX_AGE_DAYS * 86400_000) {
      localStorage.removeItem(KEY);
      return null;
    }
    return data;
  } catch {
    return null;
  }
}

export function getSignupAttributionForSignup() {
  const a = readAttribution();
  if (!a) return { signup_source: "direto" };
  return {
    signup_source: a.source,
    signup_medium: a.medium ?? "",
    signup_campaign: a.campaign ?? "",
    signup_referrer: a.referrer ?? "",
    signup_landing: a.landing ?? "",
  };
}

// For OAuth signups (Google) that bypass our custom signUp() data flow:
// backfill the attribution onto the profile right after the first sign-in
// if it's still "desconhecido".
export async function backfillSignupAttribution(userId: string) {
  if (typeof window === "undefined" || !userId) return;
  try {
    const { supabase } = await import("@/integrations/supabase/client");
    const { data: prof } = await supabase
      .from("profiles")
      .select("signup_source, created_at")
      .eq("id", userId)
      .maybeSingle();
    if (!prof) return;
    const ageMs = Date.now() - new Date(prof.created_at).getTime();
    if (ageMs > 7 * 86400_000) return; // só perfis recentes
    if (prof.signup_source && prof.signup_source !== "desconhecido") return;
    const attr = getSignupAttributionForSignup();
    await supabase
      .from("profiles")
      .update({
        signup_source: attr.signup_source,
        signup_medium: attr.signup_medium || null,
        signup_campaign: attr.signup_campaign || null,
        signup_referrer: attr.signup_referrer || null,
        signup_landing: attr.signup_landing || null,
      })
      .eq("id", userId);
  } catch {
    // ignore
  }
}
