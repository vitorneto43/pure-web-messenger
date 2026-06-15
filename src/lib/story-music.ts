export type Mood = "chill" | "happy" | "romantic" | "hype" | "cinematic" | "sad" | "lofi";

export interface MusicTrack {
  id: string;
  title: string;
  artist: string;
  source: string;
  source_url: string | null;
  license: string;
  audio_url: string;
  cover_url: string | null;
  duration_sec: number;
  genre: string | null;
  mood: string;
  is_active: boolean;
  sort_order: number;
  play_count: number;
  created_at: string;
  updated_at: string;
}

export const MOODS: { value: Mood; label: string; emoji: string; gradient: string }[] = [
  { value: "chill", label: "Chill", emoji: "🌊", gradient: "from-sky-500 to-cyan-500" },
  { value: "happy", label: "Alegre", emoji: "☀️", gradient: "from-yellow-400 to-orange-500" },
  { value: "romantic", label: "Romance", emoji: "💗", gradient: "from-pink-500 to-rose-500" },
  { value: "hype", label: "Energia", emoji: "🔥", gradient: "from-red-500 to-fuchsia-600" },
  { value: "cinematic", label: "Cinemático", emoji: "🎬", gradient: "from-indigo-500 to-purple-700" },
  { value: "sad", label: "Triste", emoji: "🌧️", gradient: "from-slate-500 to-slate-700" },
  { value: "lofi", label: "Lofi", emoji: "🎧", gradient: "from-violet-500 to-purple-500" },
];

export function moodLabel(mood: string | null | undefined) {
  return MOODS.find((m) => m.value === mood)?.label ?? "Outros";
}

export function moodEmoji(mood: string | null | undefined) {
  return MOODS.find((m) => m.value === mood)?.emoji ?? "🎵";
}

export function moodGradient(mood: string | null | undefined) {
  return MOODS.find((m) => m.value === mood)?.gradient ?? "from-primary to-primary/60";
}

export function formatDuration(sec: number) {
  if (!sec || sec < 0) return "0:00";
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${m}:${String(s).padStart(2, "0")}`;
}
