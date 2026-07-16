import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  Loader2, Sparkles, TrendingUp, TrendingDown, Users, Globe2, Clock, Rocket,
  MessageSquare, Heart, Radio, FileImage, AlertTriangle, CheckCircle2, Info, Send,
  Calendar, Zap,
} from "lucide-react";
import { analyzeGrowth, askGrowthQuestion } from "@/lib/growth-ai.functions";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, BarChart, Bar,
} from "recharts";

type Period = "today" | "7d" | "30d" | "90d" | "custom";

const QUESTIONS: { id: string; label: string }[] = [
  { id: "country_most_users", label: "Qual país trouxe mais usuários?" },
  { id: "country_best_retention", label: "Qual país teve maior retenção?" },
  { id: "best_signup_hour", label: "Qual horário teve mais cadastros?" },
  { id: "best_source_active", label: "Qual origem trouxe usuários mais ativos?" },
  { id: "d1_returned", label: "Quantos usuários voltaram no dia seguinte?" },
  { id: "top_feature_used", label: "Qual funcionalidade foi mais utilizada?" },
  { id: "growth_direction", label: "O crescimento aumentou ou diminuiu?" },
  { id: "best_campaign", label: "Qual campanha teve melhor desempenho?" },
  { id: "avg_daily", label: "Qual foi a média diária de novos usuários?" },
  { id: "forecast", label: "Qual é a projeção para os próximos 7 e 30 dias?" },
];

