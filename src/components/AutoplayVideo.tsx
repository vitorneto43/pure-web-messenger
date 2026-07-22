import { useEffect, useRef, useState } from "react";
import { Volume2, VolumeX, Play } from "lucide-react";
import { cn } from "@/lib/utils";

interface Props {
  src: string;
  poster?: string | null;
  className?: string;
  maxHeightClass?: string;
  loop?: boolean;
  aspect?: "auto" | "video" | "vertical";
}

/**
 * Vídeo com autoplay silencioso ao entrar na viewport.
 * Sem tela feia de "play": renderiza o primeiro frame como poster nativo
 * usando fragmento #t=0.1 quando não há thumbnail_url dedicada.
 */
export function AutoplayVideo({
  src,
  poster,
  className,
  maxHeightClass = "max-h-[600px]",
  loop = true,
  aspect = "auto",
}: Props) {
  const ref = useRef<HTMLVideoElement | null>(null);
  const [muted, setMuted] = useState(true);
  const [paused, setPaused] = useState(false);
  const [showControls, setShowControls] = useState(false);

  // Hint do primeiro frame como poster quando não há thumbnail
  const srcWithFrame =
    poster ? src : src.includes("#") ? src : `${src}#t=0.1`;

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (e.isIntersecting && e.intersectionRatio > 0.5) {
            el.play().then(() => setPaused(false)).catch(() => {});
          } else {
            el.pause();
          }
        }
      },
      { threshold: [0, 0.5, 1] },
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  const toggleMute = (e: React.MouseEvent) => {
    e.stopPropagation();
    setMuted((m) => !m);
  };

  const togglePlay = () => {
    const el = ref.current;
    if (!el) return;
    if (el.paused) {
      el.play().then(() => setPaused(false)).catch(() => {});
    } else {
      el.pause();
      setPaused(true);
    }
    setShowControls(true);
    window.setTimeout(() => setShowControls(false), 1500);
  };

  return (
    <div
      className={cn(
        "relative w-full bg-black overflow-hidden",
        aspect === "video" && "aspect-video",
        aspect === "vertical" && "aspect-[9/16]",
        className,
      )}
      onClick={togglePlay}
    >
      <video
        ref={ref}
        src={srcWithFrame}
        poster={poster ?? undefined}
        className={cn("w-full h-full object-contain bg-black", maxHeightClass)}
        playsInline
        muted={muted}
        loop={loop}
        preload="metadata"
        autoPlay
        controls={false}
      />

      {/* Botão de mute/unmute */}
      <button
        type="button"
        onClick={toggleMute}
        className="absolute bottom-2 right-2 z-10 grid place-items-center size-9 rounded-full bg-black/55 backdrop-blur text-white hover:bg-black/70 transition"
        aria-label={muted ? "Ativar som" : "Silenciar"}
      >
        {muted ? <VolumeX className="size-4" /> : <Volume2 className="size-4" />}
      </button>

      {/* Overlay de play quando pausado manualmente */}
      {paused && (
        <div className="absolute inset-0 grid place-items-center pointer-events-none">
          <div className="bg-black/50 rounded-full p-4">
            <Play className="size-10 text-white" fill="currentColor" />
          </div>
        </div>
      )}
      {showControls && !paused && (
        <div className="absolute inset-0 grid place-items-center pointer-events-none opacity-70">
          <div className="bg-black/40 rounded-full p-3">
            <Play className="size-8 text-white" fill="currentColor" />
          </div>
        </div>
      )}
    </div>
  );
}
