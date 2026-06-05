import { Globe, Check } from "lucide-react";
import { useTranslation } from "react-i18next";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuLabel,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import {
  LOCALE_FLAGS,
  LOCALE_LABELS,
  SUPPORTED_LOCALES,
  type Locale,
} from "@/i18n/locales";
import { currentLocale, setLocale } from "@/i18n";

export function LanguageSwitcher({ compact = false }: { compact?: boolean }) {
  const { t, i18n } = useTranslation();
  const active = currentLocale();
  // ensure re-render on language change
  void i18n.language;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        className="inline-flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-sm hover:bg-accent/40 transition focus:outline-none"
        aria-label={t("common.language")}
      >
        <Globe className="size-4" aria-hidden />
        {compact ? (
          <span className="text-base leading-none">{LOCALE_FLAGS[active]}</span>
        ) : (
          <>
            <span className="text-base leading-none">{LOCALE_FLAGS[active]}</span>
            <span className="hidden sm:inline">{LOCALE_LABELS[active]}</span>
          </>
        )}
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56 max-h-[70vh] overflow-y-auto">
        <DropdownMenuLabel>{t("common.language")}</DropdownMenuLabel>
        <DropdownMenuSeparator />
        {SUPPORTED_LOCALES.map((loc: Locale) => (
          <DropdownMenuItem
            key={loc}
            onClick={() => setLocale(loc)}
            className="flex items-center justify-between cursor-pointer"
          >
            <span className="flex items-center gap-2">
              <span className="text-base leading-none">{LOCALE_FLAGS[loc]}</span>
              <span>{LOCALE_LABELS[loc]}</span>
            </span>
            {active === loc && <Check className="size-4 text-primary" aria-hidden />}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
