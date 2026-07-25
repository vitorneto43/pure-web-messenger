import { useEffect, useRef, useState } from "react";
import { Accessibility, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";

/**
 * VLibras — plugin oficial do Governo Federal (gov.br) que traduz
 * automaticamente o conteúdo em texto do site para Libras (Língua
 * Brasileira de Sinais), promovendo inclusão de pessoas surdas.
 *
 * https://www.gov.br/governodigital/pt-br/vlibras
 *
 * Carrega o script sob demanda no client (evita SSR + peso inicial)
 * e monta o widget uma única vez.
 */
export function VLibrasWidget() {
  const [loading, setLoading] = useState(false);
  const openHandlerRef = useRef<(() => void) | null>(null);
  const pendingButtonOpenRef = useRef(false);

  useEffect(() => {
    if (typeof window === "undefined") return;

    let pendingOpen = false;
    let disposed = false;
    let retryTimer: number | undefined;

    const ensureMarkup = () => {
      if (document.querySelector("div[vw]")) return;
      const root = document.createElement("div");
      root.setAttribute("vw", "");
      root.className = "enabled";
      root.innerHTML = `
        <div vw-access-button class="active"></div>
        <div vw-plugin-wrapper>
          <div class="vw-plugin-top-wrapper"></div>
        </div>
      `;
      document.body.appendChild(root);
    };

    const ensureVisibilityStyle = () => {
      if (document.getElementById("vlibras-visibility-style")) return;
      const style = document.createElement("style");
      style.id = "vlibras-visibility-style";
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
        }
        div[vw].active {
          width: min(300px, calc(100vw - 24px)) !important;
          height: min(450px, calc(100dvh - 120px)) !important;
          min-height: 360px !important;
          transform: none !important;
        }
        [vw-access-button] {
          position: absolute !important;
          right: 0 !important;
          bottom: 0 !important;
          left: auto !important;
          top: auto !important;
          z-index: 2147483001 !important;
          pointer-events: auto !important;
          visibility: visible !important;
          opacity: 0 !important;
        }
        [vw-access-button].active,
        [vw-access-button]:not(.active) {
          display: flex !important;
        }
        [vw-access-button]::before {
          content: "";
          position: absolute;
          inset: -8px;
        }
        .wavechat-vlibras-button {
          z-index: 2147483646 !important;
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
          min-height: min(450px, calc(100dvh - 120px)) !important;
        }
        @media (min-width: 768px) {
          div[vw] { bottom: 24px !important; right: 24px !important; }
          div[vw].active { height: 450px !important; }
          [vw-plugin-wrapper] { bottom: 48px !important; max-height: calc(100dvh - 96px) !important; }
        }
      `;
      document.head.appendChild(style);
    };

    const isWidgetReady = () => {
      const accessButton = document.querySelector<HTMLElement>("[vw-access-button]");
      const wrapper = document.querySelector<HTMLElement>("[vw-plugin-wrapper]");
      return Boolean(accessButton?.querySelector("img") && wrapper?.querySelector("[vp]"));
    };

    const isPanelOpen = () => {
      const wrapper = document.querySelector<HTMLElement>("[vw-plugin-wrapper]");
      return Boolean(wrapper?.classList.contains("active"));
    };

    const forceOpenPanel = () => {
      const root = document.querySelector<HTMLElement>("div[vw]");
      const accessButton = document.querySelector<HTMLElement>("[vw-access-button]");
      const wrapper = document.querySelector<HTMLElement>("[vw-plugin-wrapper]");
      if (!root || !accessButton || !wrapper || !isWidgetReady()) return false;
      root.classList.add("active");
      accessButton.classList.add("active");
      wrapper.classList.add("active");
      setLoading(false);
      return true;
    };

    const initializeWidget = () => {
      ensureMarkup();
      ensureVisibilityStyle();
      const accessButton = document.querySelector<HTMLElement>("[vw-access-button]");
      const wrapper = document.querySelector<HTMLElement>("[vw-plugin-wrapper]");
      if (accessButton?.querySelector("img") && wrapper?.querySelector("[vp]")) return;
      try {
        // @ts-expect-error — global injetado pelo script do VLibras
        if (!window.VLibras?.Widget) return;
        const previousOnload = window.onload;
        // @ts-expect-error — global injetado pelo script do VLibras
        new window.VLibras.Widget("https://vlibras.gov.br/app");
        // O plugin oficial amarra a montagem final ao window.onload. Como este
        // componente carrega sob demanda depois da página já estar pronta,
        // disparamos esse passo manualmente para o botão ganhar o handler real.
        window.setTimeout(() => {
          if (disposed) return;
          if (typeof window.onload === "function" && window.onload !== previousOnload) {
            window.onload(new Event("load"));
          }
        }, 0);
      } catch (e) {
        console.warn("VLibras: falha ao inicializar", e);
      }
    };

    const clickAccessButton = () => {
      const wrapper = document.querySelector<HTMLElement>("[vw-plugin-wrapper]");
      if (!wrapper || !isWidgetReady()) return false;
      if (isPanelOpen()) {
        wrapper?.classList.remove("active");
        setLoading(false);
        return true;
      }
      // O botão oficial às vezes demora a receber o listener interno.
      // Abrimos o painel diretamente quando a estrutura do plugin já existe.
      return forceOpenPanel();
    };

    const retryOpen = (attempt = 0) => {
      if (disposed || !pendingOpen) return;
      initializeWidget();
      if (!isPanelOpen() && forceOpenPanel()) {
        pendingOpen = false;
        return;
      }
      if (clickAccessButton()) {
        if (isPanelOpen()) {
          pendingOpen = false;
          return;
        }
      }
      if (attempt >= 12) {
        setLoading(false);
        return;
      }
      retryTimer = window.setTimeout(() => retryOpen(attempt + 1), attempt < 4 ? 350 : 750);
    };

    const handleOpenVLibras = () => {
      setLoading(true);
      initializeWidget();
      if (clickAccessButton()) {
        pendingOpen = false;
        return;
      }
      pendingOpen = true;
      retryOpen();
    };
    openHandlerRef.current = handleOpenVLibras;
    if (pendingButtonOpenRef.current) {
      pendingButtonOpenRef.current = false;
      window.setTimeout(handleOpenVLibras, 0);
    }
    window.addEventListener("wavechat:open-vlibras", handleOpenVLibras);

    if (document.getElementById("vlibras-plugin-script")) {
      return () => {
        if (openHandlerRef.current === handleOpenVLibras) openHandlerRef.current = null;
        window.removeEventListener("wavechat:open-vlibras", handleOpenVLibras);
      };
    }

    ensureVisibilityStyle();
    ensureMarkup();

    const script = document.createElement("script");
    script.id = "vlibras-plugin-script";
    script.src = "https://vlibras.gov.br/app/vlibras-plugin.js";
    script.async = true;
    script.onload = () => {
      initializeWidget();
      if (pendingOpen) {
        retryOpen();
      }
    };
    script.onerror = () => {
      pendingOpen = false;
      setLoading(false);
      console.warn("VLibras: falha ao carregar o script oficial");
    };
    document.body.appendChild(script);
    return () => {
      disposed = true;
      if (retryTimer) window.clearTimeout(retryTimer);
      if (openHandlerRef.current === handleOpenVLibras) openHandlerRef.current = null;
      window.removeEventListener("wavechat:open-vlibras", handleOpenVLibras);
    };
  }, []);

  const openFromButton = () => {
    const open = openHandlerRef.current;
    if (open) {
      open();
      return;
    }
    pendingButtonOpenRef.current = true;
    setLoading(true);
  };

  return (
    <Button
      type="button"
      size="sm"
      variant="secondary"
      className="wavechat-vlibras-button fixed right-3 bottom-[76px] md:right-6 md:bottom-6 rounded-full shadow-lg"
      onClick={openFromButton}
      aria-label="Abrir tradução em Libras"
      title="Traduzir para Libras"
    >
      {loading ? <Loader2 className="size-4 mr-1.5 animate-spin" /> : <Accessibility className="size-4 mr-1.5" />}
      Libras
    </Button>
  );
}
