// Lista de bancos suportados com deep links públicos conhecidos.
// IMPORTANTE: a maioria dos esquemas só abre o app na tela inicial — NÃO preenche
// chave nem valor (limitação dos próprios bancos, não é possível contornar).
// No desktop ou se o app não estiver instalado, o link silenciosamente falha.

export interface Bank {
  id: string;
  name: string;
  // URL scheme do app (mobile). Vazio = sem deep link conhecido.
  scheme?: string;
  // URL https de fallback (site / página web do banco).
  web?: string;
}

export const BANKS: Bank[] = [
  { id: "nubank",       name: "Nubank",          scheme: "nubank://",         web: "https://nubank.com.br" },
  { id: "itau",         name: "Itaú",            scheme: "itau://",           web: "https://www.itau.com.br" },
  { id: "bb",           name: "Banco do Brasil", scheme: "bb://",             web: "https://www.bb.com.br" },
  { id: "bradesco",     name: "Bradesco",        scheme: "bradesco://",       web: "https://banco.bradesco" },
  { id: "santander",    name: "Santander",       scheme: "santander://",      web: "https://www.santander.com.br" },
  { id: "caixa",        name: "Caixa",           scheme: "caixa://",          web: "https://www.caixa.gov.br" },
  { id: "inter",        name: "Inter",           scheme: "bancointer://",     web: "https://www.bancointer.com.br" },
  { id: "c6",           name: "C6 Bank",         scheme: "c6bank://",         web: "https://www.c6bank.com.br" },
  { id: "picpay",       name: "PicPay",          scheme: "picpay://",         web: "https://picpay.com" },
  { id: "mercadopago",  name: "Mercado Pago",    scheme: "mercadopago://",    web: "https://www.mercadopago.com.br" },
  { id: "next",         name: "Next",            scheme: "next://",           web: "https://next.me" },
  { id: "original",     name: "Original",        scheme: "original://",       web: "https://www.original.com.br" },
  { id: "neon",         name: "Neon",            scheme: "neon://",           web: "https://neon.com.br" },
  { id: "outro",        name: "Outro",                                        web: undefined },
];

export function getBank(id?: string | null): Bank | undefined {
  if (!id) return undefined;
  return BANKS.find((b) => b.id === id);
}

// Tenta abrir o app do banco. No mobile dispara o scheme; se nada acontecer
// em ~1.2s, abre a web como fallback. No desktop vai direto pra web.
export function openBankApp(bank: Bank): "app" | "web" | "none" {
  if (typeof window === "undefined") return "none";
  const isMobile = /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);

  if (isMobile && bank.scheme) {
    const start = Date.now();
    const timer = window.setTimeout(() => {
      // Se ainda estamos visíveis, o app não interceptou — abre a web.
      if (Date.now() - start < 1500 && document.visibilityState === "visible" && bank.web) {
        window.location.href = bank.web;
      }
    }, 1200);
    // Se o app abriu, a aba fica oculta e cancelamos o fallback.
    const onHide = () => {
      if (document.visibilityState === "hidden") {
        window.clearTimeout(timer);
        document.removeEventListener("visibilitychange", onHide);
      }
    };
    document.addEventListener("visibilitychange", onHide);
    window.location.href = bank.scheme;
    return "app";
  }

  if (bank.web) {
    window.open(bank.web, "_blank", "noopener,noreferrer");
    return "web";
  }
  return "none";
}
