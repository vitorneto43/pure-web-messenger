import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useInfiniteQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useRef, useState } from "react";
import { Loader2, Heart, MessageCircle, UserPlus, UserCheck, MessageSquare, ArrowLeft, Globe2, MapPin, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { useAuthGate } from "@/hooks/use-auth-gate";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { UserBadges } from "@/components/badges/UserBadges";
import { getOrCreateDirectConversation } from "@/lib/direct-conversation";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/descobrir-status")({
  component: DiscoverStatusPage,
  head: () => ({
    meta: [
      { title: "Descobrir status — WaveChat" },
      { name: "description", content: "Descubra status públicos de pessoas no WaveChat — curta, comente, siga e converse." },
    ],
  }),
});

interface DiscoverStatus {
  status_id: string;
  user_id: string;
  username: string;
  display_name: string;
  avatar_url: string | null;
  city: string | null;
  kind: "text" | "image" | "video";
  content: string | null;
  media_url: string | null;
  caption: string | null;
  background: string | null;
  cta_url: string | null;
  cta_label: string | null;
  created_at: string;
  expires_at: string;
  is_official: boolean;
  reactions_count: number;
  comments_count: number;
  views_count: number;
  is_boosted: boolean;
  viewer_already_liked: boolean;
  viewer_already_follows: boolean;
}

const PAGE_SIZE = 12;

