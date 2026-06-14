import { useEffect, useState } from "react";
import { Capacitor } from "@capacitor/core";
import { X, Smartphone } from "lucide-react";

const DISMISS_KEY = "wavechat_playstore_banner_dismissed_until";
const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;

export function PlayStorePromoBanner() {
  const [show, setShow] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    // Hide on native (already in app)
    try {
      if (Capacitor.isNativePlatform()) return;
    } catch {
      // ignore
    }
    // Hide if running as installed PWA
    if (window.matchMedia?.("(display-mode: standalone)").matches) return;
    if ((window.navigator as any).standalone === true) return;

    try {
      const until = Number(localStorage.getItem(DISMISS_KEY) || "0");
      if (until && Date.now() < until) return;
    } catch {
      // ignore
    }
    setShow(true);
  }, []);

  if (!show) return null;

  const dismiss = () => {
    try {
      localStorage.setItem(DISMISS_KEY, String(Date.now() + SEVEN_DAYS_MS));
    } catch {
      // ignore
    }
    setShow(false);
  };

  return (
    <div className="fixed inset-x-0 top-0 z-[200] bg-gradient-to-r from-primary via-accent to-primary text-primary-foreground shadow-lg animate-in slide-in-from-top-2">
      <div className="max-w-5xl mx-auto px-3 py-2 flex items-center gap-3">
        <Smartphone className="size-5 shrink-0" aria-hidden />
        <p className="flex-1 text-xs sm:text-sm leading-snug font-medium">
          <span className="font-bold">Sua experiência é muito melhor no app!</span>{" "}
          <span className="hidden sm:inline">Baixe agora pelo botão da Play Store no topo ou procure por </span>
          <span className="sm:hidden">Baixe na Play Store: procure por </span>
          <span className="font-bold underline">WaveChat</span>.
        </p>
        <a
          href="https://play.google.com/store/apps/details?id=com.wavechat.app"
          target="_blank"
          rel="noopener noreferrer"
          className="hidden sm:inline-flex items-center gap-1.5 rounded-full bg-background/95 text-foreground px-3 py-1.5 text-xs font-semibold hover:bg-background transition shrink-0"
        >
          <svg className="size-3.5" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
            <path d="M3 20.5V3.5c0-.59.34-1.11.84-1.35L13.69 12 3.84 21.85A1.5 1.5 0 0 1 3 20.5Zm13.81-5.38L6.05 21.34 14.54 12.85l2.27 2.27Zm3.35-4.31a1.495 1.495 0 0 1 0 2.38l-2.27 1.31L15.39 12l2.27-2.5 2.27 1.31ZM6.05 2.66l10.76 6.22-2.27 2.27L6.05 2.66Z" />
          </svg>
          Play Store
        </a>
        <button
          onClick={dismiss}
          aria-label="Dispensar por 7 dias"
          title="Dispensar por 7 dias"
          className="rounded-md p-1.5 hover:bg-background/20 transition shrink-0"
        >
          <X className="size-4" />
        </button>
      </div>
    </div>
  );
}
