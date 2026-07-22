import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowLeft,
  Heart,
  MessageCircle,
  Bookmark,
  Share2,
  Upload,
  Flame,
  Volume2,
  VolumeX,
  Play,
  Loader2,
} from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { useAuthGate } from "@/hooks/use-auth-gate";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { signWavetubeUrl, formatViews } from "@/lib/wavetube";
import { FollowButton } from "@/components/FollowButton";

export const Route = createFileRoute("/waveshorts")({
  component: WaveShortsPage,
  head: () => ({
    meta: [
      { title: "WaveShorts — Vídeos curtos 9:16 na WaveChat" },
      { name: "description", content: "Assista vídeos curtos verticais de criadores brasileiros no WaveShorts, dentro da WaveChat." },
      { property: "og:title", content: "WaveShorts — Vídeos curtos 9:16" },
      { property: "og:description", content: "Feed vertical de vídeos curtos da WaveChat." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
});

type Short = {
  id: string;
  owner_id: string;
  title: string;
  description: string | null;
  category: string | null;
  file_url: string;
  thumbnail_url: string | null;
  duration_sec: number | null;
  views_count: number | null;
  likes_count: number | null;
  comments_count: number | null;
  saves_count: number | null;
  cta_label: string | null;
  cta_url: string | null;
  allow_pix: boolean | null;
  pix_key: string | null;
  published_at: string | null;
  owner_username: string | null;
  owner_display_name: string | null;
  owner_avatar_url: string | null;
};

function WaveShortsPage() {
  const { user } = useAuth();
  const { gate } = useAuthGate();
  const [items, setItems] = useState<Short[]>([]);
  const [loading, setLoading] = useState(true);
  const [done, setDone] = useState(false);
  const [signed, setSigned] = useState<Record<string, string>>({});
  const [muted, setMuted] = useState(true);
  const [active, setActive] = useState(0);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const cursorRef = useRef<string | null>(null);

  const loadMore = useCallback(async () => {
    if (done) return;
    const { data } = await supabase.rpc("discover_waveshorts", {
      _cursor: cursorRef.current ?? undefined,
      _limit: 8,
    } as any);
    const rows = (data as Short[]) ?? [];
    if (rows.length === 0) setDone(true);
    else cursorRef.current = rows[rows.length - 1].published_at ?? null;
    setItems((prev) => {
      const seen = new Set(prev.map((r) => r.id));
      return [...prev, ...rows.filter((r) => !seen.has(r.id))];
    });
    setLoading(false);
  }, [done]);

  useEffect(() => {
    void loadMore();
  }, [loadMore]);

  // Sign URLs for visible items
  useEffect(() => {
    (async () => {
      const missing = items.filter((r) => r.file_url && !signed[r.id]);
      if (missing.length === 0) return;
      const entries = await Promise.all(
        missing.map(async (r) => [r.id, (await signWavetubeUrl(r.file_url)) ?? ""] as const),
      );
      setSigned((prev) => {
        const next = { ...prev };
        for (const [id, url] of entries) if (url) next[id] = url;
        return next;
      });
    })();
  }, [items]);

  // Track active card + infinite scroll
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (e.isIntersecting && e.intersectionRatio > 0.6) {
            const idx = Number((e.target as HTMLElement).dataset.idx);
            if (!Number.isNaN(idx)) setActive(idx);
          }
        }
      },
      { root: el, threshold: [0, 0.6, 1] },
    );
    for (const c of el.querySelectorAll<HTMLElement>("[data-idx]")) observer.observe(c);

    const onScroll = () => {
      if (el.scrollTop + el.clientHeight > el.scrollHeight - el.clientHeight * 1.5) {
        void loadMore();
      }
    };
    el.addEventListener("scroll", onScroll);
    return () => {
      observer.disconnect();
      el.removeEventListener("scroll", onScroll);
    };
  }, [items.length, loadMore]);

  return (
    <div className="fixed inset-0 bg-black text-white overflow-hidden">
      <header className="absolute top-0 inset-x-0 z-30 flex items-center gap-2 px-3 pt-[env(safe-area-inset-top)] pt-3 bg-gradient-to-b from-black/70 to-transparent">
        <Button asChild size="icon" variant="ghost" className="text-white hover:bg-white/10">
          <Link to="/"><ArrowLeft className="size-5" /></Link>
        </Button>
        <div className="flex items-center gap-2">
          <Flame className="size-5 text-pink-500" />
          <h1 className="text-base font-black tracking-tight">WaveShorts</h1>
        </div>
        <div className="ml-auto flex items-center gap-1">
          <Button
            size="icon"
            variant="ghost"
            className="text-white hover:bg-white/10"
            onClick={() => setMuted((m) => !m)}
            aria-label={muted ? "Ativar som" : "Silenciar"}
          >
            {muted ? <VolumeX className="size-5" /> : <Volume2 className="size-5" />}
          </Button>
          <Button
            size="sm"
            className="rounded-full bg-pink-500 hover:bg-pink-600 text-white"
            onClick={() => gate("default", () => (window.location.href = "/wavetube/upload?short=1"))}
          >
            <Upload className="size-4 mr-1.5" /> Enviar
          </Button>
        </div>
      </header>

      <div
        ref={containerRef}
        className="h-full w-full overflow-y-auto snap-y snap-mandatory scroll-smooth scrollbar-none"
        style={{ scrollbarWidth: "none" }}
      >
        {loading && items.length === 0 ? (
          <div className="h-full grid place-items-center">
            <Loader2 className="size-8 animate-spin text-white/60" />
          </div>
        ) : items.length === 0 ? (
          <EmptyState onUpload={() => gate("default", () => (window.location.href = "/wavetube/upload?short=1"))} />
        ) : (
          items.map((s, i) => (
            <ShortCard
              key={s.id}
              idx={i}
              short={s}
              src={signed[s.id]}
              active={active === i}
              muted={muted}
              onToggleMute={() => setMuted((m) => !m)}
              currentUserId={user?.id ?? null}
              onNeedAuth={(intent, run) => gate(intent, run)}
            />
          ))
        )}
        {!done && items.length > 0 && (
          <div className="h-24 grid place-items-center">
            <Loader2 className="size-6 animate-spin text-white/50" />
          </div>
        )}
      </div>
    </div>
  );
}

