// Currency mapping for the WaveChat global campaign.
// Static FX rates against BRL (base price currency). Update these
// periodically; for production-grade you may swap to a live FX feed.
import type { Locale } from "@/i18n/locales";

export type Currency =
  | "BRL"
  | "USD"
  | "EUR"
  | "GBP"
  | "MXN"
  | "INR"
  | "JPY"
  | "CNY"
  | "SAR";

export const CURRENCY_BY_LOCALE: Record<Locale, Currency> = {
  pt: "BRL",
  en: "USD",
  es: "EUR",
  fr: "EUR",
  de: "EUR",
  it: "EUR",
  ar: "SAR",
  hi: "INR",
  zh: "CNY",
  ja: "JPY",
};

// 1 BRL = X target currency. Conservative rates (Q2 2026 reference).
// Source these from your own pricing/FX feed when you start running paid ads.
export const FX_FROM_BRL: Record<Currency, number> = {
  BRL: 1,
  USD: 0.18,
  EUR: 0.17,
  GBP: 0.15,
  MXN: 3.5,
  INR: 15,
  JPY: 27,
  CNY: 1.3,
  SAR: 0.68,
};

// Minor-unit rounding so prices look "natural" per currency.
function roundForDisplay(value: number, currency: Currency): number {
  switch (currency) {
    case "JPY":
    case "INR":
      return Math.round(value); // no decimals on the wire
    case "MXN":
    case "CNY":
      return Math.round(value * 10) / 10;
    default:
      return Math.round(value * 100) / 100;
  }
}

export function convertFromBRL(amountBRL: number, currency: Currency): number {
  return roundForDisplay(amountBRL * FX_FROM_BRL[currency], currency);
}

export function formatMoney(amount: number, currency: Currency, locale: Locale): string {
  const tag = locale === "pt" ? "pt-BR" : locale === "zh" ? "zh-CN" : locale;
  try {
    return new Intl.NumberFormat(tag, {
      style: "currency",
      currency,
      maximumFractionDigits: currency === "JPY" || currency === "INR" ? 0 : 2,
    }).format(amount);
  } catch {
    return `${currency} ${amount.toFixed(2)}`;
  }
}

export function currencyForLocale(locale: Locale): Currency {
  return CURRENCY_BY_LOCALE[locale] ?? "USD";
}
