import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { ArrowLeft, Loader2, Send, Trash2, MessageCircle } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { formatTime } from "@/lib/format-time";
import { getOrCreateDirectConversation } from "@/lib/direct-conversation";

export const Route = createFileRoute("/s/$statusId")({
  component: StatusPublicPage,
  head: ({ params }) => ({
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

type Comment = {
  id: string;
  user_id: string;
  content: string;
  created_at: string;
  author: { display_name: string; username: string | null; avatar_url: string | null } | null;
};

function StatusPublicPage() {
  const { statusId } = Route.useParams();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [status, setStatus] = useState<StatusRow | null>(null);
  const [author, setAuthor] = useState<Author | null>(null);
  const [comments, setComments] = useState<Comment[]>([]);
  const [loading, setLoading] = useState(true);
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);

  const isOwner = !!user && status?.user_id === user.id;

  async function load() {
    setLoading(true);
    const { data: s, error } = await supabase
      .from("statuses")
      .select("id,user_id,kind,content,media_url,caption,background,created_at")
      .eq("id", statusId)
      .maybeSingle();
    if (error || !s) {
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
    await loadComments();
    setLoading(false);
  }

  async function loadComments() {
    const { data } = await supabase
      .from("status_comments")
      .select("id,user_id,content,created_at")
      .eq("status_id", statusId)
      .order("created_at", { ascending: true });
    const rows = (data ?? []) as Omit<Comment, "author">[];
    if (rows.length === 0) {
      setComments([]);
      return;
    }
    const ids = Array.from(new Set(rows.map((r) => r.user_id)));
    const { data: profs } = await supabase
      .from("profiles")
      .select("id,display_name,username,avatar_url")
      .in("id", ids);
    const map = new Map<string, Comment["author"]>(
      (profs ?? []).map((p: any) => [p.id, { display_name: p.display_name, username: p.username, avatar_url: p.avatar_url }]),
    );
    setComments(rows.map((r) => ({ ...r, author: map.get(r.user_id) ?? null })));
  }

  useEffect(() => {
    load();
    // realtime: refresh on new/deleted comments
    const ch = supabase
      .channel(`status_comments:${statusId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "status_comments", filter: `status_id=eq.${statusId}` }, () => {
        loadComments();
      })
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
    const { error } = await supabase.from("status_comments").insert({
      status_id: statusId,
      user_id: user.id,
      content: value.slice(0, 1000),
    });
    setSending(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    setText("");
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

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-10 bg-background/80 backdrop-blur border-b">
        <div className="max-w-2xl mx-auto flex items-center gap-2 px-4 py-3">
          <Button size="icon" variant="ghost" onClick={() => navigate({ to: "/" })} aria-label="Voltar">
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
              <Link to="/u/$username" params={{ username: author.username }} className="font-medium hover:underline truncate block">
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
              style={{ background: status.background ?? "linear-gradient(135deg,#7c3aed,#ec4899)" }}
            >
              {status.content}
            </div>
          )}
          {status.kind === "image" && status.media_url && (
            <img src={status.media_url} className="w-full max-h-[70vh] object-contain bg-black" alt="" />
          )}
          {status.kind === "video" && status.media_url && (
            <video src={status.media_url} controls playsInline className="w-full max-h-[70vh] bg-black" />
          )}
          {status.caption && status.kind !== "text" && (
            <p className="p-3 text-sm">{status.caption}</p>
          )}
        </div>

        {/* Comments */}
        <section className="space-y-3">
          <h2 className="font-semibold text-sm text-muted-foreground">
            Comentários ({comments.length})
          </h2>

          {user ? (
            <div className="flex items-center gap-2">
              <Input
                value={text}
                onChange={(e) => setText(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    postComment();
                  }
                }}
                placeholder="Escreva um comentário..."
                maxLength={1000}
                disabled={sending}
              />
              <Button size="icon" onClick={postComment} disabled={sending || !text.trim()} aria-label="Enviar">
                <Send className="size-4" />
              </Button>
            </div>
          ) : (
            <div className="rounded-lg border bg-muted/40 p-3 text-sm flex items-center justify-between gap-3">
              <span>Entre para comentar e conversar com o autor.</span>
              <Button size="sm" onClick={() => navigate({ to: "/auth" })}>Entrar</Button>
            </div>
          )}

          <ul className="space-y-3">
            {comments.length === 0 && (
              <li className="text-sm text-muted-foreground text-center py-6">
                Seja o primeiro a comentar.
              </li>
            )}
            {comments.map((c) => {
              const canDelete = !!user && (c.user_id === user.id || status.user_id === user.id);
              return (
                <li key={c.id} className="flex items-start gap-2.5">
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
                          <span className="text-sm font-medium truncate">{c.author?.display_name ?? "Usuário"}</span>
                        )}
                        <span className="text-[11px] text-muted-foreground">{formatTime(c.created_at)}</span>
                      </div>
                      <p className="text-sm whitespace-pre-wrap break-words">{c.content}</p>
                    </div>
                    <div className="flex items-center gap-3 mt-1 px-2">
                      {user && c.user_id !== user.id && (
                        <button
                          className="text-xs text-muted-foreground hover:text-foreground"
                          onClick={() => startChat(c.user_id)}
                        >
                          Conversar
                        </button>
                      )}
                      {canDelete && (
                        <button
                          className="text-xs text-destructive hover:underline"
                          onClick={() => deleteComment(c.id)}
                        >
                          Apagar
                        </button>
                      )}
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        </section>
      </main>
    </div>
  );
}
