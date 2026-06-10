import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Loader2, Rocket, DollarSign, TrendingUp, Target, Eye, MousePointerClick, RefreshCcw } from "lucide-react";
import { getAdminBoostStatsFull } from "@/lib/admin-stats.functions";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, BarChart, Bar,
  CartesianGrid, PieChart, Pie, Cell, Legend,
} from "recharts";

const COLORS = ["#ec4899", "#f59e0b", "#22c55e", "#3b82f6", "#a855f7", "#06b6d4", "#ef4444"];

function money(cents: number) {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format((cents ?? 0) / 100);
}

export function BoostsTab() {
  const fn = useServerFn(getAdminBoostStatsFull);
  const { data, isLoading } = useQuery({
    queryKey: ["admin-boosts-full"],
    queryFn: () => fn(),
    refetchInterval: 60000,
  });

  if (isLoading || !data) {
    return <div className="flex justify-center py-12"><Loader2 className="size-6 animate-spin text-muted-foreground" /></div>;
  }

  const k = data.kpis;

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Stat label="Impulsos ativos" value={k.active} icon={Rocket} />
        <Stat label="Valor investido" value={money(k.total_invested_cents)} icon={DollarSign} />
        <Stat label="Impressões entregues" value={k.impressions_delivered.toLocaleString("pt-BR")} icon={Eye} />
        <Stat label="Cliques recebidos" value={k.total_clicks.toLocaleString("pt-BR")} icon={MousePointerClick} />
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Stat label="Total de campanhas" value={k.total} icon={Rocket} />
        <Stat label="Concluídos" value={k.completed} icon={Target} />
        <Stat label="Pendentes" value={k.pending} />
        <Stat label="Falhos / Reembolsados" value={`${k.failed} / ${k.refunded}`} icon={RefreshCcw} />
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Stat label="Últimas 24h" value={k.last1} />
        <Stat label="Últimos 7d" value={k.last7} />
        <Stat label="Últimos 30d" value={k.last30} icon={TrendingUp} />
        <Stat label="Ticket médio" value={money(k.avg_ticket_cents)} />
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Stat label="CTR global" value={`${k.ctr}%`} icon={MousePointerClick} />
        <Stat label="CPM real" value={money(k.real_cpm_cents)} />
        <Stat label="CPC médio" value={money(k.avg_cpc_cents)} />
        <Stat label="Impressões restantes" value={k.impressions_remaining.toLocaleString("pt-BR")} icon={Eye} />
      </div>

      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-sm">Performance diária (30d)</CardTitle></CardHeader>
        <CardContent className="h-72">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={data.series}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis dataKey="date" fontSize={10} tickFormatter={(d) => String(d).slice(5)} />
              <YAxis yAxisId="left" fontSize={10} />
              <YAxis yAxisId="right" orientation="right" fontSize={10} tickFormatter={(v) => `R$${Math.round(Number(v) / 100)}`} />
              <Tooltip contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))" }} />
              <Legend />
              <Line yAxisId="left" type="monotone" dataKey="impressions" name="Impressões" stroke="#3b82f6" strokeWidth={2} dot={false} />
              <Line yAxisId="left" type="monotone" dataKey="clicks" name="Cliques" stroke="#22c55e" strokeWidth={2} dot={false} />
              <Line yAxisId="right" type="monotone" dataKey="revenue_cents" name="Receita" stroke="#ec4899" strokeWidth={2} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      <div className="grid md:grid-cols-2 gap-3">
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm">Conversões por objetivo</CardTitle></CardHeader>
          <CardContent className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data.by_objective}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="name" fontSize={9} />
                <YAxis fontSize={10} />
                <Tooltip />
                <Legend />
                <Bar dataKey="clicks" name="Cliques" fill="#22c55e" radius={[4, 4, 0, 0]} />
                <Bar dataKey="count" name="Campanhas" fill="#f59e0b" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm">Por pacote</CardTitle></CardHeader>
          <CardContent className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={data.by_package} dataKey="count" nameKey="name" outerRadius={80} label>
                  {data.by_package.map((_: any, i: number) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                </Pie>
                <Tooltip /><Legend />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-sm">Estados mais segmentados</CardTitle></CardHeader>
        <CardContent className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data.by_state}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis dataKey="name" fontSize={10} />
              <YAxis fontSize={10} />
              <Tooltip />
              <Bar dataKey="count" fill="#3b82f6" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-sm">Top 25 campanhas (por cliques)</CardTitle></CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead className="text-muted-foreground border-b border-border">
                <tr>
                  <th className="text-left py-2">Usuário</th>
                  <th className="text-left py-2">Objetivo</th>
                  <th className="text-left py-2">Tipo</th>
                  <th className="text-right py-2">Valor</th>
                  <th className="text-right py-2">Impressões</th>
                  <th className="text-right py-2">Cliques</th>
                  <th className="text-right py-2">CTR</th>
                  <th className="text-left py-2">Status</th>
                </tr>
              </thead>
              <tbody>
                {data.campaigns.map((c: any) => (
                  <tr key={c.id} className="border-b border-border/50">
                    <td className="py-2">{c.display_name || c.username || c.user_id?.slice(0, 8)}</td>
                    <td className="py-2">{c.objective}</td>
                    <td className="py-2">{c.boost_type}{c.is_free_reward && <Badge variant="outline" className="ml-1 text-[9px]">grátis</Badge>}</td>
                    <td className="py-2 text-right font-medium">{money(c.amount_cents)}</td>
                    <td className="py-2 text-right">{c.impressions.toLocaleString("pt-BR")}</td>
                    <td className="py-2 text-right font-medium text-emerald-600">{c.clicks.toLocaleString("pt-BR")}</td>
                    <td className="py-2 text-right">{c.ctr}%</td>
                    <td className="py-2"><Badge variant="outline" className="text-[9px]">{c.status}</Badge></td>
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
