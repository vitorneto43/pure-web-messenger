import { useCallback, useEffect, useRef, useState } from "react";
import { useLocalParticipant } from "@livekit/components-react";
import { Track } from "livekit-client";
import { HandMetal, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { runHands, type HandsRunner } from "@/lib/mediapipe-hands";
import {
  loadTeachableMachineModel,
  predictWithTeachableMachine,
  recognizeSign,
  type TMPrediction,
} from "@/lib/sign-model";
import type { Handedness, LandmarkPoint } from "@/lib/libras-classifier";

const HOLD_MS = 700; // tempo segurando o sinal para confirmar
const CLEAR_MS = 7000; // limpa a legenda depois de parado
const CONTROL_LABELS = /^(espaço|espaco|apagar|enviar)$/i;

type CaptionPayload = { text: string };

function channelName(liveId: string) {
  return `live-captions-${liveId}`;
}

/**
 * Tradução reversa: o host surdo faz os sinais e a WaveChat exibe a legenda do
 * que está sendo dito para toda a audiência da live (em tempo real).
 *
 * Reconhecimento: modelo do Teachable Machine (se configurado) + modelo local
 * treinado pelo usuário + heurística do alfabeto, via MediaPipe Hands.
 */
export function LiveSignCaptions({ liveId, isHost }: { liveId: string; isHost: boolean }) {
  const [caption, setCaption] = useState("");
  const [enabled, setEnabled] = useState(false);
  const [starting, setStarting] = useState(false);

  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const runnerRef = useRef<HandsRunner | null>(null);
  const tmRef = useRef<any>(null);
  const holdRef = useRef<{ label: string; since: number } | null>(null);
  const lastCommitRef = useRef<string>("");
  const textRef = useRef("");
  const clearTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const tmBusyRef = useRef(false);
  const tmLastRef = useRef<TMPrediction | null>(null);

  const { localParticipant } = useLocalParticipant();

  /* ---------------- canal de legendas ---------------- */
  useEffect(() => {
    const ch = supabase.channel(channelName(liveId), { config: { broadcast: { self: true } } });
    ch.on("broadcast", { event: "caption" }, ({ payload }) => {
      const p = payload as CaptionPayload;
      setCaption(p?.text ?? "");
    }).subscribe();
    channelRef.current = ch;
    return () => {
      supabase.removeChannel(ch);
      channelRef.current = null;
    };
  }, [liveId]);

  const publish = useCallback((text: string) => {
    channelRef.current?.send({ type: "broadcast", event: "caption", payload: { text } });
    setCaption(text);
    if (clearTimerRef.current) clearTimeout(clearTimerRef.current);
    clearTimerRef.current = setTimeout(() => {
      textRef.current = "";
      channelRef.current?.send({ type: "broadcast", event: "caption", payload: { text: "" } });
      setCaption("");
    }, CLEAR_MS);
  }, []);

  const commit = useCallback(
    (label: string) => {
      const up = label.trim();
      if (!up) return;
      if (/^(espaço|espaco)$/i.test(up)) {
        textRef.current = textRef.current.endsWith(" ") ? textRef.current : `${textRef.current} `;
      } else if (/^apagar$/i.test(up)) {
        textRef.current = textRef.current.trimEnd().split(" ").slice(0, -1).join(" ");
      } else if (/^enviar$/i.test(up)) {
        publish(textRef.current.trim());
        return;
      } else if (up.length === 1) {
        textRef.current += up; // dactilologia (letra a letra)
      } else {
        textRef.current = `${textRef.current.trim()} ${up}`.trim();
      }
      publish(textRef.current.trim().slice(-160));
    },
    [publish],
  );

  const stop = useCallback(() => {
    runnerRef.current?.stop();
    runnerRef.current = null;
    videoRef.current?.remove();
    videoRef.current = null;
    holdRef.current = null;
    lastCommitRef.current = "";
    setEnabled(false);
  }, []);

  useEffect(() => () => stop(), [stop]);

  const start = useCallback(async () => {
    setStarting(true);
    try {
      const pub = localParticipant?.getTrackPublication(Track.Source.Camera);
      const mst = pub?.track?.mediaStreamTrack;
      if (!mst) {
        toast.error("Ligue a câmera antes de ativar as legendas em LIBRAS.");
        return;
      }
      const video = document.createElement("video");
      video.playsInline = true;
      video.muted = true;
      video.srcObject = new MediaStream([mst]);
      video.style.display = "none";
      document.body.appendChild(video);
      await video.play();
      videoRef.current = video;

      try {
        const p = loadTeachableMachineModel();
        if (p) tmRef.current = await p;
      } catch {
        tmRef.current = null; // segue com o modelo local
      }

      runnerRef.current = await runHands(
        video,
        (results) => {
          const lm: LandmarkPoint[] | undefined = results.multiHandLandmarks?.[0];
          const hd: Handedness = (results.multiHandedness?.[0]?.label as Handedness) || "Right";

          // Teachable Machine roda em paralelo (assíncrono) sobre o mesmo frame.
          if (tmRef.current && !tmBusyRef.current) {
            tmBusyRef.current = true;
            predictWithTeachableMachine(tmRef.current, video)
              .then((p) => {
                tmLastRef.current = p;
              })
              .catch(() => {
                tmLastRef.current = null;
              })
              .finally(() => {
                tmBusyRef.current = false;
              });
          }

          const r = recognizeSign(lm, hd, tmLastRef.current);
          const now = performance.now();
          if (!r) {
            holdRef.current = null;
            lastCommitRef.current = "";
            return;
          }
          const cur = holdRef.current;
          if (!cur || cur.label !== r.label) {
            holdRef.current = { label: r.label, since: now };
            return;
          }
          if (now - cur.since >= HOLD_MS && lastCommitRef.current !== r.label) {
            lastCommitRef.current = r.label;
            holdRef.current = { label: r.label, since: now + 10_000 };
            commit(r.label);
          }
        },
        { maxNumHands: 1 },
      );

      setEnabled(true);
      toast.success("Legendas em LIBRAS ativadas para a audiência.");
    } catch (e: any) {
      toast.error("Falha ao iniciar as legendas", { description: e?.message });
    } finally {
      setStarting(false);
    }
  }, [commit, localParticipant]);

  return (
    <>
      {caption && (
        <div className="pointer-events-none fixed left-0 right-0 bottom-[58%] z-20 flex justify-center px-4">
          <p className="max-w-[90%] rounded-xl bg-black/75 px-3 py-2 text-center text-base font-semibold leading-snug text-white shadow-lg">
            {caption}
          </p>
        </div>
      )}
      {isHost && (
        <Button
          size="sm"
          variant={enabled ? "default" : "outline"}
          onClick={() => (enabled ? stop() : start())}
          disabled={starting}
          aria-label="Legendas automáticas em LIBRAS"
          title="Traduzir meus sinais em legendas para a audiência"
        >
          {starting ? (
            <Loader2 className="size-4 mr-1 animate-spin" />
          ) : (
            <HandMetal className="size-4 mr-1" />
          )}
          Libras
        </Button>
      )}
    </>
  );
}
