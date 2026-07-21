import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { ArrowLeft, Heart, MessageCircle, PlaySquare, Share2, ThumbsDown, ThumbsUp } from "lucide-react";
import QRCode from "qrcode";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { useAuthGate } from "@/hooks/use-auth-gate";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { formatViews, signWavetubeUrl } from "@/lib/wavetube";

export const Route = createFileRoute("/v/$videoId")({
  loader: async ({ params }) => {
    const { data, error } = await supabase
      .from("videos")
      .select(
        "id, owner_id, title, description, category, hashtags, duration_sec, views_count, likes_count, dislikes_count, comments_count, published_at, file_url, thumbnail_url, cta_label, cta_url, allow_pix, pix_key, visibility",
      )
      .eq("id", params.videoId)
      .maybeSingle();
    if (error) throw error;
    if (!data) throw notFound();
    const { data: prof } = await supabase
      .from("profiles")
      .select("username, display_name, avatar_url")
      .eq("id", data.owner_id)
      .maybeSingle();
    return { video: data, owner: prof };
  },
  head: ({ loaderData }) => {
    const v = loaderData?.video;
    if (!v) {
      return { meta: [{ title: "Vídeo não encontrado — WaveTube" }, { name: "robots", content: "noindex" }] };
    }
    return {
      meta: [
        { title: `${v.title} — WaveTube` },
        { name: "description", content: (v.description ?? "").slice(0, 155) || "Vídeo no WaveTube." },
        { property: "og:title", content: v.title },
        { property: "og:description", content: (v.description ?? "").slice(0, 200) },
        { property: "og:type", content: "video.other" },
        { name: "twitter:card", content: "summary_large_image" },
      ],
    };
  },
  component: VideoPage,
});

type Comment = {
  id: string;
  body: string;
  created_at: string;
  user_id: string;
  parent_id: string | null;
  profile?: { username: string | null; display_name: string | null; avatar_url: string | null };
};

