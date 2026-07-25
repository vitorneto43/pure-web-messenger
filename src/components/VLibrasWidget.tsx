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
    if (document.getElementById("vlibras-plugin-script")) return;

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
      } catch (e) {
        console.warn("VLibras: falha ao inicializar", e);
      }
    };
    document.body.appendChild(script);
  }, []);

  return null;
}
