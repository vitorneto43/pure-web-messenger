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
        return 'No iPhone, a Apple só cria o app pela opção Compartilhar → "Adicionar à Tela de Início". Ele aparece na tela inicial, não na lista de apps.';
      case "ios-other":
        return 'No iPhone, abra este site no Safari. Outros navegadores podem salvar só um atalho/offline e não criar o app correto.';
      case "android":
        return 'Se apareceu "Baixar", "Download" ou "Página offline", essa não é a instalação do app. Use o menu (⋮) e escolha exatamente "Instalar app"; se essa opção não aparecer, esse navegador só permite atalho/offline.';
      case "mobile-other":
        return 'Abra o menu do navegador e procure "Instalar app". Não use "Baixar", "Download" ou "Salvar offline", pois isso não cria aplicativo com ícone.';
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
            {showHelp
              ? helpText
              : deferred
                ? "Toque para abrir o instalador real do celular com o ícone do Wavechat."
                : "Não toque em Baixar/Download offline. Toque aqui para ver a opção certa de instalar o app."}
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
