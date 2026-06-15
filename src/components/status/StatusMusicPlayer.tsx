import { useEffect, useRef, useState } from "react";
import { Music, Volume2, VolumeX, Play } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import type { MusicTrack } from "@/lib/story-music";

const MUTE_KEY = "wc_story_music_muted";

interface Props {
  trackId: string;
  startSec: number;
  durationSec: number;
  volume: number;
  paused?: boolean;
}

export function StatusMusicPlayer({ trackId, startSec, durationSec, volume, paused }: Props) {
  const [track, setTrack] = useState<MusicTrack | null>(null);
  const [muted, setMuted] = useState(() =>
    typeof window !== "undefined" && localStorage.getItem(MUTE_KEY) === "1",
  );
  const [needsTap, setNeedsTap] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    let cancel = false;
    (async () => {
      const { data } = await (supabase as any)
        .from("story_music_tracks")
        .select("*")
        .eq("id", trackId)
        .maybeSingle();
      if (!cancel && data) {
        setTrack(data as MusicTrack);
        (supabase as any).rpc("log_music_play", { _track_id: trackId, _source: "story_view" }).then(() => {});
      }
    })();
    return () => {
      cancel = true;
    };
  }, [trackId]);

  // Try to start playing (may be blocked by autoplay policies)
  function tryPlay(a: HTMLAudioElement) {
    const p = a.play();
    if (p && typeof p.catch === "function") {
      p.then(() => setNeedsTap(false)).catch((err) => {
        console.warn("[StatusMusicPlayer] autoplay blocked:", err?.message || err);
        setNeedsTap(true);
      });
    }
  }

  useEffect(() => {
    if (!track) return;
    const a = new Audio();
    a.crossOrigin = "anonymous";
    a.preload = "auto";
    a.src = track.audio_url;
    a.volume = muted ? 0 : volume;
    a.muted = muted;
    a.currentTime = startSec;
    (a as any).playsInline = true;
    (a as any).webkitPlaysInline = true;
    a.setAttribute("playsinline", "");
    audioRef.current = a;
    const onTime = () => {
      if (a.currentTime >= startSec + durationSec) a.currentTime = startSec;
    };
    const onError = () => {
      console.warn("[StatusMusicPlayer] audio error", a.error?.code, track.audio_url);
    };
    a.addEventListener("timeupdate", onTime);
    a.addEventListener("error", onError);
    const onCanPlay = () => tryPlay(a);
    a.addEventListener("canplay", onCanPlay, { once: true });
    // also kick off immediately
    tryPlay(a);
    return () => {
      a.removeEventListener("timeupdate", onTime);
      a.removeEventListener("error", onError);
      a.removeEventListener("canplay", onCanPlay);
      a.pause();
      a.src = "";
      audioRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [track?.id, startSec, durationSec]);

  // Global tap fallback: any user gesture in the document re-tries playback
  useEffect(() => {
    if (!needsTap) return;
    const handler = () => {
      const a = audioRef.current;
      if (!a) return;
      a.muted = false;
      setMuted(false);
      try { localStorage.setItem(MUTE_KEY, "0"); } catch {}
      tryPlay(a);
    };
    window.addEventListener("pointerdown", handler, { once: true, capture: true });
    window.addEventListener("touchstart", handler, { once: true, capture: true });
    return () => {
      window.removeEventListener("pointerdown", handler, { capture: true } as any);
      window.removeEventListener("touchstart", handler, { capture: true } as any);
    };
  }, [needsTap]);

  useEffect(() => {
    const a = audioRef.current;
    if (!a) return;
    a.muted = muted;
    a.volume = muted ? 0 : volume;
  }, [muted, volume]);

  useEffect(() => {
    const a = audioRef.current;
    if (!a) return;
    if (paused) a.pause();
    else tryPlay(a);
  }, [paused]);

  function toggleMute(e: React.MouseEvent) {
    e.stopPropagation();
    setMuted((m) => {
      const v = !m;
      try { localStorage.setItem(MUTE_KEY, v ? "1" : "0"); } catch {}
      const a = audioRef.current;
      if (a) {
        a.muted = v;
        a.volume = v ? 0 : volume;
        if (!v) tryPlay(a);
      }
      return v;
    });
    setNeedsTap(false);
  }

  if (!track) return null;

  return (
    <>
      <button
        onClick={toggleMute}
        className="absolute top-16 left-3 z-30 flex items-center gap-1.5 max-w-[60%] bg-black/55 backdrop-blur text-white text-xs px-2.5 py-1.5 rounded-full ring-1 ring-white/10"
      >
        {muted ? <VolumeX className="size-3.5 shrink-0" /> : <Music className="size-3.5 shrink-0 text-primary" />}
        <span className="truncate font-medium">{track.title}</span>
        <span className="truncate opacity-70">· {track.artist}</span>
      </button>

      {needsTap && !muted && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            const a = audioRef.current;
            if (a) {
              a.muted = false;
              tryPlay(a);
            }
          }}
          className="absolute top-28 left-3 z-30 flex items-center gap-1.5 bg-primary text-primary-foreground text-xs font-semibold px-2.5 py-1.5 rounded-full shadow-lg animate-pulse"
        >
          <Play className="size-3.5" />
          Toque para ativar o som
        </button>
      )}
    </>
  );
}
