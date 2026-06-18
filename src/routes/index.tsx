import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Loader2, MessageCircle, Phone, Heart, Users, Globe, Sparkles, ArrowRight, Zap, Shield, Star, Radio, Eye, Coins, FileText, Monitor } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useAuth } from "@/hooks/use-auth";
import { getRecommendedProfilesPublic, type PublicProfile } from "@/lib/public-discover.functions";
import { discoverGroupsPublic, type PublicGroup, type GroupCategory } from "@/lib/groups.functions";
import { getActiveLives } from "@/lib/live.functions";
import { supabase } from "@/integrations/supabase/client";
import { track } from "@/lib/track";
import wavechatLogo from "@/assets/wavechat-logo.png.asset.json";
import type { PostItem } from "@/components/posts/PostCard";

const CATEGORY_LABEL: Record<GroupCategory, string> = {
  business: "Negócios", tech: "Tecnologia", games: "Games", music: "Música",
  entertainment: "Entretenimento", relationships: "Relacionamentos",
  travel: "Viagens", sports: "Esportes", education: "Educação", other: "Outros",
};

export const Route = createFileRoute("/")({
  component: LandingPage,
  head: () => ({
    meta: [
      { title: "WaveChat — Conecte-se e Converse" },
      { name: "description", content: "WaveChat é o melhor lugar para conversar, fazer chamadas e conhecer pessoas. Grupos, stories, e muito mais." },
      { property: "og:title", content: "WaveChat — Conecte-se e Converse" },
      { property: "og:description", content: "Entre agora e descubra pessoas, grupos e conversas ao vivo." },
    ],
  }),
});

function LandingPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [profiles, setProfiles] = useState<PublicProfile[] | null>(null);
  const [groups, setGroups] = useState<PublicGroup[] | null>(null);
  const [lives, setLives] = useState<Awaited<ReturnType<typeof getActiveLives>>>([]);
  const [posts, setPosts] = useState<PostItem[]>([]);
  const [loadingLives, setLoadingLives] = useState(true);
  const [loadingPosts, setLoadingPosts] = useState(true);

  useEffect(() => {
    if (user) {
      navigate({ to: "/chat" });
      return;
    }
    void track("landing_page_view");
    getRecommendedProfilesPublic({ data: { limit: 12 } })
      .then((r) => setProfiles(r.profiles))
      .catch(() => setProfiles([]));
    discoverGroupsPublic({ data: { sort: "popular", limit: 8 } })
      .then((r) => setGroups(r.groups))
      .catch(() => setGroups([]));
    getActiveLives()
      .then((r) => { setLives(r); setLoadingLives(false); })
      .catch(() => setLoadingLives(false));
    (supabase as any).rpc("discover_public_posts", { _limit: 6, _offset: 0 })
      .then(({ data, error }: { data: PostItem[] | null; error: any }) => {
        if (!error) setPosts(data ?? []);
        setLoadingPosts(false);
      })
      .catch(() => setLoadingPosts(false));
  }, [user, navigate]);


  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="sticky top-0 z-50 bg-background/90 backdrop-blur border-b border-border">
        <div className="mx-auto max-w-4xl flex items-center justify-between px-4 py-3">
          <Link to="/" className="flex items-center gap-2">
            <img src={wavechatLogo.url} alt="WaveChat" className="size-8 rounded-lg" />
            <span className="font-bold text-lg">WaveChat</span>
          </Link>
          <div className="flex items-center gap-2">
            <Button size="sm" variant="ghost" onClick={() => navigate({ to: "/auth" })}>Entrar</Button>
            <Button size="sm" onClick={() => navigate({ to: "/auth" })}>Criar conta</Button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-4xl px-4 py-8 space-y-10">
        {/* Hero */}
        <section className="text-center space-y-5 py-8">
          <div className="mx-auto size-20 rounded-2xl bg-gradient-to-br from-primary to-accent grid place-items-center shadow-xl">
            <MessageCircle className="size-10 text-primary-foreground" />
          </div>
          <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight">
            Conecte-se e Converse
          </h1>
          <p className="text-base sm:text-lg text-muted-foreground max-w-lg mx-auto">
            Descubra pessoas, entre em grupos, compartilhe stories e faça chamadas. Tudo em um só lugar.
          </p>
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <Button size="lg" onClick={() => navigate({ to: "/auth" })} className="gap-2">
              <Zap className="size-4" /> Começar agora
            </Button>
            <Button size="lg" variant="outline" onClick={() => navigate({ to: "/descobrir" })} className="gap-2">
              Explorar sem conta <ArrowRight className="size-4" />
            </Button>
          </div>
          <div className="flex justify-center gap-5 text-xs text-muted-foreground pt-2">
            <span className="inline-flex items-center gap-1"><MessageCircle className="size-3.5" /> Mensagens</span>
            <span className="inline-flex items-center gap-1"><Phone className="size-3.5" /> Chamadas</span>
            <span className="inline-flex items-center gap-1"><Heart className="size-3.5" /> Stories</span>
            <span className="inline-flex items-center gap-1"><Shield className="size-3.5" /> Seguro</span>
          </div>
        </section>

        {/* Pessoas */}
        <section>
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <Users className="size-5 text-primary" />
              <h2 className="text-lg font-bold">Pessoas no WaveChat</h2>
            </div>
            <button onClick={() => navigate({ to: "/descobrir" })} className="text-sm text-primary hover:underline flex items-center gap-1">
              Ver todas <ArrowRight className="size-3.5" />
            </button>
          </div>
          {profiles === null ? (
            <div className="flex justify-center py-8">
              <Loader2 className="size-5 animate-spin text-muted-foreground" />
            </div>
          ) : profiles.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-6">Ninguém por aqui ainda. Seja o primeiro!</p>
          ) : (
            <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-3">
              {profiles.map((p) => (
                <Link
                  key={p.id}
                  to="/u/$username"
                  params={{ username: p.username }}
                  className="flex flex-col items-center gap-2 p-3 rounded-xl border border-border bg-card hover:bg-accent/30 transition"
                >
                  <Avatar className="size-14">
                    <AvatarImage src={p.avatar_url ?? undefined} />
                    <AvatarFallback>{(p.display_name ?? p.username).slice(0, 2).toUpperCase()}</AvatarFallback>
                  </Avatar>
                  <div className="text-center min-w-0 w-full">
                    <p className="text-xs font-semibold truncate">{p.display_name}</p>
                    <p className="text-[10px] text-muted-foreground truncate">@{p.username}</p>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </section>

        {/* Grupos */}
        <section>
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <Globe className="size-5 text-primary" />
              <h2 className="text-lg font-bold">Comunidades Populares</h2>
            </div>
            <button onClick={() => navigate({ to: "/descobrir" })} className="text-sm text-primary hover:underline flex items-center gap-1">
              Ver todas <ArrowRight className="size-3.5" />
            </button>
          </div>
          {groups === null ? (
            <div className="flex justify-center py-8">
              <Loader2 className="size-5 animate-spin text-muted-foreground" />
            </div>
          ) : groups.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-6">Nenhuma comunidade ainda. Crie a primeira!</p>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {groups.map((g) => (
                <Link
                  key={g.id}
                  to="/g/$groupId"
                  params={{ groupId: g.id }}
                  className="flex items-center gap-3 p-3 rounded-xl border border-border bg-card hover:bg-accent/30 transition"
                >
                  <Avatar className="size-14">
                    <AvatarImage src={g.avatar_url ?? undefined} />
                    <AvatarFallback>{g.name?.slice(0, 2).toUpperCase() ?? "GR"}</AvatarFallback>
                  </Avatar>
                  <div className="min-w-0 flex-1">
                    <div className="font-semibold text-sm truncate">{g.name}</div>
                    <div className="flex items-center gap-1.5 mt-0.5">
                      {g.category && <Badge variant="secondary" className="text-[10px] px-1.5 py-0">{CATEGORY_LABEL[g.category]}</Badge>}
                      <span className="text-xs text-muted-foreground">{g.member_count} {g.member_count === 1 ? "membro" : "membros"}</span>
                    </div>
                    {g.description && <p className="text-xs text-muted-foreground truncate mt-1">{g.description}</p>}
                  </div>
                </Link>
              ))}
            </div>
          )}
        </section>

        {/* Lives */}
        <section>
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <Radio className="size-5 text-red-500" />
              <h2 className="text-lg font-bold">Lives ao vivo</h2>
            </div>
            <button onClick={() => navigate({ to: "/live" })} className="text-sm text-primary hover:underline flex items-center gap-1">
              Ver todas <ArrowRight className="size-3.5" />
            </button>
          </div>
          {loadingLives ? (
            <div className="flex justify-center py-8">
              <Loader2 className="size-5 animate-spin text-muted-foreground" />
            </div>
          ) : lives.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-6">Ninguém está ao vivo agora. Seja o primeiro!</p>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
              {lives.slice(0, 8).map((l) => (
                <Link
                  key={l.id}
                  to="/live/$liveId"
                  params={{ liveId: l.id }}
                  className="relative aspect-[3/4] rounded-xl overflow-hidden bg-muted group"
                >
                  {l.cover_url || l.host?.avatar_url ? (
                    <img
                      src={l.cover_url || l.host?.avatar_url || ""}
                      alt={l.title}
                      className="absolute inset-0 w-full h-full object-cover group-hover:scale-105 transition"
                    />
                  ) : (
                    <div className="absolute inset-0 bg-gradient-to-br from-pink-500 to-yellow-500" />
                  )}
                  <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/0 to-black/40" />
                  <span className="absolute top-2 left-2 bg-red-600 text-white text-[10px] font-bold px-1.5 py-0.5 rounded">
                    AO VIVO
                  </span>
                  <span className="absolute top-2 right-2 flex items-center gap-1 text-white text-xs bg-black/50 backdrop-blur px-1.5 py-0.5 rounded-full">
                    <Eye className="w-3 h-3" /> {l.viewer_count}
                  </span>
                  <div className="absolute bottom-2 left-2 right-2 text-white">
                    <p className="text-xs font-semibold truncate">{l.host?.display_name || l.host?.username || "Host"}</p>
                    <p className="text-[11px] opacity-90 truncate">{l.title || "Ao vivo"}</p>
                    {l.total_gift_coins > 0 && (
                      <p className="text-[10px] flex items-center gap-0.5 opacity-90 mt-0.5">
                        <Coins className="w-3 h-3 text-yellow-400" /> {l.total_gift_coins}
                      </p>
                    )}
                  </div>
                </Link>
              ))}
            </div>
          )}
        </section>

        {/* Posts */}
        <section>
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <FileText className="size-5 text-primary" />
              <h2 className="text-lg font-bold">Posts da comunidade</h2>
            </div>
            <button onClick={() => navigate({ to: "/posts" })} className="text-sm text-primary hover:underline flex items-center gap-1">
              Ver feed <ArrowRight className="size-3.5" />
            </button>
          </div>
          {loadingPosts ? (
            <div className="flex justify-center py-8">
              <Loader2 className="size-5 animate-spin text-muted-foreground" />
            </div>
          ) : posts.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-6">Nenhum post ainda. Seja o primeiro!</p>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
              {posts.slice(0, 6).map((p) => (
                <Link
                  key={p.post_id}
                  to="/posts"
                  className="flex flex-col gap-2 p-3 rounded-xl border border-border bg-card hover:bg-accent/30 transition"
                >
                  <div className="flex items-center gap-2">
                    <Avatar className="size-8">
                      <AvatarImage src={p.avatar_url ?? undefined} />
                      <AvatarFallback>{(p.display_name ?? p.username).slice(0, 2).toUpperCase()}</AvatarFallback>
                    </Avatar>
                    <div className="min-w-0">
                      <p className="text-xs font-semibold truncate">{p.display_name}</p>
                      <p className="text-[10px] text-muted-foreground truncate">@{p.username}</p>
                    </div>
                  </div>
                  {p.media_url ? (
                    <div className="aspect-[4/3] rounded-lg overflow-hidden bg-muted">
                      <img src={p.media_url} alt="" className="w-full h-full object-cover" />
                    </div>
                  ) : (
                    <p className="text-xs text-muted-foreground line-clamp-3">{p.caption || p.content}</p>
                  )}
                </Link>
              ))}
            </div>
          )}
        </section>

        {/* Meet */}
        <section className="rounded-2xl border border-border bg-card p-5 flex flex-col sm:flex-row items-center gap-4">
          <div className="size-14 rounded-full bg-primary/10 grid place-items-center shrink-0">
            <Monitor className="size-7 text-primary" />
          </div>
          <div className="flex-1 text-center sm:text-left">
            <h3 className="font-bold text-sm">Reuniões com Meet</h3>
            <p className="text-xs text-muted-foreground mt-0.5">
              Crie salas de vídeo para reuniões, aulas ou bate-papos em grupo. Sem instalação.
            </p>
          </div>
          <Button size="sm" onClick={() => navigate({ to: "/meet/wavechat-geral" })}>
            Entrar na sala pública
          </Button>
        </section>

        {/* Features */}
        <section className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <FeatureCard
            icon={<MessageCircle className="size-5 text-primary" />}
            title="Mensagens"
            desc="Converse em tempo real com pessoas de todo lugar."
          />
          <FeatureCard
            icon={<Phone className="size-5 text-primary" />}
            title="Chamadas"
            desc="Áudio e vídeo de alta qualidade, direto no app."
          />
          <FeatureCard
            icon={<Sparkles className="size-5 text-primary" />}
            title="Stories"
            desc="Compartilhe momentos e veja o que seus amigos postam."
          />
        </section>

        {/* CTA final */}
        <section className="rounded-2xl border border-primary/30 bg-primary/5 p-6 text-center">
          <h3 className="text-lg font-bold mb-1">Pronto pra começar?</h3>
          <p className="text-sm text-muted-foreground mb-4">
            Crie sua conta gratuita em segundos e entre na conversa.
          </p>
          <div className="flex flex-col sm:flex-row gap-2 justify-center">
            <Button onClick={() => navigate({ to: "/auth" })}>Criar conta grátis</Button>
            <Button variant="outline" onClick={() => navigate({ to: "/auth" })}>Já tenho conta</Button>
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="border-t border-border mt-10 py-6 text-center text-xs text-muted-foreground">
        <div className="flex justify-center gap-4 mb-2">
          <Link to="/about" className="hover:text-foreground">Sobre</Link>
          <Link to="/diretrizes" className="hover:text-foreground">Diretrizes</Link>
          <Link to="/privacy" className="hover:text-foreground">Privacidade</Link>
          <Link to="/terms" className="hover:text-foreground">Termos</Link>
        </div>
        <p>WaveChat. Conecte-se e converse.</p>
      </footer>
    </div>
  );
}

function FeatureCard({ icon, title, desc }: { icon: React.ReactNode; title: string; desc: string }) {
  return (
    <div className="rounded-xl border border-border bg-card p-4 text-center space-y-2">
      <div className="mx-auto size-10 rounded-full bg-primary/10 grid place-items-center">{icon}</div>
      <h3 className="font-semibold text-sm">{title}</h3>
      <p className="text-xs text-muted-foreground">{desc}</p>
    </div>
  );
}
