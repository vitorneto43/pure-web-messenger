import { useEffect, useRef } from "react";
import { Mic, MicOff, Phone, Video, VideoOff } from "lucide-react";
import { useCall } from "@/hooks/use-call";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";

export function CallScreen() {
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
    }
  }, [remoteStream, active?.kind]);

  if (!active) return null;

  const peer = active.peerProfile;
  const isVideo = active.kind === "video";
  const statusLabel =
    active.status === "ringing"
      ? active.isCaller
        ? "Chamando..."
        : "Conectando..."
      : connecting
      ? "Conectando..."
      : "Em chamada";

  return (
    <div className="fixed inset-0 z-[100] bg-black text-white flex flex-col">
      {/* Remote video / avatar */}
      <div className="flex-1 relative overflow-hidden">
        {isVideo ? (
          <video
            ref={remoteVideoRef}
            autoPlay
            playsInline
            muted={false}
            className="absolute inset-0 w-full h-full object-cover bg-zinc-900"
          />
        ) : (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-6 bg-gradient-to-b from-zinc-900 to-black">
            <Avatar className="size-32">
              <AvatarImage src={peer?.avatar_url ?? undefined} />
              <AvatarFallback className="text-4xl">
                {peer?.display_name?.[0]?.toUpperCase() ?? "?"}
              </AvatarFallback>
            </Avatar>
            <div className="text-center">
              <div className="text-2xl font-semibold">
                {peer?.display_name ?? "Usuário"}
              </div>
              <div className="text-sm text-zinc-400 mt-1">{statusLabel}</div>
            </div>
          </div>
        )}

        {isVideo && (
          <div className="absolute top-4 left-4 right-4 flex items-start justify-between pointer-events-none">
            <div className="bg-black/40 backdrop-blur px-3 py-1.5 rounded-full text-sm">
              {peer?.display_name ?? "Usuário"} · {statusLabel}
            </div>
          </div>
        )}

        {/* Local PiP — mirrored (selfie view) */}
        {isVideo && localStream && (
          <video
            ref={localVideoRef}
            autoPlay
            playsInline
            muted
            style={{ transform: "scaleX(-1)" }}
            className="absolute bottom-4 right-4 w-28 h-40 sm:w-40 sm:h-56 rounded-xl object-cover border border-white/20 shadow-2xl bg-zinc-800"
          />
        )}

        {/* Hidden audio element when video is off (audio still plays via video element if present) */}
        <audio ref={remoteAudioRef} autoPlay />
      </div>

      {/* Controls */}
      <div className="shrink-0 px-6 py-6 pb-10 flex items-center justify-center gap-5 bg-black/60 backdrop-blur">
        <Button
          size="icon"
          onClick={toggleMic}
          className={`size-14 rounded-full ${
            micOn ? "bg-white/10 hover:bg-white/20" : "bg-white text-black hover:bg-white/90"
          }`}
        >
          {micOn ? <Mic className="size-6" /> : <MicOff className="size-6" />}
        </Button>

        {isVideo && (
          <Button
            size="icon"
            onClick={toggleCam}
            className={`size-14 rounded-full ${
              camOn ? "bg-white/10 hover:bg-white/20" : "bg-white text-black hover:bg-white/90"
            }`}
          >
            {camOn ? <Video className="size-6" /> : <VideoOff className="size-6" />}
          </Button>
        )}

        <Button
          size="icon"
          onClick={endCall}
          className="size-16 rounded-full bg-red-600 hover:bg-red-700"
        >
          <Phone className="size-7 rotate-[135deg]" />
        </Button>
      </div>
    </div>
  );
}
