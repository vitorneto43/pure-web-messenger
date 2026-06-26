import { createServerFn } from "@tanstack/react-start";
import { getRequest } from "@tanstack/react-start/server";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { COUNTRY_TO_LOCALE, SUPPORTED_LOCALES, type Locale } from "@/i18n/locales";

function countryCodeToName(code: string): string | null {
  try {
    const dn = new Intl.DisplayNames(["en"], { type: "region" });
    return dn.of(code.toUpperCase()) ?? null;
  } catch {
    return null;
  }
}

/**
 * Server-side backfill: if the caller's `profiles_private.country` is null,
 * fill it from the edge `cf-ipcountry` header. Idempotent and safe to call
 * on every sign-in — costs nothing when already set.
 */
export const backfillCountryFromEdge = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    try {
      const req = getRequest();
      const code =
        req.headers.get("cf-ipcountry") ||
        req.headers.get("x-vercel-ip-country") ||
        req.headers.get("x-country-code");
      if (!code || code.length !== 2 || code.toUpperCase() === "XX") {
        return { updated: false, reason: "no_country_header" as const };
      }
      const name = countryCodeToName(code) ?? code.toUpperCase();
      const { supabase, userId } = context;
      const { data: existing } = await supabase
        .from("profiles_private")
        .select("country")
        .eq("user_id", userId)
        .maybeSingle();
      if (existing?.country) {
        return { updated: false, reason: "already_set" as const };
      }
      await supabase
        .from("profiles_private")
        .upsert(
          { user_id: userId, country: name },
          { onConflict: "user_id" },
        );
      return { updated: true, country: name };
    } catch {
      return { updated: false, reason: "error" as const };
    }
  });

// Returns the suggested locale based on the request's geo headers
// (Cloudflare's `cf-ipcountry` or `x-vercel-ip-country`). Defaults to `en`.
export const detectLocaleFromIp = createServerFn({ method: "GET" }).handler(
  async (): Promise<{ country: string | null; locale: Locale }> => {
    try {
      const req = getRequest();
      const headers = req.headers;
      const country =
        headers.get("cf-ipcountry") ||
        headers.get("x-vercel-ip-country") ||
        headers.get("x-country-code") ||
        null;
      if (country) {
        const upper = country.toUpperCase();
        const locale = COUNTRY_TO_LOCALE[upper];
        if (locale && (SUPPORTED_LOCALES as string[]).includes(locale)) {
          return { country: upper, locale };
        }
      }
      // Fallback: try accept-language
      const accept = headers.get("accept-language");
      if (accept) {
        const first = accept.split(",")[0]?.split("-")[0]?.toLowerCase();
        if (first && (SUPPORTED_LOCALES as string[]).includes(first)) {
          return { country, locale: first as Locale };
        }
      }
      return { country, locale: "en" };
    } catch {
      return { country: null, locale: "en" };
    }
  },
);
