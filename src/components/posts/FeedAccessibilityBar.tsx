import { useCallback, useEffect, useRef, useState } from "react";
import { Languages, Loader2, Pause, Play, SkipForward, StopCircle, Volume2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { useSpeech } from "@/hooks/use-accessibility";
import { currentLocale } from "@/i18n";
import { LOCALE_LABELS, type Locale } from "@/i18n/locales";
import type { PostItem } from "@/components/posts/PostCard";

interface Props {
  items: PostItem[];
}

/**
 * Fase 2 — Acessibilidade do feed.
 * - "Ler feed": TTS sequencial de todos os posts visíveis (autor + conteúdo + legenda).
 * - "Traduzir feed": dispara evento global que faz cada PostCard traduzir seu conteúdo
 *   para o idioma atual da interface.
 */
export function FeedAccessibilityBar({ items }: Props) {
  const { speak, stop, speaking, supported } = useSpeech();
  const [reading, setReading] = useState(false);
  const [paused, setPaused] = useState(false);
  const [translated, setTranslated] = useState(false);
  const [translating, setTranslating] = useState(false);
  const indexRef = useRef(0);

  const speakIndex = useCallback(
    (i: number) => {
      const p = items[i];
      if (!p) {
        setReading(false);
        return;
      }
      const parts = [
        `Post de @${p.username}`,
        p.content ?? "",
        p.caption ?? "",
        p.kind === "image" ? "Contém imagem." : p.kind === "video" ? "Contém vídeo." : "",
      ].filter(Boolean);
      const loc = currentLocale() as Locale;
      const langMap: Record<string, string> = { pt: "pt-BR", en: "en-US", es: "es-ES" };
      speak(parts.join(". "), langMap[loc] ?? undefined);
    },
    [items, speak],
  );

  useEffect(() => {
    if (!reading || paused) return;
    // quando o TTS termina (speaking → false), avança pro próximo
    if (!speaking) {
      const next = indexRef.current + 1;
      if (next >= items.length) {
        setReading(false);
        return;
      }
      indexRef.current = next;
      speakIndex(next);
    }
  }, [speaking, reading, paused, items.length, speakIndex]);

  function startReading() {
    if (!supported) {
      toast.error("Seu navegador não suporta leitura por voz.");
      return;
    }
    if (items.length === 0) {
      toast.info("Nenhum post no feed para ler.");
      return;
    }
    indexRef.current = 0;
    setReading(true);
    setPaused(false);
    speakIndex(0);
  }

  function stopReading() {
    stop();
    setReading(false);
    setPaused(false);
    indexRef.current = 0;
  }

  function pauseResume() {
    if (paused) {
      try {
        window.speechSynthesis?.resume();
      } catch {
        /* ignore */
      }
      setPaused(false);
    } else {
      try {
        window.speechSynthesis?.pause();
      } catch {
        /* ignore */
      }
      setPaused(true);
    }
  }

  function nextPost() {
    stop();
    const next = indexRef.current + 1;
    if (next >= items.length) {
      setReading(false);
      return;
    }
    indexRef.current = next;
    setPaused(false);
    speakIndex(next);
  }

  async function toggleTranslateAll() {
    if (translated) {
      window.dispatchEvent(new CustomEvent("wavechat:translate-feed-off"));
      setTranslated(false);
      return;
    }
    if (items.length === 0) {
      toast.info("Nenhum post para traduzir.");
      return;
    }
    setTranslating(true);
    try {
      const loc = currentLocale() as Locale;
      const language = LOCALE_LABELS[loc] || "português do Brasil";
      window.dispatchEvent(new CustomEvent("wavechat:translate-feed", { detail: { language } }));
      setTranslated(true);
      toast.success(`Traduzindo feed para ${language}…`);
    } finally {
      setTranslating(false);
    }
  }

  return (
    <div
      role="toolbar"
      aria-label="Acessibilidade do feed"
      className="flex items-center gap-1.5 px-3 py-2 border-b border-border bg-background/60 overflow-x-auto"
    >
      {!reading ? (
        <Button
          size="sm"
          variant="outline"
          className="rounded-full shrink-0"
          onClick={startReading}
          aria-label="Ler todos os posts do feed em voz alta"
        >
          <Volume2 className="size-4 mr-1 text-emerald-500" /> Ler feed
        </Button>
      ) : (
        <>
          <Button
            size="sm"
            variant="outline"
            className="rounded-full shrink-0"
            onClick={pauseResume}
            aria-label={paused ? "Continuar leitura" : "Pausar leitura"}
          >
            {paused ? <Play className="size-4 mr-1" /> : <Pause className="size-4 mr-1" />}
            {paused ? "Continuar" : "Pausar"}
          </Button>
          <Button
            size="sm"
            variant="outline"
            className="rounded-full shrink-0"
            onClick={nextPost}
            aria-label="Próximo post"
          >
            <SkipForward className="size-4 mr-1" /> Próximo
          </Button>
          <Button
            size="sm"
            variant="outline"
            className="rounded-full shrink-0"
            onClick={stopReading}
            aria-label="Parar leitura"
          >
            <StopCircle className="size-4 mr-1 text-rose-500" /> Parar
          </Button>
          <span className="text-[11px] text-muted-foreground shrink-0">
            {Math.min(indexRef.current + 1, items.length)}/{items.length}
          </span>
        </>
      )}

      <Button
        size="sm"
        variant="outline"
        className="rounded-full shrink-0 ml-auto"
        onClick={toggleTranslateAll}
        disabled={translating}
        aria-label={translated ? "Voltar ao idioma original do feed" : "Traduzir todo o feed"}
      >
        {translating ? (
          <Loader2 className="size-4 mr-1 animate-spin" />
        ) : (
          <Languages className="size-4 mr-1 text-sky-500" />
        )}
        {translated ? "Ver original" : "Traduzir feed"}
      </Button>
    </div>
  );
}