function DiscoverStatusPage() {
  const { user } = useAuth();
  const { gate, GateDialog } = useAuthGate();
  const navigate = useNavigate();
  const qc = useQueryClient();

  const query = useInfiniteQuery({
    queryKey: ["discover-status", user?.id ?? "guest"],
    initialPageParam: 0,
    queryFn: async ({ pageParam }) => {
      const { data, error } = await (supabase as any).rpc("discover_public_statuses", {
        _limit: PAGE_SIZE,
        _offset: pageParam,
      });
      if (error) throw error;
      return (data ?? []) as DiscoverStatus[];
    },
    getNextPageParam: (last, all) => (last.length < PAGE_SIZE ? undefined : all.length * PAGE_SIZE),
  });

  const items = useMemo(() => query.data?.pages.flat() ?? [], [query.data]);

  const containerRef = useRef<HTMLDivElement>(null);
  const [activeIndex, setActiveIndex] = useState(0);

  // Auto-load next page near end
  useEffect(() => {
    if (activeIndex >= items.length - 3 && query.hasNextPage && !query.isFetchingNextPage) {
      void query.fetchNextPage();
    }
  }, [activeIndex, items.length, query]);

  // Register view as user reaches each card
  useEffect(() => {
    const current = items[activeIndex];
    if (!current) return;
    Promise.resolve((supabase as any).rpc("register_status_view", { _status_id: current.status_id })).catch(() => {});
  }, [activeIndex, items]);

  function patch(statusId: string, partial: Partial<DiscoverStatus>) {
    qc.setQueryData(["discover-status", user?.id], (old: any) => {
      if (!old) return old;
      return {
        ...old,
        pages: old.pages.map((page: DiscoverStatus[]) =>
          page.map((s) => (s.status_id === statusId ? { ...s, ...partial } : s)),
        ),
      };
    });
  }

  async function toggleLike(s: DiscoverStatus) {
    gate("react", async () => {
      if (!user) return;
      const liked = s.viewer_already_liked;
      patch(s.status_id, {
        viewer_already_liked: !liked,
        reactions_count: s.reactions_count + (liked ? -1 : 1),
      });
      if (liked) {
        await (supabase as any).from("status_reactions").delete().eq("status_id", s.status_id).eq("user_id", user.id);
      } else {
        await (supabase as any).from("status_reactions").upsert({ status_id: s.status_id, user_id: user.id, emoji: "❤️" }, { onConflict: "status_id,user_id" });
      }
    });
  }

  async function toggleFollow(s: DiscoverStatus) {
    gate("follow", async () => {
      if (!user || user.id === s.user_id) return;
      const following = s.viewer_already_follows;
      patch(s.status_id, { viewer_already_follows: !following });
      if (following) {
        await supabase.from("profile_follows").delete().eq("follower_id", user.id).eq("following_id", s.user_id);
        toast.message(`Você deixou de seguir @${s.username}`);
      } else {
        await supabase.from("profile_follows").insert({ follower_id: user.id, following_id: s.user_id });
        toast.success(`Você está seguindo @${s.username}`);
      }
    });
  }

  async function startChat(s: DiscoverStatus) {
    gate("message", async () => {
      if (!user) return;
      try {
        const id = await getOrCreateDirectConversation(user.id, s.user_id);
        navigate({ to: "/chat/$conversationId", params: { conversationId: id } });
      } catch (e: any) {
        toast.error(e?.message ?? "Não foi possível abrir a conversa");
      }
    });
  }

  return (
    <div className="fixed inset-0 bg-black text-white flex flex-col">
      {GateDialog}
      <header className="flex items-center justify-between gap-2 px-3 py-2 border-b border-white/10 bg-black/80 backdrop-blur z-10">
        <button onClick={() => navigate({ to: user ? "/chat" : "/descobrir" })} className="size-9 grid place-items-center rounded-full hover:bg-white/10">
          <ArrowLeft className="size-5" />
        </button>
        <div className="flex items-center gap-2">
          <Globe2 className="size-4 text-primary" />
          <span className="font-bold">Descobrir status</span>
        </div>
        {user ? <div className="size-9" /> : (
          <Button size="sm" onClick={() => navigate({ to: "/auth" })}>Entrar</Button>
        )}
      </header>

      {query.isLoading && (
        <div className="flex-1 grid place-items-center">
          <Loader2 className="size-6 animate-spin opacity-70" />
        </div>
      )}

      {!query.isLoading && items.length === 0 && (
        <div className="flex-1 grid place-items-center px-6 text-center">
          <div className="space-y-3 max-w-sm">
            <Sparkles className="size-10 mx-auto text-primary" />
            <h2 className="text-lg font-bold">Sem status públicos por enquanto</h2>
            <p className="text-sm text-white/70">Volte em instantes — novos status aparecem o tempo todo.</p>
            <Button onClick={() => navigate({ to: "/chat" })}>Voltar ao chat</Button>
          </div>
        </div>
      )}

      {items.length > 0 && (
        <div
          ref={containerRef}
          className="flex-1 overflow-y-auto snap-y snap-mandatory scroll-smooth scrollbar-thin"
          onScroll={(e) => {
            const el = e.currentTarget;
            const idx = Math.round(el.scrollTop / el.clientHeight);
            if (idx !== activeIndex) setActiveIndex(idx);
          }}
        >
          {items.map((s) => (
            <DiscoverCard
              key={s.status_id}
              s={s}
              onLike={() => toggleLike(s)}
              onFollow={() => toggleFollow(s)}
              onChat={() => startChat(s)}
              onComment={() => navigate({ to: "/s/$statusId", params: { statusId: s.status_id } })}
              onProfile={() => navigate({ to: "/u/$username", params: { username: s.username } })}
            />
          ))}
          {query.isFetchingNextPage && (
            <div className="h-16 grid place-items-center">
              <Loader2 className="size-5 animate-spin opacity-70" />
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function DiscoverCard({
  s,
  onLike,
  onFollow,
  onChat,
  onComment,
  onProfile,
}: {
  s: DiscoverStatus;
  onLike: () => void;
  onFollow: () => void;
  onChat: () => void;
  onComment: () => void;
  onProfile: () => void;
}) {
  const isMedia = s.kind !== "text" && s.media_url;

  return (
    <article className="h-[calc(100dvh-49px)] snap-start relative flex">
      {/* Background */}
      <div
        className="absolute inset-0"
        style={
          isMedia
            ? undefined
            : { background: s.background || "linear-gradient(135deg,#6366f1,#ec4899)" }
        }
      >
        {isMedia && s.kind === "image" && (
          <img src={s.media_url!} alt="" className="w-full h-full object-contain bg-black" loading="lazy" />
        )}
        {isMedia && s.kind === "video" && (
          <video src={s.media_url!} className="w-full h-full object-contain bg-black" playsInline muted loop autoPlay />
        )}
      </div>

      {/* Gradient overlays */}
      <div className="absolute inset-x-0 top-0 h-24 bg-gradient-to-b from-black/60 to-transparent pointer-events-none" />
      <div className="absolute inset-x-0 bottom-0 h-40 bg-gradient-to-t from-black/80 to-transparent pointer-events-none" />

      {/* Text content for text-kind status */}
      {!isMedia && s.content && (
        <div className="relative z-[1] flex-1 grid place-items-center px-8 text-center">
          <p className="text-2xl font-semibold leading-snug whitespace-pre-wrap">{s.content}</p>
        </div>
      )}

      {/* Boosted/Official tag */}
      <div className="absolute top-3 left-3 z-[2] flex gap-1.5">
        {s.is_official && (
          <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-sky-500/90">OFICIAL</span>
        )}
        {s.is_boosted && (
          <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-pink-500/90">PATROCINADO</span>
        )}
      </div>

      {/* Footer info */}
      <div className="absolute inset-x-0 bottom-0 z-[2] p-4 pr-20 space-y-2">
        <button onClick={onProfile} className="flex items-center gap-2 group">
          <Avatar className="size-10 ring-2 ring-white/40">
            <AvatarImage src={s.avatar_url ?? undefined} />
            <AvatarFallback>{s.display_name[0]?.toUpperCase()}</AvatarFallback>
          </Avatar>
          <div className="text-left">
            <div className="flex items-center gap-1.5">
              <span className="font-semibold leading-tight">{s.display_name}</span>
              <UserBadges userId={s.user_id} max={2} />
            </div>
            <div className="text-xs text-white/70 leading-tight flex items-center gap-1">
              <span>@{s.username}</span>
              {s.city && (
                <>
                  <span>·</span>
                  <MapPin className="size-3" />
                  <span>{s.city}</span>
                </>
              )}
            </div>
          </div>
        </button>
        {s.caption && <p className="text-sm text-white/90 line-clamp-3">{s.caption}</p>}
      </div>

      {/* Action rail */}
      <div className="absolute right-2 bottom-24 z-[2] flex flex-col items-center gap-4">
        <ActionButton onClick={onLike} label={String(s.reactions_count)} active={s.viewer_already_liked}>
          <Heart className={cn("size-6", s.viewer_already_liked && "fill-current text-rose-500")} />
        </ActionButton>
        <ActionButton onClick={onComment} label={String(s.comments_count)}>
          <MessageCircle className="size-6" />
        </ActionButton>
        <ActionButton onClick={onFollow} label={s.viewer_already_follows ? "Seguindo" : "Seguir"} active={s.viewer_already_follows}>
          {s.viewer_already_follows ? <UserCheck className="size-6" /> : <UserPlus className="size-6" />}
        </ActionButton>
        <ActionButton onClick={onChat} label="Chat">
          <MessageSquare className="size-6" />
        </ActionButton>
      </div>
    </article>
  );
}

function ActionButton({
  children,
  label,
  onClick,
  active,
}: {
  children: React.ReactNode;
  label: string;
  onClick: () => void;
  active?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "flex flex-col items-center gap-0.5 transition active:scale-90",
        active ? "text-rose-400" : "text-white",
      )}
    >
      <span className="size-11 rounded-full bg-black/40 backdrop-blur grid place-items-center ring-1 ring-white/10">
        {children}
      </span>
      <span className="text-[10px] font-medium drop-shadow">{label}</span>
    </button>
  );
}