function EmptyState({ onUpload }: { onUpload: () => void }) {
  return (
    <div className="h-full grid place-items-center px-6 text-center">
      <div>
        <Flame className="size-14 mx-auto text-pink-500 mb-3" />
        <h2 className="text-2xl font-black">Ainda não há Shorts</h2>
        <p className="text-white/70 mt-2">Envie o primeiro vídeo vertical e viralize na WaveChat.</p>
        <Button
          onClick={onUpload}
          className="mt-6 rounded-full bg-pink-500 hover:bg-pink-600 text-white"
        >
          <Upload className="size-4 mr-1.5" /> Enviar meu Short
        </Button>
      </div>
    </div>
  );
}

function ShortCard({
  idx,
  short,
  src,
  active,
  muted,
  onToggleMute,
  currentUserId,
  onNeedAuth,
}: {
  idx: number;
  short: Short;
  src: string | undefined;
  active: boolean;
  muted: boolean;
  onToggleMute: () => void;
  currentUserId: string | null;
  onNeedAuth: (intent: any, run: () => void) => void;
}) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const [liked, setLiked] = useState(false);
  const [saved, setSaved] = useState(false);
  const [likes, setLikes] = useState(short.likes_count ?? 0);
  const [saves, setSaves] = useState(short.saves_count ?? 0);
  const [paused, setPaused] = useState(false);
  const [showComments, setShowComments] = useState(false);
  const viewedRef = useRef(false);

  // Load my reaction state
  useEffect(() => {
    if (!currentUserId) return;
    let alive = true;
    (async () => {
      const [{ data: r }, { data: s }] = await Promise.all([
        supabase
          .from("video_reactions")
          .select("kind")
          .eq("video_id", short.id)
          .eq("user_id", currentUserId)
          .maybeSingle(),
        supabase
          .from("video_saves")
          .select("video_id")
          .eq("video_id", short.id)
          .eq("user_id", currentUserId)
          .maybeSingle(),
      ]);
      if (!alive) return;
      setLiked(((r as any)?.kind ?? null) === "like");
      setSaved(!!s);
    })();
    return () => {
      alive = false;
    };
  }, [currentUserId, short.id]);

  // Autoplay when active
  useEffect(() => {
    const v = videoRef.current;
    if (!v) return;
    v.muted = muted;
    if (active && !paused) {
      const p = v.play();
      if (p && typeof p.catch === "function") p.catch(() => void 0);
      if (!viewedRef.current) {
        viewedRef.current = true;
        void supabase.from("video_views").insert({ video_id: short.id, viewer_id: currentUserId } as any);
      }
    } else {
      v.pause();
      if (!active) v.currentTime = 0;
    }
  }, [active, paused, muted, short.id, currentUserId]);

  const toggleLike = () => {
    onNeedAuth("default", async () => {
      if (!currentUserId) return;
      if (liked) {
        setLiked(false);
        setLikes((n) => Math.max(0, n - 1));
        await supabase
          .from("video_reactions")
          .delete()
          .eq("video_id", short.id)
          .eq("user_id", currentUserId);
      } else {
        setLiked(true);
        setLikes((n) => n + 1);
        await supabase
          .from("video_reactions")
          .upsert({ video_id: short.id, user_id: currentUserId, kind: "like" } as any);
      }
    });
  };

  const toggleSave = () => {
    onNeedAuth("default", async () => {
      if (!currentUserId) return;
      if (saved) {
        setSaved(false);
        setSaves((n) => Math.max(0, n - 1));
        await supabase
          .from("video_saves")
          .delete()
          .eq("video_id", short.id)
          .eq("user_id", currentUserId);
      } else {
        setSaved(true);
        setSaves((n) => n + 1);
        await supabase
          .from("video_saves")
          .insert({ video_id: short.id, user_id: currentUserId } as any);
        toast.success("Salvo");
      }
    });
  };

  const shareShort = async () => {
    const url = `${window.location.origin}/v/${short.id}`;
    const caption = `${short.title} — assista no WaveChat 🌊\n${url}`;
    try {
      if (navigator.share) {
        await navigator.share({ title: short.title, text: caption, url });
      } else {
        await navigator.clipboard.writeText(caption);
        toast.success("Link copiado com marca do WaveChat");
      }
    } catch {
      /* cancelled */
    }
  };

  const authorLabel =
    short.owner_display_name || (short.owner_username ? `@${short.owner_username}` : "usuário");

  return (
    <section
      data-idx={idx}
      className="relative h-[100dvh] w-full snap-start snap-always flex items-center justify-center bg-black"
    >
      {/* Video */}
      <div
        className="relative h-full w-full max-w-[520px] mx-auto"
        onClick={() => setPaused((p) => !p)}
      >
        {src ? (
          <video
            ref={videoRef}
            src={src.includes("#") ? src : `${src}#t=0.1`}
            poster={short.thumbnail_url ?? undefined}
            playsInline
            loop
            muted={muted}
            preload={active ? "auto" : "metadata"}
            autoPlay={active}
            className="h-full w-full object-contain bg-black"
          />
        ) : (
          <div className="h-full w-full grid place-items-center text-white/40">
            <Loader2 className="size-8 animate-spin" />
          </div>
        )}

        {paused && (
          <div className="absolute inset-0 grid place-items-center pointer-events-none">
            <div className="bg-black/50 rounded-full p-4">
              <Play className="size-10 text-white" fill="currentColor" />
            </div>
          </div>
        )}

        {/* Persistent WaveChat watermark */}
        <div className="absolute top-16 right-3 select-none pointer-events-none">
          <div className="text-[11px] font-black tracking-wider text-white/85 drop-shadow-[0_1px_2px_rgba(0,0,0,0.8)] bg-black/25 backdrop-blur-sm rounded-full px-2 py-0.5">
            🌊 WaveChat
          </div>
        </div>

        {/* Bottom gradient + author/caption */}
        <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/85 via-black/40 to-transparent pt-16 pb-6 px-4">
          <div className="flex items-center gap-2 mb-2" onClick={(e) => e.stopPropagation()}>
            <Link
              to="/u/$username"
              params={{ username: short.owner_username ?? "" }}
              className="flex items-center gap-2 min-w-0 flex-1"
            >
              <Avatar className="size-9 ring-2 ring-white/70">
                <AvatarImage src={short.owner_avatar_url ?? undefined} />
                <AvatarFallback>{authorLabel.charAt(0).toUpperCase()}</AvatarFallback>
              </Avatar>
              <div className="min-w-0">
                <p className="text-sm font-bold truncate">{authorLabel}</p>
                {short.owner_username && (
                  <p className="text-[11px] text-white/70 truncate">@{short.owner_username}</p>
                )}
              </div>
            </Link>
            <FollowButton
              targetUserId={short.owner_id}
              size="sm"
              className="rounded-full h-8 px-3 bg-white text-black hover:bg-white/90"
              variant="default"
            />
          </div>
          <p className="text-sm font-semibold leading-snug line-clamp-3">{short.title}</p>
          {short.description && (
            <p className="text-xs text-white/80 mt-1 line-clamp-2">{short.description}</p>
          )}
          {short.cta_label && short.cta_url && (
            <a
              href={short.cta_url}
              target="_blank"
              rel="noopener noreferrer"
              onClick={(e) => e.stopPropagation()}
              className="inline-flex mt-3 items-center gap-1.5 rounded-full bg-white/95 text-black text-xs font-bold px-3 py-1.5 hover:bg-white"
            >
              {short.cta_label} →
            </a>
          )}
        </div>

        {/* Right action rail */}
        <div className="absolute right-2 bottom-28 flex flex-col items-center gap-4 pr-1">
          <ActionButton
            onClick={(e) => {
              e.stopPropagation();
              toggleLike();
            }}
            active={liked}
            icon={<Heart className={`size-7 ${liked ? "fill-pink-500 text-pink-500" : ""}`} />}
            label={formatViews(likes)}
          />
          <ActionButton
            onClick={(e) => {
              e.stopPropagation();
              setShowComments(true);
            }}
            icon={<MessageCircle className="size-7" />}
            label={formatViews(short.comments_count ?? 0)}
          />
          <ActionButton
            onClick={(e) => {
              e.stopPropagation();
              toggleSave();
            }}
            active={saved}
            icon={<Bookmark className={`size-7 ${saved ? "fill-yellow-400 text-yellow-400" : ""}`} />}
            label={formatViews(saves)}
          />
          <ActionButton
            onClick={(e) => {
              e.stopPropagation();
              void shareShort();
            }}
            icon={<Share2 className="size-7" />}
            label="Enviar"
          />
          <button
            onClick={(e) => {
              e.stopPropagation();
              onToggleMute();
            }}
            className="text-white/90 mt-1"
            aria-label={muted ? "Ativar som" : "Silenciar"}
          >
            {muted ? <VolumeX className="size-6" /> : <Volume2 className="size-6" />}
          </button>
        </div>
      </div>

      {showComments && (
        <div
          className="absolute inset-0 z-40 bg-black/60 flex items-end"
          onClick={() => setShowComments(false)}
        >
          <div
            className="w-full max-h-[70%] bg-background text-foreground rounded-t-2xl flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-3 border-b border-border flex items-center justify-between">
              <p className="font-bold">Comentários</p>
              <Button asChild size="sm" variant="ghost">
                <Link to="/v/$videoId" params={{ videoId: short.id }}>Abrir vídeo</Link>
              </Button>
            </div>
            <div className="p-4 text-sm text-muted-foreground">
              Abra o vídeo para comentar, responder e reagir aos comentários com toda a experiência.
            </div>
          </div>
        </div>
      )}
    </section>
  );
}

function ActionButton({
  onClick,
  icon,
  label,
  active,
}: {
  onClick: (e: React.MouseEvent) => void;
  icon: React.ReactNode;
  label: string;
  active?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      className={`flex flex-col items-center gap-0.5 text-white ${active ? "" : "opacity-95"}`}
    >
      <span className="drop-shadow-[0_1px_2px_rgba(0,0,0,0.7)]">{icon}</span>
      <span className="text-[11px] font-semibold drop-shadow-[0_1px_2px_rgba(0,0,0,0.7)]">{label}</span>
    </button>
  );
}
