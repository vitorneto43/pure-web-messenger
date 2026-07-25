import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { ArrowLeft, Loader2, Radio, Eye, Plus, Coins } from "lucide-react";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { getEcosystemBySlug, getMyRole, type Ecosystem, type EcosystemRole } from "@/lib/ecosystems";
import { getActiveLives } from "@/lib/live.functions";
import { useAuth } from "@/hooks/use-auth";

export const Route = createFileRoute("/e/$slug/live")({
  component: EcosystemLivePage,
  head: () => ({
    meta: [
      { title: "Lives — Ecossistema Wavechat" },
      { name: "description", content: "Assista lives ao vivo dentro do ecossistema." },
      { name: "robots", content: "noindex" },
    ],
  }),
});

function EcosystemLivePage() {
  const { slug } = Route.useParams();
  const { user } = useAuth();
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
        <p className="text-sm text-muted-foreground">Você precisa fazer parte do ecossistema para ver as lives.</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-10 bg-background/95 backdrop-blur border-b border-border">
        <div className="max-w-[640px] mx-auto px-3 py-3 flex items-center gap-2">
          <Button asChild size="icon" variant="ghost">
            <Link to="/e/$slug" params={{ slug }}><ArrowLeft className="size-5" /></Link>
          </Button>
          <div className="flex items-center gap-2">
            <Radio className="size-6 text-red-600" />
            <h1 className="text-lg font-bold truncate">Lives em {eco.name}</h1>
          </div>
          <Button asChild size="sm" className="ml-auto rounded-full bg-red-600 hover:bg-red-700 text-white">
            <Link to="/live/new"> <Plus className="size-4 mr-1" /> Nova live</Link>
          </Button>
        </div>
      </header>

      <main className="max-w-[640px] mx-auto px-3 py-4">
        <LiveGrid ecosystemId={eco.id} />
      </main>
    </div>
  );
}

function LiveGrid({ ecosystemId }: { ecosystemId: string }) {
  const fetchActiveLives = useServerFn(getActiveLives);
  const { data: lives = [], isLoading } = useQuery({
    queryKey: ["ecosystem-lives", ecosystemId],
    queryFn: () => fetchActiveLives({ data: { ecosystemId } }),
    refetchInterval: 30_000,
  });

  if (isLoading) {
    return (
      <div className="grid place-items-center py-20">
        <Loader2 className="size-6 animate-spin text-muted-foreground" />
      </div>
    );
  }
  if (lives.length === 0) {
    return (
      <div className="text-center py-20 text-muted-foreground rounded-2xl border border-border bg-card">
        <Radio className="size-12 mx-auto mb-3 opacity-40" />
        <p className="font-medium">Ninguém está ao vivo agora.</p>
        <p className="text-sm">Seja o primeiro a transmitir para este ecossistema!</p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
      {lives.map((l) => {
        const name = l.host?.display_name || l.host?.username || "Host";
        return (
          <Link
            key={l.id}
            to="/live/$liveId"
            params={{ liveId: l.id }}
            className="relative aspect-[3/4] rounded-xl overflow-hidden bg-muted group"
          >
            {(l.cover_url || l.host?.avatar_url) ? (
              <img
                src={l.cover_url || l.host?.avatar_url || undefined}
                alt={l.title ?? "Ao vivo"}
                className="absolute inset-0 w-full h-full object-cover group-hover:scale-105 transition"
              />
            ) : (
              <div className="absolute inset-0 bg-gradient-to-br from-pink-500 to-yellow-500" />
            )}
            <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/0 to-black/40" />
            <span className="absolute top-2 left-2 bg-red-600 text-white text-[10px] font-bold px-1.5 py-0.5 rounded">AO VIVO</span>
            <span className="absolute top-2 right-2 flex items-center gap-1 text-white text-xs bg-black/50 backdrop-blur px-1.5 py-0.5 rounded-full">
              <Eye className="size-3" /> {l.viewer_count ?? 0}
            </span>
            <div className="absolute bottom-2 left-2 right-2 text-white">
              <div className="flex items-center gap-2 mb-1">
                <Avatar className="size-6 border border-white/30">
                  <AvatarImage src={l.host?.avatar_url ?? undefined} />
                  <AvatarFallback className="bg-secondary text-[10px]">{name[0]?.toUpperCase()}</AvatarFallback>
                </Avatar>
                <p className="text-xs font-semibold truncate">{name}</p>
              </div>
              <p className="text-[11px] opacity-90 truncate">{l.title || "Ao vivo"}</p>
              {(l.total_gift_coins ?? 0) > 0 && (
                <p className="text-[10px] flex items-center gap-0.5 opacity-90 mt-0.5">
                  <Coins className="size-3 text-yellow-400" /> {l.total_gift_coins ?? 0}
                </p>
              )}
            </div>
          </Link>
        );
      })}
    </div>
  );
}
