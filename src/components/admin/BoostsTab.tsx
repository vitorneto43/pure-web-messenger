import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Loader2, Rocket, DollarSign, TrendingUp, Target } from "lucide-react";
import { getAdminBoostStats } from "@/lib/boost-analytics.functions";
import { Card, CardContent } from "@/components/ui/card";
import {
  LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, BarChart, Bar,
  CartesianGrid, PieChart, Pie, Cell, Legend,
} from "recharts";

const COLORS = ["#ec4899", "#f59e0b", "#22c55e", "#3b82f6", "#a855f7", "#06b6d4", "#ef4444"];

function money(cents: number) {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(cents / 100);
}

export function BoostsTab() {
  const fn = useServerFn(getAdminBoostStats);
  const { data, isLoading } = useQuery({
    queryKey: ["admin-boosts", 30],
    queryFn: () => fn({ data: { days: 30 } }),
  });

  if (isLoading || !data) {
    return <div className="flex justify-center py-12"><Loader2 className="size-6 animate-spin text-muted-foreground" /></div>;
  }

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Stat label="Impulsos (30d)" value={data.total ?? 0} icon={Rocket} />
        <Stat label="Receita" value={money(data.revenue_cents ?? 0)} icon={DollarSign} />
        <Stat label="Ticket médio" value={`R$ ${(data.avg_ticket ?? 0).toFixed(2)}`} icon={TrendingUp} />
        <Stat label="Ativos" value={data.active ?? 0} icon={Target} />
      </div>

      <Card>
        <CardContent className="p-4">
          <p className="text-xs font-medium text-muted-foreground mb-2">Receita diária</p>
          <ResponsiveContainer width="100%" height={220}>
            <LineChart data={data.series ?? []}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis dataKey="date" fontSize={10} tickFormatter={(d) => String(d).slice(5)} />
              <YAxis fontSize={10} tickFormatter={(v) => `R$${Math.round(Number(v)/100)}`} />
              <Tooltip formatter={(v: any) => money(Number(v))} />
              <Line type="monotone" dataKey="revenue_cents" stroke="#ec4899" strokeWidth={2} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      <div className="grid md:grid-cols-2 gap-3">
        <Card><CardContent className="p-4">
          <p className="text-xs font-medium text-muted-foreground mb-2">Por tipo</p>
          <ResponsiveContainer width="100%" height={200}>
            <PieChart>
              <Pie data={data.by_type ?? []} dataKey="count" nameKey="name" outerRadius={70} label>
                {(data.by_type ?? []).map((_: any, i: number) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
              </Pie>
              <Tooltip /><Legend />
            </PieChart>
          </ResponsiveContainer>
        </CardContent></Card>

        <Card><CardContent className="p-4">
          <p className="text-xs font-medium text-muted-foreground mb-2">Por objetivo</p>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={data.by_objective ?? []}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis dataKey="name" fontSize={9} />
              <YAxis fontSize={10} /><Tooltip />
              <Bar dataKey="count" fill="#f59e0b" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </CardContent></Card>
      </div>

      <Card><CardContent className="p-4">
        <p className="text-xs font-medium text-muted-foreground mb-2">Estados mais segmentados</p>
        <ResponsiveContainer width="100%" height={200}>
          <BarChart data={data.by_state ?? []}>
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
            <XAxis dataKey="name" fontSize={10} /><YAxis fontSize={10} /><Tooltip />
            <Bar dataKey="count" fill="#3b82f6" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </CardContent></Card>

      <Card><CardContent className="p-4">
        <p className="text-xs font-medium text-muted-foreground mb-3">Últimos impulsos</p>
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead className="text-muted-foreground border-b border-border">
              <tr>
                <th className="text-left py-2">Usuário</th>
                <th className="text-left py-2">Tipo</th>
                <th className="text-left py-2">Objetivo</th>
                <th className="text-right py-2">Valor</th>
                <th className="text-right py-2">Views</th>
                <th className="text-left py-2">Status</th>
              </tr>
            </thead>
            <tbody>
              {(data.recent ?? []).map((r: any) => (
                <tr key={r.id} className="border-b border-border/50">
                  <td className="py-2">{r.display_name || r.username || r.user_id?.slice(0, 8)}</td>
                  <td className="py-2">{r.boost_type}</td>
                  <td className="py-2">{r.objective || "—"}</td>
                  <td className="py-2 text-right font-medium">{money(r.amount_cents)}</td>
                  <td className="py-2 text-right">{r.views_total?.toLocaleString("pt-BR")}</td>
                  <td className="py-2">{r.status}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </CardContent></Card>
    </div>
  );
}

function Stat({ label, value, icon: Icon }: { label: string; value: string | number; icon?: React.ComponentType<{ className?: string }> }) {
  return (
    <Card><CardContent className="p-4">
      <div className="flex items-center justify-between">
        <p className="text-xs text-muted-foreground uppercase tracking-wider">{label}</p>
        {Icon && <Icon className="size-4 text-muted-foreground" />}
      </div>
      <p className="mt-2 text-2xl font-bold">{value}</p>
    </CardContent></Card>
  );
}
