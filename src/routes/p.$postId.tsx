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
  head: ({ params }) => ({ meta: [
    { title: `Post — WaveChat` },
    { name: "description", content: "Veja este post no WaveChat e participe da conversa." },
    { property: "og:title", content: "Post no WaveChat" },
    { property: "og:url", content: `https://webconnectchat.com/p/${params.postId}` },
  ] }),
});

function PublicPostPage() {
  const { postId } = Route.useParams();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [commentsOpen, setCommentsOpen] = useState(false);
  const [boostOpen, setBoostOpen] = useState(false);

  const q = useQuery({
    queryKey: ["public-post", postId],
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
