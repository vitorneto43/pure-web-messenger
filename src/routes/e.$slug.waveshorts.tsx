import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { ArrowLeft, Loader2, Flame, Upload } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { useAuthGate } from "@/hooks/use-auth-gate";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { optimizeAvatarUrl } from "@/lib/avatar-optimize";
import { signWavetubeUrl, formatViews } from "@/lib/wavetube";
import { getEcosystemBySlug, getMyRole, type Ecosystem, type EcosystemRole } from "@/lib/ecosystems";
import { FollowButton } from "@/components/FollowButton";

export const Route = createFileRoute("/e/$slug/waveshorts")({
  component: EcosystemWaveShorts,
  head: () => ({
    meta: [
      { title: "WaveShorts — Ecossistema Wavechat" },
      { name: "description", content: "Vídeos curtos do ecossistema." },
      { name: "robots", content: "noindex" },
    ],
  }),
});

type Short = {
  id: string;
  owner_id: string;
  title: string;
  thumbnail_url: string | null;
  file_url: string;
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

function EcosystemWaveShorts() {
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
        <p className="text-sm text-muted-foreground">Você precisa fazer parte do ecossistema para ver os Shorts.</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-30 bg-background/95 backdrop-blur border-b border-border">
        <div className="max-w-[640px] mx-auto px-3 py-3 flex items-center gap-2">
          <Button asChild size="icon" variant="ghost">
            <Link to="/e/$slug" params={{ slug }}><ArrowLeft className="size-5" /></Link>
          </Button>
          <div className="flex items-center gap-2">
            <Flame className="size-6 text-pink-500" />
            <h1 className="text-lg font-bold truncate">WaveShorts em {eco.name}</h1>
          </div>
          <Button
            size="sm"
            className="ml-auto rounded-full bg-pink-500 hover:bg-pink-600 text-white"
            onClick={() => gate("default", () => (window.location.href = "/wavetube/upload?short=1"))}
          >
            <Upload className="size-4 mr-1.5" /> Enviar
          </Button>
        </div>
      </header>

      <main className="max-w-[640px] mx-auto px-3 py-4">
        <ShortGrid ecosystemId={eco.id} />
      </main>
    </div>
  );
}

function ShortGrid({ ecosystemId }: { ecosystemId: string }) {
  const [items, setItems] = useState<Short[]>([]);
  const [loading, setLoading] = useState(true);
  const [thumbs, setThumbs] = useState<Record<string, string>>({});
  const { user } = useAuth();

  useEffect(() => {
    let alive = true;
    setLoading(true);
    (async () => {
      const { data } = await supabase.rpc("discover_waveshorts", {
        _limit: 48,
        _ecosystem_id: ecosystemId,
      } as any);
      if (!alive) return;
      setItems((data as Short[]) ?? []);
      setLoading(false);
    })();
    return () => { alive = false; };
  }, [ecosystemId]);

  useEffect(() => {
    (async () => {
      const missing = items.filter((r) => r.thumbnail_url && !thumbs[r.id]);
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
  }, [items]);

  if (loading) {
    return (
      <div className="grid place-items-center py-20">
        <Loader2 className="size-6 animate-spin text-muted-foreground" />
      </div>
    );
  }
  if (items.length === 0) {
    return (
      <div className="text-center py-20 text-muted-foreground rounded-2xl border border-border bg-card">
        <Flame className="size-12 mx-auto mb-3 opacity-40" />
        <p className="font-medium">Ainda não há Shorts aqui.</p>
        <p className="text-sm">Seja o primeiro a enviar!</p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
      {items.map((s) => (
        <Link key={s.id} to="/v/$videoId" params={{ videoId: s.id }} search={{ short: "1" }} className="group relative aspect-[9/16] rounded-xl overflow-hidden bg-muted">
          {thumbs[s.id] ? (
            <img src={thumbs[s.id]} alt={s.title} className="absolute inset-0 w-full h-full object-cover group-hover:scale-105 transition" />
          ) : (
            <div className="absolute inset-0 flex items-center justify-center text-muted-foreground"><Flame className="size-10 opacity-40" /></div>
          )}
          <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-transparent" />
          <div className="absolute bottom-2 left-2 right-2 text-white">
            <p className="text-xs font-semibold line-clamp-2">{s.title}</p>
            <div className="flex items-center justify-between mt-1">
              <div className="flex items-center gap-1.5">
                <Avatar className="size-5 border border-white/30">
                  <AvatarImage src={optimizeAvatarUrl(s.owner_avatar_url ?? undefined, 10)} />
                  <AvatarFallback className="text-[8px] bg-black/50">{(s.owner_display_name || s.owner_username || "?").charAt(0).toUpperCase()}</AvatarFallback>
                </Avatar>
                <span className="text-[10px] truncate">{s.owner_display_name || s.owner_username || "Criador"}</span>
              </div>
              <span className="text-[10px]">{formatViews(s.views_count)}</span>
            </div>
          </div>
          {user && user.id !== s.owner_id && (
            <div className="absolute top-2 right-2">
              <FollowButton targetUserId={s.owner_id} size="sm" variant="secondary" />
            </div>
          )}
        </Link>
      ))}
    </div>
  );
}
