import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { getMyInviteStats, getAmbassadorLevel } from "@/lib/invites.functions";
import { useAuth } from "@/hooks/use-auth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Loader2, ArrowLeft, Trophy } from "lucide-react";
import { InviteFriendsSheet } from "@/components/invite/InviteFriendsSheet";
import { Progress } from "@/components/ui/progress";

export const Route = createFileRoute("/_authenticated/meus-convites")({
  component: MyInvitesPage,
  head: () => ({ meta: [{ title: "Meus convites · WaveChat" }] }),
});

const CHANNEL_LABEL: Record<string, string> = {
  whatsapp: "WhatsApp",
  facebook: "Facebook",
  instagram: "Instagram",
  tiktok: "TikTok",
  kwai: "Kwai",
  share: "Compartilhar",
  copy: "Link copiado",
  other: "Outros",
};

function MyInvitesPage() {
  const { user } = useAuth();
  const statsFn = useServerFn(getMyInviteStats);
  const levelFn = useServerFn(getAmbassadorLevel);
  const stats = useQuery({ queryKey: ["my-invite-stats"], queryFn: () => statsFn(), enabled: !!user });
  const level = useQuery({
    queryKey: ["ambassador-level", user?.id],
    queryFn: () => levelFn({ data: { userId: user!.id } }),
    enabled: !!user,
  });

  if (!user || stats.isLoading || level.isLoading)
    return (
      <div className="min-h-screen grid place-items-center">
        <Loader2 className="size-6 animate-spin text-muted-foreground" />
      </div>
    );

  const byChannel = (stats.data?.by_channel ?? {}) as Record<string, number>;
  const signupsByChannel = (stats.data?.signups_by_channel ?? {}) as Record<string, number>;
  const channels = Object.keys(CHANNEL_LABEL);
  const tier = level.data?.tier;
  const next = level.data?.next;
  const invited = level.data?.invited ?? 0;
  const progress = next ? Math.min(100, (invited / next.min_invites) * 100) : 100;

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-3xl mx-auto px-4 py-6 space-y-5">
        <div className="flex items-center justify-between">
          <Link to="/" className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground">
            <ArrowLeft className="size-4" /> Voltar
          </Link>
          <InviteFriendsSheet trigger={<Button>Convidar amigos</Button>} />
        </div>

        <h1 className="text-2xl font-bold">Meus convites</h1>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-base">
              <Trophy className="size-5 text-amber-500" /> Embaixador WaveChat
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-3">
              <div className="text-3xl">{tier?.icon ?? "🌱"}</div>
              <div className="flex-1">
                <div className="font-semibold">{tier?.name ?? "Comece convidando"}</div>
                <div className="text-sm text-muted-foreground">{invited} pessoas convidadas</div>
              </div>
            </div>
            {next && (
              <div className="mt-3">
                <Progress value={progress} />
                <div className="text-xs text-muted-foreground mt-1">
                  Faltam {Math.max(0, next.min_invites - invited)} para virar {next.icon} {next.name}
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <Stat label="Convites enviados (cliques)" value={stats.data?.clicks ?? 0} />
          <Stat label="Cadastros gerados" value={stats.data?.signups ?? 0} />
          <Stat label="Convidados ativos (30d)" value={stats.data?.active ?? 0} />
          <Stat label="Nível" value={tier ? tier.name : "—"} small />
        </div>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Ranking dos canais</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {channels.map((c) => {
                const clicks = byChannel[c] ?? 0;
                const signups = signupsByChannel[c] ?? 0;
                const max = Math.max(1, ...Object.values(byChannel));
                const pct = (clicks / max) * 100;
                return (
                  <div key={c}>
                    <div className="flex justify-between text-xs mb-1">
                      <span>{CHANNEL_LABEL[c]}</span>
                      <span className="text-muted-foreground">
                        {clicks} cliques · {signups} cadastros
                      </span>
                    </div>
                    <div className="h-2 bg-muted rounded-full overflow-hidden">
                      <div className="h-full bg-primary" style={{ width: `${pct}%` }} />
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function Stat({ label, value, small }: { label: string; value: number | string; small?: boolean }) {
  return (
    <div className="rounded-xl border border-border bg-card p-3">
      <div className="text-[11px] text-muted-foreground uppercase tracking-wide">{label}</div>
      <div className={small ? "text-lg font-semibold mt-0.5" : "text-2xl font-bold mt-0.5"}>{value}</div>
    </div>
  );
}
