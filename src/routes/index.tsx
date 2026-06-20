import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { Capacitor } from "@capacitor/core";
import { toast } from "sonner";
import {
  Loader2, MessageCircle, Phone, Heart, Users, Globe, Sparkles, ArrowRight,
  Zap, Shield, Radio, Eye, Coins, Monitor, Circle, Flame,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useAuth } from "@/hooks/use-auth";
import { getRecommendedProfilesPublic, type PublicProfile, getPublicStats, type PublicStats } from "@/lib/public-discover.functions";
import { discoverGroupsPublic, type PublicGroup, type GroupCategory } from "@/lib/groups.functions";
import { getActiveLives } from "@/lib/live.functions";
import { signInWithGoogleNative } from "@/lib/native-google-auth";
import { lovable } from "@/integrations/lovable";
import { track } from "@/lib/track";
import { supabase } from "@/integrations/supabase/client";
import wavechatLogo from "@/assets/wavechat-logo.png.asset.json";

type PublicStatus = {
  status_id: string; user_id: string; username: string; display_name: string | null;
  avatar_url: string | null; kind: string; media_url: string | null; caption: string | null;
  background: string | null; content: string | null; is_official: boolean;
};
type PublicPost = {
  post_id: string; user_id: string; username: string; display_name: string | null;
  avatar_url: string | null; kind: string; media_url: string | null; thumbnail_url: string | null;
  content: string | null; reactions_count: number; comments_count: number; created_at: string;
};

const CATEGORY_LABEL: Record<GroupCategory, string> = {
  business: "Negócios", tech: "Tecnologia", games: "Games", music: "Música",
  entertainment: "Entretenimento", relationships: "Relacionamentos",
  travel: "Viagens", sports: "Esportes", education: "Educação", other: "Outros",
};

export const Route = createFileRoute("/")({
  component: LandingPage,
  head: () => ({
    meta: [
      { title: "WaveChat - Rede Social Brasileira com Chat, Stories, Grupos e Chamadas" },
      { name: "description", content: "Converse, faça amizades, publique stories, participe de grupos, lives e chamadas de voz e vídeo. Conheça pessoas e comunidades na WaveChat." },
      { property: "og:title", content: "WaveChat - Mais que Chat" },
      { property: "og:description", content: "Rede social brasileira para conversar, compartilhar stories, participar de grupos, fazer chamadas e conhecer novas pessoas." },
      { property: "og:url", content: "https://webconnectchat.com" },
      { property: "og:type", content: "website" },
      { name: "twitter:title", content: "WaveChat - Rede Social Brasileira" },
      { name: "twitter:description", content: "Chat, stories, grupos, chamadas e comunidades em um só lugar." },
      { name: "twitter:card", content: "summary_large_image" },
    ],
    links: [{ rel: "canonical", href: "https://webconnectchat.com" }],
    scripts: [
      {
        type: "application/ld+json",
        children: JSON.stringify({
          "@context": "https://schema.org",
          "@graph": [
            {
              "@type": "WebSite",
              "url": "https://webconnectchat.com",
              "name": "WaveChat",
              "description": "Rede social brasileira com chat, stories, grupos, lives e chamadas de voz e vídeo.",
              "inLanguage": "pt-BR",
            },
          ],
        }),
      },
    ],
  }),
});

function LandingPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [profiles, setProfiles] = useState<PublicProfile[] | null>(null);
  const [groups, setGroups] = useState<PublicGroup[] | null>(null);
  const [lives, setLives] = useState<Awaited<ReturnType<typeof getActiveLives>>>([]);
  const [loadingLives, setLoadingLives] = useState(true);
  const [stats, setStats] = useState<PublicStats | null>(null);
  const [googleBusy, setGoogleBusy] = useState(false);

  const isNative = useMemo(() => {
    try { return Capacitor.isNativePlatform(); } catch { return false; }
  }, []);

  const [statuses, setStatuses] = useState<PublicStatus[] | null>(null);
  const [posts, setPosts] = useState<PublicPost[] | null>(null);

  useEffect(() => {
    void track("landing_page_view", { surface: isNative ? "native" : "web", authed: !!user });
    getRecommendedProfilesPublic({ data: { limit: 12 } })
      .then((r) => setProfiles(r.profiles))
      .catch(() => setProfiles([]));
    discoverGroupsPublic({ data: { sort: "popular", limit: 8 } })
      .then((r) => setGroups(r.groups))
      .catch(() => setGroups([]));
    getActiveLives()
      .then((r) => { setLives(r); setLoadingLives(false); })
      .catch(() => setLoadingLives(false));
    if (!isNative) {
      getPublicStats().then(setStats).catch(() => setStats(null));
      (supabase as any).rpc("discover_public_statuses", { _limit: 16, _offset: 0 })
        .then(({ data }: any) => setStatuses((data ?? []) as PublicStatus[]))
        .catch(() => setStatuses([]));
      (supabase as any).rpc("discover_public_posts", { _limit: 12, _offset: 0 })
        .then(({ data }: any) => setPosts((data ?? []) as PublicPost[]))
        .catch(() => setPosts([]));
    }
  }, [user, isNative]);


  const handleGoogle = async () => {
    setGoogleBusy(true);
    try {
      void track("landing_google_signin_click");
      const launchedNative = await signInWithGoogleNative();
      if (launchedNative) return;
      const result = await lovable.auth.signInWithOAuth("google", {
        redirect_uri: `${window.location.origin}/chat`,
      });
      if (result.error) throw result.error;
    } catch (err: any) {
      console.error("[landing-google]", err);
      toast.error(err?.message ?? "Não foi possível continuar com o Google");
      setGoogleBusy(false);
    }
  };

  // ============ Native: keep the original simple layout ============
  if (isNative) {
    return <NativeLanding
      profiles={profiles} groups={groups} lives={lives} loadingLives={loadingLives}
      navigate={navigate}
    />;
  }

  // ============ Web: high-conversion redesign ============
  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-50 bg-background/90 backdrop-blur border-b border-border">
        <div className="mx-auto max-w-5xl flex items-center justify-between px-4 py-3">
          <Link to="/" className="flex items-center gap-2">
            <img src={wavechatLogo.url} alt="WaveChat" className="size-8 rounded-lg" />
            <span className="font-bold text-lg">WaveChat</span>
          </Link>
          <div className="flex items-center gap-2">
            {user ? (
              <Button size="sm" onClick={() => navigate({ to: "/chat" })} className="gap-1.5">
                <MessageCircle className="size-4" /> Abrir Chat
              </Button>
            ) : (
              <>
                <Button size="sm" variant="ghost" onClick={() => navigate({ to: "/auth" })}>Entrar</Button>
                <Button size="sm" onClick={handleGoogle} disabled={googleBusy}>
                  {googleBusy ? <Loader2 className="size-4 animate-spin" /> : "Entrar com Google"}
                </Button>
              </>
            )}
          </div>

        </div>
      </header>

      <main className="mx-auto max-w-5xl px-4 py-6 space-y-10">
        {/* HERO with social proof */}
        <section className="relative overflow-hidden rounded-3xl border border-border bg-gradient-to-br from-primary/10 via-background to-accent/10 p-6 sm:p-10">
          <div className="absolute -top-20 -right-20 size-72 rounded-full bg-primary/20 blur-3xl pointer-events-none" />
          <div className="absolute -bottom-24 -left-16 size-72 rounded-full bg-accent/20 blur-3xl pointer-events-none" />
          <div className="relative space-y-5 max-w-2xl">
            <Badge variant="secondary" className="gap-1.5">
              <Circle className="size-2 fill-emerald-500 text-emerald-500 animate-pulse" />
              {stats ? <span><b>{stats.online_now.toLocaleString("pt-BR")}</b> pessoas online agora</span> : <span>Pessoas online agora</span>}
            </Badge>
            <h1 className="text-3xl sm:text-5xl font-extrabold tracking-tight leading-tight">
              A rede social brasileira pra <span className="bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">conhecer gente de verdade</span>
            </h1>
            <p className="text-base sm:text-lg text-muted-foreground">
              Chat, stories, lives, grupos e chamadas de voz/vídeo. Sem algoritmo manipulando o que você vê. Entre em 1 clique e comece a conversar.
            </p>

            <div className="flex flex-col sm:flex-row gap-3">
              <Button size="lg" onClick={handleGoogle} disabled={googleBusy} className="gap-2 h-12 px-6 text-base shadow-lg">
                {googleBusy ? <Loader2 className="size-5 animate-spin" /> : (
                  <svg viewBox="0 0 24 24" className="size-5" aria-hidden>
                    <path fill="#fff" d="M12 10.2v3.9h5.5c-.2 1.4-1.7 4-5.5 4-3.3 0-6-2.7-6-6s2.7-6 6-6c1.9 0 3.1.8 3.8 1.5l2.6-2.5C16.8 3.7 14.6 2.8 12 2.8 6.9 2.8 2.8 6.9 2.8 12s4.1 9.2 9.2 9.2c5.3 0 8.8-3.7 8.8-8.9 0-.6-.1-1-.2-1.5H12z"/>
                  </svg>
                )}
                Continuar com Google
              </Button>
              <Button size="lg" variant="outline" onClick={() => navigate({ to: "/descobrir" })} className="gap-2 h-12 px-6 text-base">
                Explorar sem conta <ArrowRight className="size-4" />
              </Button>
            </div>

            {/* Live stats strip */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-3">
              <StatPill icon={<Users className="size-4" />} value={stats?.total_members} label="membros" />
              <StatPill icon={<Circle className="size-3 fill-emerald-500 text-emerald-500" />} value={stats?.online_now} label="online" />
              <StatPill icon={<Radio className="size-4 text-red-500" />} value={stats?.live_now} label="ao vivo" highlight={!!stats?.live_now} />
              <StatPill icon={<Flame className="size-4 text-orange-500" />} value={stats?.posts_today} label="posts hoje" />
            </div>

            {/* Quick nav — explorar conteúdo público sem conta */}
            <div className="pt-3">
              <p className="text-[11px] uppercase tracking-wide text-muted-foreground mb-2">Explorar sem conta</p>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                <Link to="/posts" className="flex items-center gap-2 px-3 py-2.5 rounded-xl border border-border bg-card hover:bg-accent/40 transition">
                  <Flame className="size-4 text-orange-500" />
                  <span className="text-sm font-semibold">Posts</span>
                </Link>
                <Link to="/descobrir-status" className="flex items-center gap-2 px-3 py-2.5 rounded-xl border border-border bg-card hover:bg-accent/40 transition">
                  <Sparkles className="size-4 text-pink-500" />
                  <span className="text-sm font-semibold">Status</span>
                </Link>
                <Link to="/live" className="flex items-center gap-2 px-3 py-2.5 rounded-xl border border-border bg-card hover:bg-accent/40 transition">
                  <Radio className="size-4 text-red-500" />
                  <span className="text-sm font-semibold">Lives</span>
                </Link>
                <Link to="/descobrir" className="flex items-center gap-2 px-3 py-2.5 rounded-xl border border-border bg-card hover:bg-accent/40 transition">
                  <Globe className="size-4 text-primary" />
                  <span className="text-sm font-semibold">Comunidades</span>
                </Link>
              </div>
            </div>

            <p className="text-xs text-muted-foreground pt-1">
              Grátis • Sem cartão • Sem anúncios invasivos • Conta só quando quiser interagir
            </p>

          </div>
        </section>

        {/* STORIES — horizontal carousel, real content */}
        {statuses !== null && statuses.length > 0 && (
          <section>
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <Sparkles className="size-5 text-pink-500" />
                <h2 className="text-lg font-bold">Stories</h2>
              </div>
              <Link to="/descobrir-status" className="text-sm text-primary hover:underline flex items-center gap-1">
                Ver todos <ArrowRight className="size-3.5" />
              </Link>
            </div>
            <div className="flex gap-3 overflow-x-auto pb-2 -mx-4 px-4 snap-x">
              {statuses.map((s) => (
                <Link
                  key={s.status_id}
                  to="/s/$statusId"
                  params={{ statusId: s.status_id }}
                  className="relative shrink-0 w-28 aspect-[9/14] rounded-2xl overflow-hidden bg-muted snap-start group"
                >
                  {s.media_url ? (
                    <img src={s.media_url} alt={s.caption ?? s.display_name ?? s.username}
                      className="absolute inset-0 w-full h-full object-cover group-hover:scale-105 transition" />
                  ) : (
                    <div
                      className="absolute inset-0 grid place-items-center p-2 text-white text-[11px] font-semibold text-center"
                      style={{ background: s.background ?? "linear-gradient(135deg,#8b5cf6,#ec4899)" }}
                    >
                      {(s.content ?? "").slice(0, 60)}
                    </div>
                  )}
                  <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-black/20" />
                  <div className="absolute top-1.5 left-1.5 right-1.5 flex items-center gap-1.5">
                    <Avatar className="size-7 ring-2 ring-pink-500">
                      <AvatarImage src={s.avatar_url ?? undefined} />
                      <AvatarFallback className="text-[10px]">{(s.display_name ?? s.username).slice(0, 2).toUpperCase()}</AvatarFallback>
                    </Avatar>
                  </div>
                  <div className="absolute bottom-1.5 left-1.5 right-1.5 text-white">
                    <p className="text-[11px] font-semibold truncate">{s.display_name ?? s.username}</p>
                  </div>
                </Link>
              ))}
            </div>
          </section>
        )}


        {/* POSTS — vitrine principal da rede */}
        {posts !== null && posts.length > 0 && (
          <section>
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <Flame className="size-5 text-orange-500" />
                <h2 className="text-lg font-bold">Posts em alta</h2>
              </div>
              <Link to="/posts" className="text-sm text-primary hover:underline flex items-center gap-1">
                Ver feed <ArrowRight className="size-3.5" />
              </Link>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
              {posts.slice(0, 12).map((p) => (
                <Link key={p.post_id} to="/p/$postId" params={{ postId: p.post_id }}
                  className="group rounded-xl overflow-hidden border border-border bg-card hover:bg-accent/30 transition flex flex-col">
                  {p.media_url || p.thumbnail_url ? (
                    <div className="relative aspect-square bg-muted overflow-hidden">
                      <img src={p.thumbnail_url || p.media_url || ""} alt={p.content ?? ""}
                        className="absolute inset-0 w-full h-full object-cover group-hover:scale-105 transition" />
                    </div>
                  ) : (
                    <div className="aspect-square p-3 grid place-items-center bg-gradient-to-br from-primary/10 to-accent/10">
                      <p className="text-xs text-foreground line-clamp-6 text-center">{p.content ?? ""}</p>
                    </div>
                  )}
                  <div className="p-2 space-y-1">
                    <div className="flex items-center gap-2">
                      <Avatar className="size-6">
                        <AvatarImage src={p.avatar_url ?? undefined} />
                        <AvatarFallback className="text-[9px]">{(p.display_name ?? p.username).slice(0, 2).toUpperCase()}</AvatarFallback>
                      </Avatar>
                      <span className="text-[11px] font-semibold truncate flex-1">{p.display_name ?? p.username}</span>
                    </div>
                    <div className="flex items-center gap-3 text-[10px] text-muted-foreground">
                      <span className="flex items-center gap-0.5"><Heart className="size-3" /> {p.reactions_count}</span>
                      <span className="flex items-center gap-0.5"><MessageCircle className="size-3" /> {p.comments_count}</span>
                      <span className="ml-auto">{new Date(p.created_at).toLocaleDateString("pt-BR", { day: "2-digit", month: "short" })}</span>
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          </section>
        )}

        {/* LIVES — acontecendo agora */}
        {(loadingLives || lives.length > 0) && (
          <section>
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <Radio className="size-5 text-red-500" />
                <h2 className="text-lg font-bold">Acontecendo agora</h2>
              </div>
              <button onClick={() => navigate({ to: "/live" })} className="text-sm text-primary hover:underline flex items-center gap-1">
                Ver todas <ArrowRight className="size-3.5" />
              </button>
            </div>
            {loadingLives ? (
              <div className="flex justify-center py-8"><Loader2 className="size-5 animate-spin text-muted-foreground" /></div>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
                {lives.slice(0, 8).map((l) => (
                  <Link key={l.id} to="/live/$liveId" params={{ liveId: l.id }}
                    className="relative aspect-[3/4] rounded-xl overflow-hidden bg-muted group">
                    {l.cover_url || l.host?.avatar_url ? (
                      <img src={l.cover_url || l.host?.avatar_url || ""} alt={l.title}
                        className="absolute inset-0 w-full h-full object-cover group-hover:scale-105 transition" />
                    ) : (
                      <div className="absolute inset-0 bg-gradient-to-br from-pink-500 to-yellow-500" />
                    )}
                    <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/0 to-black/40" />
                    <span className="absolute top-2 left-2 bg-red-600 text-white text-[10px] font-bold px-1.5 py-0.5 rounded">AO VIVO</span>
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
        )}

        {/* COMUNIDADES */}
        <section>
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <Globe className="size-5 text-primary" />
              <h2 className="text-lg font-bold">Comunidades populares</h2>
            </div>
            <button onClick={() => navigate({ to: "/descobrir" })} className="text-sm text-primary hover:underline flex items-center gap-1">
              Ver todas <ArrowRight className="size-3.5" />
            </button>
          </div>
          {groups === null ? (
            <div className="flex justify-center py-8"><Loader2 className="size-5 animate-spin text-muted-foreground" /></div>
          ) : groups.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-6">Nenhuma comunidade ainda. Crie a primeira!</p>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {groups.map((g) => (
                <Link key={g.id} to="/g/$groupId" params={{ groupId: g.id }}
                  className="flex items-center gap-3 p-3 rounded-xl border border-border bg-card hover:bg-accent/30 transition">
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

        {/* PESSOAS */}
        <section>
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <Users className="size-5 text-primary" />
              <h2 className="text-lg font-bold">Pessoas pra conhecer</h2>
            </div>
            <button onClick={() => navigate({ to: "/descobrir" })} className="text-sm text-primary hover:underline flex items-center gap-1">
              Ver todas <ArrowRight className="size-3.5" />
            </button>
          </div>
          {profiles === null ? (
            <div className="flex justify-center py-8"><Loader2 className="size-5 animate-spin text-muted-foreground" /></div>
          ) : profiles.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-6">Ninguém por aqui ainda. Seja o primeiro!</p>
          ) : (
            <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-3">
              {profiles.map((p) => (
                <Link key={p.id} to="/u/$username" params={{ username: p.username }}
                  className="flex flex-col items-center gap-2 p-3 rounded-xl border border-border bg-card hover:bg-accent/30 transition">
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

        {/* FEATURES */}
        <section className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <FeatureCard icon={<MessageCircle className="size-5 text-primary" />} title="Chat real" desc="Mensagens em tempo real, sem espera." />
          <FeatureCard icon={<Phone className="size-5 text-primary" />} title="Chamadas HD" desc="Áudio e vídeo direto no navegador." />
          <FeatureCard icon={<Sparkles className="size-5 text-primary" />} title="Stories" desc="Compartilhe momentos do seu dia." />
          <FeatureCard icon={<Shield className="size-5 text-primary" />} title="Privacidade" desc="Você controla quem vê o quê." />
        </section>



        {/* FEATURES */}
        <section className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <FeatureCard icon={<MessageCircle className="size-5 text-primary" />} title="Chat real" desc="Mensagens em tempo real, sem espera." />
          <FeatureCard icon={<Phone className="size-5 text-primary" />} title="Chamadas HD" desc="Áudio e vídeo direto no navegador." />
          <FeatureCard icon={<Sparkles className="size-5 text-primary" />} title="Stories" desc="Compartilhe momentos do seu dia." />
          <FeatureCard icon={<Shield className="size-5 text-primary" />} title="Privacidade" desc="Você controla quem vê o quê." />
        </section>

        {/* MEET */}
        <section className="rounded-2xl border border-border bg-card p-5 flex flex-col sm:flex-row items-center gap-4">
          <div className="size-14 rounded-full bg-primary/10 grid place-items-center shrink-0">
            <Monitor className="size-7 text-primary" />
          </div>
          <div className="flex-1 text-center sm:text-left">
            <h3 className="font-bold text-sm">Sala de reunião pública</h3>
            <p className="text-xs text-muted-foreground mt-0.5">Entre numa sala de vídeo agora, sem cadastro, e veja como funciona.</p>
          </div>
          <Button size="sm" variant="outline" onClick={() => navigate({ to: "/meet/wavechat-geral" })}>
            Entrar na sala
          </Button>
        </section>

        {/* CTA final */}
        <section className="rounded-2xl border border-primary/30 bg-gradient-to-br from-primary/10 to-accent/10 p-6 text-center">
          {user ? (
            <>
              <h3 className="text-xl font-bold mb-1">Continue a conversa</h3>
              <p className="text-sm text-muted-foreground mb-4">Abra seu chat e converse com quem está online agora.</p>
              <div className="flex flex-col sm:flex-row gap-2 justify-center max-w-md mx-auto">
                <Button onClick={() => navigate({ to: "/chat" })} className="gap-2">
                  <MessageCircle className="size-4" /> Abrir Chat
                </Button>
                <Button variant="outline" onClick={() => navigate({ to: "/posts" })}>Ver feed completo</Button>
              </div>
            </>
          ) : (
            <>
              <h3 className="text-xl font-bold mb-1">Pronto pra entrar na conversa?</h3>
              <p className="text-sm text-muted-foreground mb-4">
                {stats ? `Junte-se a ${stats.total_members.toLocaleString("pt-BR")} brasileiros já na WaveChat.` : "Crie sua conta gratuita em segundos."}
              </p>
              <div className="flex flex-col sm:flex-row gap-2 justify-center max-w-md mx-auto">
                <Button onClick={handleGoogle} disabled={googleBusy} className="gap-2">
                  {googleBusy ? <Loader2 className="size-4 animate-spin" /> : <Zap className="size-4" />}
                  Continuar com Google
                </Button>
                <Button variant="outline" onClick={() => navigate({ to: "/auth" })}>Outras formas</Button>
              </div>
            </>
          )}
        </section>

      </main>

      <footer className="border-t border-border mt-10 py-6 text-center text-xs text-muted-foreground">
        <div className="flex justify-center gap-4 mb-2 flex-wrap">
          <Link to="/about" className="hover:text-foreground">Sobre</Link>
          <Link to="/diretrizes" className="hover:text-foreground">Diretrizes</Link>
          <Link to="/privacy" className="hover:text-foreground">Privacidade</Link>
          <Link to="/terms" className="hover:text-foreground">Termos</Link>
          <Link to="/contact" className="hover:text-foreground">Contato</Link>
        </div>
        <p>WaveChat. Conecte-se e converse.</p>
      </footer>
    </div>
  );
}

function StatPill({ icon, value, label, highlight }: { icon: React.ReactNode; value: number | undefined; label: string; highlight?: boolean }) {
  return (
    <div className={`flex items-center gap-2 rounded-lg border ${highlight ? "border-red-500/40 bg-red-500/5" : "border-border bg-card/50"} px-3 py-2`}>
      {icon}
      <div className="min-w-0">
        <div className="text-sm font-bold leading-tight">
          {value === undefined ? <span className="text-muted-foreground">—</span> : value.toLocaleString("pt-BR")}
        </div>
        <div className="text-[10px] text-muted-foreground leading-tight">{label}</div>
      </div>
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

// ===================== Native landing (unchanged) =====================
function NativeLanding({
  profiles, groups, lives, loadingLives, navigate,
}: {
  profiles: PublicProfile[] | null;
  groups: PublicGroup[] | null;
  lives: Awaited<ReturnType<typeof getActiveLives>>;
  loadingLives: boolean;
  navigate: ReturnType<typeof useNavigate>;
}) {
  return (
    <div className="min-h-screen bg-background">
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
        <section className="text-center space-y-5 py-8">
          <div className="mx-auto size-20 rounded-2xl bg-gradient-to-br from-primary to-accent grid place-items-center shadow-xl">
            <MessageCircle className="size-10 text-primary-foreground" />
          </div>
          <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight">Conecte-se e Converse</h1>
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
            <div className="flex justify-center py-8"><Loader2 className="size-5 animate-spin text-muted-foreground" /></div>
          ) : profiles.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-6">Ninguém por aqui ainda. Seja o primeiro!</p>
          ) : (
            <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-3">
              {profiles.map((p) => (
                <Link key={p.id} to="/u/$username" params={{ username: p.username }}
                  className="flex flex-col items-center gap-2 p-3 rounded-xl border border-border bg-card hover:bg-accent/30 transition">
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
            <div className="flex justify-center py-8"><Loader2 className="size-5 animate-spin text-muted-foreground" /></div>
          ) : groups.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-6">Nenhuma comunidade ainda. Crie a primeira!</p>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {groups.map((g) => (
                <Link key={g.id} to="/g/$groupId" params={{ groupId: g.id }}
                  className="flex items-center gap-3 p-3 rounded-xl border border-border bg-card hover:bg-accent/30 transition">
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
            <div className="flex justify-center py-8"><Loader2 className="size-5 animate-spin text-muted-foreground" /></div>
          ) : lives.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-6">Ninguém está ao vivo agora. Seja o primeiro!</p>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
              {lives.slice(0, 8).map((l) => (
                <Link key={l.id} to="/live/$liveId" params={{ liveId: l.id }}
                  className="relative aspect-[3/4] rounded-xl overflow-hidden bg-muted group">
                  {l.cover_url || l.host?.avatar_url ? (
                    <img src={l.cover_url || l.host?.avatar_url || ""} alt={l.title}
                      className="absolute inset-0 w-full h-full object-cover group-hover:scale-105 transition" />
                  ) : (
                    <div className="absolute inset-0 bg-gradient-to-br from-pink-500 to-yellow-500" />
                  )}
                  <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/0 to-black/40" />
                  <span className="absolute top-2 left-2 bg-red-600 text-white text-[10px] font-bold px-1.5 py-0.5 rounded">AO VIVO</span>
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

        <section className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <FeatureCard icon={<MessageCircle className="size-5 text-primary" />} title="Mensagens" desc="Converse em tempo real com pessoas de todo lugar." />
          <FeatureCard icon={<Phone className="size-5 text-primary" />} title="Chamadas" desc="Áudio e vídeo de alta qualidade, direto no app." />
          <FeatureCard icon={<Sparkles className="size-5 text-primary" />} title="Stories" desc="Compartilhe momentos e veja o que seus amigos postam." />
        </section>

        <section className="rounded-2xl border border-primary/30 bg-primary/5 p-6 text-center">
          <h3 className="text-lg font-bold mb-1">Pronto pra começar?</h3>
          <p className="text-sm text-muted-foreground mb-4">Crie sua conta gratuita em segundos e entre na conversa.</p>
          <div className="flex flex-col sm:flex-row gap-2 justify-center">
            <Button onClick={() => navigate({ to: "/auth" })}>Criar conta grátis</Button>
            <Button variant="outline" onClick={() => navigate({ to: "/auth" })}>Já tenho conta</Button>
          </div>
        </section>
      </main>

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
