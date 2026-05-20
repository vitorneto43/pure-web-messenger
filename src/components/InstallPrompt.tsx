import { useEffect, useState } from "react";
import { Download, Smartphone, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { registerServiceWorker } from "@/lib/push-client";

type BIPEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

const DISMISS_KEY = "wavechat_install_dismissed_v4";

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

type Platform = "android" | "ios-safari" | "ios-other" | "mobile-other";

function isMobileScreen() {
  if (typeof window === "undefined" || typeof navigator === "undefined") return false;
  return window.innerWidth < 768 || /Android|iPad|iPhone|iPod/i.test(navigator.userAgent);
}

function detectPlatform(): Platform | null {
  if (typeof navigator === "undefined") return null;
  const ua = navigator.userAgent;
  const isIOS = /iPad|iPhone|iPod/.test(ua) && !(window as any).MSStream;
  const isAndroid = /Android/.test(ua);
  const isSafari = /Safari/.test(ua) && !/CriOS|FxiOS|EdgiOS/.test(ua);
  if (isIOS) return isSafari ? "ios-safari" : "ios-other";
  if (isAndroid) return "android";
  return isMobileScreen() ? "mobile-other" : null;
}

export function InstallPrompt() {
  const [mounted, setMounted] = useState(false);
  const [deferred, setDeferred] = useState<BIPEvent | null>(null);
  const [platform, setPlatform] = useState<Platform>("mobile-other");
  const [dismissed, setDismissed] = useState(false);
  const [showHelp, setShowHelp] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (inIframe()) return;
    if (isStandalone()) return;
    const detectedPlatform = detectPlatform();
    if (!detectedPlatform) return;
    setMounted(true);
    setPlatform(detectedPlatform);
    if (localStorage.getItem(DISMISS_KEY) === "1") setDismissed(true);

    void registerServiceWorker();

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
        <div className="grid size-11 shrink-0 place-items-center rounded-xl bg-primary/10 text-primary">
          {showHelp ? <Smartphone className="size-5" /> : <Download className="size-5" />}
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold">Baixar app Wavechat</p>
          <p className="mt-0.5 text-xs text-muted-foreground">
            {showHelp ? helpText : "Instale no celular com ícone na tela inicial, igual aplicativo."}
          </p>
          <div className="mt-2 flex gap-2">
            {!showHelp && (
              <Button size="sm" onClick={install}>
                Baixar app
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
