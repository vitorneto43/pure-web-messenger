import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import LanguageDetector from "i18next-browser-languagedetector";
import { RESOURCES, SUPPORTED_LOCALES, HTML_LANG, RTL_LOCALES, type Locale } from "./locales";

export const I18N_STORAGE_KEY = "wavechat.locale";

function isLocale(v: unknown): v is Locale {
  return typeof v === "string" && (SUPPORTED_LOCALES as string[]).includes(v);
}

if (!i18n.isInitialized) {
  i18n
    .use(LanguageDetector)
    .use(initReactI18next)
    .init({
      resources: RESOURCES,
      fallbackLng: "en",
      supportedLngs: SUPPORTED_LOCALES,
      load: "languageOnly",
      nonExplicitSupportedLngs: true,
      interpolation: { escapeValue: false },
      detection: {
        // Respect saved choice first, then browser/OS language, then HTML tag.
        order: ["localStorage", "navigator", "htmlTag"],
        caches: ["localStorage"],
        lookupLocalStorage: I18N_STORAGE_KEY,
      },
      react: { useSuspense: false },
      initAsync: false,
    } as Parameters<typeof i18n.init>[0]);
}

export function applyHtmlLang(locale: string) {
  if (typeof document === "undefined") return;
  const base = locale.split("-")[0];
  const lng = isLocale(base) ? base : "en";
  document.documentElement.lang = HTML_LANG[lng];
  document.documentElement.dir = (RTL_LOCALES as string[]).includes(lng) ? "rtl" : "ltr";
}

export function setLocale(locale: Locale) {
  void i18n.changeLanguage(locale);
  if (typeof window !== "undefined") {
    try {
      window.localStorage.setItem(I18N_STORAGE_KEY, locale);
    } catch {
      // ignore
    }
  }
  applyHtmlLang(locale);
}

export function currentLocale(): Locale {
  const lng = (i18n.language || "en").split("-")[0];
  return isLocale(lng) ? lng : "en";
}

export default i18n;
