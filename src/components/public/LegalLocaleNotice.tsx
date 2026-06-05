import "@/i18n";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";

/**
 * Notice shown on legal pages (privacy/terms) when the user's locale
 * is not Portuguese. The Portuguese version is the legally binding one.
 * Renders nothing during SSR / first paint to keep hydration stable.
 */
export function LegalLocaleNotice() {
  const { t, i18n } = useTranslation();
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  if (!mounted) return null;
  const lng = (i18n.language || "pt").split("-")[0];
  if (lng === "pt") return null;
  return (
    <div className="mb-6 rounded-xl border border-primary/30 bg-primary/5 px-4 py-3 text-sm text-foreground/90">
      {t("legal.localeNotice")}
    </div>
  );
}
