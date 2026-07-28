import { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { Hand, Loader2, Trash2, Volume2, X, GraduationCap } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { useSpeech } from "@/hooks/use-accessibility";
import { runHands, type HandsRunner } from "@/lib/mediapipe-hands";
import {
  loadTeachableMachineModel,
  predictWithTeachableMachine,
  recognizeSign,
  type TMPrediction,
} from "@/lib/sign-model";
import type { Handedness, LandmarkPoint } from "@/lib/libras-classifier";
import { matchSignCommand, SIGN_COMMANDS, type SignCommand } from "@/lib/sign-commands";
import { SignTrainerDialog } from "@/components/libras/SignTrainerDialog";
import { CreateStatusDialog } from "@/components/status/CreateStatusDialog";
import { LibrasPostComposer } from "@/components/posts/LibrasPostComposer";

const HOLD_MS = 700;

/**
 * Central de comandos por gestos (acessibilidade para surdos).
 *
 * - Lê os sinais pela câmera (Teachable Machine + modelo local + heurística).
 * - Mostra a TRADUÇÃO INVERTIDA: legenda em texto do que está sendo sinalizado.
 * - Executa ações do app quando o gesto casa com um comando (live, story,
 *   post, WaveTube, WaveShorts, chat, WaveChat For...).
 */
export function GestureCommandCenter() {
  const navigate = useNavigate();
  const { speak } = useSpeech();

  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(false);
  const [starting, setStarting] = useState(false);
  const [caption, setCaption] = useState("");
  const [lastAction, setLastAction] = useState("");
  const [trainerOpen, setTrainerOpen] = useState(false);
  const [storyOpen, setStoryOpen] = useState(false);
  const [postOpen, setPostOpen] = useState(false);

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const runnerRef = useRef<HandsRunner | null>(null);
  const tmRef = useRef<any>(null);
  const tmBusyRef = useRef(false);
  const tmLastRef = useRef<TMPrediction | null>(null);
  const holdRef = useRef<{ label: string; since: number } | null>(null);
  const lastCommitRef = useRef("");
  const textRef = useRef("");

  const announce = useCallback(
    (msg: string) => {
      setLastAction(msg);
      try {
        speak(msg);
      } catch {
        /* TTS é opcional aqui */
      }
      toast.success(msg);
    },
    [speak],
  );

  const requestStartLive = useCallback(() => {
    if (typeof window === "undefined") return;
    window.sessionStorage.setItem("wavechat:auto-start-live", "1");
    let tries = 0;
    const fire = () => {
      tries++;
      if (window.location.pathname.startsWith("/live/new")) {
        window.dispatchEvent(new CustomEvent("wavechat:start-live"));
        return;
      }
      if (tries < 12) setTimeout(fire, 400);
    };
    navigate({ to: "/live/new" });
    setTimeout(fire, 300);
  }, [navigate]);

  const runCommand = useCallback(
    (cmd: SignCommand) => {
      textRef.current = "";
      setCaption("");
      switch (cmd.id) {
        case "live":
          announce("Abrindo e iniciando a live.");
          requestStartLive();
          break;
        case "end-live":
          announce("Encerrando a transmissão.");
          window.dispatchEvent(new CustomEvent("wavechat:end-live"));
          break;
        case "story":
          announce("Criando um story.");
          setStoryOpen(true);
          break;
        case "post":
          announce("Abrindo a postagem em LIBRAS.");
          setPostOpen(true);
          break;
        case "wavetube":
          announce("Abrindo o WaveTube.");
          navigate({ to: "/wavetube" });
          break;
        case "waveshorts":
          announce("Abrindo o WaveShorts.");
          navigate({ to: "/waveshorts" });
          break;
        case "chat":
          announce("Abrindo suas conversas.");
          navigate({ to: "/" });
          break;
        case "home":
          announce("Voltando ao início.");
          navigate({ to: "/" });
          break;
        case "descobrir":
          announce("Abrindo o descobrir.");
          navigate({ to: "/descobrir" });
          break;
        case "movimento":
          announce("Abrindo as comunidades.");
          navigate({ to: "/movimento" });
          break;
        case "ecosystems":
          announce("Abrindo o WaveChat For.");
          navigate({ to: "/ecosystems/pricing" });
          break;
        case "perfil":
          announce("Abrindo seu perfil.");
          navigate({ to: "/" });
          break;
        case "ajuda":
          setOpen(true);
          announce("Estes são os gestos de comando disponíveis.");
          break;
        case "limpar":
          setLastAction("Legenda limpa.");
          break;
      }
    },
    [announce, navigate, requestStartLive],
  );

  const commit = useCallback(
    (label: string) => {
      const up = label.trim();
      if (!up) return;
      if (/^(espaço|espaco)$/i.test(up)) {
        textRef.current = textRef.current.endsWith(" ") ? textRef.current : `${textRef.current} `;
      } else if (/^apagar$/i.test(up)) {
        textRef.current = textRef.current.slice(0, -1);
      } else if (/^enviar$/i.test(up)) {
        const cmd = matchSignCommand(textRef.current);
        if (cmd) runCommand(cmd);
        else setLastAction(`Nenhum comando reconhecido em "${textRef.current.trim()}".`);
        return;
      } else if (up.length === 1) {
        textRef.current += up;
      } else {
        textRef.current = `${textRef.current.trim()} ${up}`.trim();
      }
      const text = textRef.current.slice(-120);
      setCaption(text);
      const cmd = matchSignCommand(text);
      if (cmd) runCommand(cmd);
    },
    [runCommand],
  );

  const stop = useCallback(() => {
    runnerRef.current?.stop();
    runnerRef.current = null;
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    holdRef.current = null;
    lastCommitRef.current = "";
    setActive(false);
  }, []);

  useEffect(() => () => stop(), [stop]);

  // Pausa o reconhecimento enquanto outro módulo usa a câmera.
  useEffect(() => {
    if (postOpen && active) stop();
  }, [postOpen, active, stop]);

  const start = useCallback(async () => {
    if (active || starting) return;
    setStarting(true);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "user", width: 480, height: 360 },
        audio: false,
      });
      streamRef.current = stream;
      const video = videoRef.current;
      if (!video) throw new Error("Câmera indisponível");
      video.srcObject = stream;
      video.muted = true;
      video.playsInline = true;
      await video.play();

      try {
        const p = loadTeachableMachineModel();
        if (p) tmRef.current = await p;
      } catch {
        tmRef.current = null;
      }

      runnerRef.current = await runHands(
        video,
        (results) => {
          const lm: LandmarkPoint[] | undefined = results.multiHandLandmarks?.[0];
          const hd: Handedness = (results.multiHandedness?.[0]?.label as Handedness) || "Right";

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

      setActive(true);
      setOpen(true);
    } catch (e: any) {
      toast.error("Não consegui ligar a câmera", { description: e?.message });
    } finally {
      setStarting(false);
    }
  }, [active, commit, starting]);

  return (
    <>
      {/* Botão flutuante */}
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-label="Comandos por gestos (LIBRAS)"
        title="Comandos por gestos (LIBRAS)"
        className="fixed bottom-24 left-4 z-40 flex size-12 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-lg hover:opacity-90"
      >
        <Hand className="size-5" />
      </button>

      {open && (
        <div className="fixed bottom-40 left-4 z-40 w-[min(20rem,calc(100vw-2rem))] rounded-2xl border bg-card p-3 shadow-xl">
          <div className="flex items-center justify-between gap-2">
            <p className="text-sm font-semibold">Comandos por gestos</p>
            <Button size="icon" variant="ghost" onClick={() => setOpen(false)} aria-label="Fechar">
              <X className="size-4" />
            </Button>
          </div>

          <div className="mt-2 overflow-hidden rounded-lg bg-muted">
            <video
              ref={videoRef}
              className={`h-36 w-full scale-x-[-1] object-cover ${active ? "" : "hidden"}`}
            />
            {!active && (
              <p className="p-3 text-xs text-muted-foreground">
                Ligue a câmera e sinalize um comando. A legenda do que você sinaliza aparece abaixo
                (tradução invertida) e a ação é executada automaticamente.
              </p>
            )}
          </div>

          <div className="mt-2 min-h-9 rounded-lg bg-black/80 px-2 py-1.5 text-center text-sm font-semibold text-white">
            {caption || "…"}
          </div>
          {lastAction && (
            <p className="mt-1 flex items-center gap-1 text-xs text-muted-foreground">
              <Volume2 className="size-3" /> {lastAction}
            </p>
          )}

          <div className="mt-2 flex flex-wrap gap-2">
            <Button size="sm" onClick={() => (active ? stop() : start())} disabled={starting}>
              {starting ? <Loader2 className="mr-1 size-4 animate-spin" /> : <Hand className="mr-1 size-4" />}
              {active ? "Parar" : "Ligar câmera"}
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() => {
                textRef.current = "";
                setCaption("");
              }}
            >
              <Trash2 className="mr-1 size-4" /> Limpar
            </Button>
            <Button size="sm" variant="outline" onClick={() => setTrainerOpen(true)}>
              <GraduationCap className="mr-1 size-4" /> Treinar
            </Button>
          </div>

          <div className="mt-3 max-h-32 overflow-y-auto rounded-lg border p-2">
            <p className="mb-1 text-[11px] font-medium text-muted-foreground">Gestos de comando</p>
            <ul className="space-y-0.5 text-[11px]">
              {SIGN_COMMANDS.map((c) => (
                <li key={c.id} className="flex justify-between gap-2">
                  <span className="font-semibold">{c.hint}</span>
                  <span className="text-muted-foreground">{c.label}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}

      <SignTrainerDialog open={trainerOpen} onOpenChange={setTrainerOpen} />
      <CreateStatusDialog open={storyOpen} onOpenChange={setStoryOpen} />
      <LibrasPostComposer open={postOpen} onOpenChange={setPostOpen} />
    </>
  );
}
