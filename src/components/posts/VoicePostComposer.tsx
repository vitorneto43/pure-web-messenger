import { useCallback, useEffect, useRef, useState } from "react";
import { Loader2, Mic, MicOff, Volume2, VolumeX, Sparkles, ImagePlus, X, CheckCircle2, RotateCcw } from "lucide-react";
import { toast } from "sonner";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { runAIAssistant } from "@/lib/ai-assistant.functions";
import { describeImage } from "@/lib/accessibility.functions";
import { useSpeech } from "@/hooks/use-accessibility";
import { notifyFollowersOfContent } from "@/lib/follower-push.functions";
import { scanLocally } from "@/lib/content-policy";

const WELCOME_TEXT =
  "Postar por voz aberto. Toque em gravar, ou pressione a letra G, para começar a falar seu post.";
const GRAVAR_HINT = "Pressione G para gravar, Enter para publicar, Escape para fechar.";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onCreated?: (postId: string) => void;
}

type Step = "idle" | "listening" | "review" | "publishing";

/**
 * Postagem por voz — acessibilidade para pessoas cegas ou com baixa visão.
 *
 * Fluxo:
 *  1. Toca "Fale seu post depois do bip" (TTS) e inicia ditado contínuo.
 *  2. Usuário fala; texto aparece em tempo real e é lido em voz alta ao final.
 *  3. Botão de foto opcional: envia imagem e a IA gera legenda descritiva.
 *  4. IA aprimora o texto (opcional) → TTS lê rascunho final.
 *  5. Comando "publicar" / botão publica; "regravar" / "cancelar" refazem/fecham.
 */
