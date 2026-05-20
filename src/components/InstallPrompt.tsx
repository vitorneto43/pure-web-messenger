import { useEffect, useState } from "react";
import { X, Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { registerServiceWorker } from "@/lib/push-client";

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
        return 'Toque no botão Compartilhar (quadrado com seta) e depois em "Adicionar à Tela de Início".';
      case "ios-other":
        return 'Abra este site no Safari, toque em Compartilhar e depois em "Adicionar à Tela de Início".';
      case "android":
        return 'Se a janela de instalação não abriu, o navegador ainda não liberou o instalador. Toque no menu (⋮) e escolha "Instalar app" ou "Adicionar à Tela de Início".';
      case "mobile-other":
        return 'Abra o menu do navegador e escolha "Instalar app" ou "Adicionar à Tela de Início".';
      default:
        return 'No computador, clique no ícone de instalação na barra de endereço, ou abra o site pelo celular para instalar como app.';
    }
  })();

  if (collapsed) {
    return (
      <button
        onClick={expand}
        aria-label="Instalar no celular"
        className="fixed bottom-4 right-4 z-[100] flex items-center gap-2 rounded-full border border-border bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground shadow-lg hover:opacity-90"
      >
        <Download className="size-4" />
        Instalar no celular
      </button>
    );
  }

  return (
    <div className="fixed bottom-4 left-1/2 z-[100] w-[min(420px,calc(100vw-2rem))] -translate-x-1/2 rounded-xl border border-border bg-card/95 p-3 shadow-lg backdrop-blur">
      <div className="flex items-start gap-3">
        <img
          src="/icon-192.png"
          alt="Ícone do Wavechat"
          className="size-11 shrink-0 rounded-xl shadow-sm"
          loading="lazy"
        />
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold">Instalar no celular</p>
          <p className="mt-0.5 text-xs text-muted-foreground">
            {showHelp ? helpText : deferred ? "Toque para abrir o instalador do celular com o ícone do Wavechat." : "Instale o Wavechat direto na tela inicial, igual app de celular."}
          </p>
          <div className="mt-2 flex flex-wrap gap-2">
            <Button size="sm" onClick={install} disabled={installing}>
              <Download className="size-4" />
              {installing ? "Abrindo..." : "Instalar no celular"}
            </Button>
            {showHelp && (
              <Button size="sm" variant="ghost" onClick={() => setShowHelp(false)}>
                Voltar
              </Button>
            )}
            <Button size="sm" variant="ghost" onClick={collapse}>
              Minimizar
            </Button>
          </div>
        </div>
        <button
          aria-label="Minimizar"
          onClick={collapse}
          className="rounded-md p-1 text-muted-foreground hover:bg-muted"
        >
          <X className="size-4" />
        </button>
      </div>
    </div>
  );
}
