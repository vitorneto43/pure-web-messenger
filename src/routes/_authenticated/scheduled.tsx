import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import {
  listMyScheduledPosts,
  listMyScheduledStatuses,
  listMyScheduledLives,
  cancelScheduledPost,
  cancelScheduledStatus,
  cancelScheduledLive,
} from "@/lib/schedule.functions";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ArrowLeft, CalendarClock, Trash2, Loader2 } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/scheduled")({
  head: () => ({ meta: [{ title: "Agendamentos — WaveChat" }, { name: "robots", content: "noindex" }] }),
  component: ScheduledPage,
});

function ScheduledPage() {
  const navigate = useNavigate();
  const [posts, setPosts] = useState<Awaited<ReturnType<typeof listMyScheduledPosts>>>([]);
  const [stories, setStories] = useState<Awaited<ReturnType<typeof listMyScheduledStatuses>>>([]);
  const [lives, setLives] = useState<Awaited<ReturnType<typeof listMyScheduledLives>>>([]);
  const [loading, setLoading] = useState(true);

  async function refresh() {
    setLoading(true);
    try {
      const [p, s, l] = await Promise.all([
        listMyScheduledPosts(),
        listMyScheduledStatuses(),
        listMyScheduledLives(),
      ]);
      setPosts(p); setStories(s); setLives(l);
    } finally { setLoading(false); }
  }

  useEffect(() => { refresh(); }, []);

  return (
    <div className="min-h-screen bg-background">
      <header className="flex items-center gap-2 p-4 border-b">
        <Button variant="ghost" size="icon" onClick={() => navigate({ to: "/posts" })}>
          <ArrowLeft className="size-5" />
        </Button>
        <h1 className="text-xl font-bold flex items-center gap-2">
          <CalendarClock className="size-5 text-primary" /> Agendamentos
        </h1>
      </header>

      {loading ? (
        <div className="p-6 text-center"><Loader2 className="size-5 animate-spin mx-auto" /></div>
      ) : (
        <Tabs defaultValue="posts" className="p-3">
          <TabsList className="w-full grid grid-cols-3">
            <TabsTrigger value="posts">Posts ({posts.length})</TabsTrigger>
            <TabsTrigger value="stories">Stories ({stories.length})</TabsTrigger>
            <TabsTrigger value="lives">Lives ({lives.length})</TabsTrigger>
          </TabsList>

          <TabsContent value="posts" className="mt-3">
            {posts.length === 0 ? (
              <p className="text-sm text-center text-muted-foreground p-6">Nenhum post agendado.</p>
            ) : posts.map((p) => (
              <Item
                key={p.id}
                when={p.scheduled_at}
                title={p.content?.slice(0, 80) || p.caption?.slice(0, 80) || "(sem texto)"}
                onCancel={async () => { await cancelScheduledPost({ data: { id: p.id } }); toast.success("Cancelado"); refresh(); }}
              />
            ))}
          </TabsContent>

          <TabsContent value="stories" className="mt-3">
            {stories.length === 0 ? (
              <p className="text-sm text-center text-muted-foreground p-6">Nenhum story agendado.</p>
            ) : stories.map((s) => (
              <Item
                key={s.id}
                when={s.scheduled_at}
                title={s.content?.slice(0, 80) || s.caption?.slice(0, 80) || "Story"}
                onCancel={async () => { await cancelScheduledStatus({ data: { id: s.id } }); toast.success("Cancelado"); refresh(); }}
              />
            ))}
          </TabsContent>

          <TabsContent value="lives" className="mt-3">
            {lives.length === 0 ? (
              <p className="text-sm text-center text-muted-foreground p-6">
                Nenhuma live agendada. <Link to="/live/new" className="underline">Agendar agora</Link>
              </p>
            ) : lives.map((l) => (
              <Item
                key={l.id}
                when={l.scheduled_at}
                title={l.title || "Live"}
                subtitle={l.will_record ? "🔴 Será gravada" : undefined}
                onCancel={async () => { await cancelScheduledLive({ data: { id: l.id } }); toast.success("Cancelado"); refresh(); }}
              />
            ))}
          </TabsContent>
        </Tabs>
      )}
    </div>
  );
}

function Item({ when, title, subtitle, onCancel }: { when: string; title: string; subtitle?: string; onCancel: () => void }) {
  return (
    <div className="flex items-center gap-3 p-3 border-b">
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold truncate">{title}</p>
        <p className="text-xs text-muted-foreground">
          {new Date(when).toLocaleString("pt-BR")}
          {subtitle ? ` · ${subtitle}` : ""}
        </p>
      </div>
      <Button size="icon" variant="ghost" onClick={onCancel}><Trash2 className="size-4 text-destructive" /></Button>
    </div>
  );
}
