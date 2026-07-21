import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { ArrowLeft, BarChart3, Eye, ThumbsUp, ThumbsDown, MessageCircle, PlaySquare, Flame, TrendingUp, Users } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { formatViews, formatDuration } from "@/lib/wavetube";

export const Route = createFileRoute("/_authenticated/wavetube/analytics")({
  component: CreatorAnalyticsPage,
  head: () => ({
    meta: [
      { title: "Métricas do Criador — WaveTube" },
      { name: "description", content: "Acompanhe visualizações, curtidas, comentários e engajamento dos seus vídeos e Shorts na WaveChat." },
      { name: "robots", content: "noindex" },
    ],
  }),
});

type VideoRow = {
  id: string;
  title: string;
  thumbnail_url: string | null;
  published_at: string | null;
  created_at: string;
  duration_sec: number | null;
  is_short: boolean | null;
  visibility: string;
  status: string;
  views_count: number;
  likes_count: number;
  dislikes_count: number;
  comments_count: number;
  saves_count: number | null;
};

type ViewRow = { video_id: string; watched_seconds: number | null; viewer_id: string | null; created_at: string };

function CreatorAnalyticsPage() {
  const { user } = useAuth();
  const [videos, setVideos] = useState<VideoRow[]>([]);
  const [views, setViews] = useState<ViewRow[]>([]);
  const [followers, setFollowers] = useState<number>(0);
  const [loading, setLoading] = useState(true);
  const [range, setRange] = useState<7 | 30 | 90>(30);

  useEffect(() => {
    if (!user) return;
    let alive = true;
    (async () => {
      setLoading(true);
      const since = new Date(Date.now() - range * 86400_000).toISOString();
      const [vids, vws, fol] = await Promise.all([
        supabase
          .from("videos")
          .select("id, title, thumbnail_url, published_at, created_at, duration_sec, is_short, visibility, status, views_count, likes_count, dislikes_count, comments_count, saves_count")
          .eq("owner_id", user.id)
          .order("created_at", { ascending: false })
          .limit(200),
        supabase
          .from("video_views")
          .select("video_id, watched_seconds, viewer_id, created_at")
          .gte("created_at", since)
          .limit(10000),
        supabase
          .from("profile_follows")
          .select("follower_id", { count: "exact", head: true })
          .eq("following_id", user.id),
      ]);
      if (!alive) return;
      setVideos((vids.data as VideoRow[]) ?? []);
      setViews((vws.data as ViewRow[]) ?? []);
      setFollowers(fol.count ?? 0);
      setLoading(false);
    })();
    return () => {
      alive = false;
    };
  }, [user?.id, range]);

  const stats = useMemo(() => {
    const byVideo = new Map<string, { views: number; watch: number; unique: Set<string> }>();
    for (const v of views) {
      const b = byVideo.get(v.video_id) ?? { views: 0, watch: 0, unique: new Set<string>() };
      b.views += 1;
      b.watch += v.watched_seconds ?? 0;
      if (v.viewer_id) b.unique.add(v.viewer_id);
      byVideo.set(v.video_id, b);
    }
    const totals = videos.reduce(
      (acc, v) => {
        acc.videos += 1;
        acc.views += v.views_count ?? 0;
        acc.likes += v.likes_count ?? 0;
        acc.comments += v.comments_count ?? 0;
        acc.saves += v.saves_count ?? 0;
        acc.shorts += v.is_short ? 1 : 0;
        return acc;
      },
      { videos: 0, views: 0, likes: 0, comments: 0, saves: 0, shorts: 0 },
    );
    const rangeViews = Array.from(byVideo.values()).reduce((s, b) => s + b.views, 0);
    const uniqueViewers = new Set<string>();
    for (const b of byVideo.values()) for (const u of b.unique) uniqueViewers.add(u);
    return { byVideo, totals, rangeViews, uniqueViewers: uniqueViewers.size };
  }, [videos, views]);

  const enriched = useMemo(() => {
    return videos
      .map((v) => {
        const b = stats.byVideo.get(v.id);
        const rangeV = b?.views ?? 0;
        const avgWatch = b && b.views > 0 ? Math.round(b.watch / b.views) : 0;
        const engagement =
          (v.views_count ?? 0) > 0
            ? Math.round((((v.likes_count ?? 0) + (v.comments_count ?? 0) + (v.saves_count ?? 0)) / v.views_count) * 1000) / 10
            : 0;
        return { ...v, range_views: rangeV, avg_watch_sec: avgWatch, engagement_pct: engagement };
      })
      .sort((a, b) => (b.range_views - a.range_views) || ((b.views_count ?? 0) - (a.views_count ?? 0)));
  }, [videos, stats]);

  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="sticky top-0 z-30 bg-background/95 backdrop-blur border-b border-border">
        <div className="max-w-5xl mx-auto px-3 py-3 flex items-center gap-2">
          <Button asChild size="icon" variant="ghost">
            <Link to="/wavetube"><ArrowLeft className="size-5" /></Link>
          </Button>
          <BarChart3 className="size-6 text-red-600" />
          <h1 className="text-lg font-bold">Métricas do Criador</h1>
          <div className="ml-auto flex items-center gap-1">
            {([7, 30, 90] as const).map((r) => (
              <button
                key={r}
                onClick={() => setRange(r)}
                className={`px-3 py-1 rounded-full text-xs font-semibold border ${range === r ? "bg-foreground text-background" : "bg-muted"}`}
              >
                {r}d
              </button>
            ))}
          </div>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-3 py-4">
        <section className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
          <KpiCard icon={<Eye className="size-4" />} label={`Views (${range}d)`} value={formatViews(stats.rangeViews)} />
          <KpiCard icon={<Users className="size-4" />} label={`Espectadores únicos (${range}d)`} value={formatViews(stats.uniqueViewers)} />
          <KpiCard icon={<TrendingUp className="size-4" />} label="Views totais" value={formatViews(stats.totals.views)} />
          <KpiCard icon={<Users className="size-4" />} label="Seguidores" value={formatViews(followers)} />
          <KpiCard icon={<PlaySquare className="size-4" />} label="Vídeos publicados" value={String(stats.totals.videos)} />
          <KpiCard icon={<Flame className="size-4 text-pink-500" />} label="WaveShorts" value={String(stats.totals.shorts)} />
          <KpiCard icon={<ThumbsUp className="size-4" />} label="Curtidas" value={formatViews(stats.totals.likes)} />
          <KpiCard icon={<MessageCircle className="size-4" />} label="Comentários" value={formatViews(stats.totals.comments)} />
        </section>

        <h2 className="text-base font-bold mb-2 flex items-center gap-2">
          <BarChart3 className="size-4" /> Desempenho por vídeo
        </h2>

        {loading ? (
          <div className="space-y-2">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="h-20 bg-muted rounded-xl animate-pulse" />
            ))}
          </div>
        ) : enriched.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground border border-dashed border-border rounded-xl">
            <PlaySquare className="size-10 mx-auto mb-2 opacity-40" />
            <p className="font-medium">Você ainda não publicou vídeos.</p>
            <Button asChild className="mt-4 rounded-full bg-red-600 hover:bg-red-700 text-white">
              <Link to="/wavetube/upload">Enviar meu primeiro vídeo</Link>
            </Button>
          </div>
        ) : (
          <ul className="space-y-2">
            {enriched.map((v) => (
              <li key={v.id} className="rounded-xl border border-border bg-card p-3 flex gap-3 items-center">
                <Link to="/v/$videoId" params={{ videoId: v.id }} className="shrink-0 relative">
                  <div className={`bg-muted rounded-lg overflow-hidden ${v.is_short ? "w-14 h-24" : "w-24 h-14"}`}>
                    {v.thumbnail_url ? (
                      <div className="w-full h-full bg-cover bg-center" style={{ backgroundImage: `url(${v.thumbnail_url})` }} />
                    ) : (
                      <div className="w-full h-full grid place-items-center text-muted-foreground">
                        {v.is_short ? <Flame className="size-5 text-pink-500" /> : <PlaySquare className="size-5" />}
                      </div>
                    )}
                  </div>
                  {v.duration_sec ? (
                    <span className="absolute bottom-0.5 right-0.5 text-[10px] font-bold bg-black/80 text-white px-1 rounded">
                      {formatDuration(v.duration_sec)}
                    </span>
                  ) : null}
                </Link>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <Link to="/v/$videoId" params={{ videoId: v.id }} className="text-sm font-semibold truncate hover:underline">
                      {v.title}
                    </Link>
                    {v.is_short && <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-pink-500/15 text-pink-500">SHORT</span>}
                    {v.status !== "ready" && <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-muted text-muted-foreground uppercase">{v.status}</span>}
                    {v.visibility !== "public" && <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-muted text-muted-foreground uppercase">{v.visibility}</span>}
                  </div>
                  <p className="text-[11px] text-muted-foreground mt-0.5">
                    {v.published_at ? new Date(v.published_at).toLocaleDateString("pt-BR") : "não publicado"}
                  </p>
                  <div className="mt-1.5 flex flex-wrap gap-x-3 gap-y-1 text-xs text-muted-foreground">
                    <span className="inline-flex items-center gap-1"><Eye className="size-3.5" /> {formatViews(v.views_count)} <span className="opacity-60">({formatViews(v.range_views)} em {range}d)</span></span>
                    <span className="inline-flex items-center gap-1"><ThumbsUp className="size-3.5" /> {formatViews(v.likes_count)}</span>
                    <span className="inline-flex items-center gap-1"><ThumbsDown className="size-3.5" /> {formatViews(v.dislikes_count)}</span>
                    <span className="inline-flex items-center gap-1"><MessageCircle className="size-3.5" /> {formatViews(v.comments_count)}</span>
                    {v.avg_watch_sec > 0 && <span>⏱ {formatDuration(v.avg_watch_sec)} médio</span>}
                    <span className="font-semibold text-foreground">Engajamento {v.engagement_pct}%</span>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}

        <p className="mt-6 text-xs text-muted-foreground">
          Os dados de espectadores únicos e tempo médio consideram apenas os últimos {range} dias. Views totais, curtidas e comentários são cumulativos desde a publicação.
        </p>
      </main>
    </div>
  );
}

function KpiCard({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="rounded-xl border border-border bg-card p-3">
      <div className="flex items-center gap-1.5 text-xs text-muted-foreground">{icon}<span>{label}</span></div>
      <p className="mt-1 text-xl font-black">{value}</p>
    </div>
  );
}
