import { createServerFn } from "@tanstack/react-start";
import { getRequest } from "@tanstack/react-start/server";
import { COUNTRY_TO_LOCALE, SUPPORTED_LOCALES, type Locale } from "@/i18n/locales";

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