export function VoicePostComposer({ open, onOpenChange, onCreated }: Props) {
  const { user } = useAuth();
  const ai = useServerFn(runAIAssistant);
  const describe = useServerFn(describeImage);
  const { speak, stop: stopSpeak, speaking, supported: ttsSupported } = useSpeech();

  const [step, setStep] = useState<Step>("idle");
  const [transcript, setTranscript] = useState("");
  const [interim, setInterim] = useState("");
  const [improving, setImproving] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [caption, setCaption] = useState("");
  const [uploadingImage, setUploadingImage] = useState(false);

  const recRef = useRef<any>(null);
  const listeningRef = useRef(false);
  const transcriptRef = useRef("");

  const captionRef = useRef("");
  const imageUrlRef = useRef<string | null>(null);
  const recordButtonRef = useRef<HTMLButtonElement>(null);
  const welcomeSpoken = useRef(false);
  const [announcement, setAnnouncement] = useState("");
  useEffect(() => { transcriptRef.current = transcript; }, [transcript]);
  useEffect(() => { captionRef.current = caption; }, [caption]);
  useEffect(() => { imageUrlRef.current = imageUrl; }, [imageUrl]);

  const srSupported =
    typeof window !== "undefined" &&
    !!((window as any).SpeechRecognition || (window as any).webkitSpeechRecognition);

  const reset = useCallback(() => {
    listeningRef.current = false;
    try { recRef.current?.stop?.(); } catch {}
    recRef.current = null;

    stopSpeak();
    setStep("idle");
    setTranscript("");
    setInterim("");
    setImageUrl(null);
    setCaption("");
    setImproving(false);
    setPublishing(false);
    setUploadingImage(false);
  }, [stopSpeak]);

  useEffect(() => {
    if (!open) {
      reset();
      welcomeSpoken.current = false;
      return;
    }
    // Foca no botão gravar e anuncia para leitores de tela
    setTimeout(() => {
      recordButtonRef.current?.focus();
      setAnnouncement(WELCOME_TEXT);
      if (!welcomeSpoken.current) {
        welcomeSpoken.current = true;
        speak(WELCOME_TEXT, "pt-BR");
      }
    }, 200);
  }, [open, reset, speak]);

  const startDictation = useCallback(() => {
    if (!srSupported) {
      toast.error("Seu navegador não suporta ditado por voz. Use o Chrome.");
      return;
    }
    // Libera o microfone: TTS e qualquer reconhecimento anterior
    stopSpeak();
    try { recRef.current?.stop?.(); } catch {}
    recRef.current = null;
    setTranscript("");
    setInterim("");
    setStep("listening");
    listeningRef.current = true;

    const Ctor = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    const rec = new Ctor();
    rec.lang = "pt-BR";
    rec.continuous = true;
    rec.interimResults = true;
    rec.maxAlternatives = 1;

    rec.onresult = (e: any) => {
      let finalText = "";
      let interimText = "";
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const res = e.results[i];
        if (res.isFinal) finalText += res[0].transcript;
        else interimText += res[0].transcript;
      }
      if (finalText) {
        setTranscript((prev) => (prev + " " + finalText).replace(/\s+/g, " ").trim());
      }
      setInterim(interimText);
    };
    rec.onerror = (e: any) => {
      if (e?.error === "no-speech" || e?.error === "aborted") return;
      if (e?.error === "not-allowed" || e?.error === "service-not-allowed") {
        listeningRef.current = false;
        setStep("idle");
        toast.error("Permita o acesso ao microfone para gravar por voz.");
        return;
      }
      toast.error("Erro no reconhecimento", { description: String(e?.error ?? "") });
    };
    rec.onend = () => {
      // Mantém a gravação contínua enquanto o usuário não tocar em "Concluir"
      if (recRef.current === rec && listeningRef.current) {
        try { rec.start(); } catch {}
      }
    };

    recRef.current = rec;
    try {
      rec.start();
    } catch {
      toast.error("Não foi possível iniciar o microfone");
      listeningRef.current = false;
      setStep("idle");
    }
  }, [srSupported, stopSpeak]);


  const finishDictation = useCallback(() => {
    listeningRef.current = false;
    recRef.current && (recRef.current.onend = null);
    try { recRef.current?.stop?.(); } catch {}
    recRef.current = null;

    setInterim("");
    setStep("review");

    // Read back for confirmation
    setTimeout(() => {
      const t = transcriptRef.current.trim();
      if (!t) {
        speak("Nada foi gravado. Toque em gravar novamente.", "pt-BR");
        return;
      }
      speak(
        `Seu post diz: ${t}. Toque em publicar para postar, ou em regravar para tentar de novo.`,
        "pt-BR",
      );
    }, 200);
  }, [speak]);

  const improveText = useCallback(async () => {
    const base = transcriptRef.current.trim();
    if (!base) return;
    setImproving(true);
    try {
      const res = await ai({ data: { action: "improve", text: base, tone: "neutral" } });
      if (res?.ok && res.content) {
        setTranscript(res.content);
        speak(`Novo texto: ${res.content}`, "pt-BR");
      } else {
        toast.error(res?.error ?? "IA indisponível");
      }
    } catch (e: any) {
      toast.error("Falha ao aprimorar", { description: e?.message });
    } finally {
      setImproving(false);
    }
  }, [ai, speak]);

  async function handleImage(file: File) {
    if (!user) return;
    setUploadingImage(true);
    try {
      const ext = file.name.split(".").pop() ?? "jpg";
      const path = `${user.id}/posts/${Date.now()}.${ext}`;
      const { error } = await supabase.storage.from("status-media").upload(path, file, { upsert: false });
      if (error) throw error;
      const { data: { publicUrl } } = supabase.storage.from("status-media").getPublicUrl(path);
      setImageUrl(publicUrl);

      // Auto-describe for accessibility
      speak("Imagem enviada. Aguarde, descrevendo automaticamente.", "pt-BR");
      const r = await describe({ data: { imageUrl: publicUrl } });
      if (r?.ok && r.content) {
        setCaption(r.content);
        speak(`Descrição da imagem: ${r.content}`, "pt-BR");
      }
    } catch (e: any) {
      toast.error("Falha no upload", { description: e?.message });
    } finally {
      setUploadingImage(false);
    }
  }

  async function publish() {
    if (!user) return;
    const content = transcriptRef.current.trim();
    const img = imageUrlRef.current;
    const cap = captionRef.current.trim();
    if (!content && !img) {
      toast.error("Grave um áudio ou envie uma imagem");
      return;
    }
    const policy = scanLocally(`${content} ${cap}`, "post");
    if (policy.verdict === "block") {
      toast.error("Bloqueado pelas Diretrizes", { description: policy.reasons[0] });
      speak("Post bloqueado pelas diretrizes.", "pt-BR");
      return;
    }
    setPublishing(true);
    setStep("publishing");
    try {
      const inline = Array.from((content + " " + cap).matchAll(/#(\w+)/g)).map((m) => m[1].toLowerCase());
      const hashtags = Array.from(new Set(inline)).slice(0, 12);

      const kind: "text" | "image" = img ? "image" : "text";
      const payload: any = {
        user_id: user.id,
        kind,
        content: kind === "text" ? content : null,
        media_url: img,
        thumbnail_url: img,
        caption: cap || (kind === "image" ? content : null) || null,
        background: kind === "text" ? "linear-gradient(135deg,#6366f1,#ec4899)" : null,
        hashtags,
        visibility: "public",
        ecosystem_id: null,
      };
      const { data, error } = await (supabase as any).from("posts").insert([payload]).select("id");
      if (error) throw error;
      const id = data?.[0]?.id;
      if (id) {
        notifyFollowersOfContent({ data: { kind: "post", contentId: id } }).catch(() => {});
      }
      speak("Post publicado com sucesso!", "pt-BR");
      toast.success("Post publicado por voz!");
      onCreated?.(id);
      onOpenChange(false);
    } catch (e: any) {
      toast.error("Falha ao publicar", { description: e?.message });
      speak("Não foi possível publicar. Tente de novo.", "pt-BR");
      setStep("review");
    } finally {
      setPublishing(false);
    }
  }

  const listening = step === "listening";
  const shownText = transcript + (interim ? ` ${interim}` : "");

  // Atalhos de teclado dentro do compositor: G = gravar/parar, Ctrl+Enter = publicar, Escape = fechar
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement | null;
      const typing =
        !!el && (el.tagName === "INPUT" || el.tagName === "TEXTAREA" || el.isContentEditable);
      if (!typing && (e.key === "g" || e.key === "G")) {
        e.preventDefault();
        if (listening) finishDictation();
        else startDictation();
        return;
      }

      if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) {
        e.preventDefault();
        publish();
        return;
      }
      if (e.key === "Escape" && step !== "publishing") {
        e.preventDefault();
        onOpenChange(false);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, listening, step, startDictation, finishDictation, publish, onOpenChange]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Mic className="size-5 text-pink-500" />
            Postar por voz
          </DialogTitle>
          <DialogDescription>
            Acessibilidade: fale seu post, adicione uma foto (opcional) e publique.
            A IA descreve a imagem automaticamente para você.
            Atalhos: G grava, Ctrl+Enter publica, Escape fecha.
          </DialogDescription>
        </DialogHeader>

        <div aria-live="polite" aria-atomic="true" className="sr-only">
          {announcement}
        </div>

        {!srSupported && (
          <div className="text-sm text-destructive p-3 rounded-md bg-destructive/10">
            Seu navegador não suporta ditado por voz. Abra a WaveChat no Chrome ou Edge.
          </div>
        )}

        {/* Status area */}
        <div
          role="status"
          aria-live="polite"
          className="min-h-[120px] rounded-xl border border-border bg-muted/30 p-3 text-sm"
        >
          {step === "idle" && (
            <p className="text-muted-foreground">
              Toque em <b>Gravar</b> e fale seu post. Você pode adicionar uma foto antes ou depois.
            </p>
          )}
          {listening && (
            <div>
              <p className="text-rose-500 font-medium flex items-center gap-2 mb-2">
                <span className="size-2 rounded-full bg-rose-500 animate-pulse" />
                Ouvindo… fale à vontade
              </p>
              <p className="whitespace-pre-wrap">{shownText || <span className="text-muted-foreground">…</span>}</p>
            </div>
          )}
          {(step === "review" || step === "publishing") && (
            <div className="space-y-2">
              <Textarea
                value={transcript}
                onChange={(e) => setTranscript(e.target.value)}
                rows={5}
                aria-label="Texto do post — edite se quiser"
                placeholder="Seu post aparecerá aqui após a gravação."
              />
              {caption && (
                <div className="text-xs text-muted-foreground">
                  <b>Descrição da foto:</b> {caption}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Image */}
        {imageUrl ? (
          <div className="relative rounded-xl overflow-hidden bg-black">
            <img src={imageUrl} alt={caption || "Imagem do post"} className="w-full max-h-56 object-contain" />
            <button
              onClick={() => { setImageUrl(null); setCaption(""); }}
              className="absolute top-2 right-2 size-7 grid place-items-center rounded-full bg-black/60 text-white"
              aria-label="Remover imagem"
            >
              <X className="size-4" />
            </button>
          </div>
        ) : (
          <label className="flex items-center justify-center gap-2 border border-dashed border-border rounded-xl p-3 text-sm cursor-pointer hover:bg-muted/30">
            <input
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => e.target.files?.[0] && handleImage(e.target.files[0])}
            />
            {uploadingImage ? (
              <><Loader2 className="size-4 animate-spin" /> Enviando…</>
            ) : (
              <><ImagePlus className="size-4" /> Adicionar foto (opcional)</>
            )}
          </label>
        )}

        {/* Primary actions */}
        <div className="grid grid-cols-2 gap-2">
          {!listening ? (
            <Button
              ref={recordButtonRef}
              type="button"
              size="lg"
              onClick={startDictation}
              disabled={!srSupported || publishing}
              className="h-14 text-base"
              aria-label={transcript ? "Regravar áudio do post. Atalho: tecla G." : "Gravar áudio do post. Atalho: tecla G."}
            >
              {transcript ? <RotateCcw className="size-5 mr-2" /> : <Mic className="size-5 mr-2" />}
              {transcript ? "Regravar" : "Gravar"}
            </Button>
          ) : (
            <Button
              type="button"
              size="lg"
              variant="destructive"
              onClick={finishDictation}
              className="h-14 text-base"
              aria-label="Concluir gravação"
            >
              <MicOff className="size-5 mr-2" />
              Concluir
            </Button>
          )}

          <Button
            type="button"
            size="lg"
            onClick={publish}
            disabled={publishing || listening || (!transcript.trim() && !imageUrl)}
            className="h-14 text-base bg-emerald-600 hover:bg-emerald-700 text-white"
            aria-label="Publicar post"
          >
            {publishing ? <Loader2 className="size-5 mr-2 animate-spin" /> : <CheckCircle2 className="size-5 mr-2" />}
            Publicar
          </Button>
        </div>

        {/* Secondary actions */}
        <div className="flex flex-wrap gap-2">
          {ttsSupported && (transcript || caption) && (
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={() => (speaking ? stopSpeak() : speak(`${transcript}${caption ? ". Foto: " + caption : ""}`, "pt-BR"))}
              aria-label={speaking ? "Parar leitura" : "Ouvir rascunho"}
            >
              {speaking ? <VolumeX className="size-4 mr-1" /> : <Volume2 className="size-4 mr-1" />}
              {speaking ? "Parar" : "Ouvir rascunho"}
            </Button>
          )}
          {transcript && (
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={improveText}
              disabled={improving}
              aria-label="Aprimorar texto com IA"
            >
              {improving ? <Loader2 className="size-4 mr-1 animate-spin" /> : <Sparkles className="size-4 mr-1 text-pink-500" />}
              Aprimorar com IA
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
