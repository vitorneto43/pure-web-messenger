import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, Hash, Loader2, Image as ImageIcon, Video, Type } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/hashtag/$tag")({
  component: HashtagFeedPage,
  head: ({ params }) => ({
    meta: [
      { title: `#${params.tag} — WaveChat` },
      {
        name: "description",
        content: `Veja publicações no WaveChat marcadas com #${params.tag}.`,
      },
    ],
  }),
});

interface StatusRow {
  id: string;
  kind: "text" | "image" | "video";
  content: string | null;
  media_url: string | null;
  caption: string | null;
  background: string | null;
  hashtags: string[];
  created_at: string;
  user_id: string;
  profiles: {
    username: string;
    display_name: string;
    avatar_url: string | null;
    visibility: string;
  } | null;
}

function HashtagFeedPage() {
  const { tag } = Route.useParams();
  const navigate = useNavigate();
  const normalized = tag.toLowerCase().replace(/^#/, "");

  const q = useQuery({
    queryKey: ["hashtag-feed", normalized],
    queryFn: async () => {
      const nowIso = new Date().toISOString();
      const { data, error } = await (supabase as any)
        .from("statuses")
        .select(
          "id, kind, content, media_url, caption, background, hashtags, created_at, user_id, profiles!inner(username, display_name, avatar_url, visibility)",
        )
        .contains("hashtags", [normalized])
        .gt("expires_at", nowIso)
        .eq("profiles.visibility", "public")
        .order("created_at", { ascending: false })
        .limit(200);
      if (error) throw error;
      return (data ?? []) as StatusRow[];
    },
  });

  const items = q.data ?? [];

  return (
    <div className="fixed inset-0 bg-background text-foreground flex flex-col">
      <header className="flex items-center gap-2 px-3 py-3 border-b bg-card/95 backdrop-blur z-10">
        <button
          onClick={() => navigate({ to: "/hashtags" })}
          className="size-9 grid place-items-center rounded-full hover:bg-muted"
          aria-label="Voltar"
        >
          <ArrowLeft className="size-5" />
        </button>
        <div className="flex items-center gap-2 flex-1 min-w-0">
          <Hash className="size-5 text-primary shrink-0" />
          <div className="min-w-0">
            <h1 className="font-bold leading-tight truncate">#{normalized}</h1>
            <p className="text-[11px] text-muted-foreground leading-tight">
              {q.isLoading
                ? "Carregando…"
                : `${items.length} ${items.length === 1 ? "publicação ativa" : "publicações ativas"}`}
            </p>
          </div>
        </div>
      </header>

      <div className="flex-1 overflow-y-auto p-3">
        {q.isLoading && (
          <div className="p-10 grid place-items-center">
            <Loader2 className="size-6 animate-spin text-muted-foreground" />
          </div>
        )}

        {!q.isLoading && items.length === 0 && (
          <div className="p-10 text-center text-sm text-muted-foreground">
            Nenhuma publicação pública com <span className="font-mono">#{normalized}</span> ainda.
          </div>
        )}

        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
          {items.map((s) => (
            <Link
              key={s.id}
              to="/s/$statusId"
              params={{ statusId: s.id }}
              className="relative aspect-[3/4] rounded-lg overflow-hidden bg-muted group"
            >
              {s.kind === "image" && s.media_url && (
                <img
                  src={s.media_url}
                  alt={s.caption ?? `#${normalized}`}
                  className="absolute inset-0 w-full h-full object-cover"
                  loading="lazy"
                />
              )}
              {s.kind === "video" && s.media_url && (
                <video
                  src={s.media_url}
                  className="absolute inset-0 w-full h-full object-cover"
                  muted
                  playsInline
                />
              )}
              {s.kind === "text" && (
                <div
                  className="absolute inset-0 grid place-items-center p-2 text-center text-white text-xs font-semibold"
                  style={{ background: s.background ?? "linear-gradient(135deg,#6366f1,#ec4899)" }}
                >
                  <span className="line-clamp-6">{s.content}</span>
                </div>
              )}

              <div className="absolute top-1.5 left-1.5 size-6 rounded-full bg-black/60 grid place-items-center text-white">
                {s.kind === "image" && <ImageIcon className="size-3" />}
                {s.kind === "video" && <Video className="size-3" />}
                {s.kind === "text" && <Type className="size-3" />}
              </div>

              <div
                className={cn(
                  "absolute inset-x-0 bottom-0 p-2 bg-gradient-to-t from-black/80 to-transparent text-white",
                  s.kind === "text" && "from-black/40",
                )}
              >
                <div className="flex items-center gap-1.5">
                  <Avatar className="size-5">
                    <AvatarImage src={s.profiles?.avatar_url ?? undefined} />
                    <AvatarFallback className="text-[8px]">
                      {s.profiles?.display_name?.[0]?.toUpperCase() ?? "?"}
                    </AvatarFallback>
                  </Avatar>
                  <span className="text-[10px] font-medium truncate">
                    @{s.profiles?.username}
                  </span>
                </div>
                {s.caption && (
                  <p className="text-[10px] mt-0.5 line-clamp-2 opacity-90">{s.caption}</p>
                )}
              </div>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
