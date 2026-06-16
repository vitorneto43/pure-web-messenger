import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { ArrowLeft, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { PostCard, type PostItem } from "@/components/posts/PostCard";
import { PostComments } from "@/components/posts/PostComments";
import { PostBoostDialog } from "@/components/posts/PostBoostDialog";

export const Route = createFileRoute("/p/$postId")({
  component: PublicPostPage,
  loader: async ({ params }) => {
    const { data } = await (supabase as any).rpc("get_public_post", { _post_id: params.postId });
    const row = (data ?? [])[0];
    if (!row) return { post: null as PostItem | null };
    return { post: { ...row, hashtags: row.hashtags ?? [], is_boosted: false, viewer_already_liked: false } as PostItem };
  },
  head: ({ params, loaderData }) => {
    const post = loaderData?.post;
    const url = `https://webconnectchat.com/p/${params.postId}`;
    const baseTitle = post
      ? `${post.display_name} (@${post.username}) no WaveChat`
      : "Post no WaveChat";
    const desc = post
      ? (post.caption || post.content || `Veja este post de @${post.username} no WaveChat.`).slice(0, 200)
      : "Veja este post no WaveChat e participe da conversa.";
    const image = post?.kind === "image" && post.media_url
      ? post.media_url
      : post?.kind === "video" && post.media_url
        ? post.media_url
        : (post?.avatar_url || undefined);
    const meta: Array<Record<string, string>> = [
      { title: baseTitle },
      { name: "description", content: desc },
      { property: "og:type", content: "article" },
      { property: "og:title", content: baseTitle },
      { property: "og:description", content: desc },
      { property: "og:url", content: url },
      { name: "twitter:card", content: image ? "summary_large_image" : "summary" },
      { name: "twitter:title", content: baseTitle },
      { name: "twitter:description", content: desc },
    ];
    if (image) {
      meta.push({ property: "og:image", content: image });
      meta.push({ name: "twitter:image", content: image });
    }
    return { meta };
  },
});

function PublicPostPage() {
  const { postId } = Route.useParams();
  const { post: initialPost } = Route.useLoaderData();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [commentsOpen, setCommentsOpen] = useState(false);
  const [boostOpen, setBoostOpen] = useState(false);

  const q = useQuery({
    queryKey: ["public-post", postId],
    initialData: initialPost,
    queryFn: async () => {
      const { data } = await (supabase as any).rpc("get_public_post", { _post_id: postId });
      const row = (data ?? [])[0];
      if (!row) return null;
      return { ...row, hashtags: row.hashtags ?? [], is_boosted: false, viewer_already_liked: false } as PostItem;
    },
  });

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-10 flex items-center justify-between gap-2 px-3 h-12 border-b bg-background/80 backdrop-blur">
        <button onClick={() => navigate({ to: user ? "/posts" : "/chat" })} className="size-9 grid place-items-center rounded-full hover:bg-muted"><ArrowLeft className="size-5" /></button>
        <h1 className="font-bold">Post</h1>
        {!user && <Button size="sm" onClick={() => navigate({ to: "/auth" })}>Entrar</Button>}
        {user && <div className="size-9" />}
      </header>

      <div className="max-w-xl mx-auto">
        {q.isLoading && <Loader2 className="size-6 animate-spin mx-auto mt-20 opacity-60" />}
        {!q.isLoading && !q.data && (
          <div className="text-center py-20 px-6 space-y-3">
            <p className="text-muted-foreground">Post não encontrado ou não está público.</p>
            <Button onClick={() => navigate({ to: "/posts" })}>Ver outros posts</Button>
          </div>
        )}
        {q.data && (
          <>
            <PostCard
              post={q.data}
              onChange={() => q.refetch()}
              onOpenComments={() => setCommentsOpen(true)}
              onBoost={() => setBoostOpen(true)}
            />
            <PostComments open={commentsOpen} onOpenChange={setCommentsOpen} postId={postId} />
            <PostBoostDialog open={boostOpen} onOpenChange={setBoostOpen} postId={postId} />
          </>
        )}
      </div>
    </div>
  );
}
