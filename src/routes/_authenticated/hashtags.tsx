import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { ArrowLeft, Hash, Loader2, MessageSquare, Search, TrendingUp, Users, ArrowRight, Image as ImageIcon, Video, Type } from "lucide-react";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { getOrCreateDirectConversation } from "@/lib/direct-conversation";
import { cn } from "@/lib/utils";
import { FeatureTip } from "@/components/FeatureTip";

export const Route = createFileRoute("/_authenticated/hashtags")({
  component: HashtagsPage,
  head: () => ({
    meta: [
      { title: "Hashtags em alta — WaveChat" },
      {
        name: "description",
        content:
          "Veja as hashtags em alta no WaveChat, descubra quem está falando sobre cada tema e comece uma conversa direta.",
      },
    ],
  }),
});

interface TrendingTag {
  tag: string;
  uses_count: number;
  authors_count: number;
  last_used_at: string;
}

interface HashtagPerson {
  user_id: string;
  username: string;
  display_name: string;
  avatar_url: string | null;
  city: string | null;
  uses_count: number;
  last_used_at: string;
  last_status_id: string;
  last_caption: string | null;
  viewer_follows: boolean;
  shares_conversation: boolean;
}

function HashtagsPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [activeTag, setActiveTag] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const normalizedSearch = search.trim().toLowerCase().replace(/^#/, "");

  const trending = useQuery({
    queryKey: ["trending-hashtags"],
    queryFn: async () => {
      const { data, error } = await (supabase as any).rpc("get_trending_hashtags", { _limit: 50 });
      if (error) throw error;
      return (data ?? []) as TrendingTag[];
    },
  });

  const searchResults = useQuery({
    queryKey: ["hashtag-search-preview", normalizedSearch],
    enabled: normalizedSearch.length > 0,
    queryFn: async () => {
      const nowIso = new Date().toISOString();
      const { data, error } = await (supabase as any)
        .from("statuses")
        .select(
          "id, kind, content, media_url, caption, background, hashtags, created_at, user_id, profiles!inner(username, display_name, avatar_url, visibility)",
        )
        .gt("expires_at", nowIso)
        .eq("profiles.visibility", "public")
        .order("created_at", { ascending: false })
        .limit(60);
      if (error) throw error;
      const list = (data ?? []) as any[];
      return list.filter((s) =>
        Array.isArray(s.hashtags) &&
        s.hashtags.some((h: string) => (h ?? "").toLowerCase().includes(normalizedSearch)),
      );
    },
  });

  return (
    <div className="fixed inset-0 bg-background text-foreground flex flex-col">
      <header className="flex items-center gap-2 px-3 py-3 border-b bg-card/95 backdrop-blur z-10">
        <button
          onClick={() => navigate({ to: "/chat" })}
          className="size-9 grid place-items-center rounded-full hover:bg-muted"
          aria-label="Voltar"
        >
          <ArrowLeft className="size-5" />
        </button>
        <div className="flex items-center gap-2 flex-1">
          <TrendingUp className="size-5 text-primary" />
          <div>
            <h1 className="font-bold leading-tight">Hashtags em alta</h1>
            <p className="text-[11px] text-muted-foreground leading-tight">
              Últimos 7 dias · descubra pessoas que falaram do mesmo tema
            </p>
          </div>
        </div>
      </header>

      <div className="px-3 pt-3 pb-2 border-b bg-card/60">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (normalizedSearch) {
              navigate({ to: "/hashtag/$tag", params: { tag: normalizedSearch } });
            }
          }}
          className="relative"
        >
          <Search className="size-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Pesquisar hashtag (ex.: recife, viagem)"
            className="pl-9 pr-24 h-10"
          />
          {normalizedSearch && (
            <Button
              type="submit"
              size="sm"
              className="absolute right-1 top-1/2 -translate-y-1/2 h-8 gap-1"
            >
              Ver #{normalizedSearch}
              <ArrowRight className="size-3.5" />
            </Button>
          )}
        </form>
      </div>

      <div className="flex-1 overflow-y-auto">
        <div className="p-3">
          <FeatureTip id="hashtags-page" title="Como funciona o Em alta">
            Pesquise uma hashtag para ver <b>todas</b> as publicações com ela, ou toque numa
            hashtag em alta para descobrir pessoas que falaram do tema. Apenas stories <b>públicos</b> aparecem aqui.
          </FeatureTip>
        </div>

        {normalizedSearch && (
          <div className="px-3 pb-3">
            <div className="flex items-center justify-between mb-2">
              <h2 className="text-sm font-semibold flex items-center gap-1.5">
                <Hash className="size-4 text-primary" />
                Publicações com "{normalizedSearch}"
              </h2>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => navigate({ to: "/hashtag/$tag", params: { tag: normalizedSearch } })}
                className="h-7 gap-1 text-xs"
              >
                Ver tudo
                <ArrowRight className="size-3" />
              </Button>
            </div>

            {searchResults.isLoading && (
              <div className="p-6 grid place-items-center">
                <Loader2 className="size-5 animate-spin text-muted-foreground" />
              </div>
            )}

            {!searchResults.isLoading && (searchResults.data ?? []).length === 0 && (
              <div className="p-6 text-center text-xs text-muted-foreground border rounded-lg">
                Nenhuma publicação pública encontrada para essa hashtag.
              </div>
            )}

            {(searchResults.data ?? []).length > 0 && (
              <div className="grid grid-cols-3 gap-1.5">
                {(searchResults.data ?? []).slice(0, 9).map((s: any) => (
                  <Link
                    key={s.id}
                    to="/s/$statusId"
                    params={{ statusId: s.id }}
                    className="relative aspect-square rounded-md overflow-hidden bg-muted group"
                  >
                    {s.kind === "image" && s.media_url && (
                      <img src={s.media_url} alt={s.caption ?? ""} className="absolute inset-0 w-full h-full object-cover" loading="lazy" />
                    )}
                    {s.kind === "video" && s.media_url && (
                      <video src={s.media_url} className="absolute inset-0 w-full h-full object-cover" muted playsInline />
                    )}
                    {s.kind === "text" && (
                      <div
                        className="absolute inset-0 grid place-items-center p-1.5 text-center text-white text-[10px] font-semibold"
                        style={{ background: s.background ?? "linear-gradient(135deg,#6366f1,#ec4899)" }}
                      >
                        <span className="line-clamp-4">{s.content}</span>
                      </div>
                    )}
                    <div className="absolute top-1 left-1 size-5 rounded-full bg-black/60 grid place-items-center text-white">
                      {s.kind === "image" && <ImageIcon className="size-2.5" />}
                      {s.kind === "video" && <Video className="size-2.5" />}
                      {s.kind === "text" && <Type className="size-2.5" />}
                    </div>
                    <div className="absolute inset-x-0 bottom-0 px-1.5 py-1 bg-gradient-to-t from-black/80 to-transparent text-white">
                      <span className="text-[9px] font-medium truncate block">
                        @{s.profiles?.username}
                      </span>
                    </div>
                  </Link>
                ))}
              </div>
            )}

            <div className="h-px bg-border my-4" />
            <p className="text-[11px] uppercase tracking-wide text-muted-foreground mb-1 px-1">
              Hashtags relacionadas
            </p>
          </div>
        )}

        {trending.isLoading && (
          <div className="p-10 grid place-items-center">
            <Loader2 className="size-6 animate-spin text-muted-foreground" />
          </div>
        )}
          <div className="p-10 grid place-items-center">
            <Loader2 className="size-6 animate-spin text-muted-foreground" />
          </div>
        )}

        {!trending.isLoading && (trending.data ?? []).length === 0 && (
          <div className="p-10 text-center text-sm text-muted-foreground">
            Ainda não há hashtags em alta. Crie um story usando <span className="font-mono">#exemplo</span> 😉
          </div>
        )}

        <ul className="divide-y">
          {(trending.data ?? [])
            .filter((t) => !normalizedSearch || t.tag.toLowerCase().includes(normalizedSearch))
            .map((t, i) => (
            <li key={t.tag}>
              <div
                className={cn(
                  "w-full flex items-center gap-2 px-4 py-3 hover:bg-muted/50 transition",
                  activeTag === t.tag && "bg-muted/60",
                )}
              >
                <button
                  onClick={() => setActiveTag(activeTag === t.tag ? null : t.tag)}
                  className="flex items-center gap-3 flex-1 min-w-0 text-left"
                >
                  <span
                    className={cn(
                      "size-9 rounded-full grid place-items-center text-sm font-bold shrink-0",
                      i < 3 ? "bg-gradient-to-br from-primary to-pink-500 text-white" : "bg-muted text-foreground/70",
                    )}
                  >
                    {i + 1}
                  </span>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5 font-semibold truncate">
                      <Hash className="size-4 text-primary shrink-0" />
                      <span className="truncate">{t.tag}</span>
                    </div>
                    <div className="text-xs text-muted-foreground flex items-center gap-3 mt-0.5">
                      <span>{t.uses_count} {t.uses_count === 1 ? "story" : "stories"}</span>
                      <span className="flex items-center gap-1">
                        <Users className="size-3" /> {t.authors_count}
                      </span>
                    </div>
                  </div>
                </button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => navigate({ to: "/hashtag/$tag", params: { tag: t.tag } })}
                  className="shrink-0 gap-1"
                >
                  Ver
                  <ArrowRight className="size-3.5" />
                </Button>
              </div>

              {activeTag === t.tag && user && (
                <HashtagPeopleList tag={t.tag} meId={user.id} />
              )}
            </li>
          ))}

          {!trending.isLoading && normalizedSearch &&
            !(trending.data ?? []).some((t) => t.tag.toLowerCase().includes(normalizedSearch)) && (
              <li className="px-4 py-6 text-center">
                <p className="text-sm text-muted-foreground mb-3">
                  Nenhuma hashtag em alta corresponde a "{normalizedSearch}".
                </p>
                <Button
                  size="sm"
                  onClick={() => navigate({ to: "/hashtag/$tag", params: { tag: normalizedSearch } })}
                  className="gap-1"
                >
                  Ver publicações com #{normalizedSearch}
                  <ArrowRight className="size-3.5" />
                </Button>
              </li>
            )}
        </ul>
      </div>
    </div>
  );
}

