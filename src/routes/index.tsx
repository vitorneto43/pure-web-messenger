import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useInfiniteQuery, useQueryClient } from "@tanstack/react-query";
import { Capacitor } from "@capacitor/core";
import {
  Loader2, MessageCircle, Users, Globe, Sparkles, ArrowRight,
  Radio, Eye, Coins, Monitor, Plus, Search, Download,
  Newspaper, BookOpen, CircleHelp, Settings, Bell,
  User as UserIcon, Rocket, Hash, CalendarClock, Video,
  Shield, FileText, Lock, Info, LogOut, Mail,
  Sliders, BarChart3, History, Target, Megaphone,
} from "lucide-react";
import {
  DropdownMenu, DropdownMenuTrigger, DropdownMenuContent,
  DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useAuth } from "@/hooks/use-auth";
import { useAuthGate } from "@/hooks/use-auth-gate";
import { supabase } from "@/integrations/supabase/client";
import { getRecommendedProfilesPublic, type PublicProfile } from "@/lib/public-discover.functions";
import { discoverGroupsPublic, type PublicGroup, type GroupCategory } from "@/lib/groups.functions";
import { getActiveLives } from "@/lib/live.functions";
import { PostCard, type PostItem } from "@/components/posts/PostCard";
import { PostComments } from "@/components/posts/PostComments";
import { PostComposer } from "@/components/posts/PostComposer";
import { PostBoostDialog } from "@/components/posts/PostBoostDialog";
import { NotificationsBell } from "@/components/chat/NotificationsBell";
import { track } from "@/lib/track";
import wavechatLogo from "@/assets/wavechat-logo.png.asset.json";

type PublicStatus = {
  status_id: string; user_id: string; username: string; display_name: string | null;
  avatar_url: string | null; kind: string; media_url: string | null; caption: string | null;
  background: string | null; content: string | null; is_official: boolean;
};

const CATEGORY_LABEL: Record<GroupCategory, string> = {
  business: "Negócios", tech: "Tecnologia", games: "Games", music: "Música",
  entertainment: "Entretenimento", relationships: "Relacionamentos",
  travel: "Viagens", sports: "Esportes", education: "Educação", other: "Outros",
};

const PAGE_SIZE = 12;

export const Route = createFileRoute("/")({
  component: HomeFeed,
  head: () => ({
    meta: [
      { title: "WaveChat — Rede social brasileira: posts, stories, lives e comunidades" },
      { name: "description", content: "Veja posts, stories, lives e comunidades em tempo real. Conheça pessoas, participe de grupos e converse no WaveChat." },
      { property: "og:title", content: "WaveChat — Rede social brasileira" },
      { property: "og:description", content: "Posts, stories, lives, comunidades e chamadas em um só lugar." },
      { property: "og:url", content: "https://webconnectchat.com" },
      { property: "og:type", content: "website" },
      { name: "twitter:title", content: "WaveChat — Rede social brasileira" },
      { name: "twitter:description", content: "Posts, stories, lives, comunidades e chamadas em um só lugar." },
      { name: "twitter:card", content: "summary_large_image" },
    ],
    links: [{ rel: "canonical", href: "https://webconnectchat.com" }],
    scripts: [
      {
        type: "application/ld+json",
        children: JSON.stringify({
          "@context": "https://schema.org",
          "@type": "WebSite",
          url: "https://webconnectchat.com",
          name: "WaveChat",
          inLanguage: "pt-BR",
        }),
      },
    ],
  }),
});

