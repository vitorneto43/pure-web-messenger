import { useState } from "react";
import { Languages, Loader2 } from "lucide-react";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { runAIAssistant } from "@/lib/ai-assistant.functions";
import { currentLocale } from "@/i18n";
import { LOCALE_LABELS, type Locale } from "@/i18n/locales";
import { cn } from "@/lib/utils";

/**
 * Small "Translate" toggle button.
 * Uses the AI gateway to translate text into the user's current UI locale.
 * Clicking again hides the translation and reveals the original.
 */
export function TranslateButton({
  text,
  className,
  size = "sm",
  variant = "muted",
  onTranslated,
}: {
  text: string | null | undefined;
  className?: string;
  size?: "xs" | "sm";
  variant?: "muted" | "light" | "dark";
  onTranslated?: (translated: string | null) => void;
}) {
  const run = useServerFn(runAIAssistant);
  const [loading, setLoading] = useState(false);
  const [translated, setTranslated] = useState<string | null>(null);
  const [shown, setShown] = useState(false);

  const src = (text ?? "").trim();
  if (!src) return null;

  async function toggle() {
    if (shown) {
      setShown(false);
      onTranslated?.(null);
      return;
    }
    if (translated) {
      setShown(true);
      onTranslated?.(translated);
      return;
    }
    setLoading(true);
    try {
      const loc = currentLocale() as Locale;
      const target = LOCALE_LABELS[loc] || "português do Brasil";
      const res = await run({ data: { action: "translate", text: src, targetLanguage: target } });
      if (!res.ok) throw new Error(res.error);
      setTranslated(res.content);
      setShown(true);
      onTranslated?.(res.content);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Falha ao traduzir");
    } finally {
      setLoading(false);
    }
  }

  const colorCls =
    variant === "dark"
      ? "text-white/80 hover:text-white"
      : variant === "light"
        ? "text-primary hover:opacity-80"
        : "text-muted-foreground hover:text-foreground";
  const sizeCls = size === "xs" ? "text-[10px] gap-0.5" : "text-xs gap-1";

  return (
    <button
      type="button"
      onClick={toggle}
      disabled={loading}
      className={cn("inline-flex items-center transition disabled:opacity-60", colorCls, sizeCls, className)}
      aria-label={shown ? "Ver original" : "Traduzir"}
    >
      {loading ? (
        <Loader2 className="size-3 animate-spin" />
      ) : (
        <Languages className="size-3" />
      )}
      <span>{shown ? "Ver original" : "Traduzir"}</span>
    </button>
  );
}
