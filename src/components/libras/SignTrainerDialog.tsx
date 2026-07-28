import { useCallback, useEffect, useRef, useState } from "react";
import { Camera, Loader2, Plus, Trash2, GraduationCap, Link2, Check } from "lucide-react";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { runHands, type HandsRunner } from "@/lib/mediapipe-hands";
import {
  addSamples,
  clearSamples,
  getTeachableMachineUrl,
  landmarksToVector,
  removeLabel,
  setTeachableMachineUrl,
  trainedLabels,
} from "@/lib/sign-model";
import type { Handedness, LandmarkPoint } from "@/lib/libras-classifier";

const CAPTURE_MS = 3000; // 3 segundos gravando amostras do gesto

/**
 * Treinador de gestos da WaveChat.
 *
 * Dois caminhos:
 *  - Teachable Machine: cole o link do modelo treinado no site do Google.
 *  - Treino local: grave 3 segundos de cada gesto pela câmera e o app aprende
 *    na hora (roda offline, sem custo, quantos gestos você quiser).
 */
export function SignTrainerDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const runnerRef = useRef<HandsRunner | null>(null);
  const bufferRef = useRef<number[][]>([]);
  const capturingRef = useRef(false);

  const [label, setLabel] = useState("");
  const [tmUrl, setTmUrl] = useState("");
  const [ready, setReady] = useState(false);
  const [starting, setStarting] = useState(false);
  const [capturing, setCapturing] = useState(false);
  const [handVisible, setHandVisible] = useState(false);
  const [labels, setLabels] = useState<{ label: string; count: number }[]>([]);

  useEffect(() => {
    if (open) {
      setLabels(trainedLabels());
      setTmUrl(getTeachableMachineUrl());
    }
  }, [open]);

  const stop = useCallback(() => {
    runnerRef.current?.stop();
    runnerRef.current = null;
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    capturingRef.current = false;
    setCapturing(false);
    setReady(false);
  }, []);

  useEffect(() => {
    if (!open) stop();
    return () => stop();
  }, [open, stop]);

  const startCamera = useCallback(async () => {
    setStarting(true);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "user", width: 640, height: 480 },
        audio: false,
      });
      streamRef.current = stream;
      const video = videoRef.current!;
      video.srcObject = stream;
      await video.play();
      runnerRef.current = await runHands(
        video,
        (results) => {
          const lm: LandmarkPoint[] | undefined = results.multiHandLandmarks?.[0];
          const hd: Handedness = (results.multiHandedness?.[0]?.label as Handedness) || "Right";
          setHandVisible(!!lm);
          if (!lm || !capturingRef.current) return;
          const vec = landmarksToVector(lm, hd);
          if (vec) bufferRef.current.push(vec);
        },
        { maxNumHands: 1 },
      );
      setReady(true);
    } catch (e: any) {
      toast.error("Não foi possível abrir a câmera", { description: e?.message });
    } finally {
      setStarting(false);
    }
  }, []);

  const record = useCallback(() => {
    const name = label.trim();
    if (!name) {
      toast.error("Dê um nome ao gesto (letra, palavra ou frase).");
      return;
    }
    bufferRef.current = [];
    capturingRef.current = true;
    setCapturing(true);
    setTimeout(() => {
      capturingRef.current = false;
      setCapturing(false);
      const vecs = bufferRef.current;
      bufferRef.current = [];
      if (vecs.length < 5) {
        toast.error("Poucas amostras. Mantenha a mão visível durante a gravação.");
        return;
      }
      // Amostra até 40 quadros bem distribuídos para não inchar o modelo.
      const step = Math.max(1, Math.floor(vecs.length / 40));
      addSamples(
        name,
        vecs.filter((_, i) => i % step === 0),
      );
      setLabels(trainedLabels());
      toast.success(`Gesto "${name}" aprendido!`);
      setLabel("");
    }, CAPTURE_MS);
  }, [label]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[92vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <GraduationCap className="size-5 text-primary" /> Treinar gestos (LIBRAS)
          </DialogTitle>
          <DialogDescription>
            Ensine a WaveChat a reconhecer qualquer sinal — letras, palavras ou frases inteiras.
          </DialogDescription>
        </DialogHeader>

        {/* Teachable Machine */}
        <div className="rounded-xl border border-border p-3 space-y-2">
          <p className="text-sm font-medium flex items-center gap-2">
            <Link2 className="size-4" /> Modelo do Teachable Machine (opcional)
          </p>
          <p className="text-xs text-muted-foreground">
            Treine em teachablemachine.withgoogle.com (projeto de Imagem), clique em Exportar
            modelo → Enviar meu modelo e cole aqui o link compartilhável.
          </p>
          <div className="flex gap-2">
            <Input
              value={tmUrl}
              onChange={(e) => setTmUrl(e.target.value)}
              placeholder="https://teachablemachine.withgoogle.com/models/XXXXXXX/"
            />
            <Button
              variant="secondary"
              onClick={() => {
                setTeachableMachineUrl(tmUrl);
                toast.success(tmUrl.trim() ? "Modelo conectado." : "Modelo removido.");
              }}
            >
              <Check className="size-4" />
            </Button>
          </div>
        </div>

        {/* Treino local */}
        <div className="rounded-xl border border-border p-3 space-y-3">
          <p className="text-sm font-medium flex items-center gap-2">
            <Camera className="size-4" /> Treino pela câmera (offline)
          </p>

          <div className="relative rounded-lg overflow-hidden bg-black aspect-video">
            <video
              ref={videoRef}
              playsInline
              muted
              className="w-full h-full object-cover -scale-x-100"
            />
            {!ready && (
              <div className="absolute inset-0 grid place-items-center">
                <Button onClick={startCamera} disabled={starting}>
                  {starting ? <Loader2 className="size-4 mr-2 animate-spin" /> : <Camera className="size-4 mr-2" />}
                  Ligar câmera
                </Button>
              </div>
            )}
            {ready && (
              <span className="absolute top-2 left-2 text-xs px-2 py-0.5 rounded-full bg-black/60 text-white">
                {capturing ? "Gravando gesto…" : handVisible ? "Mão detectada" : "Mostre a mão"}
              </span>
            )}
          </div>

          <div className="flex gap-2">
            <Input
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              placeholder="Nome do gesto: A, OI, OBRIGADO…"
              disabled={!ready || capturing}
            />
            <Button onClick={record} disabled={!ready || capturing}>
              {capturing ? <Loader2 className="size-4 animate-spin" /> : <Plus className="size-4" />}
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">
            Segure o sinal por 3 segundos, variando levemente o ângulo. Repita 2 ou 3 vezes por
            gesto para melhorar a precisão.
          </p>
        </div>

        {/* Gestos aprendidos */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <p className="text-sm font-medium">Gestos aprendidos ({labels.length})</p>
            {labels.length > 0 && (
              <Button
                size="sm"
                variant="ghost"
                onClick={() => {
                  clearSamples();
                  setLabels([]);
                }}
              >
                Limpar tudo
              </Button>
            )}
          </div>
          {labels.length === 0 ? (
            <p className="text-xs text-muted-foreground">Nenhum gesto treinado ainda.</p>
          ) : (
            <div className="flex flex-wrap gap-2">
              {labels.map((l) => (
                <Badge key={l.label} variant="secondary" className="gap-1">
                  {l.label} · {l.count}
                  <button
                    type="button"
                    aria-label={`Remover gesto ${l.label}`}
                    onClick={() => {
                      removeLabel(l.label);
                      setLabels(trainedLabels());
                    }}
                  >
                    <Trash2 className="size-3" />
                  </button>
                </Badge>
              ))}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
