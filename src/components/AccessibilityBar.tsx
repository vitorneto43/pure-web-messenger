import { useMemo, useState } from "react";
import { Loader2, Volume2, VolumeX, Eye, Mic, MicOff, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { useServerFn } from "@tanstack/react-start";
import { Button } from "@/components/ui/button";
import { describeImage } from "@/lib/accessibility.functions";
import { useSpeech, useVoiceCommand } from "@/hooks/use-accessibility";
import { cn } from "@/lib/utils";

interface Props {
  /** Texto do post (content + caption). */
  readText: string;
  /** URL da imagem, se houver — habilita "Descrever imagem". */
  imageUrl?: string | null;
  /** Estilo escuro (para posts de texto com fundo colorido). */
  dark?: boolean;
  /** Idioma para leitura (auto se omitido). */
  lang?: string;
}

/**
 * Barra de acessibilidade — botões "Ler post" (TTS) e "Descrever imagem" (IA),
 * mais um botão de comando de voz que aciona os mesmos recursos por fala.
 *
 * Comandos reconhecidos (pt-BR):
 *   "ler" / "leia" / "ler post"       → lê o texto
 *   "descrever" / "descreva" / "imagem" → descreve a imagem
 *   "parar" / "silêncio"              → interrompe a leitura
 */
export function AccessibilityBar({ readText, imageUrl, dark, lang }: Props) {
  const runDescribe = useServerFn(describeImage);
  const { speak, stop, speaking, supported: ttsSupported } = useSpeech();
  const [describing, setDescribing] = useState(false);
  const [description, setDescription] = useState<string | null>(null);

  const trimmedText = useMemo(() => (readText ?? "").trim(), [readText]);
  const hasText = trimmedText.length > 0;

  async function handleDescribe(autoRead = false) {
    if (!imageUrl || describing) return;
    setDescribing(true);
    try {
      let text = description;
      if (!text) {
        const r = await runDescribe({ data: { imageUrl } });
        if (!r.ok) {
          toast.error(r.error);
          return;
        }
        text = r.content;
        setDescription(text);
      }
      if (text) {
        toast.info(text, { duration: 8000 });
        if (autoRead || ttsSupported) speak(text, lang);
      }
    } catch (e: any) {
      toast.error(e?.message ?? "Falha ao descrever imagem");
    } finally {
      setDescribing(false);
    }
  }

  function handleRead() {
    if (!hasText) return;
    if (speaking) {
      stop();
      return;
    }
    speak(trimmedText, lang);
  }

  const handleVoice = (cmd: string) => {
    if (/(parar|silenc|silêncio|stop|cala)/.test(cmd)) {
      stop();
      toast.info("Leitura interrompida");
      return;
    }
    if (/(descrev|imagem|foto|figura)/.test(cmd)) {
      if (imageUrl) void handleDescribe(true);
      else toast.info("Este post não tem imagem para descrever");
      return;
    }
    if (/(ler|leia|ouvir|escutar|le o|lê o)/.test(cmd)) {
      if (hasText) speak(trimmedText, lang);
      else toast.info("Este post não tem texto para ler");
      return;
    }
    toast.info(`Comando não reconhecido: "${cmd}"`);
  };

  const { start: startListen, stop: stopListen, listening, supported: srSupported } =
    useVoiceCommand(handleVoice, lang || "pt-BR");

  const btnCls = cn(
    "h-7 px-2 gap-1 text-[11px] rounded-full",
    dark
      ? "text-white/90 bg-white/15 hover:bg-white/25 border border-white/20"
      : "text-muted-foreground hover:text-foreground"
  );

  if (!hasText && !imageUrl) return null;

  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {hasText && ttsSupported && (
        <Button
          type="button"
          size="sm"
          variant={dark ? "ghost" : "ghost"}
          className={btnCls}
          onClick={handleRead}
          aria-label={speaking ? "Parar leitura" : "Ler post em voz alta"}
        >
          {speaking ? <VolumeX className="size-3.5" /> : <Volume2 className="size-3.5" />}
          {speaking ? "Parar" : "Ler post"}
        </Button>
      )}
      {imageUrl && (
        <Button
          type="button"
          size="sm"
          variant="ghost"
          className={btnCls}
          onClick={() => handleDescribe(false)}
          disabled={describing}
          aria-label="Descrever imagem para acessibilidade"
        >
          {describing ? <Loader2 className="size-3.5 animate-spin" /> : <Eye className="size-3.5" />}
          Descrever imagem
          <Sparkles className="size-2.5 opacity-70" />
        </Button>
      )}
      {srSupported && (
        <Button
          type="button"
          size="sm"
          variant="ghost"
          className={cn(btnCls, listening && "text-rose-500 animate-pulse")}
          onClick={() => (listening ? stopListen() : startListen())}
          aria-label={listening ? "Parar comando de voz" : "Ativar comando de voz — diga: ler, descrever ou parar"}
          title='Diga: "ler", "descrever" ou "parar"'
        >
          {listening ? <MicOff className="size-3.5" /> : <Mic className="size-3.5" />}
          {listening ? "Ouvindo..." : "Voz"}
        </Button>
      )}
    </div>
  );
}
