import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { ArrowLeft, Loader2, Send, Trash2, MessageCircle, Eye, Flag, Reply, Share2, SmilePlus } from "lucide-react";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";

import { shareMessageExternally } from "@/lib/share-message";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { formatTime } from "@/lib/format-time";
import { getOrCreateDirectConversation } from "@/lib/direct-conversation";
import { sendStatusPush } from "@/lib/status-push.functions";

export const Route = createFileRoute("/s/$statusId")({
  component: StatusPublicPage,
  head: () => ({
    meta: [
      { title: `Publicação no WaveChat` },
      { name: "description", content: `Veja e comente esta publicação no WaveChat.` },
      { property: "og:title", content: "Publicação no WaveChat" },
      { property: "og:description", content: "Veja, comente e converse no WaveChat." },
    ],
  }),
});

type StatusRow = {
  id: string;
  user_id: string;
  kind: "text" | "image" | "video";
  content: string | null;
  media_url: string | null;
  caption: string | null;
  background: string | null;
  created_at: string;
};

type Author = {
  id: string;
  display_name: string;
  username: string | null;
  avatar_url: string | null;
};

type CommentRow = {
  id: string;
  user_id: string;
  content: string;
  created_at: string;
  parent_id: string | null;
};

type CommentReaction = { emoji: string; user_id: string };

type Comment = CommentRow & {
  author: { display_name: string; username: string | null; avatar_url: string | null } | null;
};

const REACTION_EMOJIS = ["❤️", "👍", "😂", "😮", "😢", "🔥", "🎉", "👏"];