function HashtagPeopleList({ tag, meId }: { tag: string; meId: string }) {
  const navigate = useNavigate();
  const people = useQuery({
    queryKey: ["hashtag-people", tag],
    queryFn: async () => {
      const { data, error } = await (supabase as any).rpc("get_hashtag_people", { _tag: tag, _limit: 30 });
      if (error) throw error;
      return (data ?? []) as HashtagPerson[];
    },
  });

  async function startChatAbout(p: HashtagPerson) {
    if (p.user_id === meId) return;
    try {
      const convId = await getOrCreateDirectConversation(meId, p.user_id);
      const draft = `Oi, ${p.display_name?.split(" ")[0] ?? p.username}! 👋 Vi que você também postou sobre #${tag} — bora trocar uma ideia sobre isso?`;
      navigate({
        to: "/chat/$conversationId",
        params: { conversationId: convId },
        search: { draft } as any,
      });
    } catch (e: any) {
      toast.error(e?.message ?? "Não foi possível abrir a conversa");
    }
  }

  if (people.isLoading) {
    return (
      <div className="px-4 py-4 grid place-items-center bg-muted/30">
        <Loader2 className="size-4 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const list = people.data ?? [];
  if (list.length === 0) {
    return (
      <div className="px-4 py-3 text-xs text-muted-foreground bg-muted/30">Ninguém público encontrado para esta hashtag.</div>
    );
  }

  return (
    <div className="bg-muted/30 px-3 py-3 space-y-1.5">
      <p className="text-[11px] uppercase tracking-wide text-muted-foreground px-1 mb-1">
        Pessoas que também usaram #{tag}
      </p>
      {list.map((p) => {
        const isMe = p.user_id === meId;
        return (
          <div
            key={p.user_id}
            className="flex items-center gap-3 px-2 py-2 rounded-lg bg-card border"
          >
            <button
              onClick={() => navigate({ to: "/u/$username", params: { username: p.username } })}
              className="shrink-0"
            >
              <Avatar className="size-10">
                <AvatarImage src={p.avatar_url ?? undefined} />
                <AvatarFallback>{p.display_name?.[0]?.toUpperCase() ?? "?"}</AvatarFallback>
              </Avatar>
            </button>
            <div className="flex-1 min-w-0">
              <div className="font-medium leading-tight truncate">{p.display_name}</div>
              <div className="text-[11px] text-muted-foreground truncate">
                @{p.username}
                {p.city ? ` · ${p.city}` : ""}
                {" · "}
                {p.uses_count}× #{tag}
              </div>
              {p.last_caption && (
                <div className="text-[11px] text-muted-foreground truncate italic mt-0.5">
                  "{p.last_caption}"
                </div>
              )}
            </div>
            {!isMe && (
              <Button size="sm" onClick={() => startChatAbout(p)} className="shrink-0 gap-1.5">
                <MessageSquare className="size-3.5" />
                {p.shares_conversation ? "Falar" : "Puxar assunto"}
              </Button>
            )}
          </div>
        );
      })}
    </div>
  );
}
