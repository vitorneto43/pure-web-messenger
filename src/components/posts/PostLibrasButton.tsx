import { useState } from "react";
import { HandMetal, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

/**
 * Fase 3 — Botão "Libras" por post.
 * Abre o widget VLibras (se já não estiver aberto) e envia o texto do post
 * para tradução automática em Língua Brasileira de Sinais.
 * Usa a API oficial: window.plugin.translate(text).
 */
export function PostLibrasButton({
  text,
  className,
}: {
  text: string | null | undefined;
  className?: string;
}) {
  const [loading, setLoading] = useState(false);
  const src = (text ?? "").trim();
  if (!src) return null;

  async function translate() {
    setLoading(true);
    try {
      // Abre o widget (pré-aquece o plugin se ainda não foi carregado)
      const w = window as Window & {
        wavechatOpenVLibras?: () => void;
        plugin?: { translate?: (t: string) => void };
      };
      if (!document.querySelector("[vw-plugin-wrapper].active")) {
        w.wavechatOpenVLibras?.();
      }
      // Aguarda o plugin ficar pronto (até ~12s)
      const start = Date.now();
      while (!w.plugin?.translate && Date.now() - start < 12000) {
        await new Promise((r) => setTimeout(r, 250));
      }
      if (!w.plugin?.translate) {
        toast.error("VLibras ainda está carregando. Tente novamente em alguns segundos.");
        return;
      }
      w.plugin.translate(src);
      toast.success("Tradução em Libras iniciada.");
    } catch {
      toast.error("Não foi possível traduzir para Libras agora.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <button
      type="button"
      onClick={translate}
      disabled={loading}
      className={cn(
        "inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition disabled:opacity-60",
        className,
      )}
      aria-label="Traduzir este post para Libras"
      title="Traduzir para Libras"
    >
      {loading ? <Loader2 className="size-3 animate-spin" /> : <HandMetal className="size-3 text-amber-500" />}
      <span>Libras</span>
    </button>
  );
}
