import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Loader2, Globe2, Eye, Users } from "lucide-react";
import { getTrafficBySource } from "@/lib/admin.functions";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid,
  PieChart, Pie, Cell, Legend, LineChart, Line,
} from "recharts";

const COLORS = ["#3b82f6", "#22c55e", "#f59e0b", "#ec4899", "#a855f7", "#06b6d4", "#ef4444", "#84cc16", "#eab308", "#14b8a6"];

const SOURCE_LABEL: Record<string, string> = {
  facebook: "Facebook",
  instagram: "Instagram",
  tiktok: "TikTok",
  google: "Google",
  bing: "Bing",
  youtube: "YouTube",
  twitter: "Twitter / X",
  whatsapp: "WhatsApp",
  direct: "Direto / Desconhecido",
};

function labelSource(s: string) {
  return SOURCE_LABEL[s] ?? s;
}

export function TrafficSourcesCard() {
  const [days, setDays] = useState(7);
  const fn = useServerFn(getTrafficBySource);
  const { data, isLoading } = useQuery({
    queryKey: ["admin-traffic-by-source", days],
    queryFn: () => fn({ data: { days } }),
    refetchInterval: 60_000,
  });

  const topSources = useMemo(() => (data?.sources ?? []).slice(0, 8), [data]);
  const seriesSources = useMemo(() => topSources.slice(0, 5).map((s) => s.source), [topSources]);

  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-start justify-between gap-2 flex-wrap">
          <div>
            <CardTitle className="text-sm flex items-center gap-2">
              <Globe2 className="size-4 text-primary" /> Tráfego por origem (UTM + referrer)
            </CardTitle>
            <CardDescription className="text-xs">
              Visitas reais por origem dos últimos {days} dias. Inclui cliques do Facebook (mesmo via in-app browser sem referrer), Instagram, TikTok, Google Ads, etc.
            </CardDescription>
          </div>
          <div className="flex gap-1">
            {[1, 7, 30].map((d) => (
              <Button
                key={d}
                size="sm"
                variant={days === d ? "default" : "outline"}
                onClick={() => setDays(d)}
                className="h-7 text-xs"
              >
                {d === 1 ? "24h" : `${d}d`}
              </Button>
            ))}
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {isLoading || !data ? (
          <div className="flex justify-center py-12">
            <Loader2 className="size-6 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <div className="space-y-4">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <MiniStat label="Visualizações" value={data.totalViews} icon={Eye} />
              <MiniStat label="Sessões únicas" value={data.totalSessions} icon={Users} />
              <MiniStat
                label="Origem #1"
                value={topSources[0] ? `${labelSource(topSources[0].source)} (${topSources[0].views})` : "—"}
              />
              <MiniStat
                label="% identificado"
                value={
                  data.totalViews > 0
                    ? `${Math.round(
                        ((data.totalViews -
                          (data.sources.find((s) => s.source === "direct")?.views ?? 0)) /
                          data.totalViews) *
                          100,
                      )}%`
                    : "0%"
                }
                hint="Visitas com origem conhecida"
              />
            </div>

            <div className="grid md:grid-cols-2 gap-3">
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={topSources}
                      dataKey="views"
                      nameKey="source"
                      outerRadius={90}
                      label={(e: { source?: string; views?: number }) =>
                        `${labelSource(String(e.source))} (${e.views})`
                      }
                    >
                      {topSources.map((_, i) => (
                        <Cell key={i} fill={COLORS[i % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip
                      formatter={(v: number, n: string) => [v, labelSource(n)]}
                      contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))" }}
                    />
                    <Legend formatter={(v: string) => labelSource(v)} />
                  </PieChart>
                </ResponsiveContainer>
              </div>

              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={topSources}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                    <XAxis
                      dataKey="source"
                      tickFormatter={labelSource}
                      tick={{ fontSize: 10 }}
                      interval={0}
                      angle={-20}
                      textAnchor="end"
                      height={60}
                    />
                    <YAxis tick={{ fontSize: 10 }} allowDecimals={false} />
                    <Tooltip
                      formatter={(v: number) => [v, "Visualizações"]}
                      labelFormatter={labelSource}
                      contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))" }}
                    />
                    <Bar dataKey="views" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            {data.series.length > 1 && (
              <div className="h-56">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={data.series}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                    <XAxis dataKey="date" tick={{ fontSize: 10 }} tickFormatter={(d) => String(d).slice(5)} />
                    <YAxis tick={{ fontSize: 10 }} allowDecimals={false} />
                    <Tooltip
                      contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))" }}
                      formatter={(v: number, n: string) => [v, labelSource(n)]}
                    />
                    <Legend formatter={(v: string) => labelSource(v)} />
                    {seriesSources.map((src, i) => (
                      <Line
                        key={src}
                        type="monotone"
                        dataKey={src}
                        stroke={COLORS[i % COLORS.length]}
                        strokeWidth={2}
                        dot={false}
                      />
                    ))}
                  </LineChart>
                </ResponsiveContainer>
              </div>
            )}

            <div className="grid md:grid-cols-2 gap-3">
              <div>
                <p className="text-xs font-medium mb-2 text-muted-foreground uppercase tracking-wider">Detalhe por origem</p>
                <table className="w-full text-xs">
                  <thead className="text-muted-foreground border-b border-border">
                    <tr>
                      <th className="text-left py-2">Origem</th>
                      <th className="text-right py-2">Visitas</th>
                      <th className="text-right py-2">Sessões</th>
                      <th className="text-right py-2">%</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.sources.map((s) => (
                      <tr key={s.source} className="border-b border-border/50">
                        <td className="py-2 font-medium">{labelSource(s.source)}</td>
                        <td className="py-2 text-right tabular-nums">{s.views}</td>
                        <td className="py-2 text-right tabular-nums text-muted-foreground">{s.sessions}</td>
                        <td className="py-2 text-right tabular-nums text-muted-foreground">
                          {data.totalViews > 0 ? ((s.views / data.totalViews) * 100).toFixed(1) : 0}%
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div>
                <p className="text-xs font-medium mb-2 text-muted-foreground uppercase tracking-wider">
                  Campanhas (utm_campaign / utm_medium)
                </p>
                {data.campaigns.length === 0 ? (
                  <p className="text-xs text-muted-foreground py-4">
                    Sem campanhas com UTM ainda. Use links como{" "}
                    <code className="text-[10px]">?utm_source=facebook&amp;utm_medium=cpc&amp;utm_campaign=nome</code>{" "}
                    nos seus anúncios.
                  </p>
                ) : (
                  <div className="divide-y divide-border/50">
                    {data.campaigns.map((c, i) => (
                      <div key={i} className="py-2 flex items-center justify-between gap-2 text-xs">
                        <div className="min-w-0">
                          <p className="font-medium truncate">{labelSource(c.source)} · {c.campaign}</p>
                          <p className="text-[10px] text-muted-foreground truncate">meio: {c.medium}</p>
                        </div>
                        <Badge variant="secondary" className="shrink-0">{c.views}</Badge>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            <div>
              <p className="text-xs font-medium mb-2 text-muted-foreground uppercase tracking-wider">Páginas mais visitadas</p>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-1">
                {data.topPaths.map((p) => (
                  <div key={p.path} className="flex items-center justify-between text-xs py-1 border-b border-border/30">
                    <span className="truncate font-mono">{p.path}</span>
                    <span className="tabular-nums text-muted-foreground ml-2">{p.views}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function MiniStat({
  label,
  value,
  hint,
  icon: Icon,
}: {
  label: string;
  value: string | number;
  hint?: string;
  icon?: React.ComponentType<{ className?: string }>;
}) {
  return (
    <div className="rounded-md border border-border bg-card/50 p-3">
      <div className="flex items-center justify-between">
        <p className="text-[10px] text-muted-foreground uppercase tracking-wider">{label}</p>
        {Icon && <Icon className="size-3.5 text-muted-foreground" />}
      </div>
      <p className="mt-1 text-lg font-bold truncate">{value}</p>
      {hint && <p className="text-[10px] text-muted-foreground mt-0.5">{hint}</p>}
    </div>
  );
}
