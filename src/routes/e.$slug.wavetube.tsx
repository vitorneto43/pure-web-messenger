import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { ArrowLeft, Search, Upload, PlaySquare, BarChart3, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { useAuthGate } from "@/hooks/use-auth-gate";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { optimizeAvatarUrl } from "@/lib/avatar-optimize";
import { WAVETUBE_CATEGORIES, formatDuration, formatViews, signWavetubeUrl } from "@/lib/wavetube";
import { getEcosystemBySlug, getMyRole, type Ecosystem, type EcosystemRole } from "@/lib/ecosystems";

export const Route = createFileRoute("/e/$slug/wavetube")({
  component: EcosystemWaveTube,
  head: () => ({
    meta: [
      { title: "WaveTube — Ecossistema Wavechat" },
      { name: "description", content: "Vídeos do ecossistema." },
      { name: "robots", content: "noindex" },
    ],
  }),
});

type Row = {
  id: string;
  owner_id: string;
  title: string;
  description: string | null;
  category: string | null;
  thumbnail_url: string | null;
  duration_sec: number | null;
  views_count: number | null;
  likes_count: number | null;
  published_at: string | null;
  owner_username: string | null;
  owner_display_name: string | null;
  owner_avatar_url: string | null;
};

function EcosystemWaveTube() {
  const { slug } = Route.useParams();
  const { user } = useAuth();
  const { gate } = useAuthGate();
  const [eco, setEco] = useState<Ecosystem | null | undefined>(undefined);
  const [role, setRole] = useState<EcosystemRole | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const e = await getEcosystemBySlug(slug);
        setEco(e);
        if (e && user) setRole(await getMyRole(e.id));
      } catch {
        setEco(null);
      }
    })();
  }, [slug, user?.id]);

  if (eco === undefined) {
    return (
      <div className="min-h-screen grid place-items-center">
        <Loader2 className="size-6 animate-spin text-muted-foreground" />
      </div>
    );
  }
  if (!eco) {
    return (
      <div className="min-h-screen grid place-items-center text-center p-6">
        <p className="text-sm text-muted-foreground">Ecossistema não encontrado.</p>
      </div>
    );
  }
  if (!role) {
    return (
      <div className="min-h-screen grid place-items-center text-center p-6">
        <p className="text-sm text-muted-foreground">Você precisa fazer parte do ecossistema para ver os vídeos.</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="sticky top-0 z-30 bg-background/95 backdrop-blur border-b border-border">
        <div className="max-w-[640px] mx-auto px-3 py-3 flex items-center gap-2">
          <Button asChild size="icon" variant="ghost">
            <Link to="/e/$slug" params={{ slug }}><ArrowLeft className="size-5" /></Link>
          </Button>
          <div className="flex items-center gap-2 mr-2">
            <PlaySquare className="size-6 text-red-600" />
            <h1 className="text-lg font-bold truncate">WaveTube em {eco.name}</h1>
          </div>
          <div className="ml-auto flex items-center gap-2">
            {user && (
              <Button asChild size="sm" variant="ghost" className="rounded-full hidden sm:inline-flex">
                <Link to="/wavetube/analytics"><BarChart3 className="size-4 mr-1.5" /> Métricas</Link>
              </Button>
            )}
            <Button
              size="sm"
              variant="secondary"
              onClick={() => gate("default", () => (window.location.href = "/wavetube/upload"))}
              className="rounded-full"
            >
              <Upload className="size-4 mr-1.5" /> Enviar
            </Button>
          </div>
        </div>
      </header>

      <main className="max-w-[640px] mx-auto px-3 py-4">
        <VideoGrid ecosystemId={eco.id} />
      </main>
    </div>
  );
}

