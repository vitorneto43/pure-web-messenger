import { useEffect, useRef, useState } from "react";
import { Music, Volume2, VolumeX } from "lucide-react";
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
        (supabase as any).rpc("increment_music_play_count", { _track_id: trackId }).then(() => {});
      }
    })();
    return () => {
      cancel = true;
    };
  }, [trackId]);

  useEffect(() => {
    if (!track) return;
    const a = new Audio(track.audio_url);
    a.volume = muted ? 0 : volume;
    a.currentTime = startSec;
    audioRef.current = a;
    const onTime = () => {
      if (a.currentTime >= startSec + durationSec) a.currentTime = startSec;
    };
    a.addEventListener("timeupdate", onTime);
    a.play().catch(() => {});
    return () => {
      a.removeEventListener("timeupdate", onTime);
      a.pause();
      audioRef.current = null;
    };
  }, [track?.id, startSec, durationSec]);

  useEffect(() => {
    if (audioRef.current) audioRef.current.volume = muted ? 0 : volume;
  }, [muted, volume]);

  useEffect(() => {
    if (!audioRef.current) return;
    if (paused) audioRef.current.pause();
    else audioRef.current.play().catch(() => {});
  }, [paused]);

  function toggleMute() {
    setMuted((m) => {
      const v = !m;
      try { localStorage.setItem(MUTE_KEY, v ? "1" : "0"); } catch {}
      return v;
    });
  }

  if (!track) return null;

  return (
    <button
      onClick={toggleMute}
      className="absolute top-16 left-3 z-20 flex items-center gap-1.5 max-w-[60%] bg-black/55 backdrop-blur text-white text-xs px-2.5 py-1.5 rounded-full ring-1 ring-white/10"
    >
      {muted ? <VolumeX className="size-3.5 shrink-0" /> : <Music className="size-3.5 shrink-0 text-primary" />}
      <span className="truncate font-medium">{track.title}</span>
      <span className="truncate opacity-70">· {track.artist}</span>
    </button>
  );
}
