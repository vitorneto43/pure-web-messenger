import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Loader2, FileImage, Eye, MousePointerClick, Users, BadgeCheck, TrendingUp } from "lucide-react";
import { getAdminStatusStats } from "@/lib/admin-stats.functions";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, BarChart, Bar,
  CartesianGrid, PieChart, Pie, Cell, Legend,
} from "recharts";

const COLORS = ["#ec4899", "#f59e0b", "#22c55e", "#3b82f6", "#a855f7", "#06b6d4"];

export function StatusAdminTab() {
  const fn = useServerFn(getAdminStatusStats);
  const { data, isLoading } = useQuery({
    queryKey: ["admin-status-stats"],
    queryFn: () => fn(),
    refetchInterval: 60000,
  });

  if (isLoading || !data) {
    return <div className="flex justify-center py-12"><Loader2 className="size-6 animate-spin text-muted-foreground" /></div>;
  }

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Stat label="Status hoje" value={data.today} icon={FileImage} />
        <Stat label="Últimos 7 dias" value={data.last7} icon={TrendingUp} />
        <Stat label="Últimos 30 dias" value={data.last30} icon={TrendingUp} />
        <Stat label="Total publicado" value={data.total} icon={FileImage} />
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Stat label="Usuários publicando" value={data.unique_authors} icon={Users} />
        <Stat label="Média de views/status" value={data.avg_views_per_status.toFixed(1)} icon={Eye} />
        <Stat label="Total de views" value={data.total_views.toLocaleString("pt-BR")} icon={Eye} />
        <Stat label="Status oficiais" value={data.official} icon={BadgeCheck} />
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Stat label="Views impulsionadas" value={data.boosted_views.toLocaleString("pt-BR")} icon={Eye} />
        <Stat label="Cliques em CTA" value={data.total_cta_clicks.toLocaleString("pt-BR")} icon={MousePointerClick} />
        <Stat label="CTR dos CTAs" value={`${data.cta_ctr.toFixed(2)}%`} icon={MousePointerClick} />
        <Stat label="Status por usuário" value={data.unique_authors > 0 ? (data.total / data.unique_authors).toFixed(1) : "0"} icon={FileImage} />
      </div>

      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-sm">Publicações nos últimos 30 dias</CardTitle></CardHeader>
        <CardContent className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={data.series}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis dataKey="date" fontSize={10} tickFormatter={(d) => String(d).slice(5)} />
              <YAxis fontSize={10} allowDecimals={false} />
              <Tooltip contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))" }} />
              <Line type="monotone" dataKey="count" stroke="#ec4899" strokeWidth={2} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      <div className="grid md:grid-cols-2 gap-3">
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm">Por tipo de mídia</CardTitle></CardHeader>
          <CardContent className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={data.by_kind} dataKey="count" nameKey="name" outerRadius={80} label>
                  {data.by_kind.map((_: any, i: number) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                </Pie>
                <Tooltip /><Legend />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm">Top 10 status por visualizações</CardTitle></CardHeader>
          <CardContent className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data.top_by_views.map((t: any) => ({ name: t.display_name || t.username || "—", views: t.views }))}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="name" fontSize={9} angle={-25} textAnchor="end" height={50} />
                <YAxis fontSize={10} />
                <Tooltip />
                <Bar dataKey="views" fill="#3b82f6" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-sm">Status recentes</CardTitle></CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead className="text-muted-foreground border-b border-border">
                <tr>
                  <th className="text-left py-2">Autor</th>
                  <th className="text-left py-2">Tipo</th>
                  <th className="text-left py-2">CTA</th>
                  <th className="text-right py-2">Views</th>
                  <th className="text-left py-2">Criado</th>
                </tr>
              </thead>
              <tbody>
                {data.recent.map((s: any) => (
                  <tr key={s.id} className="border-b border-border/50">
                    <td className="py-2">
                      {s.display_name || s.username || s.user_id.slice(0, 8)}
                      {s.is_official && <Badge variant="outline" className="ml-1 text-[9px]">oficial</Badge>}
                    </td>
                    <td className="py-2">{s.kind}</td>
                    <td className="py-2 truncate max-w-[160px]">{s.cta_label || "—"}</td>
                    <td className="py-2 text-right font-medium">{s.views}</td>
                    <td className="py-2">{new Date(s.created_at).toLocaleString("pt-BR")}</td>
                  </tr>
                ))}
              </tbody>
            </table>
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
