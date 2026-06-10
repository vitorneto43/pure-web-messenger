import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Loader2, UserPlus, Users, TrendingUp, Heart } from "lucide-react";
import { getAdminFollowersStats } from "@/lib/admin-stats.functions";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid,
} from "recharts";

export function FollowersAdminTab() {
  const fn = useServerFn(getAdminFollowersStats);
  const { data, isLoading } = useQuery({
    queryKey: ["admin-followers-stats"],
    queryFn: () => fn(),
    refetchInterval: 60000,
  });

  if (isLoading || !data) {
    return <div className="flex justify-center py-12"><Loader2 className="size-6 animate-spin text-muted-foreground" /></div>;
  }

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Stat label="Total de seguidores criados" value={data.total} icon={Heart} />
        <Stat label="Hoje" value={data.today} icon={UserPlus} />
        <Stat label="Últimos 7 dias" value={data.last7} icon={TrendingUp} />
        <Stat label="Últimos 30 dias" value={data.last30} icon={TrendingUp} />
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Stat label="Pessoas seguindo" value={data.unique_followers} icon={Users} />
        <Stat label="Pessoas seguidas" value={data.unique_followed} icon={Users} />
        <Stat label="Média seguidores/perfil" value={data.avg_followers_per_user} icon={Heart} />
        <Stat label="Reciprocidade" value={data.unique_followers > 0 ? `${((data.unique_followed / data.unique_followers) * 100).toFixed(1)}%` : "0%"} icon={Heart} />
      </div>

      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-sm">Novos seguidores por dia (30d)</CardTitle></CardHeader>
        <CardContent className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={data.series}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis dataKey="date" fontSize={10} tickFormatter={(d) => String(d).slice(5)} />
              <YAxis fontSize={10} allowDecimals={false} />
              <Tooltip contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))" }} />
              <Line type="monotone" dataKey="count" stroke="#a855f7" strokeWidth={2} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-sm">Perfis mais seguidos</CardTitle></CardHeader>
        <CardContent>
          <div className="space-y-2">
            {data.top_followed.map((p: any, i: number) => (
              <div key={p.id} className="flex items-center gap-3 py-1.5 border-b border-border/50 last:border-0">
                <span className="text-xs text-muted-foreground w-6 text-right">#{i + 1}</span>
                <Avatar className="size-8">
                  <AvatarImage src={p.avatar_url ?? undefined} />
                  <AvatarFallback>{(p.display_name || p.username || "?").slice(0, 2).toUpperCase()}</AvatarFallback>
                </Avatar>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{p.display_name || p.username || p.id.slice(0, 8)}</p>
                  {p.username && <p className="text-xs text-muted-foreground truncate">@{p.username}</p>}
                </div>
                <div className="text-sm font-bold tabular-nums">{p.followers.toLocaleString("pt-BR")}</div>
                <span className="text-xs text-muted-foreground">seguidores</span>
              </div>
            ))}
            {data.top_followed.length === 0 && <p className="text-sm text-muted-foreground py-4 text-center">Ninguém segue ninguém ainda.</p>}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function Stat({ label, value, icon: Icon }: { label: string; value: string | number; icon?: React.ComponentType<{ className?: string }> }) {
  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex items-center justify-between">
          <p className="text-xs text-muted-foreground uppercase tracking-wider">{label}</p>
          {Icon && <Icon className="size-4 text-muted-foreground" />}
        </div>
        <p className="mt-2 text-2xl font-bold">{value}</p>
      </CardContent>
    </Card>
  );
}
