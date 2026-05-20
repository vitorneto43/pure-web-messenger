import { useEffect, useState } from "react";
import { Download, X } from "lucide-react";
import { Button } from "@/components/ui/button";

type BIPEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

const DISMISS_KEY = "wavechat_install_dismissed_v2";

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

type Platform = "android-chrome" | "ios-safari" | "ios-other" | "desktop-chrome" | "desktop-other";

function detectPlatform(): Platform {
  if (typeof navigator === "undefined") return "desktop-other";
  const ua = navigator.userAgent;
  const isIOS = /iPad|iPhone|iPod/.test(ua) && !(window as any).MSStream;
  const isAndroid = /Android/.test(ua);
  const isSafari = /Safari/.test(ua) && !/CriOS|FxiOS|EdgiOS/.test(ua);
  const isChromium = /Chrome|Chromium|Edg|OPR/.test(ua);
  if (isIOS) return isSafari ? "ios-safari" : "ios-other";
  if (isAndroid) return "android-chrome";
  return isChromium ? "desktop-chrome" : "desktop-other";
}

export function InstallPrompt() {
  const [mounted, setMounted] = useState(false);
  const [deferred, setDeferred] = useState<BIPEvent | null>(null);
  const [platform, setPlatform] = useState<Platform>("desktop-other");
  const [dismissed, setDismissed] = useState(false);
  const [showHelp, setShowHelp] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (inIframe()) return;
    if (isStandalone()) return;
    setMounted(true);
    setPlatform(detectPlatform());
    if (localStorage.getItem(DISMISS_KEY) === "1") setDismissed(true);

    const onBIP = (e: Event) => {
      e.preventDefault();
      setDeferred(e as BIPEvent);
    };
    window.addEventListener("beforeinstallprompt", onBIP);
    return () => window.removeEventListener("beforeinstallprompt", onBIP);
  }, []);

  if (!mounted || dismissed) return null;

  const dismiss = () => {
    localStorage.setItem(DISMISS_KEY, "1");
    setDismissed(true);
  };

  const install = async () => {
    if (deferred) {
      await deferred.prompt();
      await deferred.userChoice;
      setDeferred(null);
      dismiss();
    } else {
      setShowHelp(true);
    }
  };

  const helpText = (() => {
    switch (platform) {
      case "ios-safari":
        return 'Toque no botão Compartilhar (quadrado com seta) e depois em "Adicionar à Tela de Início".';
      case "ios-other":
        return 'Abra este site no Safari, toque em Compartilhar e depois em "Adicionar à Tela de Início".';
      case "android-chrome":
        return 'Abra o menu ⋮ do Chrome e toque em "Instalar app" ou "Adicionar à Tela de Início".';
      case "desktop-chrome":
        return 'Clique no ícone de instalar na barra de endereço, ou no menu ⋮ → "Instalar Wavechat".';
      default:
        return "Abra este site no Chrome, Edge ou Safari para instalar como aplicativo.";
    }
  })();

  return (
    <div className="fixed bottom-4 left-1/2 z-[100] w-[min(420px,calc(100vw-2rem))] -translate-x-1/2 rounded-xl border border-border bg-card/95 p-3 shadow-lg backdrop-blur">
      <div className="flex items-start gap-3">
        <div className="grid size-10 shrink-0 place-items-center rounded-lg bg-primary/10 text-primary">
          <Download className="size-5" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold">Instalar Wavechat</p>
          <p className="mt-0.5 text-xs text-muted-foreground">
            {showHelp ? helpText : "Acesse mais rápido e receba notificações como num app nativo."}
          </p>
          <div className="mt-2 flex gap-2">
            {!showHelp && (
              <Button size="sm" onClick={install}>
                Instalar
              </Button>
            )}
            <Button size="sm" variant="ghost" onClick={dismiss}>
              {showHelp ? "Fechar" : "Agora não"}
            </Button>
          </div>
        </div>
        <button
          aria-label="Fechar"
          onClick={dismiss}
          className="rounded-md p-1 text-muted-foreground hover:bg-muted"
        >
          <X className="size-4" />
        </button>
      </div>
    </div>
  );
}
