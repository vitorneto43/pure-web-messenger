import { useEffect, useRef, useState } from "react";
import { Mic, MicOff, Phone, Video, VideoOff, Volume2, VolumeX, RotateCcw } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useCall } from "@/hooks/use-call";
import { setNativeSpeakerphone } from "@/integrations/native-call";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";

export function CallScreen() {
  const { t } = useTranslation();
  const {
    active,
    localStream,
    remoteStream,
    micOn,
    camOn,
    connecting,
    endCall,
    toggleMic,
    toggleCam,
  } = useCall();

  const localVideoRef = useRef<HTMLVideoElement>(null);
  const remoteVideoRef = useRef<HTMLVideoElement>(null);
  const remoteAudioRef = useRef<HTMLAudioElement>(null);
  const [callDuration, setCallDuration] = useState(0);
  const [speakerOn, setSpeakerOn] = useState(false);
  const durationIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // Update call duration every second
  useEffect(() => {
    if (!active || active.status !== "accepted") return;

    durationIntervalRef.current = setInterval(() => {
      setCallDuration((prev) => prev + 1);
    }, 1000);

    return () => {
      if (durationIntervalRef.current) {
        clearInterval(durationIntervalRef.current);
      }
    };
  }, [active]);

  useEffect(() => {
    if (localVideoRef.current && localStream) {
      // CRITICAL: feed ONLY the video tracks to the local preview.
      // If the full stream (incl. mic) is attached, some WebViews ignore
      // `muted` and play the local mic back to the user → they hear themselves.
      const videoOnly = new MediaStream(localStream.getVideoTracks());
      localVideoRef.current.srcObject = videoOnly;
      localVideoRef.current.muted = true;
      (localVideoRef.current as HTMLVideoElement).volume = 0;
    }
  }, [localStream]);

  useEffect(() => {
    if (remoteVideoRef.current && remoteStream) {
      // Video element gets video-only; audio always routed through <audio>.
      const videoOnly = new MediaStream(remoteStream.getVideoTracks());
      remoteVideoRef.current.srcObject = videoOnly;
      remoteVideoRef.current.muted = true;
      (remoteVideoRef.current as HTMLVideoElement).volume = 0;
    }
    if (remoteAudioRef.current && remoteStream) {
      const audioOnly = new MediaStream(remoteStream.getAudioTracks());
      remoteAudioRef.current.srcObject = audioOnly;
      remoteAudioRef.current.volume = 1;
      // Force playback to start (Android WebView sometimes pauses on attach).
      remoteAudioRef.current.play?.().catch(() => {});
    }
  }, [remoteStream, active?.kind]);

  // Apply speaker toggle to native audio routing.
  useEffect(() => {
    void setNativeSpeakerphone(speakerOn);
  }, [speakerOn]);

  const formatDuration = (seconds: number) => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;

    if (hours > 0) {
      return `${hours}:${minutes.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
    }
    return `${minutes}:${secs.toString().padStart(2, "0")}`;
  };

  if (!active) return null;

  const peer = active.peerProfile;
  const isVideo = active.kind === "video";
  const statusLabel =
    active.status === "ringing"
      ? active.isCaller
        ? t("call.statusRinging")
        : t("call.statusConnecting")
      : connecting
        ? t("call.statusConnecting")
        : active.status === "accepted"
          ? formatDuration(callDuration)
          : t("call.statusInCall");

  return (
    <div className="fixed inset-0 z-[100] bg-black text-white flex flex-col overflow-hidden">
      {/* Remote video / avatar */}
      <div className="flex-1 relative overflow-hidden bg-gradient-to-b from-zinc-900 to-black">
        {isVideo ? (
          <>
            <video
              ref={remoteVideoRef}
              autoPlay
              playsInline
              muted={false}
              className="absolute inset-0 w-full h-full object-cover bg-zinc-900"
            />
            {/* Gradient overlay for better text readability */}
            <div className="absolute inset-0 bg-gradient-to-t from-black/40 via-transparent to-black/20 pointer-events-none" />
          </>
        ) : (
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
        )}

        {/* Top info bar - only show in video calls */}
        {isVideo && (
          <div className="absolute top-0 left-0 right-0 p-4 flex items-center justify-between pointer-events-none">
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
        )}

        {/* Local PiP — mirrored (selfie view) */}
        {isVideo && localStream && (
          <div className="absolute bottom-24 right-4 w-32 h-44 sm:w-40 sm:h-56 rounded-2xl overflow-hidden border-2 border-white/20 shadow-2xl bg-zinc-800 ring-2 ring-white/10">
            <video
              ref={localVideoRef}
              autoPlay
              playsInline
              muted
              style={{ transform: "scaleX(-1)" }}
              className="w-full h-full object-cover"
            />
            {/* Subtle gradient overlay */}
            <div className="absolute inset-0 bg-gradient-to-t from-black/20 to-transparent pointer-events-none" />
          </div>
        )}

        {/* Hidden audio element when video is off (audio still plays via video element if present) */}
        <audio ref={remoteAudioRef} autoPlay />
      </div>

      {/* Controls - Professional WhatsApp/Telegram style */}
      <div className="shrink-0 px-4 py-8 pb-12 flex flex-col items-center gap-6 bg-gradient-to-t from-black via-black/80 to-transparent">
        {/* Call status and duration */}
        {active.status === "accepted" && (
          <div className="text-center">
            <div className="text-sm text-zinc-400 font-medium">{t("call.callDuration")}</div>
            <div className="text-2xl font-bold text-white mt-1">{formatDuration(callDuration)}</div>
          </div>
        )}

        {/* Primary controls row */}
        <div className="flex items-center justify-center gap-4 sm:gap-6">
          {/* Mic toggle */}
          <Button
            size="icon"
            onClick={toggleMic}
            className={`size-16 sm:size-18 rounded-full transition-all duration-200 ${
              micOn
                ? "bg-white/10 hover:bg-white/20 text-white"
                : "bg-red-500/20 hover:bg-red-500/30 text-red-400"
            }`}
            title={micOn ? t("call.micOff") : t("call.micOn")}
          >
            {micOn ? <Mic className="size-7" /> : <MicOff className="size-7" />}
          </Button>

          {/* Video toggle (only for video calls) */}
          {isVideo && (
            <Button
              size="icon"
              onClick={toggleCam}
              className={`size-16 sm:size-18 rounded-full transition-all duration-200 ${
                camOn
                  ? "bg-white/10 hover:bg-white/20 text-white"
                  : "bg-red-500/20 hover:bg-red-500/30 text-red-400"
              }`}
              title={camOn ? t("call.camOff") : t("call.camOn")}
            >
              {camOn ? <Video className="size-7" /> : <VideoOff className="size-7" />}
            </Button>
          )}

          {/* Speaker toggle */}
          <Button
            size="icon"
            onClick={() => setSpeakerOn(!speakerOn)}
            className={`size-16 sm:size-18 rounded-full transition-all duration-200 ${
              speakerOn
                ? "bg-white/10 hover:bg-white/20 text-white"
                : "bg-white/5 hover:bg-white/10 text-zinc-400"
            }`}
            title={speakerOn ? t("call.speakerOff") : t("call.speakerOn")}
          >
            {speakerOn ? <Volume2 className="size-7" /> : <VolumeX className="size-7" />}
          </Button>

          {/* Flip camera (only for video calls) */}
          {isVideo && (
            <Button
              size="icon"
              className="size-16 sm:size-18 rounded-full bg-white/5 hover:bg-white/10 text-zinc-400 transition-all duration-200"
              title={t("call.flipCamera")}
            >
              <RotateCcw className="size-7" />
            </Button>
          )}
        </div>

        {/* End call button - prominent red */}
        <Button
          size="icon"
          onClick={endCall}
          className="size-20 sm:size-24 rounded-full bg-red-600 hover:bg-red-700 text-white shadow-lg hover:shadow-xl transition-all duration-200 active:scale-95"
          title={t("call.endCall")}
        >
          <Phone className="size-9 sm:size-10 rotate-[135deg]" />
        </Button>

        {/* Call info text */}
        <div className="text-xs text-zinc-500 text-center">
          {isVideo ? t("call.videoCall") : t("call.voiceCall")} • {active.isCaller ? t("call.youStarted") : t("call.callReceived")}
        </div>
      </div>
    </div>
  );
}
