import { useEffect, useMemo, useRef, useState } from "react";
import { Loader2, Music, Play, Pause, Search, Check, X, Volume2, Flame, Sparkles, ListMusic } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { cn } from "@/lib/utils";
import { MOODS, type MusicTrack, formatDuration, moodEmoji } from "@/lib/story-music";
import { toast } from "sonner";

export interface MusicSelection {
  track: MusicTrack;
  start_sec: number;
  duration_sec: number;
  volume: number;
}

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onSelect: (sel: MusicSelection) => void;
  /** If true, show volume mix slider (for video stories). */
  showVolumeMix?: boolean;
  initial?: MusicSelection | null;
}

type Tab = "trending" | "new" | "mood";

interface TrendingTrack extends MusicTrack {
  trend_plays?: number;
}

function formatPlays(n: number | undefined): string {
  const v = n ?? 0;
  if (v >= 1_000_000) return `${(v / 1_000_000).toFixed(1)}M`;
  if (v >= 1_000) return `${(v / 1_000).toFixed(1)}k`;
  return String(v);
}

export function MusicPickerSheet({ open, onOpenChange, onSelect, showVolumeMix, initial }: Props) {
  const [step, setStep] = useState<"list" | "trim">("list");
  const [tab, setTab] = useState<Tab>("trending");
  const [mood, setMood] = useState<string>("");
  const [search, setSearch] = useState("");
  const [tracks, setTracks] = useState<TrendingTrack[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedTrack, setSelectedTrack] = useState<MusicTrack | null>(null);
  const [startSec, setStartSec] = useState(0);
  const [durationSec, setDurationSec] = useState(15);
  const [volume, setVolume] = useState(0.8);
  const [previewingId, setPreviewingId] = useState<string | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    if (!open) {
      stopAudio();
      return;
    }
    if (initial) {
      setSelectedTrack(initial.track);
      setStartSec(initial.start_sec);
      setDurationSec(initial.duration_sec);
      setVolume(initial.volume);
      setStep("trim");
    } else {
      setStep("list");
      setSelectedTrack(null);
      setStartSec(0);
      setDurationSec(15);
      setVolume(0.8);
    }
  }, [open]);

  useEffect(() => {
    if (!open || step !== "list") return;
    let cancel = false;
    setLoading(true);
    (async () => {
      const hasSearch = search.trim().length > 0;
      let data: any = null;
      let error: any = null;
      if (hasSearch) {
        ({ data, error } = await (supabase as any).rpc("list_active_music_tracks", {
          _mood: null,
          _search: search.trim(),
        }));
      } else if (tab === "trending") {
        ({ data, error } = await (supabase as any).rpc("trending_music_tracks", {
          _days: 7,
          _limit: 50,
        }));
      } else if (tab === "new") {
        ({ data, error } = await (supabase as any).rpc("new_music_tracks", { _limit: 50 }));
      } else {
        ({ data, error } = await (supabase as any).rpc("list_active_music_tracks", {
          _mood: mood || null,
          _search: null,
        }));
      }
      if (cancel) return;
      if (error) {
        console.warn(error);
        setTracks([]);
      } else {
        setTracks((data ?? []) as TrendingTrack[]);
      }
      setLoading(false);
    })();
    return () => {
      cancel = true;
    };
  }, [open, step, tab, mood, search]);

  function stopAudio() {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.src = "";
      audioRef.current = null;
    }
    setPreviewingId(null);
  }

  function previewTrack(t: MusicTrack) {
    if (previewingId === t.id) {
      stopAudio();
      return;
    }
    stopAudio();
    const a = new Audio(t.audio_url);
    a.volume = 0.8;
    a.play().catch((e) => {
      console.warn(e);
      toast.error("Não foi possível tocar essa música.");
    });
    audioRef.current = a;
    setPreviewingId(t.id);
    a.onended = () => stopAudio();
  }

  function pickTrack(t: MusicTrack) {
    stopAudio();
    setSelectedTrack(t);
    setStartSec(0);
    setDurationSec(Math.min(15, Math.max(5, t.duration_sec || 15)));
    setStep("trim");
  }

  // Trim preview: play the chosen segment in loop
  useEffect(() => {
    if (step !== "trim" || !selectedTrack) return;
    const a = new Audio(selectedTrack.audio_url);
    a.volume = volume;
    a.currentTime = startSec;
    audioRef.current = a;
    let stopped = false;
    a.play().catch(() => {});
    const onTime = () => {
      if (stopped) return;
      if (a.currentTime >= startSec + durationSec) {
        a.currentTime = startSec;
      }
    };
    a.addEventListener("timeupdate", onTime);
    return () => {
      stopped = true;
      a.removeEventListener("timeupdate", onTime);
      a.pause();
      audioRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step, selectedTrack?.id, startSec, durationSec]);

  useEffect(() => {
    if (audioRef.current) audioRef.current.volume = volume;
  }, [volume]);

  const maxStart = useMemo(() => {
    if (!selectedTrack) return 0;
    return Math.max(0, (selectedTrack.duration_sec || 60) - 5);
  }, [selectedTrack]);

  function confirm() {
    if (!selectedTrack) return;
    onSelect({
      track: selectedTrack,
      start_sec: Math.round(startSec),
      duration_sec: Math.round(durationSec),
      volume: Number(volume.toFixed(2)),
    });
    stopAudio();
    onOpenChange(false);
  }

  return (
    <Sheet open={open} onOpenChange={(v) => { if (!v) stopAudio(); onOpenChange(v); }}>
      <SheetContent side="bottom" className="h-[85vh] flex flex-col p-0">
        <SheetHeader className="px-4 pt-4 pb-2 border-b">
          <SheetTitle className="flex items-center gap-2">
            <Music className="size-5 text-primary" />
            {step === "list" ? "Escolher música" : "Ajustar trecho"}
          </SheetTitle>
          <SheetDescription>
            {step === "list"
              ? "Catálogo de músicas livres de direitos autorais."
              : "Selecione o trecho que vai tocar no seu story."}
          </SheetDescription>
        </SheetHeader>

        {step === "list" && (
          <div className="flex-1 flex flex-col min-h-0">
            <div className="px-4 pt-3 pb-2 space-y-2">
              <div className="relative">
                <Search className="size-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                <Input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Buscar título ou artista..."
                  className="pl-9"
                />
              </div>

              {!search.trim() && (
                <div className="flex gap-1.5 pt-1">
                  {([
                    { id: "trending", label: "Em alta", icon: Flame },
                    { id: "new", label: "Novas", icon: Sparkles },
                    { id: "mood", label: "Por humor", icon: ListMusic },
                  ] as const).map((t) => {
                    const Icon = t.icon;
                    const active = tab === t.id;
                    return (
                      <button
                        key={t.id}
                        onClick={() => setTab(t.id)}
                        className={cn(
                          "flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold border transition",
                          active
                            ? "bg-primary text-primary-foreground border-primary shadow-sm"
                            : "bg-muted/60 border-border text-muted-foreground hover:text-foreground",
                        )}
                      >
                        <Icon className="size-3.5" />
                        {t.label}
                      </button>
                    );
                  })}
                </div>
              )}

              {!search.trim() && tab === "mood" && (
                <div className="flex gap-1.5 overflow-x-auto pb-1 -mx-1 px-1 scrollbar-thin">
                  <button
                    onClick={() => setMood("")}
                    className={cn(
                      "shrink-0 px-3 py-1.5 rounded-full text-xs font-medium border transition",
                      !mood ? "bg-primary text-primary-foreground border-primary" : "bg-muted border-border",
                    )}
                  >
                    Todos
                  </button>
                  {MOODS.map((m) => (
                    <button
                      key={m.value}
                      onClick={() => setMood(m.value === mood ? "" : m.value)}
                      className={cn(
                        "shrink-0 px-3 py-1.5 rounded-full text-xs font-medium border transition flex items-center gap-1",
                        mood === m.value ? "bg-primary text-primary-foreground border-primary" : "bg-muted border-border",
                      )}
                    >
                      <span>{m.emoji}</span>
                      {m.label}
                    </button>
                  ))}
                </div>
              )}
            </div>

            <div className="flex-1 overflow-y-auto px-3 pb-4">
              {loading && (
                <div className="py-8 grid place-items-center">
                  <Loader2 className="size-5 animate-spin text-muted-foreground" />
                </div>
              )}
              {!loading && tracks.length === 0 && (
                <div className="py-10 text-center text-sm text-muted-foreground space-y-1">
                  <Music className="size-8 mx-auto opacity-50" />
                  <p>Nenhuma música encontrada.</p>
                </div>
              )}

              {!loading && tracks.length > 0 && !search.trim() && tab === "trending" && (
                <p className="text-[11px] uppercase tracking-wider text-muted-foreground font-semibold px-1 pt-2 pb-1 flex items-center gap-1">
                  <Flame className="size-3 text-orange-500" /> Top 7 dias · atualizado em tempo real
                </p>
              )}

              <ul className="space-y-1.5">
                {tracks.map((t, idx) => {
                  const showRank = !search.trim() && tab === "trending";
                  const showNewBadge = !search.trim() && tab === "new";
                  const rank = idx + 1;
                  const isTop3 = showRank && rank <= 3;
                  return (
                    <li
                      key={t.id}
                      className={cn(
                        "flex items-center gap-3 p-2 rounded-xl transition",
                        isTop3
                          ? "bg-gradient-to-r from-orange-500/10 via-pink-500/5 to-transparent ring-1 ring-orange-500/20"
                          : "hover:bg-muted/60",
                      )}
                    >
                      {showRank && (
                        <div
                          className={cn(
                            "w-6 text-center font-black tabular-nums shrink-0",
                            rank === 1 && "text-orange-500 text-xl",
                            rank === 2 && "text-pink-500 text-lg",
                            rank === 3 && "text-amber-500 text-base",
                            rank > 3 && "text-muted-foreground text-sm",
                          )}
                        >
                          {rank}
                        </div>
                      )}
                      <button
                        onClick={() => previewTrack(t)}
                        className={cn(
                          "relative rounded-lg bg-muted overflow-hidden grid place-items-center shrink-0 ring-1 ring-border",
                          isTop3 ? "size-14" : "size-12",
                        )}
                        aria-label={previewingId === t.id ? "Pausar" : "Tocar"}
                      >
                        {t.cover_url ? (
                          <img src={t.cover_url} alt="" className="absolute inset-0 w-full h-full object-cover" />
                        ) : (
                          <span className="text-xl">{moodEmoji(t.mood)}</span>
                        )}
                        <span className="absolute inset-0 grid place-items-center bg-black/40">
                          {previewingId === t.id ? (
                            <Pause className="size-5 text-white" />
                          ) : (
                            <Play className="size-5 text-white" />
                          )}
                        </span>
                      </button>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5">
                          <p className={cn("font-medium truncate", isTop3 ? "text-sm" : "text-sm")}>{t.title}</p>
                          {rank === 1 && showRank && <Flame className="size-3.5 text-orange-500 shrink-0" />}
                          {showNewBadge && (
                            <span className="text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded bg-primary text-primary-foreground shrink-0">
                              Novo
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-muted-foreground truncate">
                          {t.artist} · {formatDuration(t.duration_sec)}
                          {showRank && (t.trend_plays ?? 0) > 0 && (
                            <> · <span className="text-orange-500/90 font-medium">{formatPlays(t.trend_plays)} usos</span></>
                          )}
                          {!showRank && (t.play_count ?? 0) > 0 && (
                            <> · {formatPlays(t.play_count)} usos</>
                          )}
                        </p>
                      </div>
                      <Button size="sm" onClick={() => pickTrack(t)}>
                        <Check className="size-4 mr-1" /> Usar
                      </Button>
                    </li>
                  );
                })}
              </ul>
            </div>
          </div>
        )}


        {step === "trim" && selectedTrack && (
          <div className="flex-1 flex flex-col overflow-y-auto">
            <div className="px-4 py-4 space-y-5">
              <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/60">
                <div className="size-14 rounded-md bg-background overflow-hidden grid place-items-center shrink-0 ring-1 ring-border">
                  {selectedTrack.cover_url ? (
                    <img src={selectedTrack.cover_url} alt="" className="w-full h-full object-cover" />
                  ) : (
                    <span className="text-2xl">{moodEmoji(selectedTrack.mood)}</span>
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-semibold truncate">{selectedTrack.title}</p>
                  <p className="text-xs text-muted-foreground truncate">
                    {selectedTrack.artist} · {formatDuration(selectedTrack.duration_sec)}
                  </p>
                </div>
                <Button size="sm" variant="ghost" onClick={() => setStep("list")}>
                  Trocar
                </Button>
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between text-xs font-medium">
                  <span>Início do trecho</span>
                  <span className="text-muted-foreground tabular-nums">
                    {formatDuration(startSec)} / {formatDuration(selectedTrack.duration_sec)}
                  </span>
                </div>
                <Slider
                  min={0}
                  max={maxStart}
                  step={1}
                  value={[startSec]}
                  onValueChange={(v) => setStartSec(v[0])}
                />
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between text-xs font-medium">
                  <span>Duração do trecho</span>
                  <span className="text-muted-foreground tabular-nums">{durationSec}s</span>
                </div>
                <Slider
                  min={5}
                  max={Math.min(60, Math.max(5, selectedTrack.duration_sec - startSec))}
                  step={1}
                  value={[durationSec]}
                  onValueChange={(v) => setDurationSec(v[0])}
                />
              </div>

              {showVolumeMix && (
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-xs font-medium">
                    <span className="flex items-center gap-1.5">
                      <Volume2 className="size-3.5" /> Volume da música no vídeo
                    </span>
                    <span className="text-muted-foreground tabular-nums">
                      {Math.round(volume * 100)}%
                    </span>
                  </div>
                  <Slider
                    min={0}
                    max={1}
                    step={0.05}
                    value={[volume]}
                    onValueChange={(v) => setVolume(v[0])}
                  />
                  <p className="text-[11px] text-muted-foreground">
                    O áudio original do vídeo fica mais alto quando a música está baixa.
                  </p>
                </div>
              )}

              <div className="rounded-lg bg-muted/40 px-3 py-2 text-[11px] text-muted-foreground">
                <p>
                  <strong className="text-foreground">{selectedTrack.source}</strong> · {selectedTrack.license}
                </p>
                {selectedTrack.source_url && (
                  <a
                    href={selectedTrack.source_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-primary hover:underline break-all"
                  >
                    Ver fonte original
                  </a>
                )}
              </div>
            </div>

            <div className="mt-auto sticky bottom-0 bg-background border-t p-3 flex gap-2">
              <Button variant="ghost" className="flex-1" onClick={() => onOpenChange(false)}>
                <X className="size-4 mr-1" /> Cancelar
              </Button>
              <Button className="flex-1" onClick={confirm}>
                <Check className="size-4 mr-1" /> Adicionar música
              </Button>
            </div>
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}
