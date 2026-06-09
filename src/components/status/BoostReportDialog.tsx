import { useEffect, useState } from "react";
import { Loader2, BarChart3 } from "lucide-react";
import { useServerFn } from "@tanstack/react-start";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { getBoostReport } from "@/lib/boost-analytics.functions";
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, BarChart, Bar, CartesianGrid, PieChart, Pie, Cell, Legend } from "recharts";

const COLORS = ["#ec4899", "#f59e0b", "#22c55e", "#3b82f6", "#a855f7", "#06b6d4", "#ef4444"];

function money(cents: number) {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(cents / 100);
}

export function BoostReportDialog({ boostId, open, onOpenChange }: { boostId: string | null; open: boolean; onOpenChange: (v: boolean) => void }) {
  const fn = useServerFn(getBoostReport);
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!open || !boostId) return;
    setLoading(true);
    fn({ data: { boostId } }).then((r) => setData(r)).catch(() => setData(null)).finally(() => setLoading(false));
  }, [open, boostId]);

  const series = (data?.series ?? []).reduce((acc: any[], row: any) => {
    const found = acc.find((x) => x.date === row.date);
    if (found) { found.views += row.views; found.clicks += row.clicks; }
    else acc.push({ date: row.date, views: row.views, clicks: row.clicks });
    return acc;
  }, []).sort((a: any, b: any) => a.date.localeCompare(b.date));

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2"><BarChart3 className="size-5 text-primary" /> Relatório do impulso</DialogTitle>
        </DialogHeader>
        {loading || !data ? (
          <div className="flex justify-center py-12"><Loader2 className="size-6 animate-spin text-muted-foreground" /></div>
        ) : (
          <div className="space-y-4">
            <div className="grid grid-cols-2 md:grid-cols-5 gap-2">
              <Stat label="Gasto" value={money(data.boost?.amount_cents ?? 0)} />
              <Stat label="Visualizações" value={data.views_delivered?.toLocaleString("pt-BR") ?? 0} />
              <Stat label="Cliques" value={data.clicks?.toLocaleString("pt-BR") ?? 0} />
              <Stat label="CTR" value={`${data.ctr ?? 0}%`} />
              <Stat label="CPM real" value={money(data.real_cpm_cents ?? 0)} />
            </div>

            <Card title="Views e cliques por dia">
              <ResponsiveContainer width="100%" height={200}>
                <LineChart data={series}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="date" fontSize={10} tickFormatter={(d) => d.slice(5)} />
                  <YAxis fontSize={10} />
                  <Tooltip />
                  <Line type="monotone" dataKey="views" stroke="#ec4899" strokeWidth={2} dot={false} />
                  <Line type="monotone" dataKey="clicks" stroke="#3b82f6" strokeWidth={2} dot={false} />
                </LineChart>
              </ResponsiveContainer>
            </Card>

            <Card title="Estados que mais viram">
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={data.by_state ?? []}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="name" fontSize={10} />
                  <YAxis fontSize={10} />
                  <Tooltip />
                  <Bar dataKey="count" fill="#ec4899" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </Card>

            <div className="grid md:grid-cols-2 gap-3">
              <Card title="Faixa etária">
                <ResponsiveContainer width="100%" height={200}>
                  <BarChart data={data.by_age ?? []}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                    <XAxis dataKey="name" fontSize={10} />
                    <YAxis fontSize={10} />
                    <Tooltip />
                    <Bar dataKey="count" fill="#f59e0b" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </Card>

              <Card title="Gênero">
                <ResponsiveContainer width="100%" height={200}>
                  <PieChart>
                    <Pie data={data.by_gender ?? []} dataKey="count" nameKey="name" outerRadius={70} label>
                      {(data.by_gender ?? []).map((_: any, i: number) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                    </Pie>
                    <Tooltip />
                    <Legend />
                  </PieChart>
                </ResponsiveContainer>
              </Card>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

function Stat({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-lg border border-border bg-card p-3">
      <p className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</p>
      <p className="text-lg font-bold mt-1">{value}</p>
    </div>
  );
}

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-lg border border-border bg-card p-3">
      <p className="text-xs font-medium text-muted-foreground mb-2">{title}</p>
      {children}
    </div>
  );
}
