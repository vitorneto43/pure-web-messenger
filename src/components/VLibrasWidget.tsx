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
    const clickAccessButton = () => {
      const accessButton = document.querySelector<HTMLElement>("[vw-access-button]");
      if (!accessButton) return false;
      accessButton.click();
      return true;
    };
    const handleOpenVLibras = () => {
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

    // CSS para garantir que o botão flutuante fique visível acima da
    // navegação inferior (em mobile a lib posiciona `absolute` no fim
    // do <body>, o que pode deixar o botão fora da viewport).
    if (!document.getElementById("vlibras-visibility-style")) {
      const style = document.createElement("style");
      style.id = "vlibras-visibility-style";
      style.textContent = `
        div[vw] { position: fixed !important; z-index: 2147483000 !important; }
        [vw-access-button] {
          position: fixed !important;
          right: 12px !important;
          bottom: 88px !important;
          left: auto !important;
          top: auto !important;
          z-index: 2147483000 !important;
        }
        [vw-plugin-wrapper] { z-index: 2147483000 !important; }
        @media (min-width: 768px) {
          [vw-access-button] { bottom: 24px !important; right: 24px !important; }
        }
      `;
      document.head.appendChild(style);
    }

    // Marcação exigida pelo widget.
    if (!document.querySelector("div[vw]")) {
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
    }

    const script = document.createElement("script");
    script.id = "vlibras-plugin-script";
    script.src = "https://vlibras.gov.br/app/vlibras-plugin.js";
    script.async = true;
    script.onload = () => {
      try {
        // @ts-expect-error — global injetado pelo script do VLibras
        new window.VLibras.Widget("https://vlibras.gov.br/app");
        if (pendingOpen) {
          window.setTimeout(() => {
            if (clickAccessButton()) pendingOpen = false;
          }, 300);
        }
      } catch (e) {
        console.warn("VLibras: falha ao inicializar", e);
      }
    };
    document.body.appendChild(script);
    return () => window.removeEventListener("wavechat:open-vlibras", handleOpenVLibras);
  }, []);

  return null;
}
