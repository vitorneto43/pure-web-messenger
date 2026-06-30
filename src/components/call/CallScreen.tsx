import { useEffect, useMemo, useRef, useState } from "react";
import { Mic, MicOff, Phone, Video, VideoOff, Volume2, VolumeX, RotateCcw, Circle, StopCircle } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useCall } from "@/hooks/use-call";
import { setNativeSpeakerphone } from "@/integrations/native-call";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  LiveKitRoom,
  RoomAudioRenderer,
  StartAudio,
  useLocalParticipant,
  useRoomContext,
  useTracks,
  VideoTrack,
} from "@livekit/components-react";
import { Track, createLocalVideoTrack } from "livekit-client";
import { useServerFn } from "@tanstack/react-start";
import { startCallRecording, stopCallRecording } from "@/lib/calls.functions";
import { toast } from "sonner";

export function CallScreen() {
  const { active, livekit, connecting } = useCall();
  if (!active) return null;

  // Outer shell is always rendered (ringing UI). LiveKit mounts once we have a token.
  return (
    <CallShell>
      {livekit && active.status === "accepted" ? (
        <LiveKitRoom
          token={livekit.token}
          serverUrl={livekit.serverUrl}
          connect
          audio
          video={active.kind === "video"}
          // No layout — we render UI ourselves.
          className="contents"
        >
          <RoomAudioRenderer volume={1} />
          <AudioBootstrap />
          <CallMedia />
        </LiveKitRoom>
      ) : null}
      <CallControls />
    </CallShell>
  );
}

/**
 * Ensures the microphone is actually published once the room is connected and
 * unblocks remote audio playback for browsers that gate autoplay. Without this
 * the callee often hears nothing because the <LiveKitRoom audio /> prop only
 * sets the initial intent — if permission resolves after `connect` finishes,
 * the local track is never published and the AudioContext stays suspended.
 */
function AudioBootstrap() {
  const room = useRoomContext();
  const { localParticipant } = useLocalParticipant();
  const did = useRef(false);
  useEffect(() => {
    if (!room || did.current) return;
    const run = async () => {
      try {
        await localParticipant.setMicrophoneEnabled(true);
      } catch (e) {
        console.error("Failed to enable microphone", e);
        toast.error("Não foi possível acessar o microfone. Verifique a permissão.");
      }
      try {
        // Some browsers (iOS Safari, some Android WebViews) require an explicit
        // startAudio() before the AudioContext will play remote tracks.
        await room.startAudio();
      } catch {
        /* user gesture may still be required — StartAudio button handles that */
      }
    };
    if (room.state === "connected") {
      did.current = true;
      void run();
    } else {
      const onConnected = () => {
        if (did.current) return;
        did.current = true;
        void run();
      };
      room.on("connected" as any, onConnected);
      return () => {
        room.off("connected" as any, onConnected);
      };
    }
  }, [room, localParticipant]);
  return (
    <StartAudio
      label="Tocar áudio"
      className="absolute inset-0 z-[110] flex items-center justify-center bg-black/80 text-white text-lg font-medium"
    />
  );
}

function CallShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="fixed inset-0 z-[100] bg-black text-white flex flex-col overflow-hidden">
      {children}
    </div>
  );
}