function VideoPage() {
  const { video, owner } = Route.useLoaderData();
  const { user } = useAuth();
  const { gate } = useAuthGate();
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const [pixQr, setPixQr] = useState<string | null>(null);
  const [reaction, setReaction] = useState<"like" | "dislike" | null>(null);
  const [likes, setLikes] = useState<number>(video.likes_count ?? 0);
  const [dislikes, setDislikes] = useState<number>(video.dislikes_count ?? 0);
  const [comments, setComments] = useState<Comment[]>([]);
  const [reply, setReply] = useState("");
  const [replyingTo, setReplyingTo] = useState<string | null>(null);
  const viewLogged = useRef(false);
  const videoRef = useRef<HTMLVideoElement | null>(null);

  useEffect(() => {
    (async () => setVideoUrl(await signWavetubeUrl(video.file_url)))();
  }, [video.file_url]);

  useEffect(() => {
    if (!video.allow_pix || !video.pix_key) return;
    QRCode.toDataURL(video.pix_key, { width: 220, margin: 1 }).then(setPixQr).catch(() => {});
  }, [video.allow_pix, video.pix_key]);

  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from("video_comments")
        .select("id, body, created_at, user_id, parent_id")
        .eq("video_id", video.id)
        .order("created_at", { ascending: true })
        .limit(200);
      const rows = (data ?? []) as Comment[];
      const ids = Array.from(new Set(rows.map((r) => r.user_id)));
      if (ids.length) {
        const { data: profs } = await supabase
          .from("profiles")
          .select("id, username, display_name, avatar_url")
          .in("id", ids);
        const m = new Map((profs ?? []).map((p: any) => [p.id, p]));
        rows.forEach((r) => (r.profile = m.get(r.user_id)));
      }
      setComments(rows);
    })();
  }, [video.id]);

  useEffect(() => {
    if (!user) return;
    (async () => {
      const { data } = await supabase
        .from("video_reactions")
        .select("kind")
        .eq("video_id", video.id)
        .eq("user_id", user.id)
        .maybeSingle();
      setReaction((data?.kind as "like" | "dislike" | null) ?? null);
    })();
  }, [user, video.id]);

  function onPlay() {
    if (viewLogged.current) return;
    viewLogged.current = true;
    supabase.from("video_views").insert({ video_id: video.id, viewer_id: user?.id ?? null } as any);
  }

  async function react(kind: "like" | "dislike") {
    if (!user) return gate("default", () => void 0);
    const prev = reaction;
    if (prev === kind) {
      setReaction(null);
      if (kind === "like") setLikes((n) => Math.max(0, n - 1));
      else setDislikes((n) => Math.max(0, n - 1));
      await supabase.from("video_reactions").delete().eq("video_id", video.id).eq("user_id", user.id);
      return;
    }
    setReaction(kind);
    if (kind === "like") {
      setLikes((n) => n + 1);
      if (prev === "dislike") setDislikes((n) => Math.max(0, n - 1));
    } else {
      setDislikes((n) => n + 1);
      if (prev === "like") setLikes((n) => Math.max(0, n - 1));
    }
    await supabase.from("video_reactions").upsert(
      { video_id: video.id, user_id: user.id, kind } as any,
      { onConflict: "video_id,user_id" },
    );
  }

  async function submitComment() {
    if (!user) return gate("default", () => void 0);
    const body = reply.trim();
    if (!body) return;
    const { data, error } = await supabase
      .from("video_comments")
      .insert({ video_id: video.id, user_id: user.id, body, parent_id: replyingTo } as any)
      .select("id, body, created_at, user_id, parent_id")
      .single();
    if (error) return toast.error("Falha ao comentar", { description: error.message });
    const { data: prof } = await supabase
      .from("profiles").select("username, display_name, avatar_url").eq("id", user.id).maybeSingle();
    setComments((prev) => [...prev, { ...(data as any), profile: prof as any }]);
    setReply("");
    setReplyingTo(null);
  }

  function share() {
    const url = `${window.location.origin}/v/${video.id}`;
    if (navigator.share) navigator.share({ url, title: video.title }).catch(() => {});
    else {
      navigator.clipboard.writeText(url);
      toast.success("Link copiado!");
    }
  }

  const topLevel = useMemo(() => comments.filter((c) => !c.parent_id), [comments]);
  const repliesOf = (id: string) => comments.filter((c) => c.parent_id === id);

  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="sticky top-0 z-30 bg-background/95 backdrop-blur border-b border-border">
        <div className="max-w-6xl mx-auto px-3 py-3 flex items-center gap-2">
          <Button asChild size="icon" variant="ghost">
            <Link to="/wavetube"><ArrowLeft className="size-5" /></Link>
          </Button>
          <PlaySquare className="size-6 text-red-600" />
          <h1 className="text-lg font-bold">WaveTube</h1>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-3 py-4 grid lg:grid-cols-[minmax(0,1fr)_320px] gap-6">
        <div>
          <div className="aspect-video bg-black rounded-xl overflow-hidden">
            {videoUrl ? (
              <video
                ref={videoRef}
                src={videoUrl}
                controls
                playsInline
                onPlay={onPlay}
                className="w-full h-full"
                poster={undefined}
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center text-white/60">Carregando...</div>
            )}
          </div>

          <h2 className="mt-3 text-xl font-bold leading-snug">{video.title}</h2>
          <p className="text-sm text-muted-foreground mt-1">
            {formatViews(video.views_count)} visualizações · {video.published_at ? new Date(video.published_at).toLocaleDateString("pt-BR") : ""}
          </p>

          <div className="mt-3 flex items-center gap-3 flex-wrap">
            <Link
              to="/profile/$username"
              params={{ username: owner?.username ?? "" }}
              className="flex items-center gap-2 min-w-0"
            >
              <Avatar className="size-10">
                <AvatarImage src={owner?.avatar_url ?? undefined} />
                <AvatarFallback>{(owner?.display_name || owner?.username || "?").charAt(0).toUpperCase()}</AvatarFallback>
              </Avatar>
              <div className="min-w-0">
                <p className="text-sm font-semibold truncate">{owner?.display_name || `@${owner?.username ?? ""}`}</p>
                <p className="text-xs text-muted-foreground truncate">@{owner?.username ?? ""}</p>
              </div>
            </Link>

            <div className="ml-auto flex items-center gap-2">
              <Button
                variant={reaction === "like" ? "default" : "secondary"}
                size="sm"
                className="rounded-full"
                onClick={() => react("like")}
              >
                <ThumbsUp className="size-4 mr-1.5" /> {likes}
              </Button>
              <Button
                variant={reaction === "dislike" ? "default" : "secondary"}
                size="sm"
                className="rounded-full"
                onClick={() => react("dislike")}
              >
                <ThumbsDown className="size-4 mr-1.5" /> {dislikes}
              </Button>
              <Button variant="secondary" size="sm" className="rounded-full" onClick={share}>
                <Share2 className="size-4 mr-1.5" /> Compartilhar
              </Button>
            </div>
          </div>

          {video.cta_label && video.cta_url ? (
            <a
              href={video.cta_url}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-3 inline-flex items-center gap-2 rounded-full bg-primary text-primary-foreground px-4 py-2 text-sm font-semibold"
            >
              {video.cta_label}
            </a>
          ) : null}

          {video.description ? (
            <div className="mt-4 rounded-xl bg-muted/40 p-3 text-sm whitespace-pre-wrap">
              {video.description}
              {video.hashtags?.length ? (
                <p className="mt-2 text-primary">
                  {video.hashtags.map((h: string) => `#${h}`).join(" ")}
                </p>
              ) : null}
            </div>
          ) : null}

          <section className="mt-6">
            <h3 className="text-base font-semibold mb-3 flex items-center gap-2">
              <MessageCircle className="size-4" /> Comentários · {topLevel.length}
            </h3>
            <div className="flex gap-2 mb-4">
              <Textarea
                value={reply}
                onChange={(e) => setReply(e.target.value)}
                rows={2}
                placeholder={replyingTo ? "Escreva sua resposta..." : "Adicione um comentário público..."}
              />
              <div className="flex flex-col gap-2">
                <Button size="sm" onClick={submitComment}>Enviar</Button>
                {replyingTo && (
                  <Button size="sm" variant="ghost" onClick={() => setReplyingTo(null)}>Cancelar</Button>
                )}
              </div>
            </div>
            <ul className="space-y-4">
              {topLevel.map((c) => (
                <li key={c.id}>
                  <CommentRow c={c} onReply={() => setReplyingTo(c.id)} />
                  {repliesOf(c.id).length > 0 && (
                    <ul className="mt-2 ml-10 space-y-3 border-l border-border pl-3">
                      {repliesOf(c.id).map((r) => (
                        <li key={r.id}><CommentRow c={r} /></li>
                      ))}
                    </ul>
                  )}
                </li>
              ))}
              {topLevel.length === 0 && (
                <li className="text-sm text-muted-foreground">Seja o primeiro a comentar.</li>
              )}
            </ul>
          </section>
        </div>

        <aside className="space-y-4">
          {video.allow_pix && pixQr && (
            <div className="rounded-xl border border-border p-4 text-center">
              <p className="text-sm font-semibold flex items-center justify-center gap-2">
                <Heart className="size-4 text-red-500" /> Apoie este criador
              </p>
              <p className="text-xs text-muted-foreground mt-1">Pague qualquer valor via Pix</p>
              <img src={pixQr} alt="QR Code Pix" className="mx-auto mt-3 rounded-lg bg-white p-2" />
              <p className="text-[11px] break-all text-muted-foreground mt-2">{video.pix_key}</p>
              <Button
                size="sm"
                variant="secondary"
                className="mt-2 rounded-full"
                onClick={() => {
                  navigator.clipboard.writeText(video.pix_key ?? "");
                  toast.success("Chave Pix copiada!");
                }}
              >
                Copiar chave
              </Button>
            </div>
          )}
        </aside>
      </main>
    </div>
  );
}

function CommentRow({ c, onReply }: { c: Comment; onReply?: () => void }) {
  return (
    <div className="flex gap-2">
      <Avatar className="size-8 shrink-0">
        <AvatarImage src={c.profile?.avatar_url ?? undefined} />
        <AvatarFallback>{(c.profile?.display_name || c.profile?.username || "?").charAt(0).toUpperCase()}</AvatarFallback>
      </Avatar>
      <div className="min-w-0 flex-1">
        <p className="text-xs text-muted-foreground">
          <span className="font-semibold text-foreground">{c.profile?.display_name || `@${c.profile?.username ?? "usuário"}`}</span>
          {" · "}{new Date(c.created_at).toLocaleDateString("pt-BR")}
        </p>
        <p className="text-sm whitespace-pre-wrap">{c.body}</p>
        {onReply && (
          <button onClick={onReply} className="text-xs text-muted-foreground hover:text-foreground mt-0.5">
            Responder
          </button>
        )}
      </div>
    </div>
  );
}
