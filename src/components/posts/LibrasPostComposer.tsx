import { useCallback, useEffect, useRef, useState } from "react";
import {
  Camera as CameraIcon,
  Loader2,
  CheckCircle2,
  RotateCcw,
  Volume2,
  VolumeX,
  Delete,
  Space as SpaceIcon,
  Send,
  Hand,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useSpeech } from "@/hooks/use-accessibility";
import { runAIAssistant } from "@/lib/ai-assistant.functions";
import { notifyFollowersOfContent } from "@/lib/follower-push.functions";
import { scanLocally } from "@/lib/content-policy";
import { type LandmarkPoint, type Handedness } from "@/lib/libras-classifier";
import { recognizeSign } from "@/lib/sign-model";
import { SignTrainerDialog } from "@/components/libras/SignTrainerDialog";
import { GraduationCap } from "lucide-react";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onCreated?: (postId: string) => void;
}

const MEDIAPIPE_CDN = "https://cdn.jsdelivr.net/npm/@mediapipe/hands@0.4.1675469240";
const HOLD_MS = 900; // tempo para "cravar" um gesto

declare global {
  interface Window {
    Hands?: any;
    __wavechatHandsLoader?: Promise<any>;
  }
}

function loadMediaPipe(): Promise<any> {
  if (typeof window === "undefined") return Promise.reject(new Error("SSR"));
  if (window.Hands) return Promise.resolve(window.Hands);
  if (window.__wavechatHandsLoader) return window.__wavechatHandsLoader;
  window.__wavechatHandsLoader = new Promise((resolve, reject) => {
    const s = document.createElement("script");
    s.src = `${MEDIAPIPE_CDN}/hands.js`;
    s.crossOrigin = "anonymous";
    s.async = true;
    s.onload = () => {
      if ((window as any).Hands) resolve((window as any).Hands);
      else reject(new Error("MediaPipe Hands não disponível"));
    };
    s.onerror = () => reject(new Error("Falha ao carregar MediaPipe"));
    document.head.appendChild(s);
  });
  return window.__wavechatHandsLoader;
}