/** Renders remote video + local PiP for video calls. */
function CallMedia() {
  const { active } = useCall();
  const { localParticipant, isCameraEnabled, isMicrophoneEnabled } =
    useLocalParticipant();
  const {
    micOn,
    camOn,
    micToggleSignal,
    camToggleSignal,
    setMediaState,
  } = useCall();

  // Sync hook state -> LiveKit participant on toggle signals
  const lastMicSig = useRef(0);
  const lastCamSig = useRef(0);
  useEffect(() => {
    if (micToggleSignal !== lastMicSig.current) {
      lastMicSig.current = micToggleSignal;
      void localParticipant.setMicrophoneEnabled(!isMicrophoneEnabled);
    }
  }, [micToggleSignal, localParticipant, isMicrophoneEnabled]);

  useEffect(() => {
    if (camToggleSignal !== lastCamSig.current) {
      lastCamSig.current = camToggleSignal;
      void localParticipant.setCameraEnabled(!isCameraEnabled);
    }
  }, [camToggleSignal, localParticipant, isCameraEnabled]);

  // Mirror LiveKit publication state back to the hook so the UI buttons reflect reality
  useEffect(() => {
    if (micOn !== isMicrophoneEnabled) setMediaState({ micOn: isMicrophoneEnabled });
  }, [isMicrophoneEnabled, micOn, setMediaState]);
  useEffect(() => {
    if (camOn !== isCameraEnabled) setMediaState({ camOn: isCameraEnabled });
  }, [isCameraEnabled, camOn, setMediaState]);

  const remoteVideoTracks = useTracks(
    [Track.Source.Camera, Track.Source.ScreenShare],
    { onlySubscribed: true },
  ).filter((tr) => tr.participant.identity !== localParticipant.identity);

  const localCamRef = useRef<HTMLVideoElement>(null);
  useEffect(() => {
    const pub = localParticipant.getTrackPublication(Track.Source.Camera);
    const el = localCamRef.current;
    if (!el) return;
    if (pub?.track) pub.track.attach(el);
    return () => {
      if (pub?.track && el) pub.track.detach(el);
    };
  }, [localParticipant, isCameraEnabled]);

  const isVideo = active?.kind === "video";
  const remoteCam = remoteVideoTracks.find((t) => t.source === Track.Source.Camera);

  if (!isVideo) return null;

  return (
    <>
      <div className="absolute inset-0">
        {remoteCam ? (
          <VideoTrack
            trackRef={remoteCam}
            className="w-full h-full object-cover bg-zinc-900"
          />
        ) : null}
      </div>
      {isCameraEnabled && (
        <div className="absolute bottom-44 right-4 w-32 h-44 sm:w-40 sm:h-56 rounded-2xl overflow-hidden border-2 border-white/20 shadow-2xl bg-zinc-800 ring-2 ring-white/10 z-10">
          <video
            ref={localCamRef}
            autoPlay
            playsInline
            muted
            style={{ transform: "scaleX(-1)" }}
            className="w-full h-full object-cover"
          />
        </div>
      )}
    </>
  );
}

