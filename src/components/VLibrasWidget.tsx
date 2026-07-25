import { useEffect, useRef, useState } from "react";
import { Accessibility, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";

const VLIBRAS_SCRIPT_ID = "vlibras-plugin-script";
const VLIBRAS_STYLE_ID = "vlibras-visibility-style";

declare global {
  interface Window {
    VLibras?: {
      Widget?: new (root: string) => unknown;
    };
    plugin?: unknown;
    wavechatOpenVLibras?: () => void;
  }
}

export function VLibrasWidget() {
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const mountedRef = useRef(false);
  const openRef = useRef(false);
  const prewarmedRef = useRef(false);
  const stabilizeTimerRef = useRef<number | undefined>(undefined);

  useEffect(() => {
    return () => {
      if (stabilizeTimerRef.current) window.clearInterval(stabilizeTimerRef.current);
    };
  }, []);

  useEffect(() => {
    const handler = () => {
      void toggleVLibras();
    };
    window.wavechatOpenVLibras = handler;
    window.addEventListener("wavechat:open-vlibras", handler);
    return () => {
      if (window.wavechatOpenVLibras === handler) window.wavechatOpenVLibras = undefined;
      window.removeEventListener("wavechat:open-vlibras", handler);
    };
  }, []);

  const ensureStyle = () => {
    if (document.getElementById(VLIBRAS_STYLE_ID)) return;
    const style = document.createElement("style");
    style.id = VLIBRAS_STYLE_ID;
    style.textContent = `
      div[vw] {
        position: fixed !important;
        right: 12px !important;
        bottom: 76px !important;
        left: auto !important;
        top: auto !important;
        z-index: 2147483000 !important;
        display: block !important;
        width: 40px !important;
        min-width: 40px !important;
        min-height: 40px !important;
        margin: 0 !important;
        transform: none !important;
      }
      div[vw].wavechat-vlibras-prewarm {
        visibility: hidden !important;
        pointer-events: none !important;
      }
      div[vw].active {
        width: min(300px, calc(100vw - 24px)) !important;
        height: min(450px, calc(100dvh - 120px)) !important;
        min-height: 360px !important;
      }
      [vw-access-button] {
        position: absolute !important;
        right: 0 !important;
        bottom: 0 !important;
        left: auto !important;
        top: auto !important;
        display: flex !important;
        opacity: 0 !important;
        visibility: visible !important;
        pointer-events: none !important;
      }
      [vw-plugin-wrapper] {
        position: absolute !important;
        right: 0 !important;
        bottom: 48px !important;
        z-index: 2147483000 !important;
        max-width: calc(100vw - 24px) !important;
        max-height: calc(100dvh - 120px) !important;
      }
      [vw-plugin-wrapper].active {
        display: flex !important;
        visibility: visible !important;
        opacity: 1 !important;
        height: min(450px, calc(100dvh - 120px)) !important;
        min-height: min(450px, calc(100dvh - 120px)) !important;
      }
      .wavechat-vlibras-button { z-index: 2147483646 !important; }
      @media (min-width: 768px) {
        div[vw] { right: 24px !important; bottom: 24px !important; }
        div[vw].active { height: 450px !important; }
        [vw-plugin-wrapper] { bottom: 48px !important; max-height: calc(100dvh - 96px) !important; }
        [vw-plugin-wrapper].active { height: 450px !important; min-height: 450px !important; }
      }
    `;
    document.head.appendChild(style);
  };

  const ensureMarkup = () => {
    let root = document.querySelector<HTMLElement>("div[vw]");
    if (!root) {
      root = document.createElement("div");
      root.setAttribute("vw", "");
      root.className = "enabled";
      root.innerHTML = `
        <div vw-access-button class="active"></div>
        <div vw-plugin-wrapper>
          <div class="vw-plugin-top-wrapper"></div>
        </div>
      `;
      document.body.appendChild(root);
    }
    return root;
  };

  const isReady = () => Boolean(document.querySelector("[vw-plugin-wrapper] [vp]"));

  const waitForReady = async () => {
    for (let i = 0; i < 40; i += 1) {
      if (isReady()) return true;
      await new Promise((resolve) => window.setTimeout(resolve, i < 10 ? 200 : 400));
    }
    return false;
  };

  const loadScript = () =>
    new Promise<void>((resolve, reject) => {
      const existing = document.getElementById(VLIBRAS_SCRIPT_ID) as HTMLScriptElement | null;
      if (window.VLibras?.Widget || isReady()) {
        resolve();
        return;
      }
      if (existing) {
        existing.addEventListener("load", () => resolve(), { once: true });
        existing.addEventListener("error", () => reject(new Error("Falha ao carregar VLibras")), { once: true });
        return;
      }
      const script = document.createElement("script");
      script.id = VLIBRAS_SCRIPT_ID;
      script.src = "https://vlibras.gov.br/app/vlibras-plugin.js";
      script.async = true;
      script.onload = () => resolve();
      script.onerror = () => reject(new Error("Falha ao carregar VLibras"));
      document.body.appendChild(script);
    });

  const mountWidget = () => {
    ensureMarkup();
    if (isReady() || mountedRef.current) return;
    if (!window.VLibras?.Widget) return;
    const previousOnload = window.onload;
    new window.VLibras.Widget("https://vlibras.gov.br/app");
    mountedRef.current = true;
    window.setTimeout(() => {
      const runOnload = window.onload;
      if (typeof runOnload === "function" && runOnload !== previousOnload) {
        runOnload.call(window, new Event("load"));
      }
    }, 0);
  };

  const showPanel = () => {
    const root = ensureMarkup();
    const accessButton = document.querySelector<HTMLElement>("[vw-access-button]");
    const wrapper = document.querySelector<HTMLElement>("[vw-plugin-wrapper]");
    const wrapperWasActive = Boolean(wrapper?.classList.contains("active"));
    root.classList.remove("wavechat-vlibras-prewarm");
    if (!wrapperWasActive) {
      accessButton?.click();
    }
    root.classList.add("enabled", "active");
    accessButton?.classList.add("active");
    wrapper?.classList.add("active");
    openRef.current = true;
    setOpen(true);
    setLoading(false);

    if (stabilizeTimerRef.current) window.clearInterval(stabilizeTimerRef.current);
    const startedAt = Date.now();
    stabilizeTimerRef.current = window.setInterval(() => {
      if (!openRef.current || Date.now() - startedAt > 10000) {
        if (stabilizeTimerRef.current) window.clearInterval(stabilizeTimerRef.current);
        stabilizeTimerRef.current = undefined;
        return;
      }
      root.classList.add("enabled", "active");
      accessButton?.classList.add("active");
      wrapper?.classList.add("active");
    }, 250);
  };

  const hidePanel = () => {
    document.querySelector<HTMLElement>("div[vw]")?.classList.remove("active");
    document.querySelector<HTMLElement>("[vw-access-button]")?.classList.remove("active");
    document.querySelector<HTMLElement>("[vw-plugin-wrapper]")?.classList.remove("active");
    openRef.current = false;
    setOpen(false);
    setLoading(false);
  };

  const toggleVLibras = async () => {
    if (openRef.current || document.querySelector("[vw-plugin-wrapper].active")) {
      hidePanel();
      return;
    }

    setLoading(true);
    ensureStyle();
    ensureMarkup();
    const slowTimer = window.setTimeout(() => {
      if (loading || !openRef.current) {
        toast.info("O avatar oficial do VLibras ainda está carregando. A primeira abertura pode demorar alguns segundos.");
      }
    }, 8000);

    try {
      await loadScript();
      mountWidget();
      const ready = await waitForReady();
      window.clearTimeout(slowTimer);
      if (!ready) {
        setLoading(false);
        toast.error("O VLibras está lento fora da WaveChat. Tente novamente em alguns segundos.");
        return;
      }
      showPanel();
    } catch {
      window.clearTimeout(slowTimer);
      setLoading(false);
      toast.error("Não foi possível abrir o VLibras agora.");
    }
  };

  const warmVLibras = async () => {
    if (prewarmedRef.current) return;
    prewarmedRef.current = true;
    try {
      ensureStyle();
      const root = ensureMarkup();
      root.classList.add("wavechat-vlibras-prewarm");
      await loadScript();
      mountWidget();
      const ready = await waitForReady();
      if (!ready || openRef.current || window.plugin) return;
      document.querySelector<HTMLElement>("[vw-access-button]")?.click();
      window.setTimeout(() => {
        if (openRef.current) return;
        document.querySelector<HTMLElement>("div[vw]")?.classList.remove("active");
        document.querySelector<HTMLElement>("[vw-access-button]")?.classList.remove("active");
        document.querySelector<HTMLElement>("[vw-plugin-wrapper]")?.classList.remove("active");
      }, 2000);
    } catch {
      prewarmedRef.current = false;
    }
  };

  useEffect(() => {
    const win = window as Window & {
      requestIdleCallback?: (cb: () => void, options?: { timeout: number }) => number;
      cancelIdleCallback?: (id: number) => void;
    };
    if (win.requestIdleCallback) {
      const idleId = win.requestIdleCallback(() => void warmVLibras(), { timeout: 5000 });
      return () => win.cancelIdleCallback?.(idleId);
    }
    const timer = window.setTimeout(() => void warmVLibras(), 3500);
    return () => window.clearTimeout(timer);
  }, []);

  return (
    <Button
      type="button"
      size="sm"
      variant="secondary"
      className="wavechat-vlibras-button fixed right-3 bottom-[76px] md:right-6 md:bottom-6 rounded-full shadow-lg"
      onClick={() => void toggleVLibras()}
      aria-label={open ? "Fechar tradução em Libras" : "Abrir tradução em Libras"}
      title="Traduzir para Libras"
    >
      {loading ? <Loader2 className="size-4 mr-1.5 animate-spin" /> : <Accessibility className="size-4 mr-1.5" />}
      Libras
    </Button>
  );
}