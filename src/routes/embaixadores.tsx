import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { getTopAmbassadors } from "@/lib/invites.functions";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { ArrowLeft, Trophy, Loader2 } from "lucide-react";

export const Route = createFileRoute("/embaixadores")({
  component: Page,
  head: () => ({
    meta: [
      { title: "Top Embaixadores · WaveChat" },
      { name: "description", content: "Os usuários que mais convidam amigos para a WaveChat." },
    ],
  }),
});

function Page() {
  const fn = useServerFn(getTopAmbassadors);
  const q = useQuery({ queryKey: ["top-ambassadors"], queryFn: () => fn({ data: { limit: 100 } }) });

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-3xl mx-auto px-4 py-6 space-y-4">
        <Link to="/" className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="size-4" /> Voltar
        </Link>
        <div className="flex items-center gap-2">
          <Trophy className="size-6 text-amber-500" />
          <h1 className="text-2xl font-bold">Top Embaixadores da WaveChat</h1>
        </div>
        <p className="text-sm text-muted-foreground">
          Os usuários que mais trazem amigos para a comunidade.
        </p>

        {q.isLoading ? (
          <Loader2 className="size-6 animate-spin text-muted-foreground" />
        ) : !q.data || q.data.length === 0 ? (
          <p className="text-sm text-muted-foreground">O ranking ainda não está disponível.</p>
        ) : (
          <ol className="space-y-2">
            {q.data.map((r, idx) => (
              <li
                key={r.user_id}
                className="flex items-center gap-3 rounded-xl border border-border bg-card p-3"
              >
                <div className="w-7 text-center text-sm font-bold text-muted-foreground">{idx + 1}</div>
                <Avatar className="size-10">
                  <AvatarImage src={r.avatar_url ?? undefined} />
                  <AvatarFallback>{r.display_name?.[0] ?? "?"}</AvatarFallback>
                </Avatar>
                <div className="flex-1 min-w-0">
                  <div className="font-semibold truncate">{r.display_name}</div>
                  <div className="text-xs text-muted-foreground truncate">@{r.username}</div>
                </div>
                <div className="text-right">
                  <div className="text-lg font-bold">{r.invited}</div>
                  <div className="text-[11px] text-muted-foreground">
                    {r.tier_icon} {r.tier_name ?? "—"}
                  </div>
                </div>
              </li>
            ))}
          </ol>
        )}
      </div>
    </div>
  );
}