function CallControls() {
  const { t } = useTranslation();
  const {
    active,
    livekit,
    micOn,
    camOn,
    connecting,
    endCall,
    toggleMicRequest,
    toggleCamRequest,
  } = useCall();

  const [callDuration, setCallDuration] = useState(0);
  const [speakerOn, setSpeakerOn] = useState(false);
  const [recording, setRecording] = useState(false);
  const [recPending, setRecPending] = useState(false);
  const startRecFn = useServerFn(startCallRecording);
  const stopRecFn = useServerFn(stopCallRecording);
  const durationIntervalRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    if (!active || active.status !== "accepted") return;
    durationIntervalRef.current = setInterval(() => {
      setCallDuration((p) => p + 1);
    }, 1000);
    return () => {
      if (durationIntervalRef.current) clearInterval(durationIntervalRef.current);
    };
  }, [active]);

  useEffect(() => {
    void setNativeSpeakerphone(speakerOn);
  }, [speakerOn]);

  // Auto-stop recording when call ends
  useEffect(() => {
    return () => {
      // best-effort stop on unmount if user was recording
      if (recording && active?.id) {
        void stopRecFn({ data: { callId: active.id } }).catch(() => {});
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const formatDuration = (seconds: number) => {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = seconds % 60;
    if (h > 0) return `${h}:${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
    return `${m}:${s.toString().padStart(2, "0")}`;
  };

  if (!active) return null;
  const peer = active.peerProfile;
  const isVideo = active.kind === "video";
  const statusLabel =
    active.status === "ringing"
      ? active.isCaller
        ? t("call.statusRinging")
        : t("call.statusConnecting")
      : connecting || !livekit
        ? t("call.statusConnecting")
        : active.status === "accepted"
          ? formatDuration(callDuration)
          : t("call.statusInCall");

  async function toggleRecording() {
    if (!active || !active.isCaller) return;
    if (recPending) return;
    setRecPending(true);
    try {
      if (recording) {
        await stopRecFn({ data: { callId: active.id } });
        setRecording(false);
        toast.success("Gravação encerrada");
      } else {
        await startRecFn({ data: { callId: active.id } });
        setRecording(true);
        toast.success("Gravando chamada");
      }
    } catch (e: any) {
      toast.error(e?.message ?? "Falha na gravação");
    } finally {
      setRecPending(false);
    }
  }

  return (
    <>
      {/* Background placeholder when no remote video */}
      {!isVideo || !livekit ? (
        <div className="flex-1 relative overflow-hidden bg-gradient-to-b from-zinc-900 to-black">
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-6">
            <Avatar className="size-40 border-4 border-white/20">
              <AvatarImage src={peer?.avatar_url ?? undefined} />
              <AvatarFallback className="text-6xl bg-gradient-to-br from-blue-500 to-purple-600">
                {peer?.display_name?.[0]?.toUpperCase() ?? "?"}
              </AvatarFallback>
            </Avatar>
            <div className="text-center">
              <div className="text-3xl font-bold tracking-tight">
                {peer?.display_name ?? t("call.unknownUser")}
              </div>
              <div className="text-sm text-zinc-300 mt-2 font-medium">{statusLabel}</div>
            </div>
          </div>
        </div>
      ) : (
        <div className="flex-1 relative">
          <div className="absolute top-0 left-0 right-0 p-4 flex items-center justify-between pointer-events-none z-20">
            <div className="bg-black/50 backdrop-blur-md px-4 py-2 rounded-full text-sm font-medium">
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse" />
                {peer?.display_name ?? t("call.unknownUser")}
              </div>
            </div>
            <div className="bg-black/50 backdrop-blur-md px-4 py-2 rounded-full text-sm font-medium">
              {statusLabel}
            </div>
          </div>
        </div>
      )}

      <div className="shrink-0 px-4 py-8 pb-12 flex flex-col items-center gap-6 bg-gradient-to-t from-black via-black/80 to-transparent z-20">
        {active.status === "accepted" && (
          <div className="text-center">
            <div className="text-sm text-zinc-400 font-medium">{t("call.callDuration")}</div>
            <div className="text-2xl font-bold text-white mt-1">{formatDuration(callDuration)}</div>
          </div>
        )}

        <div className="flex items-center justify-center gap-4 sm:gap-6">
          <Button
            size="icon"
            onClick={toggleMicRequest}
            className={`size-16 sm:size-18 rounded-full ${
              micOn
                ? "bg-white/10 hover:bg-white/20 text-white"
                : "bg-red-500/20 hover:bg-red-500/30 text-red-400"
            }`}
            title={micOn ? t("call.micOff") : t("call.micOn")}
          >
            {micOn ? <Mic className="size-7" /> : <MicOff className="size-7" />}
          </Button>

          {isVideo && (
            <Button
              size="icon"
              onClick={toggleCamRequest}
              className={`size-16 sm:size-18 rounded-full ${
                camOn
                  ? "bg-white/10 hover:bg-white/20 text-white"
                  : "bg-red-500/20 hover:bg-red-500/30 text-red-400"
              }`}
              title={camOn ? t("call.camOff") : t("call.camOn")}
            >
              {camOn ? <Video className="size-7" /> : <VideoOff className="size-7" />}
            </Button>
          )}

          <Button
            size="icon"
            onClick={() => setSpeakerOn(!speakerOn)}
            className={`size-16 sm:size-18 rounded-full ${
              speakerOn
                ? "bg-white/10 hover:bg-white/20 text-white"
                : "bg-white/5 hover:bg-white/10 text-zinc-400"
            }`}
            title={speakerOn ? t("call.speakerOff") : t("call.speakerOn")}
          >
            {speakerOn ? <Volume2 className="size-7" /> : <VolumeX className="size-7" />}
          </Button>

          {active.isCaller && active.status === "accepted" && (
            <Button
              size="icon"
              onClick={toggleRecording}
              disabled={recPending}
              className={`size-16 sm:size-18 rounded-full ${
                recording
                  ? "bg-red-600 hover:bg-red-700 text-white animate-pulse"
                  : "bg-white/5 hover:bg-white/10 text-zinc-400"
              }`}
              title={recording ? "Parar gravação" : "Gravar chamada"}
            >
              {recording ? <StopCircle className="size-7" /> : <Circle className="size-7" />}
            </Button>
          )}
        </div>

        <Button
          size="icon"
          onClick={endCall}
          className="size-20 sm:size-24 rounded-full bg-red-600 hover:bg-red-700 text-white shadow-lg active:scale-95"
          title={t("call.endCall")}
        >
          <Phone className="size-9 sm:size-10 rotate-[135deg]" />
        </Button>

        <div className="text-xs text-zinc-500 text-center">
          {isVideo ? t("call.videoCall") : t("call.voiceCall")} •{" "}
          {active.isCaller ? t("call.youStarted") : t("call.callReceived")}
        </div>
      </div>
    </>
  );
}
