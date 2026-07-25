import { useEffect } from "react";

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
  useEffect(() => {
    if (typeof window === "undefined") return;

    let pendingOpen = false;
    let disposed = false;

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
          opacity: 1 !important;
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
      const accessButton = document.querySelector<HTMLElement>("[vw-access-button]");
      if (!accessButton) return false;
      accessButton.click();
      return true;
    };
    const handleOpenVLibras = () => {
      initializeWidget();
      if (clickAccessButton()) return;
      pendingOpen = true;
      window.setTimeout(() => {
        if (pendingOpen && clickAccessButton()) pendingOpen = false;
      }, 800);
    };
    window.addEventListener("wavechat:open-vlibras", handleOpenVLibras);

    if (document.getElementById("vlibras-plugin-script")) {
      return () => window.removeEventListener("wavechat:open-vlibras", handleOpenVLibras);
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
        window.setTimeout(() => {
          if (clickAccessButton()) pendingOpen = false;
        }, 300);
      }
    };
    document.body.appendChild(script);
    return () => {
      disposed = true;
      window.removeEventListener("wavechat:open-vlibras", handleOpenVLibras);
    };
  }, []);

  return null;
}
