import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useInfiniteQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { ArrowLeft, Loader2, Plus, Sparkles, Radio } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { useAuthGate } from "@/hooks/use-auth-gate";
import { Button } from "@/components/ui/button";
import { PostCard, type PostItem } from "@/components/posts/PostCard";
import { PostComments } from "@/components/posts/PostComments";
import { PostComposer } from "@/components/posts/PostComposer";
import { PostBoostDialog } from "@/components/posts/PostBoostDialog";

export const Route = createFileRoute("/posts")({
  component: PostsPage,
  head: () => ({ meta: [
    { title: "Posts — WaveChat" },
    { name: "description", content: "Feed público de posts: textos, imagens, vídeos e músicas no WaveChat." },
  ] }),
});

const PAGE_SIZE = 12;

function PostsPage() {
  const { user } = useAuth();
  const { gate, GateDialog } = useAuthGate();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [composerOpen, setComposerOpen] = useState(false);
  const [commentsFor, setCommentsFor] = useState<string | null>(null);
  const [boostFor, setBoostFor] = useState<string | null>(null);

  const query = useInfiniteQuery({
    queryKey: ["posts-feed", user?.id ?? "guest"],
    initialPageParam: 0,
    queryFn: async ({ pageParam }) => {
      const { data, error } = await (supabase as any).rpc("discover_public_posts", { _limit: PAGE_SIZE, _offset: pageParam });
      if (error) throw error;
      return (data ?? []) as PostItem[];
    },
    getNextPageParam: (last, all) => (last.length < PAGE_SIZE ? undefined : all.length * PAGE_SIZE),
  });

  const items = useMemo(() => query.data?.pages.flat() ?? [], [query.data]);

  function patch(postId: string, p: Partial<PostItem>) {
    qc.setQueryData(["posts-feed", user?.id ?? "guest"], (old: any) => {
      if (!old) return old;
      return { ...old, pages: old.pages.map((page: PostItem[]) => page.map((x) => x.post_id === postId ? { ...x, ...p } : x)) };
    });
  }

  return (
    <div className="min-h-screen bg-background">
      {GateDialog}
      <header className="sticky top-0 z-10 flex items-center justify-between gap-2 px-3 h-12 border-b bg-background/80 backdrop-blur">
        <button onClick={() => navigate({ to: "/chat" })} className="size-9 grid place-items-center rounded-full hover:bg-muted"><ArrowLeft className="size-5" /></button>
        <h1 className="font-bold">Posts</h1>
        <div className="flex items-center gap-1">
          <button onClick={() => navigate({ to: "/live" })} className="size-9 grid place-items-center rounded-full hover:bg-muted relative" title="Lives">
            <Radio className="size-5 text-red-500" />
          </button>
          <Button size="sm" onClick={() => gate("create_status", () => setComposerOpen(true))}>
            <Plus className="size-4 mr-1" />Novo
          </Button>
        </div>
      </header>

      <div className="max-w-xl mx-auto">
        {query.isLoading && <div className="grid place-items-center py-20"><Loader2 className="size-6 animate-spin opacity-60" /></div>}
        {!query.isLoading && items.length === 0 && (
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
            onChange={(patchObj) => patch(p.post_id, patchObj)}
            onOpenComments={() => setCommentsFor(p.post_id)}
            onBoost={() => setBoostFor(p.post_id)}
            onDeleted={() => query.refetch()}
          />
        ))}
        {query.hasNextPage && (
          <div className="grid place-items-center py-6">
            <Button variant="outline" onClick={() => query.fetchNextPage()} disabled={query.isFetchingNextPage}>
              {query.isFetchingNextPage ? <Loader2 className="size-4 animate-spin" /> : "Carregar mais"}
            </Button>
          </div>
        )}
      </div>

      <PostComposer open={composerOpen} onOpenChange={setComposerOpen} onCreated={() => query.refetch()} />
      {commentsFor && <PostComments open={!!commentsFor} onOpenChange={(v) => !v && setCommentsFor(null)} postId={commentsFor} onCountChange={(n) => patch(commentsFor, { comments_count: n })} />}
      {boostFor && <PostBoostDialog open={!!boostFor} onOpenChange={(v) => !v && setBoostFor(null)} postId={boostFor} />}
    </div>
  );
}
