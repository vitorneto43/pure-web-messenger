import { useEffect, useRef, useState } from "react";
import { Accessibility, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";

/**
 * HandTalk widget (avatar Hugo com LIBRAS completa).
 *
 * Ativação: definir `VITE_HANDTALK_TOKEN` no ambiente. Sem token, o
 * SignLanguageProvider carrega o VLibras. O token é vinculado ao domínio
 * pela HandTalk (https://www.handtalk.me/plugin) e é público por design.
 *
 * Expõe o MESMO contrato do VLibrasWidget para que o resto do app
 * (PostLibrasButton, ChatSidebar, evento `wavechat:open-vlibras`)
 * funcione sem alterações quando o HandTalk estiver ativo:
 *   - window.wavechatOpenVLibras()  → abre/fecha o avatar
 *   - window.plugin.translate(text) → traduz texto arbitrário
 */

const HANDTALK_SCRIPT_ID = "handtalk-plugin-script";
const HANDTALK_SRC = "https://plugin.handtalk.me/web/latest/handtalk.min.js";

type HandTalkInstance = {
  translate?: (text: string) => void;
  open?: () => void;
  close?: () => void;
};

declare global {
  interface Window {
    HT?: new (options: {
      token: string;
      avatar?: "HUGO" | "MAYA";
      pageSpeech?: boolean;
      opacity?: number;
      side?: "left" | "right";
      align?: "top" | "bottom";
      maximumTextLength?: number;
      customButton?: HTMLElement | null;
    }) => HandTalkInstance;
    __handTalk?: HandTalkInstance;
  }
}

export function HandTalkWidget({ token }: { token: string }) {
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const instanceRef = useRef<HandTalkInstance | null>(null);
  const openRef = useRef(false);

  const loadScript = () =>
    new Promise<void>((resolve, reject) => {
      if (window.HT) {
        resolve();
        return;
      }
      const existing = document.getElementById(HANDTALK_SCRIPT_ID) as HTMLScriptElement | null;
      if (existing) {
        existing.addEventListener("load", () => resolve(), { once: true });
        existing.addEventListener("error", () => reject(new Error("handtalk-load-failed")), { once: true });
        return;
      }
      const script = document.createElement("script");
      script.id = HANDTALK_SCRIPT_ID;
      script.src = HANDTALK_SRC;
      script.async = true;
      script.onload = () => resolve();
      script.onerror = () => reject(new Error("handtalk-load-failed"));
      document.body.appendChild(script);
    });

  const ensureInstance = async (): Promise<HandTalkInstance | null> => {
    if (instanceRef.current) return instanceRef.current;
    if (!window.HT) return null;
    try {
      const instance = new window.HT({
        token,
        avatar: "HUGO",
        pageSpeech: false,
        opacity: 1,
        side: "right",
        align: "bottom",
      });
      instanceRef.current = instance;
      window.__handTalk = instance;
      // Compat: PostLibrasButton usa `window.plugin.translate`
      const w = window as Window & { plugin?: { translate?: (t: string) => void } };
      w.plugin = { translate: (text: string) => instance.translate?.(text) };
      return instance;
    } catch (err) {
      console.error("[HandTalk] init failed", err);
      return null;
    }
  };

  const toggle = async () => {
    if (openRef.current) {
      instanceRef.current?.close?.();
      openRef.current = false;
      setOpen(false);
      return;
    }
    setLoading(true);
    const slow = window.setTimeout(() => {
      if (!openRef.current) {
        toast.info("O avatar HandTalk ainda está carregando…");
      }
    }, 8000);
    try {
      await loadScript();
      const instance = await ensureInstance();
      window.clearTimeout(slow);
      if (!instance) {
        toast.error("Não foi possível iniciar o HandTalk. Verifique o token.");
        setLoading(false);
        return;
      }
      instance.open?.();
      openRef.current = true;
      setOpen(true);
    } catch {
      window.clearTimeout(slow);
      toast.error("Falha ao carregar o HandTalk. Tente novamente.");
    } finally {
      setLoading(false);
    }
  };

  // Registra o mesmo contrato de eventos do VLibras
  useEffect(() => {
    const handler = () => void toggle();
    window.wavechatOpenVLibras = handler;
    window.addEventListener("wavechat:open-vlibras", handler);
    return () => {
      if (window.wavechatOpenVLibras === handler) window.wavechatOpenVLibras = undefined;
      window.removeEventListener("wavechat:open-vlibras", handler);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Prewarm em idle: carrega o script e instancia o avatar em background
  useEffect(() => {
    const warm = async () => {
      try {
        await loadScript();
        await ensureInstance();
      } catch {
        /* silencioso */
      }
    };
    const win = window as Window & {
      requestIdleCallback?: (cb: () => void, options?: { timeout: number }) => number;
      cancelIdleCallback?: (id: number) => void;
    };
    if (win.requestIdleCallback) {
      const id = win.requestIdleCallback(() => void warm(), { timeout: 5000 });
      return () => win.cancelIdleCallback?.(id);
    }
    const t = window.setTimeout(() => void warm(), 3500);
    return () => window.clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <Button
      type="button"
      size="sm"
      variant="secondary"
      className="wavechat-handtalk-button fixed right-3 bottom-[76px] md:right-6 md:bottom-6 rounded-full shadow-lg z-[2147483646]"
      onClick={() => void toggle()}
      aria-label={open ? "Fechar tradução em Libras" : "Abrir tradução em Libras"}
      title="Traduzir para Libras (HandTalk)"
    >
      {loading ? <Loader2 className="size-4 mr-1.5 animate-spin" /> : <Accessibility className="size-4 mr-1.5" />}
      Libras
    </Button>
  );
}