export function HomeFeed() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { gate, GateDialog } = useAuthGate();

  const [composerOpen, setComposerOpen] = useState(false);
  const [commentsFor, setCommentsFor] = useState<string | null>(null);
  const [boostFor, setBoostFor] = useState<string | null>(null);
  const [chatSheetOpen, setChatSheetOpen] = useState(false);
  const [statuses, setStatuses] = useState<PublicStatus[] | null>(null);
  const [profiles, setProfiles] = useState<PublicProfile[] | null>(null);
  const [groups, setGroups] = useState<PublicGroup[] | null>(null);
  const [lives, setLives] = useState<Awaited<ReturnType<typeof getActiveLives>>>([]);

  const isNative = useMemo(() => {
    try { return Capacitor.isNativePlatform(); } catch { return false; }
  }, []);

  useEffect(() => {
    void track("home_feed_view", { authed: !!user, surface: isNative ? "native" : "web" });
    (supabase as any).rpc("discover_public_statuses", { _limit: 16, _offset: 0 })
      .then(({ data }: any) => setStatuses((data ?? []) as PublicStatus[]))
      .catch(() => setStatuses([]));
    getRecommendedProfilesPublic({ data: { limit: 8 } }).then((r) => setProfiles(r.profiles)).catch(() => setProfiles([]));
    discoverGroupsPublic({ data: { sort: "popular", limit: 5 } }).then((r) => setGroups(r.groups)).catch(() => setGroups([]));
    getActiveLives().then(setLives).catch(() => {});
  }, [user, isNative]);

  const feed = useInfiniteQuery({
    queryKey: ["home-posts-feed", user?.id ?? "guest"],
    initialPageParam: 0,
    queryFn: async ({ pageParam }) => {
      const { data, error } = await (supabase as any).rpc("discover_public_posts", { _limit: PAGE_SIZE, _offset: pageParam });
      if (error) throw error;
      return (data ?? []) as PostItem[];
    },
    getNextPageParam: (last, all) => (last.length < PAGE_SIZE ? undefined : all.length * PAGE_SIZE),
  });

  const items = useMemo(() => feed.data?.pages.flat() ?? [], [feed.data]);

  function patch(postId: string, p: Partial<PostItem>) {
    qc.setQueryData(["home-posts-feed", user?.id ?? "guest"], (old: any) => {
      if (!old) return old;
      return { ...old, pages: old.pages.map((page: PostItem[]) => page.map((x) => x.post_id === postId ? { ...x, ...p } : x)) };
    });
  }

  return (
    <div className="min-h-screen bg-background">
      {GateDialog}

      {/* HEADER — atalhos superiores + busca */}
      <header className="sticky top-0 z-30 bg-background/90 backdrop-blur border-b border-border">
        <div className="mx-auto max-w-6xl flex items-center gap-2 px-3 sm:px-4 min-h-16 py-2">
          <Link to="/" className="flex items-center gap-2 min-w-0 shrink-0">
            <img src={wavechatLogo.url} alt="WaveChat" className="size-11 rounded-full" />
            <span className="min-w-0 hidden min-[360px]:block">
              <span className="block truncate font-bold text-base leading-tight">WaveChat</span>
              <span className="block max-w-28 sm:max-w-44 truncate text-xs text-muted-foreground">
                {user?.email ?? "webconnectchat.com"}
              </span>
            </span>
          </Link>

          <Button
            size="sm"
            variant="secondary"
            onClick={() => navigate({ to: "/about" })}
            className="shrink-0 gap-1 rounded-full px-2.5 sm:px-3"
            title="Baixar app"
          >
            <Download className="size-4" />
            <span className="hidden min-[380px]:inline">Baixar app</span>
          </Button>

          <div className="ml-auto flex items-center gap-1 shrink-0">
            <Button size="icon" variant="ghost" className="rounded-full" onClick={() => navigate({ to: "/live" })} title="Lives">
              <Radio className="size-5 text-destructive" />
            </Button>
            <Button size="icon" variant="ghost" className="rounded-full" onClick={() => navigate({ to: "/posts" })} title="Posts">
              <Newspaper className="size-5" />
            </Button>
            <Button size="icon" variant="ghost" className="rounded-full" onClick={() => navigate({ to: "/terms" })} title="Termos de uso">
              <BookOpen className="size-5" />
            </Button>
            <Button size="icon" variant="ghost" className="rounded-full" onClick={() => navigate({ to: "/support" })} title="Ajuda e suporte">
              <CircleHelp className="size-5" />
            </Button>
            {user ? (
              <NotificationsBell />
                ) : (
                  <Button size="icon" variant="ghost" className="rounded-full" onClick={() => gate("default", () => undefined)} title="Notificações">
                <Bell className="size-5" />
              </Button>
            )}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button size="icon" variant="ghost" className="rounded-full" title="Configurações e mais">
                  <Settings className="size-5" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-64">
                {user ? (
                  <>
                    <DropdownMenuLabel className="truncate">{user.email}</DropdownMenuLabel>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem onClick={() => navigate({ to: "/profile" })}>
                      <UserIcon className="size-4 mr-2" /> Meu perfil
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => navigate({ to: "/chat" })}>
                      <MessageCircle className="size-4 mr-2" /> Conversas
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => navigate({ to: "/scheduled" })}>
                      <CalendarClock className="size-4 mr-2" /> Postagens agendadas
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => navigate({ to: "/recordings" })}>
                      <Video className="size-4 mr-2" /> Gravações de chamadas
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => navigate({ to: "/hashtags" })}>
                      <Hash className="size-4 mr-2" /> Hashtags
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuLabel className="text-xs text-muted-foreground">Impulsionamentos</DropdownMenuLabel>
                    <DropdownMenuItem onClick={() => { navigate({ to: "/posts" }); toast.message("Toque em ⚡ no post para impulsionar (pacotes)"); }}>
                      <Rocket className="size-4 mr-2 text-primary" /> Impulsionar post (pacotes)
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => { navigate({ to: "/posts" }); toast.message("Toque em ⚡ no post e escolha 'Personalizado'"); }}>
                      <Sliders className="size-4 mr-2 text-primary" /> Impulsionar post (personalizado)
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => { navigate({ to: "/descobrir-status" }); toast.message("Abra seu status e toque em ⚡"); }}>
                      <Rocket className="size-4 mr-2 text-pink-500" /> Impulsionar story (pacotes)
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => { navigate({ to: "/descobrir-status" }); toast.message("Abra seu status, toque em ⚡ e escolha 'Personalizado' para definir orçamento, dias, estados, idade e gênero"); }}>
                      <Target className="size-4 mr-2 text-pink-500" /> Impulsionar story (personalizado)
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => { navigate({ to: "/live/new" }); }}>
                      <Radio className="size-4 mr-2 text-destructive" /> Iniciar uma live
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => navigate({ to: "/profile" })}>
                      <History className="size-4 mr-2" /> Histórico de impulsionamentos
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => navigate({ to: "/profile" })}>
                      <BarChart3 className="size-4 mr-2" /> Relatórios e análises
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => navigate({ to: "/profile" })}>
                      <Megaphone className="size-4 mr-2" /> Minhas campanhas
                    </DropdownMenuItem>
                  </>
                ) : null}
                <DropdownMenuSeparator />
                <DropdownMenuLabel className="text-xs text-muted-foreground">Institucional</DropdownMenuLabel>
                <DropdownMenuItem onClick={() => navigate({ to: "/about" })}>
                  <Info className="size-4 mr-2" /> Sobre o WaveChat
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => navigate({ to: "/diretrizes" })}>
                  <Shield className="size-4 mr-2" /> Diretrizes da comunidade
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => navigate({ to: "/terms" })}>
                  <FileText className="size-4 mr-2" /> Termos de uso
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => navigate({ to: "/privacy" })}>
                  <Lock className="size-4 mr-2" /> Política de privacidade
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => navigate({ to: "/guide" })}>
                  <BookOpen className="size-4 mr-2" /> Guia de uso
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => navigate({ to: "/support" })}>
                  <CircleHelp className="size-4 mr-2" /> Ajuda e suporte
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => navigate({ to: "/contact" })}>
                  <Mail className="size-4 mr-2" /> Fale conosco
                </DropdownMenuItem>
                {user && (
                  <>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem
                      onClick={async () => {
                        await supabase.auth.signOut();
                        toast.success("Você saiu da conta");
                        navigate({ to: "/" });
                      }}
                      className="text-destructive focus:text-destructive"
                    >
                      <LogOut className="size-4 mr-2" /> Sair
                    </DropdownMenuItem>
                  </>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>

        <div className="mx-auto max-w-6xl flex items-center gap-2 px-3 sm:px-4 pb-2">
          <button
            onClick={() => navigate({ to: "/descobrir" })}
            className="flex-1 flex items-center gap-2 px-3 h-10 rounded-full bg-muted/60 hover:bg-muted text-left text-sm text-muted-foreground"
          >
            <Search className="size-4" />
            Buscar conversas ou pessoas…
          </button>

          <div className="flex items-center gap-1.5 shrink-0">
            <Button
              size="sm"
              variant="ghost"
              onClick={() => (user ? navigate({ to: "/chat" }) : gate("message", () => navigate({ to: "/chat" })))}
              className="gap-1.5"
              title="Abrir Chat"
            >
              <MessageCircle className="size-5" />
              <span className="hidden sm:inline">Chat</span>
            </Button>
            {user ? (
              <Button size="sm" onClick={() => gate("create_status", () => setComposerOpen(true))} className="gap-1">
                <Plus className="size-4" /> <span className="hidden sm:inline">Postar</span>
              </Button>
            ) : null}
          </div>
        </div>

        <nav className="mx-auto max-w-6xl border-t border-border/60 px-3 sm:px-4 py-2" aria-label="Atalhos da WaveChat">
          <div className="grid grid-cols-5 gap-1.5 sm:flex sm:gap-2 sm:overflow-x-auto">
            <Button size="sm" variant="secondary" className="min-w-0 flex-col sm:flex-row h-11 sm:h-9 px-1.5 sm:px-3 gap-0.5 sm:gap-1.5" onClick={() => navigate({ to: "/descobrir-status" })}>
              <Sparkles className="size-4" /> <span className="text-[10px] sm:text-sm">Stories</span>
            </Button>
            <Button size="sm" variant="secondary" className="min-w-0 flex-col sm:flex-row h-11 sm:h-9 px-1.5 sm:px-3 gap-0.5 sm:gap-1.5" onClick={() => navigate({ to: "/live" })}>
              <Radio className="size-4" /> <span className="text-[10px] sm:text-sm">Lives</span>
            </Button>
            <Button size="sm" variant="secondary" className="min-w-0 flex-col sm:flex-row h-11 sm:h-9 px-1.5 sm:px-3 gap-0.5 sm:gap-1.5" onClick={() => navigate({ to: "/meet/wavechat-geral" })}>
              <Monitor className="size-4" /> <span className="text-[10px] sm:text-sm">Meet</span>
            </Button>
            <Button size="sm" variant="secondary" className="min-w-0 flex-col sm:flex-row h-11 sm:h-9 px-1.5 sm:px-3 gap-0.5 sm:gap-1.5" onClick={() => navigate({ to: "/descobrir" })}>
              <Users className="size-4" /> <span className="text-[10px] sm:text-sm">Pessoas</span>
            </Button>
            <Button size="sm" variant="outline" className="min-w-0 flex-col sm:flex-row h-11 sm:h-9 px-1.5 sm:px-3 gap-0.5 sm:gap-1.5" onClick={() => (user ? navigate({ to: "/chat" }) : gate("message", () => navigate({ to: "/chat" })))}>
              <MessageCircle className="size-4" /> <span className="text-[10px] sm:text-sm">Chat</span>
            </Button>
          </div>
        </nav>

        {/* STORIES STRIP — sempre visível */}
        <div className="mx-auto max-w-6xl border-t border-border/60">
          <div className="flex gap-3 overflow-x-auto px-3 sm:px-4 py-3 snap-x">
            <button
              onClick={() => gate("create_status", () => setComposerOpen(true))}
              className="shrink-0 flex flex-col items-center gap-1 w-16 snap-start"
              title="Criar story"
            >
              <div className="size-16 rounded-full p-[2px] bg-gradient-to-tr from-primary to-accent">
                <div className="size-full rounded-full bg-background grid place-items-center ring-2 ring-background">
                  <Plus className="size-6 text-primary" />
                </div>
              </div>
              <span className="text-[10px] truncate w-full text-center font-medium">Seu story</span>
            </button>
            {statuses === null ? (
              Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="shrink-0 w-16 snap-start">
                  <div className="size-16 rounded-full bg-muted animate-pulse" />
                  <div className="h-2 mt-1 rounded bg-muted animate-pulse" />
                </div>
              ))
            ) : statuses.length === 0 ? (
              <Link to="/descobrir-status" className="shrink-0 flex items-center gap-2 px-4 rounded-full bg-muted/60 hover:bg-muted text-xs text-muted-foreground self-center h-10">
                <Sparkles className="size-4" /> Descobrir stories
              </Link>
            ) : (
              statuses.map((s) => (
                <Link
                  key={s.status_id}
                  to="/s/$statusId"
                  params={{ statusId: s.status_id }}
                  className="shrink-0 flex flex-col items-center gap-1 w-16 snap-start"
                >
                  <div className="size-16 rounded-full p-[2px] bg-gradient-to-tr from-pink-500 via-fuchsia-500 to-yellow-400">
                    <Avatar className="size-full ring-2 ring-background">
                      <AvatarImage src={s.avatar_url ?? undefined} />
                      <AvatarFallback className="text-xs">{(s.display_name ?? s.username).slice(0, 2).toUpperCase()}</AvatarFallback>
                    </Avatar>
                  </div>
                  <span className="text-[10px] truncate w-full text-center">{s.display_name ?? s.username}</span>
                </Link>
              ))
            )}
          </div>
        </div>
      </header>


      {/* MAIN LAYOUT — feed + side rail */}
      <main className="mx-auto max-w-6xl px-3 sm:px-4 py-4 grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_320px] gap-6">
        {/* FEED */}
        <section className="min-w-0 max-w-xl mx-auto w-full" id="posts">
          <div className="mb-3 flex items-center justify-between px-1">
            <h1 className="text-base font-bold">Posts</h1>
            <Button size="sm" variant="ghost" className="gap-1.5" onClick={() => gate("create_status", () => setComposerOpen(true))}>
              <Plus className="size-4" /> Postar
            </Button>
          </div>

          {lives.length > 0 && (
            <div className="mb-4 rounded-2xl border border-destructive/30 bg-destructive/5 p-3">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <Radio className="size-4 text-destructive animate-pulse" />
                  <span className="text-sm font-bold">Ao vivo agora</span>
                </div>
                <Link to="/live" className="text-xs text-primary hover:underline flex items-center gap-1">
                  Ver todas <ArrowRight className="size-3" />
                </Link>
              </div>
              <div className="flex gap-2 overflow-x-auto -mx-1 px-1 pb-1">
                {lives.slice(0, 6).map((l) => (
                  <Link key={l.id} to="/live/$liveId" params={{ liveId: l.id }}
                    className="relative shrink-0 w-32 aspect-[3/4] rounded-lg overflow-hidden bg-muted group">
                    {l.cover_url || l.host?.avatar_url ? (
                      <img src={l.cover_url || l.host?.avatar_url || ""} alt={l.title}
                        className="absolute inset-0 w-full h-full object-cover group-hover:scale-105 transition" />
                    ) : (
                      <div className="absolute inset-0 bg-gradient-to-br from-pink-500 to-yellow-500" />
                    )}
                    <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent" />
                    <span className="absolute top-1 left-1 bg-red-600 text-white text-[9px] font-bold px-1 py-0.5 rounded">LIVE</span>
                    <span className="absolute top-1 right-1 flex items-center gap-0.5 text-white text-[10px] bg-black/50 px-1 rounded">
                      <Eye className="size-2.5" /> {l.viewer_count}
                    </span>
                    <div className="absolute bottom-1 left-1.5 right-1.5 text-white">
                      <p className="text-[11px] font-semibold truncate">{l.host?.display_name || l.host?.username}</p>
                      {l.total_gift_coins > 0 && (
                        <p className="text-[9px] flex items-center gap-0.5 opacity-90">
                          <Coins className="size-2.5 text-yellow-400" /> {l.total_gift_coins}
                        </p>
                      )}
                    </div>
                  </Link>
                ))}
              </div>
            </div>
          )}

          {feed.isLoading && (
            <div className="grid place-items-center py-20"><Loader2 className="size-6 animate-spin opacity-60" /></div>
          )}
          {!feed.isLoading && items.length === 0 && (
            <div className="text-center py-20 px-6 space-y-3">
              <Sparkles className="size-10 mx-auto text-primary" />
              <p className="text-muted-foreground">Nenhum post público ainda. Seja o primeiro!</p>
              <Button onClick={() => gate("create_status", () => setComposerOpen(true))}>Criar post</Button>
            </div>
          )}
          {items.map((p) => (
            <PostCard
              key={p.post_id}
              post={p}
              onChange={(po) => patch(p.post_id, po)}
              onOpenComments={() => setCommentsFor(p.post_id)}
              onBoost={() => setBoostFor(p.post_id)}
              onDeleted={() => feed.refetch()}
            />
          ))}
          {feed.hasNextPage && (
            <div className="grid place-items-center py-6">
              <Button variant="outline" onClick={() => feed.fetchNextPage()} disabled={feed.isFetchingNextPage}>
                {feed.isFetchingNextPage ? <Loader2 className="size-4 animate-spin" /> : "Carregar mais"}
              </Button>
            </div>
          )}
        </section>

        {/* SIDE RAIL — desktop only */}
        <aside className="hidden lg:block space-y-4 sticky top-[64px] self-start">
          <SideCard title="Pessoas pra conhecer" icon={<Users className="size-4 text-primary" />} viewAll={() => navigate({ to: "/descobrir" })}>
            {profiles === null ? <SideLoader /> : profiles.slice(0, 5).map((p) => (
              <Link key={p.id} to="/u/$username" params={{ username: p.username }}
                className="flex items-center gap-2 p-1.5 rounded-lg hover:bg-accent/40 transition">
                <Avatar className="size-9">
                  <AvatarImage src={p.avatar_url ?? undefined} />
                  <AvatarFallback className="text-[10px]">{(p.display_name ?? p.username).slice(0, 2).toUpperCase()}</AvatarFallback>
                </Avatar>
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-semibold truncate">{p.display_name ?? p.username}</p>
                  <p className="text-[10px] text-muted-foreground truncate">@{p.username}</p>
                </div>
              </Link>
            ))}
          </SideCard>

          <SideCard title="Comunidades populares" icon={<Globe className="size-4 text-primary" />} viewAll={() => navigate({ to: "/descobrir" })}>
            {groups === null ? <SideLoader /> : groups.slice(0, 5).map((g) => (
              <Link key={g.id} to="/g/$groupId" params={{ groupId: g.id }}
                className="flex items-center gap-2 p-1.5 rounded-lg hover:bg-accent/40 transition">
                <Avatar className="size-9">
                  <AvatarImage src={g.avatar_url ?? undefined} />
                  <AvatarFallback className="text-[10px]">{g.name?.slice(0, 2).toUpperCase() ?? "GR"}</AvatarFallback>
                </Avatar>
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-semibold truncate">{g.name}</p>
                  <div className="flex items-center gap-1">
                    {g.category && <Badge variant="secondary" className="text-[9px] px-1 py-0">{CATEGORY_LABEL[g.category]}</Badge>}
                    <span className="text-[10px] text-muted-foreground">{g.member_count} memb.</span>
                  </div>
                </div>
              </Link>
            ))}
          </SideCard>

          <div className="rounded-2xl border border-border bg-card p-3 flex items-center gap-3">
            <div className="size-10 rounded-full bg-primary/10 grid place-items-center shrink-0">
              <Monitor className="size-5 text-primary" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-bold">Sala Meet pública</p>
              <p className="text-[10px] text-muted-foreground">Entre na sala de vídeo</p>
            </div>
            <Button size="sm" variant="outline" onClick={() => navigate({ to: "/meet/wavechat-geral" })}>Entrar</Button>
          </div>

          <nav className="text-[10px] text-muted-foreground flex flex-wrap gap-x-2 gap-y-1 px-2">
            <Link to="/about" className="hover:text-foreground">Sobre</Link>·
            <Link to="/diretrizes" className="hover:text-foreground">Diretrizes</Link>·
            <Link to="/privacy" className="hover:text-foreground">Privacidade</Link>·
            <Link to="/terms" className="hover:text-foreground">Termos</Link>·
            <Link to="/contact" className="hover:text-foreground">Contato</Link>
          </nav>
        </aside>
      </main>

      <PostComposer open={composerOpen} onOpenChange={setComposerOpen} onCreated={() => feed.refetch()} />
      {commentsFor && <PostComments open={!!commentsFor} onOpenChange={(v) => !v && setCommentsFor(null)} postId={commentsFor} onCountChange={(n) => patch(commentsFor, { comments_count: n })} />}
      {boostFor && <PostBoostDialog open={!!boostFor} onOpenChange={(v) => !v && setBoostFor(null)} postId={boostFor} />}
    </div>
  );
}

function SideCard({ title, icon, viewAll, children }: { title: string; icon: React.ReactNode; viewAll?: () => void; children: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-border bg-card p-3">
      <div className="flex items-center justify-between mb-2 px-1">
        <div className="flex items-center gap-1.5">{icon}<h3 className="text-xs font-bold">{title}</h3></div>
        {viewAll && (
          <button onClick={viewAll} className="text-[10px] text-primary hover:underline flex items-center gap-0.5">
            Ver <ArrowRight className="size-2.5" />
          </button>
        )}
      </div>
      <div className="space-y-0.5">{children}</div>
    </div>
  );
}

function SideLoader() {
  return <div className="flex justify-center py-4"><Loader2 className="size-4 animate-spin text-muted-foreground" /></div>;
}