export function LibrasPostComposer({ open, onOpenChange, onCreated }: Props) {
  const { user } = useAuth();
  const { speak, stop: stopSpeak, speaking, supported: ttsSupported } = useSpeech();
  const ai = useServerFn(runAIAssistant);

  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const handsRef = useRef<any>(null);
  const rafRef = useRef<number | null>(null);
  const currentSignRef = useRef<{ key: string; since: number } | null>(null);
  const submittedRef = useRef(false);

  const [status, setStatus] = useState<"idle" | "loading" | "capturing" | "review" | "publishing">("idle");
  const [text, setText] = useState("");
  const [detected, setDetected] = useState<string>("—");
  const [progress, setProgress] = useState(0); // 0..1 hold progress
  const [improving, setImproving] = useState(false);
  const [trainerOpen, setTrainerOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const textRef = useRef(text);
  useEffect(() => { textRef.current = text; }, [text]);

  const stopCamera = useCallback(() => {
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    rafRef.current = null;
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    try { handsRef.current?.close?.(); } catch {}
    handsRef.current = null;
  }, []);

  const reset = useCallback(() => {
    stopCamera();
    stopSpeak();
    setStatus("idle");
    setText("");
    setDetected("—");
    setProgress(0);
    setError(null);
    currentSignRef.current = null;
    submittedRef.current = false;
  }, [stopCamera, stopSpeak]);

  useEffect(() => {
    if (!open) reset();
    return () => stopCamera();
  }, [open, reset, stopCamera]);

  const commitGesture = useCallback(
    (label: string) => {
      if (label === "SPACE") {
        setText((t) => (t.endsWith(" ") ? t : t + " "));
        speak("espaço", "pt-BR");
      } else if (label === "BACKSPACE") {
        setText((t) => t.slice(0, -1));
        speak("apagou", "pt-BR");
      } else if (label === "SUBMIT") {
        submittedRef.current = true;
        speak("Enviando para revisão", "pt-BR");
        finishCapture();
      } else if (label.length === 1) {
        setText((t) => t + label);
        speak(label, "pt-BR");
      } else {
        setText((t) => `${t.trim()} ${label}`.trim());
        speak(label, "pt-BR");
      }
      if (navigator.vibrate) navigator.vibrate(60);
    },
    [speak],
  );

  const finishCapture = useCallback(() => {
    stopCamera();
    setStatus("review");
    const t = textRef.current.trim();
    setTimeout(() => {
      if (!t) speak("Nada foi capturado. Toque em recomeçar.", "pt-BR");
      else speak(`Seu post diz: ${t}. Toque em publicar ou edite se precisar.`, "pt-BR");
    }, 200);
  }, [stopCamera, speak]);

  const startCapture = useCallback(async () => {
    setError(null);
    setStatus("loading");
    try {
      await loadMediaPipe();
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "user", width: 640, height: 480 },
        audio: false,
      });
      streamRef.current = stream;
      const video = videoRef.current!;
      video.srcObject = stream;
      await video.play();

      const HandsCtor = (window as any).Hands;
      const hands = new HandsCtor({
        locateFile: (f: string) => `${MEDIAPIPE_CDN}/${f}`,
      });
      hands.setOptions({
        maxNumHands: 1,
        modelComplexity: 0,
        minDetectionConfidence: 0.6,
        minTrackingConfidence: 0.6,
      });

      hands.onResults((results: any) => {
        const canvas = canvasRef.current;
        if (canvas) {
          const ctx = canvas.getContext("2d");
          if (ctx) {
            canvas.width = video.videoWidth || 640;
            canvas.height = video.videoHeight || 480;
            ctx.save();
            ctx.scale(-1, 1);
            ctx.translate(-canvas.width, 0);
            ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
            if (results.multiHandLandmarks?.length) {
              ctx.fillStyle = "#22c55e";
              for (const p of results.multiHandLandmarks[0]) {
                ctx.beginPath();
                ctx.arc(p.x * canvas.width, p.y * canvas.height, 5, 0, Math.PI * 2);
                ctx.fill();
              }
            }
            ctx.restore();
          }
        }

        const lm: LandmarkPoint[] | undefined = results.multiHandLandmarks?.[0];
        const hd: Handedness =
          (results.multiHandedness?.[0]?.label as Handedness) || "Right";
        const r = recognizeSign(lm, hd);

        let key = "";
        let label = "—";
        if (r) {
          const v = r.label;
          if (/^(espaço|espaco)$/i.test(v)) { key = "SPACE"; label = "␣ espaço"; }
          else if (/^apagar$/i.test(v)) { key = "BACK"; label = "⌫ apagar"; }
          else if (/^enviar$/i.test(v)) { key = "SUBMIT"; label = "✓ enviar"; }
          else { key = `L:${v}`; label = v; }
        }

        setDetected(label);

        if (!key) {
          currentSignRef.current = null;
          setProgress(0);
          return;
        }
        const now = performance.now();
        const cur = currentSignRef.current;
        if (!cur || cur.key !== key) {
          currentSignRef.current = { key, since: now };
          setProgress(0);
        } else {
          const held = now - cur.since;
          const p = Math.min(1, held / HOLD_MS);
          setProgress(p);
          if (held >= HOLD_MS) {
            currentSignRef.current = { key, since: now + 10_000 }; // trava até sair do gesto
            setProgress(0);
            if (key === "SPACE") commitGesture("SPACE");
            else if (key === "BACK") commitGesture("BACKSPACE");
            else if (key === "SUBMIT") commitGesture("SUBMIT");
            else commitGesture(key.slice(2));
          }
        }
      });

      handsRef.current = hands;

      const loop = async () => {
        if (!handsRef.current || !streamRef.current) return;
        try {
          if (video.readyState >= 2) await hands.send({ image: video });
        } catch {}
        rafRef.current = requestAnimationFrame(loop);
      };
      rafRef.current = requestAnimationFrame(loop);

      setStatus("capturing");
      speak(
        "Câmera ligada. Faça o sinal em LIBRAS e segure por um segundo para confirmar. Palma aberta apaga, punho fechado espaça, polegar para cima envia.",
        "pt-BR",
      );
    } catch (e: any) {
      setError(e?.message ?? "Falha na câmera");
      setStatus("idle");
      toast.error("Não foi possível iniciar a câmera", { description: e?.message });
    }
  }, [commitGesture, speak]);

  const improve = useCallback(async () => {
    const base = textRef.current.trim();
    if (!base) return;
    setImproving(true);
    try {
      const res: any = await ai({ data: { action: "improve", text: base, tone: "neutral" } });
      if (res?.ok && res.content) {
        setText(res.content);
        speak(`Novo texto: ${res.content}`, "pt-BR");
      } else toast.error(res?.error ?? "IA indisponível");
    } catch (e: any) {
      toast.error("Falha ao aprimorar", { description: e?.message });
    } finally {
      setImproving(false);
    }
  }, [ai, speak]);

  async function publish() {
    if (!user) return;
    const content = textRef.current.trim();
    if (!content) {
      toast.error("Escreva ou capture algum texto");
      return;
    }
    const policy = scanLocally(content, "post");
    if (policy.verdict === "block") {
      toast.error("Bloqueado pelas Diretrizes", { description: policy.reasons[0] });
      return;
    }
    setStatus("publishing");
    try {
      const inline = Array.from(content.matchAll(/#(\w+)/g)).map((m) => m[1].toLowerCase());
      const hashtags = Array.from(new Set(inline)).slice(0, 12);
      const payload: any = {
        user_id: user.id,
        kind: "text",
        content,
        background: "linear-gradient(135deg,#0ea5e9,#22c55e)",
        hashtags,
        visibility: "public",
        ecosystem_id: null,
      };
      const { data, error } = await (supabase as any).from("posts").insert([payload]).select("id");
      if (error) throw error;
      const id = data?.[0]?.id;
      if (id) notifyFollowersOfContent({ data: { kind: "post", contentId: id } }).catch(() => {});
      toast.success("Post publicado em LIBRAS!");
      speak("Post publicado com sucesso!", "pt-BR");
      onCreated?.(id);
      onOpenChange(false);
    } catch (e: any) {
      toast.error("Falha ao publicar", { description: e?.message });
      setStatus("review");
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Hand className="size-5 text-emerald-500" />
            Postar em LIBRAS
          </DialogTitle>
          <DialogDescription>
            Use a câmera para escrever seu post em LIBRAS. Reconhece o alfabeto e também
            os gestos que você mesmo treinar (letras, palavras ou frases).
          </DialogDescription>
        </DialogHeader>

        <div>
          <Button size="sm" variant="outline" onClick={() => setTrainerOpen(true)}>
            <GraduationCap className="size-4 mr-1" /> Treinar meus gestos
          </Button>
        </div>
        <SignTrainerDialog open={trainerOpen} onOpenChange={setTrainerOpen} />

        {error && (
          <div className="text-sm text-destructive p-3 rounded-md bg-destructive/10">{error}</div>
        )}


        <div className="grid md:grid-cols-2 gap-3">
          <div className="relative rounded-xl overflow-hidden bg-black aspect-[4/3]">
            <video ref={videoRef} playsInline muted className="hidden" />
            <canvas ref={canvasRef} className="w-full h-full object-cover" />
            {status === "loading" && (
              <div className="absolute inset-0 grid place-items-center text-white/80">
                <Loader2 className="size-8 animate-spin" />
              </div>
            )}
            {status === "idle" && (
              <div className="absolute inset-0 grid place-items-center text-white/70 text-sm text-center p-6">
                Toque em <b className="mx-1">Iniciar câmera</b> para começar.
              </div>
            )}
            {status === "capturing" && (
              <div className="absolute top-2 left-2 right-2 flex items-center justify-between text-white text-xs">
                <span className="px-2 py-1 rounded-full bg-black/60 backdrop-blur">
                  Sinal: <b>{detected}</b>
                </span>
                <span className="px-2 py-1 rounded-full bg-black/60 backdrop-blur">
                  🟢 gravando
                </span>
              </div>
            )}
            {status === "capturing" && progress > 0 && (
              <div className="absolute bottom-0 left-0 right-0 h-1.5 bg-white/20">
                <div
                  className="h-full bg-emerald-400 transition-[width]"
                  style={{ width: `${Math.round(progress * 100)}%` }}
                />
              </div>
            )}
          </div>

          <div className="space-y-2">
            <label className="text-xs font-medium text-muted-foreground">
              Texto capturado (edite se precisar)
            </label>
            <Textarea
              value={text}
              onChange={(e) => setText(e.target.value)}
              rows={7}
              placeholder="Faça os sinais em frente à câmera…"
              aria-label="Texto do post em LIBRAS"
            />
            <div className="grid grid-cols-3 gap-1.5">
              <Button size="sm" variant="outline" onClick={() => commitGesture("SPACE")}>
                <SpaceIcon className="size-4 mr-1" /> Espaço
              </Button>
              <Button size="sm" variant="outline" onClick={() => commitGesture("BACKSPACE")}>
                <Delete className="size-4 mr-1" /> Apagar
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() =>
                  ttsSupported && (speaking ? stopSpeak() : speak(textRef.current, "pt-BR"))
                }
                disabled={!ttsSupported || !text}
              >
                {speaking ? <VolumeX className="size-4 mr-1" /> : <Volume2 className="size-4 mr-1" />}
                Ouvir
              </Button>
            </div>
            <p className="text-[11px] text-muted-foreground leading-snug">
              Segure cada sinal por ~1s para confirmar. <b>Punho fechado</b> = espaço,
              <b> palma aberta</b> = apagar, <b>👍 polegar acima</b> = concluir. Letras
              suportadas: <span className="font-mono">A B D F I L U V W Y</span>.
            </p>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-2">
          {status === "capturing" ? (
            <Button size="lg" variant="destructive" onClick={finishCapture} className="h-14">
              <X className="size-5 mr-2" /> Concluir captura
            </Button>
          ) : (
            <Button
              size="lg"
              onClick={startCapture}
              disabled={status === "loading" || status === "publishing"}
              className="h-14"
            >
              {status === "loading" ? (
                <Loader2 className="size-5 mr-2 animate-spin" />
              ) : text ? (
                <RotateCcw className="size-5 mr-2" />
              ) : (
                <CameraIcon className="size-5 mr-2" />
              )}
              {text ? "Recomeçar" : "Iniciar câmera"}
            </Button>
          )}
          <Button
            size="lg"
            onClick={publish}
            disabled={status === "publishing" || status === "capturing" || !text.trim()}
            className="h-14 bg-emerald-600 hover:bg-emerald-700 text-white"
          >
            {status === "publishing" ? (
              <Loader2 className="size-5 mr-2 animate-spin" />
            ) : (
              <Send className="size-5 mr-2" />
            )}
            Publicar
          </Button>
        </div>

        {text && status !== "capturing" && (
          <div className="flex justify-center">
            <Button size="sm" variant="ghost" onClick={improve} disabled={improving}>
              {improving ? (
                <Loader2 className="size-4 mr-1 animate-spin" />
              ) : (
                <CheckCircle2 className="size-4 mr-1 text-emerald-500" />
              )}
              Aprimorar texto com IA
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