export function GrowthAITab() {
  const analyzeFn = useServerFn(analyzeGrowth);
  const askFn = useServerFn(askGrowthQuestion);

  const [period, setPeriod] = useState<Period>("30d");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");

  const analyze = useMutation({
    mutationFn: () => analyzeFn({ data: { period, from: from || undefined, to: to || undefined } }),
  });

  const [chat, setChat] = useState<{ q: string; a: string }[]>([]);
  const ask = useMutation({
    mutationFn: (questionId: string) => askFn({ data: { question: questionId, period, from: from || undefined, to: to || undefined } }),
    onSuccess: (r, qid) => {
      const label = QUESTIONS.find((x) => x.id === qid)?.label ?? qid;
      setChat((c) => [...c, { q: label, a: r.answer }]);
    },
  });

  const d = analyze.data;

  return (
    <div className="space-y-4">
      {/* Header / Controls */}
      <Card className="border-primary/30 bg-gradient-to-br from-primary/5 to-transparent">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Sparkles className="size-5 text-primary" />
            Growth AI
            <Badge variant="outline" className="ml-2">somente-leitura</Badge>
          </CardTitle>
          <CardDescription>
            Consultor inteligente baseado 100% em dados do banco. Não altera nada. Nenhuma API externa.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap items-end gap-3">
            <div className="w-44">
              <label className="text-xs text-muted-foreground mb-1 block">Período</label>
              <Select value={period} onValueChange={(v) => setPeriod(v as Period)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="today">Hoje</SelectItem>
                  <SelectItem value="7d">Últimos 7 dias</SelectItem>
                  <SelectItem value="30d">Últimos 30 dias</SelectItem>
                  <SelectItem value="90d">Últimos 90 dias</SelectItem>
                  <SelectItem value="custom">Personalizado</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {period === "custom" && (
              <>
                <div>
                  <label className="text-xs text-muted-foreground mb-1 block">De</label>
                  <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="w-40" />
                </div>
                <div>
                  <label className="text-xs text-muted-foreground mb-1 block">Até</label>
                  <Input type="date" value={to} onChange={(e) => setTo(e.target.value)} className="w-40" />
                </div>
              </>
            )}
            <Button onClick={() => analyze.mutate()} disabled={analyze.isPending}>
              {analyze.isPending ? <Loader2 className="size-4 animate-spin mr-2" /> : <Zap className="size-4 mr-2" />}
              Analisar Agora
            </Button>
            {d && (
              <p className="text-xs text-muted-foreground ml-2">
                <Calendar className="size-3 inline mr-1" />
                {new Date(d.period.start).toLocaleDateString("pt-BR")} → {new Date(d.period.end).toLocaleDateString("pt-BR")} ({d.period.days}d)
              </p>
            )}
          </div>
        </CardContent>
      </Card>

      {analyze.isError && (
        <Card className="border-destructive/50"><CardContent className="p-4 text-sm text-destructive">
          Erro ao analisar: {analyze.error instanceof Error ? analyze.error.message : "desconhecido"}
        </CardContent></Card>
      )}

      {!d && !analyze.isPending && (
        <Card><CardContent className="p-8 text-center text-muted-foreground">
          Selecione um período e clique em <b>Analisar Agora</b> para gerar insights.
        </CardContent></Card>
      )}

      {d && (
        <>
          {/* KPIs */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <Stat label="Total na plataforma" value={d.totals.total_users_platform} icon={Users} />
            <Stat label="Novos no período" value={d.totals.new_users_period} icon={TrendingUp}
              hint={`vs ${d.totals.prev_period} anterior`} />
            <Stat label="Variação" value={`${d.totals.growth_delta_pct >= 0 ? "+" : ""}${d.totals.growth_delta_pct.toFixed(1)}%`}
              icon={d.totals.growth_delta_pct >= 0 ? TrendingUp : TrendingDown}
              tone={d.totals.growth_delta_pct >= 0 ? "success" : "warn"} />
            <Stat label="Média/dia" value={d.totals.avg_per_day.toFixed(1)} icon={Sparkles} />
          </div>

          {/* Recommendations */}
          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-sm flex items-center gap-2">
              <Sparkles className="size-4 text-primary" /> Recomendações da IA
            </CardTitle></CardHeader>
            <CardContent className="space-y-2">
              {d.recommendations.map((r: any, i: number) => (
                <div key={i} className="flex items-start gap-2 text-sm p-2 rounded-md bg-muted/40">
                  {r.level === "success" && <CheckCircle2 className="size-4 text-green-500 mt-0.5 shrink-0" />}
                  {r.level === "warn" && <AlertTriangle className="size-4 text-amber-500 mt-0.5 shrink-0" />}
                  {r.level === "info" && <Info className="size-4 text-blue-500 mt-0.5 shrink-0" />}
                  <span>{r.text}</span>
                </div>
              ))}
            </CardContent>
          </Card>

          {/* Crescimento chart */}
          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-sm">Cadastros por dia</CardTitle></CardHeader>
            <CardContent className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={d.series}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="date" fontSize={10} tickFormatter={(x) => String(x).slice(5)} />
                  <YAxis fontSize={10} allowDecimals={false} />
                  <Tooltip contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))" }} />
                  <Line type="monotone" dataKey="count" stroke="hsl(var(--primary))" strokeWidth={2} dot={false} />
                </LineChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          {/* Forecast */}
          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-sm flex items-center gap-2">
              <Rocket className="size-4 text-primary" /> Previsão (estimativa)
            </CardTitle></CardHeader>
            <CardContent>
              <div className="grid grid-cols-3 gap-3">
                <Stat label="Amanhã" value={d.forecast.tomorrow} />
                <Stat label="Próximos 7 dias" value={d.forecast.next7} />
                <Stat label="Próximos 30 dias" value={d.forecast.next30} />
              </div>
              <p className="text-xs text-muted-foreground mt-3">Base: {d.forecast.basis}. Estimativa, não é garantia.</p>
            </CardContent>
          </Card>

          {/* Aquisição */}
          <div className="grid md:grid-cols-2 gap-3">
            <RankCard title="Origens de cadastro" icon={Globe2} rows={d.acquisition.sources} />
            <RankCard title="Campanhas" icon={Rocket} rows={d.acquisition.campaigns} />
            <RankCard title="Países (idioma)" icon={Globe2} rows={d.audience.countries} />
            <RankCard title="Dispositivos" icon={Users} rows={d.audience.devices} />
            <RankCard title="Sistemas" icon={Users} rows={d.audience.os} />
            <RankCard title="Navegadores" icon={Users} rows={d.audience.browsers} />
          </div>

          {/* Horários */}
          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-sm flex items-center gap-2">
              <Clock className="size-4" /> Cadastros por hora do dia
            </CardTitle></CardHeader>
            <CardContent className="h-56">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={d.acquisition.by_hour}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="hour" fontSize={10} />
                  <YAxis fontSize={10} allowDecimals={false} />
                  <Tooltip contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))" }} />
                  <Bar dataKey="count" fill="hsl(var(--primary))" />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          {/* Retention */}
          <div className="grid md:grid-cols-2 gap-3">
            <Card>
              <CardHeader className="pb-2"><CardTitle className="text-sm">Retenção</CardTitle></CardHeader>
              <CardContent className="space-y-2">
                <Row label="Voltaram em D1" value={`${d.retention.d1_users} (${d.retention.d1_pct.toFixed(1)}%)`} />
                <Row label="Voltaram em D7" value={`${d.retention.d7_users} (${d.retention.d7_pct.toFixed(1)}%)`} />
                <Row label="Risco de abandono" value={`${d.totals.churn_risk_users}`} tone="warn" />
                <Row label="Publicaram Status → retorno" value={`${d.retention.status_publishers_ret_pct.toFixed(1)}%`} tone="success" />
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2"><CardTitle className="text-sm">Retenção por país</CardTitle></CardHeader>
              <CardContent>
                {d.retention.by_country.length === 0 ? (
                  <p className="text-sm text-muted-foreground">Não há dados suficientes.</p>
                ) : (
                  <div className="space-y-1.5">
                    {d.retention.by_country.map((c: any) => (
                      <div key={c.country} className="flex items-center justify-between text-sm">
                        <span>{c.country}</span>
                        <span className="tabular-nums text-muted-foreground">{c.retention_pct.toFixed(1)}% <span className="text-xs">({c.total})</span></span>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Engagement */}
          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-sm">Engajamento no período</CardTitle></CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <Stat label="Posts" value={d.engagement.posts} icon={FileImage} />
                <Stat label="Status" value={d.engagement.statuses} icon={FileImage} />
                <Stat label="Lives" value={d.engagement.lives} icon={Radio} />
                <Stat label="Mensagens" value={d.engagement.messages} icon={MessageSquare} />
                <Stat label="Comentários" value={d.engagement.comments} icon={MessageSquare} />
                <Stat label="Reações" value={d.engagement.reactions} icon={Heart} />
                <Stat label="Melhor h/ post" value={`${d.engagement.best_post_hour}h`} icon={Clock} />
                <Stat label="Melhor h/ live" value={`${d.engagement.best_live_hour}h`} icon={Clock} />
              </div>
            </CardContent>
          </Card>

          {/* Perguntas */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex items-center gap-2"><Send className="size-4" /> Perguntas</CardTitle>
              <CardDescription>Selecione uma pergunta. A IA responde apenas com base nos dados do banco.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex flex-wrap gap-2">
                {QUESTIONS.map((q) => (
                  <Button key={q.id} size="sm" variant="outline" disabled={ask.isPending}
                    onClick={() => ask.mutate(q.id)}>
                    {q.label}
                  </Button>
                ))}
              </div>
              {chat.length > 0 && (
                <div className="space-y-2 mt-4">
                  {chat.map((c, i) => (
                    <div key={i} className="rounded-md border border-border/50 p-3 bg-muted/30">
                      <p className="text-xs text-muted-foreground font-medium mb-1">🧑 {c.q}</p>
                      <p className="text-sm">🤖 {c.a}</p>
                    </div>
                  ))}
                </div>
              )}
              {ask.isPending && <Loader2 className="size-4 animate-spin text-muted-foreground" />}
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}

function Stat({ label, value, hint, icon: Icon, tone }: {
  label: string; value: string | number; hint?: string;
  icon?: React.ComponentType<{ className?: string }>;
  tone?: "success" | "warn";
}) {
  const toneCls = tone === "success" ? "text-green-500" : tone === "warn" ? "text-amber-500" : "";
  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex items-center justify-between">
          <p className="text-xs text-muted-foreground uppercase tracking-wider">{label}</p>
          {Icon && <Icon className="size-4 text-muted-foreground" />}
        </div>
        <p className={`mt-2 text-2xl font-bold ${toneCls}`}>
          {typeof value === "number" ? value.toLocaleString("pt-BR") : value}
        </p>
        {hint && <p className="mt-1 text-xs text-muted-foreground">{hint}</p>}
      </CardContent>
    </Card>
  );
}

function Row({ label, value, tone }: { label: string; value: string; tone?: "success" | "warn" }) {
  const cls = tone === "success" ? "text-green-500" : tone === "warn" ? "text-amber-500" : "";
  return (
    <div className="flex items-center justify-between text-sm">
      <span className="text-muted-foreground">{label}</span>
      <span className={`font-semibold ${cls}`}>{value}</span>
    </div>
  );
}

function RankCard({ title, icon: Icon, rows }: {
  title: string; icon: React.ComponentType<{ className?: string }>;
  rows: { key: string; value: number }[];
}) {
  return (
    <Card>
      <CardHeader className="pb-2"><CardTitle className="text-sm flex items-center gap-2">
        <Icon className="size-4" /> {title}
      </CardTitle></CardHeader>
      <CardContent>
        {rows.length === 0 ? (
          <p className="text-sm text-muted-foreground">Não há dados suficientes.</p>
        ) : (
          <div className="space-y-1.5">
            {rows.map((r, i) => (
              <div key={r.key + i} className="flex items-center justify-between text-sm">
                <span className="truncate">{r.key}</span>
                <span className="tabular-nums text-muted-foreground ml-2">{r.value.toLocaleString("pt-BR")}</span>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
