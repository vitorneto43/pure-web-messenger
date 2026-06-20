import { useEffect, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { Heart, MessageCircle, Share2, Rocket, MoreVertical, Trash2, Music, MessageSquare, BadgeCheck, Flag, Ban, UserPlus, UserCheck, Pin, PinOff } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { useAuthGate } from "@/hooks/use-auth-gate";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { StatusMusicPlayer } from "@/components/status/StatusMusicPlayer";
import { ReportContentDialog } from "@/components/ReportContentDialog";
import { blockUser } from "@/lib/moderation.functions";
import { getOrCreateDirectConversation } from "@/lib/direct-conversation";
import { cn } from "@/lib/utils";
import { track } from "@/lib/track";
import { formatTime } from "@/lib/format-time";
import { linkify } from "@/lib/linkify";

export interface PostItem {
  post_id: string;
  user_id: string;
  username: string;
  display_name: string;
  avatar_url: string | null;
  kind: "text" | "image" | "video";
  content: string | null;
  media_url: string | null;
  thumbnail_url?: string | null;
  caption: string | null;
  background: string | null;
  hashtags: string[];
  music_track_id: string | null;
  created_at: string;
  is_official: boolean;
  reactions_count: number;
  comments_count: number;
  views_count: number;
  is_boosted: boolean;
  viewer_already_liked: boolean;
  pinned?: boolean;
}

interface Props {
  post: PostItem;
  onChange: (patch: Partial<PostItem>) => void;
  onOpenComments: () => void;
  onBoost: () => void;
  onDeleted?: () => void;
}

export function PostCard({ post, onChange, onOpenComments, onBoost, onDeleted }: Props) {
  const { user } = useAuth();
  const { gate, GateDialog } = useAuthGate();
  const navigate = useNavigate();
  const isOwner = user?.id === post.user_id;
  const [reportOpen, setReportOpen] = useState(false);
  const [hidden, setHidden] = useState(false);
  const [isFollowing, setIsFollowing] = useState(false);
  const blockFn = useServerFn(blockUser);

  useEffect(() => {
    void (supabase as any).rpc("register_post_view", { _post_id: post.post_id, _session_hash: null });
  }, [post.post_id]);

  useEffect(() => {
    if (!user || isOwner) return;
    (async () => {
      const { data } = await supabase
        .from("profile_follows")
        .select("id")
        .eq("follower_id", user.id)
        .eq("following_id", post.user_id)
        .maybeSingle();
      setIsFollowing(!!data);
    })();
  }, [user?.id, post.user_id, isOwner]);

  async function handleBlock() {
    gate("react", async () => {
      if (!confirm(`Bloquear @${post.username}? Você não verá mais conteúdos dessa pessoa.`)) return;
      try {
        await blockFn({ data: { user_id: post.user_id } });
        toast.success("Usuário bloqueado");
        setHidden(true);
      } catch (e: any) {
        toast.error(e?.message ?? "Falha ao bloquear");
      }
    });
  }

  async function toggleLike() {
    gate("react", async () => {
      if (!user) return;
      const liked = post.viewer_already_liked;
      onChange({ viewer_already_liked: !liked, reactions_count: post.reactions_count + (liked ? -1 : 1) });
      if (liked) {
        await (supabase as any).from("post_reactions").delete().eq("post_id", post.post_id).eq("user_id", user.id);
      } else {
        await (supabase as any).from("post_reactions").upsert({ post_id: post.post_id, user_id: user.id, emoji: "❤️" }, { onConflict: "post_id,user_id" });
      }
    });
  }

  async function startChat() {
    gate("message", async () => {
      if (!user) return;
      try {
        const id = await getOrCreateDirectConversation(user.id, post.user_id);
        navigate({ to: "/chat/$conversationId", params: { conversationId: id } });
      } catch (e: any) { toast.error(e?.message ?? "Falha ao abrir chat"); }
    });
  }

  async function share() {
    gate("react", async () => {
      const url = `https://webconnectchat.com/p/${post.post_id}`;
      try {
        if (navigator.share) await navigator.share({ url, title: post.caption ?? `Post de @${post.username} no WaveChat` });
        else { await navigator.clipboard.writeText(url); toast.success("Link copiado!"); }
        void track("post_share", { post_id: post.post_id });
        if (user) await (supabase as any).from("post_shares").insert({ post_id: post.post_id, user_id: user.id, channel: "link" });
      } catch {}
    });
  }

  async function toggleFollow() {
    if (!user || isOwner) return;
    gate("follow", async () => {
      const { data: nowFollowing, error } = await supabase.rpc("toggle_follow", { _target: post.user_id });
      if (error) {
        toast.error(error.message);
        return;
      }
      setIsFollowing(!!nowFollowing);
      toast.success(nowFollowing ? "Seguindo" : "Deixou de seguir");
    });
  }

  async function remove() {
    if (!confirm("Apagar este post?")) return;
    const { error } = await (supabase as any).from("posts").delete().eq("id", post.post_id);
    if (error) { toast.error(error.message); return; }
    toast.success("Post apagado");
    onDeleted?.();
  }

  async function togglePin() {
    if (!isOwner) return;
    const { data, error } = await (supabase as any).rpc("toggle_post_pin", { _post_id: post.post_id });
    if (error) { toast.error(error.message); return; }
    onChange({ pinned: !!data });
    toast.success(data ? "Post fixado no perfil" : "Post desafixado");
  }

  const isMedia = post.kind !== "text" && post.media_url;

  if (hidden) return null;

  return (
    <article className="border-b border-border bg-background">
      {GateDialog}
      <ReportContentDialog
        open={reportOpen}
        onOpenChange={setReportOpen}
        targetType="post"
        targetId={post.post_id}
        reportedUserId={post.user_id}
      />
      <header className="flex items-center gap-3 p-3">
        <button onClick={() => navigate({ to: "/u/$username", params: { username: post.username } })}>
          <Avatar className="size-10">
            <AvatarImage src={post.avatar_url ?? undefined} />
            <AvatarFallback>{post.display_name[0]?.toUpperCase()}</AvatarFallback>
          </Avatar>
        </button>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5 text-sm">
            <span className="font-semibold truncate">{post.display_name}</span>
            {post.is_official && <BadgeCheck className="size-4 text-sky-500" />}
            {!isOwner && user && (
              <button
                onClick={toggleFollow}
                className={cn(
                  "ml-1 text-xs font-medium px-2 py-0.5 rounded-full border transition",
                  isFollowing
                    ? "border-primary/30 text-primary bg-primary/10"
                    : "border-primary text-primary hover:bg-primary/10"
                )}
              >
                {isFollowing ? "Seguindo" : "Seguir"}
              </button>
            )}
          </div>
          <div className="text-xs text-muted-foreground flex items-center gap-1.5">
            <span>@{post.username}</span>
            <span>·</span>
            <span>{formatTime(post.created_at)}</span>
            {post.is_boosted && <span className="ml-1 text-[10px] uppercase font-bold text-pink-500">Patrocinado</span>}
          </div>
        </div>
        <DropdownMenu>
          <DropdownMenuTrigger asChild><Button size="icon" variant="ghost"><MoreVertical className="size-4" /></Button></DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            {isOwner ? (
              <DropdownMenuItem onClick={remove} className="text-destructive"><Trash2 className="size-4 mr-2" />Apagar post</DropdownMenuItem>
            ) : (
              <>
                <DropdownMenuItem onClick={() => gate("react", () => setReportOpen(true))}>
                  <Flag className="size-4 mr-2" />Denunciar post
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={handleBlock} className="text-destructive">
                  <Ban className="size-4 mr-2" />Bloquear @{post.username}
                </DropdownMenuItem>
              </>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      </header>


      {/* Body */}
      {post.kind === "text" && (
        <div className="px-4 py-8 text-center" style={{ background: post.background ?? "linear-gradient(135deg,#6366f1,#ec4899)", color: "white" }}>
          <p className="text-xl font-semibold whitespace-pre-wrap">{linkify(post.content, "underline break-all")}</p>
        </div>
      )}
      {isMedia && post.kind === "image" && (
        <img src={post.media_url!} alt="" className="w-full max-h-[600px] object-contain bg-black" loading="lazy" />
      )}
      {isMedia && post.kind === "video" && (
        <video src={post.media_url!} className="w-full max-h-[600px] bg-black" controls playsInline muted preload="metadata" />
      )}

      {/* Actions */}
      <div className="flex items-center gap-1 px-2 py-2">
        <Button variant="ghost" size="sm" onClick={toggleLike}>
          <Heart className={cn("size-5 mr-1", post.viewer_already_liked && "fill-rose-500 text-rose-500")} />
          {post.reactions_count}
        </Button>
        <Button variant="ghost" size="sm" onClick={onOpenComments}>
          <MessageCircle className="size-5 mr-1" />{post.comments_count}
        </Button>
        <Button variant="ghost" size="sm" onClick={share}>
          <Share2 className="size-5" />
        </Button>
        <Button variant="ghost" size="sm" onClick={startChat}>
          <MessageSquare className="size-5 mr-1" />Chat
        </Button>
        <div className="flex-1" />
        {isOwner && (
          <>
            <Button variant="ghost" size="sm" onClick={togglePin} title={post.pinned ? "Desafixar" : "Fixar no perfil"}>
              {post.pinned ? <PinOff className="size-5" /> : <Pin className="size-5" />}
            </Button>
            <Button variant="ghost" size="sm" onClick={onBoost} className="text-pink-500">
              <Rocket className="size-5 mr-1" />Impulsionar
            </Button>
          </>
        )}
      </div>

      {/* Caption */}
      {post.caption && (
        <p className="px-4 pb-3 text-sm">
          <span className="font-semibold mr-2">@{post.username}</span>
          {post.caption}
        </p>
      )}

      {/* Music tag — at the bottom of the post */}
      {post.music_track_id && (
        <div className="px-3 pb-3">
          <StatusMusicPlayer trackId={post.music_track_id} startSec={0} durationSec={30} volume={0.8} autoplay={false} inline />
        </div>
      )}
    </article>
  );
}
