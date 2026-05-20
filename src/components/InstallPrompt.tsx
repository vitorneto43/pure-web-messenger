import { useEffect, useState } from "react";
import { Download, X } from "lucide-react";
import { Button } from "@/components/ui/button";

type BIPEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

const DISMISS_KEY = "wavechat_install_dismissed_v1";

function isStandalone() {
  if (typeof window === "undefined") return true;
  if (window.matchMedia?.("(display-mode: standalone)").matches) return true;
  // iOS Safari
  return (window.navigator as any).standalone === true;
}

function isIOS() {
  if (typeof navigator === "undefined") return false;
  return /iPad|iPhone|iPod/.test(navigator.userAgent) && !(window as any).MSStream;
}

function inIframe() {
  try {
    return window.self !== window.top;
  } catch {
    return true;
  }
}

export function InstallPrompt() {
  const [deferred, setDeferred] = useState<BIPEvent | null>(null);
  const [showIOSHint, setShowIOSHint] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (inIframe()) return;
    if (isStandalone()) return;
    if (localStorage.getItem(DISMISS_KEY) === "1") {
      setDismissed(true);
      return;
    }

    const onBIP = (e: Event) => {
      e.preventDefault();
      setDeferred(e as BIPEvent);
    };
    window.addEventListener("beforeinstallprompt", onBIP);

    if (isIOS()) setShowIOSHint(true);

    return () => window.removeEventListener("beforeinstallprompt", onBIP);
  }, []);

  if (dismissed || isStandalone() || inIframe()) return null;
  if (!deferred && !showIOSHint) return null;

  const dismiss = () => {
    localStorage.setItem(DISMISS_KEY, "1");
    setDismissed(true);
  };

  const install = async () => {
    if (!deferred) return;
    await deferred.prompt();
    await deferred.userChoice;
    setDeferred(null);
    dismiss();
  };

  return (
    <div className="fixed bottom-4 left-1/2 z-50 w-[min(420px,calc(100vw-2rem))] -translate-x-1/2 rounded-xl border border-border bg-card/95 p-3 shadow-lg backdrop-blur">
      <div className="flex items-start gap-3">
        <div className="grid size-10 shrink-0 place-items-center rounded-lg bg-primary/10 text-primary">
          <Download className="size-5" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold">Instalar Wavechat</p>
          {deferred ? (
            <p className="mt-0.5 text-xs text-muted-foreground">
              Acesse mais rápido e receba chamadas como num app nativo.
            </p>
          ) : (
            <p className="mt-0.5 text-xs text-muted-foreground">
              Toque em <span className="font-medium">Compartilhar</span> e em{" "}
              <span className="font-medium">Adicionar à Tela de Início</span>.
            </p>
          )}
          {deferred && (
            <div className="mt-2 flex gap-2">
              <Button size="sm" onClick={install}>
                Instalar
              </Button>
              <Button size="sm" variant="ghost" onClick={dismiss}>
                Agora não
              </Button>
            </div>
          )}
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
