import "@/i18n";
import { useEffect, useState } from "react";
import { X, Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { registerServiceWorker } from "@/lib/push-client";
import { useTranslation } from "react-i18next";

type BIPEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

const COLLAPSE_KEY = "wavechat_install_collapsed_v1";

function isStandalone() {
  if (typeof window === "undefined") return true;
  if (window.matchMedia?.("(display-mode: standalone)").matches) return true;
  return (window.navigator as any).standalone === true;
}

function inIframe() {
  try {
    return window.self !== window.top;
  } catch {
    return true;
  }
}

type Platform = "android" | "ios-safari" | "ios-other" | "mobile-other" | "desktop";

function detectPlatform(): Platform {
  if (typeof navigator === "undefined") return "desktop";
  const ua = navigator.userAgent;
  const isIOS = /iPad|iPhone|iPod/.test(ua) && !(window as any).MSStream;
  const isAndroid = /Android/.test(ua);
  const isSafari = /Safari/.test(ua) && !/CriOS|FxiOS|EdgiOS/.test(ua);
  if (isIOS) return isSafari ? "ios-safari" : "ios-other";
  if (isAndroid) return "android";
  if (window.innerWidth < 768) return "mobile-other";
  return "desktop";
}

export function InstallPrompt() {
  const { t } = useTranslation();
  const [mounted, setMounted] = useState(false);
  const [deferred, setDeferred] = useState<BIPEvent | null>(null);
  const [platform, setPlatform] = useState<Platform>("desktop");
  const [collapsed, setCollapsed] = useState(false);
  const [showHelp, setShowHelp] = useState(false);
  const [installing, setInstalling] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (inIframe()) return;
    if (isStandalone()) return;
    setMounted(true);
    setPlatform(detectPlatform());
    if (localStorage.getItem(COLLAPSE_KEY) === "1") setCollapsed(true);

    void registerServiceWorker().then(() => setPlatform(detectPlatform()));

    const onBIP = (e: Event) => {
      e.preventDefault();
      setDeferred(e as BIPEvent);
      setShowHelp(false);
    };
    const onInstalled = () => {
      setDeferred(null);
      setShowHelp(false);
      setMounted(false);
    };
    window.addEventListener("beforeinstallprompt", onBIP);
    window.addEventListener("appinstalled", onInstalled);
    return () => {
      window.removeEventListener("beforeinstallprompt", onBIP);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);

  if (!mounted) return null;

  const collapse = () => {
    localStorage.setItem(COLLAPSE_KEY, "1");
    setCollapsed(true);
    setShowHelp(false);
  };

  const expand = () => {
    localStorage.removeItem(COLLAPSE_KEY);
    setCollapsed(false);
  };

  const install = async () => {
    if (deferred) {
      setInstalling(true);
      try {
        await deferred.prompt();
        const choice = await deferred.userChoice;
        setDeferred(null);
        setShowHelp(choice.outcome !== "accepted");
      } finally {
        setInstalling(false);
      }
    } else {
      setShowHelp(true);
    }
  };

  const helpText = (() => {
    switch (platform) {
      case "ios-safari":
        return t("app.install.helpIosSafari");
      case "ios-other":
        return t("app.install.helpIosOther");
      case "android":
        return t("app.install.helpAndroid");
      case "mobile-other":
        return t("app.install.helpMobileOther");
      default:
        return t("app.install.helpDesktop");
    }
  })();

  if (collapsed) {
    return (
      <button
        onClick={expand}
        aria-label={t("app.install.ariaInstall")}
        className="fixed bottom-4 right-4 z-[100] flex items-center gap-2 rounded-full border border-border bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground shadow-lg hover:opacity-90"
      >
        <Download className="size-4" />
        {t("app.install.title")}
      </button>
    );
  }

  return (
    <div className="fixed bottom-4 left-1/2 z-[100] w-[min(420px,calc(100vw-2rem))] -translate-x-1/2 rounded-xl border border-border bg-card/95 p-3 shadow-lg backdrop-blur">
      <div className="flex items-start gap-3">
        <img
          src="/icon-192.png"
          alt={t("app.install.iconAlt")}
          className="size-11 shrink-0 rounded-xl shadow-sm"
          loading="lazy"
        />
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold">{t("app.install.title")}</p>
          <p className="mt-0.5 text-xs text-muted-foreground">
            {showHelp
              ? helpText
              : deferred
                ? t("app.install.hintDeferred")
                : t("app.install.hintDefault")}
          </p>
          <div className="mt-2 flex flex-wrap gap-2">
            <Button size="sm" onClick={install} disabled={installing}>
              <Download className="size-4" />
              {installing ? t("app.install.installing") : t("app.install.btnInstall")}
            </Button>
            {showHelp && (
              <Button size="sm" variant="ghost" onClick={() => setShowHelp(false)}>
                {t("app.install.btnBack")}
              </Button>
            )}
            <Button size="sm" variant="ghost" onClick={collapse}>
              {t("app.install.btnMinimize")}
            </Button>
          </div>
        </div>
        <button
          aria-label={t("app.install.ariaMinimize")}
          onClick={collapse}
          className="rounded-md p-1 text-muted-foreground hover:bg-muted"
        >
          <X className="size-4" />
        </button>
      </div>
    </div>
  );
}