function VideoGrid({ ecosystemId }: { ecosystemId: string }) {
  const [sort, setSort] = useState<"recent" | "trending">("recent");
  const [category, setCategory] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [thumbs, setThumbs] = useState<Record<string, string>>({});

  useEffect(() => {
    let alive = true;
    setLoading(true);
    (async () => {
      const { data } = await supabase.rpc("discover_wavetube_videos", {
        _sort: sort,
        _category: category ?? undefined,
        _search: search.trim() || undefined,
        _limit: 48,
        _offset: 0,
        _ecosystem_id: ecosystemId,
      } as any);
      if (!alive) return;
      setRows((data as Row[]) ?? []);
      setLoading(false);
    })();
    return () => { alive = false; };
  }, [sort, category, search, ecosystemId]);

  useEffect(() => {
    (async () => {
      const missing = rows.filter((r) => r.thumbnail_url && !thumbs[r.id]);
      if (missing.length === 0) return;
      const entries = await Promise.all(
        missing.map(async (r) => [r.id, (await signWavetubeUrl(r.thumbnail_url)) ?? ""] as const),
      );
      setThumbs((prev) => {
        const next = { ...prev };
        for (const [id, url] of entries) if (url) next[id] = url;
        return next;
      });
    })();
  }, [rows]);

  const cats = useMemo(() => [{ value: null as string | null, label: "Todos" }, ...WAVETUBE_CATEGORIES.map((c) => ({ value: c.value as string | null, label: c.label }))], []);

  return (
    <div>
      <div className="relative mb-3">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Buscar vídeos no ecossistema..."
          className="pl-9 rounded-full"
        />
      </div>
      <div className="flex gap-2 overflow-x-auto pb-2 mb-2">
        <button onClick={() => setSort("recent")} className={`shrink-0 px-3 py-1 rounded-full text-xs font-medium border ${sort === "recent" ? "bg-foreground text-background" : "bg-muted"}`}>Recentes</button>
        <button onClick={() => setSort("trending")} className={`shrink-0 px-3 py-1 rounded-full text-xs font-medium border ${sort === "trending" ? "bg-foreground text-background" : "bg-muted"}`}>Em alta</button>
        <span className="w-px bg-border mx-1" />
        {cats.map((c) => (
          <button key={String(c.value)} onClick={() => setCategory(c.value)} className={`shrink-0 px-3 py-1 rounded-full text-xs font-medium border ${category === c.value ? "bg-foreground text-background" : "bg-muted"}`}>
            {c.label}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="animate-pulse">
              <div className="aspect-video bg-muted rounded-xl" />
              <div className="mt-2 h-4 bg-muted rounded w-3/4" />
            </div>
          ))}
        </div>
      ) : rows.length === 0 ? (
        <div className="text-center py-20 text-muted-foreground rounded-2xl border border-border bg-card">
          <PlaySquare className="size-12 mx-auto mb-3 opacity-40" />
          <p className="font-medium">Ainda não há vídeos aqui.</p>
          <p className="text-sm">Seja o primeiro a publicar!</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {rows.map((r) => (
            <Link key={r.id} to="/v/$videoId" params={{ videoId: r.id }} className="group">
              <div className="relative aspect-video bg-muted rounded-xl overflow-hidden">
                {thumbs[r.id] ? (
                  <img src={thumbs[r.id]} alt={r.title} className="w-full h-full object-cover group-hover:scale-[1.02] transition-transform" loading="lazy" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-muted-foreground"><PlaySquare className="size-10 opacity-40" /></div>
                )}
                {r.duration_sec ? (
                  <span className="absolute bottom-1.5 right-1.5 text-[11px] font-semibold bg-black/80 text-white px-1.5 py-0.5 rounded">{formatDuration(r.duration_sec)}</span>
                ) : null}
              </div>
              <div className="mt-2 flex gap-2">
                <Avatar className="size-8 shrink-0">
                  <AvatarImage src={optimizeAvatarUrl(r.owner_avatar_url ?? undefined, 64)} />
                  <AvatarFallback>{(r.owner_display_name || r.owner_username || "?").charAt(0).toUpperCase()}</AvatarFallback>
                </Avatar>
                <div className="min-w-0">
                  <p className="text-sm font-semibold line-clamp-2 leading-tight">{r.title}</p>
                  <p className="text-xs text-muted-foreground truncate">{r.owner_display_name || `@${r.owner_username ?? "usuario"}`}</p>
                  <p className="text-xs text-muted-foreground">{formatViews(r.views_count)} visualizações · {r.published_at ? new Date(r.published_at).toLocaleDateString("pt-BR") : ""}</p>
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