function StatusPublicPage() {
  const { statusId } = Route.useParams();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [status, setStatus] = useState<StatusRow | null>(null);
  const [author, setAuthor] = useState<Author | null>(null);
  const [comments, setComments] = useState<Comment[]>([]);
  const [reactionsByComment, setReactionsByComment] = useState<Record<string, CommentReaction[]>>({});

  const [viewCount, setViewCount] = useState<number>(0);
  const [shareCount, setShareCount] = useState<number>(0);
  const [sharing, setSharing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const [replyTo, setReplyTo] = useState<Comment | null>(null);
  const [reportTarget, setReportTarget] = useState<Comment | null>(null);
  const [reportReason, setReportReason] = useState("");
  const [reportDetails, setReportDetails] = useState("");
  const [reporting, setReporting] = useState(false);

  const isOwner = !!user && status?.user_id === user.id;

  const { roots, repliesByParent } = useMemo(() => {
    const r: Comment[] = [];
    const map: Record<string, Comment[]> = {};
    for (const c of comments) {
      if (c.parent_id) {
        (map[c.parent_id] ||= []).push(c);
      } else {
        r.push(c);
      }
    }
    return { roots: r, repliesByParent: map };
  }, [comments]);

  async function loadViewCount() {
    const { data } = await supabase.rpc("get_status_view_count", { _status_id: statusId });
    if (typeof data === "number") setViewCount(data);
  }

  async function loadShareCount() {
    const { data } = await supabase.rpc("get_status_share_count", { _status_id: statusId });
    if (typeof data === "number") setShareCount(data);
  }

  async function handleShare() {
    if (!status) return;
    setSharing(true);
    try {
      await shareMessageExternally({
        content: status.caption ?? status.content ?? null,
        attachment_url: status.media_url,
        attachment_type:
          status.kind === "video" ? "video/mp4" : status.kind === "image" ? "image/jpeg" : null,
        attachment_name: status.media_url ? `wavechat-status-${status.id}` : null,
        brandWatermark: true,
      });
      if (user) {
        await supabase.rpc("record_status_share", { _status_id: statusId });
        loadShareCount();
      }
    } finally {
      setSharing(false);
    }
  }

  async function load() {
    setLoading(true);
    const { data: s } = await supabase
      .from("statuses")
      .select("id,user_id,kind,content,media_url,caption,background,created_at")
      .eq("id", statusId)
      .maybeSingle();
    if (!s) {
      setStatus(null);
      setLoading(false);
      return;
    }
    setStatus(s as StatusRow);
    const { data: p } = await supabase
      .from("profiles")
      .select("id,display_name,username,avatar_url")
      .eq("id", s.user_id)
      .maybeSingle();
    setAuthor((p as Author) ?? null);
    await Promise.all([loadComments(), loadViewCount(), loadShareCount()]);
    setLoading(false);
  }

  async function loadComments() {
    const { data } = await supabase
      .from("status_comments")
      .select("id,user_id,content,created_at,parent_id")
      .eq("status_id", statusId)
      .order("created_at", { ascending: true });
    const rows = (data ?? []) as CommentRow[];
    if (rows.length === 0) {
      setComments([]);
      setReactionsByComment({});
      return;
    }
    const ids = Array.from(new Set(rows.map((r) => r.user_id)));
    const { data: profs } = await supabase
      .from("profiles")
      .select("id,display_name,username,avatar_url")
      .in("id", ids);
    const map = new Map<string, Comment["author"]>(
      (profs ?? []).map((p: any) => [
        p.id,
        { display_name: p.display_name, username: p.username, avatar_url: p.avatar_url },
      ]),
    );
    setComments(rows.map((r) => ({ ...r, author: map.get(r.user_id) ?? null })));

    const commentIds = rows.map((r) => r.id);
    const { data: reacts } = await supabase
      .from("status_comment_reactions" as any)
      .select("comment_id,emoji,user_id")
      .in("comment_id", commentIds);
    const byComment: Record<string, CommentReaction[]> = {};
    for (const r of (reacts ?? []) as any[]) {
      (byComment[r.comment_id] ||= []).push({ emoji: r.emoji, user_id: r.user_id });
    }
    setReactionsByComment(byComment);
  }

  async function toggleCommentReaction(commentId: string, emoji: string) {
    if (!user) {
      navigate({ to: "/auth" });
      return;
    }
    const existing = (reactionsByComment[commentId] ?? []).find(
      (r) => r.user_id === user.id && r.emoji === emoji,
    );
    if (existing) {
      const { error } = await supabase
        .from("status_comment_reactions" as any)
        .delete()
        .eq("comment_id", commentId)
        .eq("user_id", user.id)
        .eq("emoji", emoji);
      if (error) return toast.error(error.message);
    } else {
      const { error } = await supabase
        .from("status_comment_reactions" as any)
        .insert({ comment_id: commentId, user_id: user.id, emoji });
      if (error) return toast.error(error.message);
      // Fire-and-forget push to the comment author
      sendStatusPush({
        data: { statusId, kind: "comment_reaction", commentId, emoji },
      }).catch(() => {});
    }
    loadComments();
  }


  useEffect(() => {
    load();
    const ch = supabase
      .channel(`status_comments:${statusId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "status_comments", filter: `status_id=eq.${statusId}` },
        () => {
          loadComments();
        },
      )
      .subscribe();
    return () => {
      supabase.removeChannel(ch);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [statusId]);

  async function postComment() {
    if (!user) {
      navigate({ to: "/auth" });
      return;
    }
    const value = text.trim();
    if (!value) return;
    setSending(true);
    const parentId = replyTo?.id ?? null;
    const { error } = await supabase.from("status_comments").insert({
      status_id: statusId,
      user_id: user.id,
      content: value.slice(0, 1000),
      parent_id: parentId,
    });
    setSending(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    // Fire-and-forget push to status owner or parent-comment author
    sendStatusPush({
      data: {
        statusId,
        kind: parentId ? "reply" : "comment",
        commentId: parentId ?? undefined,
        preview: value.slice(0, 120),
      },
    }).catch(() => {});
    setText("");
    setReplyTo(null);
    loadComments();
  }

  async function deleteComment(id: string) {
    if (!confirm("Apagar este comentário?")) return;
    const { error } = await supabase.from("status_comments").delete().eq("id", id);
    if (error) toast.error(error.message);
    else loadComments();
  }

  async function deleteStatus() {
    if (!status) return;
    if (!confirm("Apagar esta publicação? Os comentários serão removidos.")) return;
    const { error } = await supabase.from("statuses").delete().eq("id", status.id);
    if (error) toast.error(error.message);
    else {
      toast.success("Publicação apagada");
      navigate({ to: "/" });
    }
  }

  async function startChat(targetUserId: string) {
    if (!user) {
      navigate({ to: "/auth" });
      return;
    }
    if (targetUserId === user.id) return;
    try {
      const convId = await getOrCreateDirectConversation(user.id, targetUserId);
      navigate({ to: "/chat/$conversationId", params: { conversationId: convId } });
    } catch (e: any) {
      toast.error(e?.message ?? "Erro ao abrir conversa");
    }
  }

  async function submitReport() {
    if (!user || !reportTarget) return;
    if (reportReason.trim().length < 3) {
      toast.error("Selecione um motivo");
      return;
    }
    setReporting(true);
    const { error } = await supabase.from("content_reports").insert({
      reporter_id: user.id,
      reported_user_id: reportTarget.user_id,
      target_type: "status_comment" as any,
      target_id: reportTarget.id,
      reason: reportReason,
      details: reportDetails.slice(0, 1000) || null,
    });
    setReporting(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Denúncia enviada. Nossa moderação vai analisar.");
    setReportTarget(null);
    setReportReason("");
    setReportDetails("");
  }

  if (loading) {
    return (
      <div className="min-h-screen grid place-items-center">
        <Loader2 className="size-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!status) {
    return (
      <div className="min-h-screen grid place-items-center p-6 text-center">
        <div>
          <p className="text-lg font-semibold mb-2">Publicação não encontrada</p>
          <p className="text-sm text-muted-foreground mb-4">
            Ela pode ter sido apagada ou expirado.
          </p>
          <Button asChild>
            <Link to="/">Voltar ao início</Link>
          </Button>
        </div>
      </div>
    );
  }

  const renderComment = (c: Comment, depth = 0) => {
    const canDelete = !!user && (c.user_id === user.id || status.user_id === user.id);
    const canReport = !!user && c.user_id !== user.id;
    const childReplies = repliesByParent[c.id] ?? [];
    const reactions = reactionsByComment[c.id] ?? [];
    const counts: Record<string, { count: number; mine: boolean }> = {};
    for (const r of reactions) {
      const entry = (counts[r.emoji] ||= { count: 0, mine: false });
      entry.count += 1;
      if (user && r.user_id === user.id) entry.mine = true;
    }
    const sortedEmojis = Object.keys(counts).sort((a, b) => counts[b].count - counts[a].count);

    return (
      <li key={c.id} className={depth > 0 ? "ml-10" : ""}>
        <div className="flex items-start gap-2.5">
          <Avatar className="size-8">
            <AvatarImage src={c.author?.avatar_url ?? undefined} />
            <AvatarFallback>{c.author?.display_name?.[0] ?? "?"}</AvatarFallback>
          </Avatar>
          <div className="flex-1 min-w-0">
            <div className="rounded-2xl bg-muted px-3 py-2">
              <div className="flex items-center gap-2 mb-0.5">
                {c.author?.username ? (
                  <Link
                    to="/u/$username"
                    params={{ username: c.author.username }}
                    className="text-sm font-medium hover:underline truncate"
                  >
                    {c.author?.display_name ?? "Usuário"}
                  </Link>
                ) : (
                  <span className="text-sm font-medium truncate">
                    {c.author?.display_name ?? "Usuário"}
                  </span>
                )}
                <span className="text-[11px] text-muted-foreground">
                  {formatTime(c.created_at)}
                </span>
              </div>
              <p className="text-sm whitespace-pre-wrap break-words">{c.content}</p>
            </div>

            {sortedEmojis.length > 0 && (
              <div className="flex flex-wrap gap-1 mt-1 px-1">
                {sortedEmojis.map((emoji) => (
                  <button
                    key={emoji}
                    onClick={() => toggleCommentReaction(c.id, emoji)}
                    className={`text-xs rounded-full border px-2 py-0.5 flex items-center gap-1 transition ${
                      counts[emoji].mine
                        ? "bg-primary/15 border-primary/40 text-foreground"
                        : "bg-muted/60 border-border hover:bg-muted"
                    }`}
                  >
                    <span>{emoji}</span>
                    <span className="tabular-nums">{counts[emoji].count}</span>
                  </button>
                ))}
              </div>
            )}

            <div className="flex items-center gap-3 mt-1 px-2">
              <Popover>
                <PopoverTrigger asChild>
                  <button
                    className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1"
                    aria-label="Reagir"
                  >
                    <SmilePlus className="size-3.5" /> Reagir
                  </button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-1.5" align="start">
                  <div className="flex gap-0.5">
                    {REACTION_EMOJIS.map((emoji) => (
                      <button
                        key={emoji}
                        className="text-xl hover:scale-125 transition px-1.5 py-1"
                        onClick={() => toggleCommentReaction(c.id, emoji)}
                      >
                        {emoji}
                      </button>
                    ))}
                  </div>
                </PopoverContent>
              </Popover>
              {user && (

                <button
                  className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1"
                  onClick={() => {
                    setReplyTo(c);
                    setTimeout(() => {
                      document.getElementById("comment-input")?.focus();
                    }, 0);
                  }}
                >
                  <Reply className="size-3" /> Responder
                </button>
              )}
              {user && c.user_id !== user.id && (
                <button
                  className="text-xs text-muted-foreground hover:text-foreground"
                  onClick={() => startChat(c.user_id)}
                >
                  Conversar
                </button>
              )}
              {(canDelete || canReport) && (
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <button className="text-xs text-muted-foreground hover:text-foreground">
                      Mais
                    </button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="start">
                    {canReport && (
                      <DropdownMenuItem onClick={() => setReportTarget(c)}>
                        <Flag className="size-3.5 mr-2" /> Denunciar
                      </DropdownMenuItem>
                    )}
                    {canDelete && (
                      <DropdownMenuItem
                        className="text-destructive"
                        onClick={() => deleteComment(c.id)}
                      >
                        <Trash2 className="size-3.5 mr-2" /> Apagar
                      </DropdownMenuItem>
                    )}
                  </DropdownMenuContent>
                </DropdownMenu>
              )}
            </div>

            {childReplies.length > 0 && (
              <ul className="mt-2 space-y-3">
                {childReplies.map((r) => renderComment(r, depth + 1))}
              </ul>
            )}
          </div>
        </div>
      </li>
    );
  };

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-10 bg-background/80 backdrop-blur border-b">
        <div className="max-w-2xl mx-auto flex items-center gap-2 px-4 py-3">
          <Button
            size="icon"
            variant="ghost"
            onClick={() => navigate({ to: "/" })}
            aria-label="Voltar"
          >
            <ArrowLeft className="size-5" />
          </Button>
          <h1 className="text-base font-semibold">Publicação</h1>
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-4 py-4 space-y-4">
        {/* Author header */}
        <div className="flex items-center gap-3">
          <Avatar className="size-11">
            <AvatarImage src={author?.avatar_url ?? undefined} />
            <AvatarFallback>{author?.display_name?.[0] ?? "?"}</AvatarFallback>
          </Avatar>
          <div className="flex-1 min-w-0">
            {author?.username ? (
              <Link
                to="/u/$username"
                params={{ username: author.username }}
                className="font-medium hover:underline truncate block"
              >
                {author?.display_name ?? "..."}
              </Link>
            ) : (
              <p className="font-medium truncate">{author?.display_name ?? "..."}</p>
            )}
            <p className="text-xs text-muted-foreground">{formatTime(status.created_at)}</p>
          </div>
          {!isOwner && author && (
            <Button size="sm" variant="outline" onClick={() => startChat(author.id)}>
              <MessageCircle className="size-4 mr-1.5" /> Conversar
            </Button>
          )}
          {isOwner && (
            <Button size="sm" variant="destructive" onClick={deleteStatus}>
              <Trash2 className="size-4 mr-1.5" /> Apagar
            </Button>
          )}
        </div>

        {/* Status content */}
        <div className="rounded-xl overflow-hidden border bg-card">
          {status.kind === "text" && (
            <div
              className="p-8 min-h-[280px] grid place-items-center text-center text-white text-xl font-semibold break-words"
              style={{
                background: status.background ?? "linear-gradient(135deg,#7c3aed,#ec4899)",
              }}
            >
              {status.content}
            </div>
          )}
          {status.kind === "image" && status.media_url && (
            <img
              src={status.media_url}
              className="w-full max-h-[70vh] object-contain bg-black"
              alt=""
            />
          )}
          {status.kind === "video" && status.media_url && (
            <video src={status.media_url} controls playsInline className="w-full max-h-[70vh] bg-black" />
          )}
          {status.caption && status.kind !== "text" && (
            <p className="p-3 text-sm">{status.caption}</p>
          )}
        </div>

        {/* Stats bar */}
        <div className="flex items-center justify-between gap-3 text-sm text-muted-foreground">
          <div className="flex items-center gap-4 flex-wrap">
            <span className="flex items-center gap-1.5">
              <Eye className="size-4" /> {viewCount} {viewCount === 1 ? "visualização" : "visualizações"}
            </span>
            <span className="flex items-center gap-1.5">
              <MessageCircle className="size-4" /> {comments.length}{" "}
              {comments.length === 1 ? "comentário" : "comentários"}
            </span>
            <span className="flex items-center gap-1.5">
              <Share2 className="size-4" /> {shareCount}{" "}
              {shareCount === 1 ? "compartilhamento" : "compartilhamentos"}
            </span>
          </div>
          <Button size="sm" variant="outline" onClick={handleShare} disabled={sharing}>
            <Share2 className="size-4 mr-1.5" /> Compartilhar
          </Button>
        </div>


        {/* Comments */}
        <section className="space-y-3">
          <h2 className="font-semibold text-sm text-muted-foreground">Comentários</h2>

          {user ? (
            <div className="space-y-1.5">
              {replyTo && (
                <div className="flex items-center justify-between text-xs bg-muted/60 rounded-md px-2 py-1">
                  <span className="truncate">
                    Respondendo a{" "}
                    <strong>{replyTo.author?.display_name ?? "Usuário"}</strong>
                  </span>
                  <button
                    className="text-muted-foreground hover:text-foreground"
                    onClick={() => setReplyTo(null)}
                  >
                    Cancelar
                  </button>
                </div>
              )}
              <div className="flex items-center gap-2">
                <Input
                  id="comment-input"
                  value={text}
                  onChange={(e) => setText(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault();
                      postComment();
                    }
                  }}
                  placeholder={
                    replyTo
                      ? `Responder a ${replyTo.author?.display_name ?? "comentário"}...`
                      : "Escreva um comentário..."
                  }
                  maxLength={1000}
                  disabled={sending}
                />
                <Button
                  size="icon"
                  onClick={postComment}
                  disabled={sending || !text.trim()}
                  aria-label="Enviar"
                >
                  <Send className="size-4" />
                </Button>
              </div>
            </div>
          ) : (
            <div className="rounded-lg border bg-muted/40 p-3 text-sm flex items-center justify-between gap-3">
              <span>Entre para comentar e conversar com o autor.</span>
              <Button size="sm" onClick={() => navigate({ to: "/auth" })}>
                Entrar
              </Button>
            </div>
          )}

          <ul className="space-y-3">
            {roots.length === 0 && (
              <li className="text-sm text-muted-foreground text-center py-6">
                Seja o primeiro a comentar.
              </li>
            )}
            {roots.map((c) => renderComment(c, 0))}
          </ul>
        </section>
      </main>

      <Dialog open={!!reportTarget} onOpenChange={(o) => !o && setReportTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Denunciar comentário</DialogTitle>
            <DialogDescription>
              Conte para a moderação o que há de errado. Denúncias são anônimas.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-2">
              {[
                "spam",
                "assédio",
                "discurso de ódio",
                "conteúdo sexual",
                "violência",
                "outro",
              ].map((r) => (
                <Button
                  key={r}
                  type="button"
                  variant={reportReason === r ? "default" : "outline"}
                  size="sm"
                  onClick={() => setReportReason(r)}
                >
                  {r}
                </Button>
              ))}
            </div>
            <Textarea
              value={reportDetails}
              onChange={(e) => setReportDetails(e.target.value)}
              placeholder="Detalhes (opcional)"
              rows={3}
              maxLength={1000}
            />
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setReportTarget(null)}>
              Cancelar
            </Button>
            <Button onClick={submitReport} disabled={reporting || !reportReason}>
              Enviar denúncia
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
