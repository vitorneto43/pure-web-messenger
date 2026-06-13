import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { getConversionFunnel, type FunnelResult } from "@/lib/funnel.functions";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Loader2, TrendingDown, AlertTriangle, Info, Users, Eye, UserPlus } from "lucide-react";

type Period = "today" | "7d" | "30d" | "90d";

const PERIOD_LABELS: Record<Period, string> = {
  today: "Hoje",
  "7d": "7 dias",
  "30d": "30 dias",
  "90d": "90 dias",
};

export function ConversionFunnelTab() {
  const [period, setPeriod] = useState<Period>("7d");
  const fetchFn = useServerFn(getConversionFunnel);
  const q = useQuery({
    queryKey: ["admin", "funnel", period],
    queryFn: () => fetchFn({ data: { period } }) as Promise<FunnelResult>,
    refetchOnWindowFocus: false,
  });

  return (
    <div className="space-y-6">
      {/* Header + period selector */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-semibold tracking-tight">Funil de Conversão</h2>
          <p className="text-sm text-muted-foreground">
            Onde os usuários estão abandonando o cadastro do WaveChat.
          </p>
        </div>
        <div className="flex gap-1.5 rounded-lg border border-border bg-card p-1">
          {(Object.keys(PERIOD_LABELS) as Period[]).map((p) => (
            <Button
              key={p}
              size="sm"
              variant={period === p ? "default" : "ghost"}
              onClick={() => setPeriod(p)}
              className="h-8"
            >
              {PERIOD_LABELS[p]}
            </Button>
          ))}
        </div>
      </div>

      {q.isLoading && (
        <div className="flex items-center gap-2 text-muted-foreground">
          <Loader2 className="size-4 animate-spin" /> Carregando funil…
        </div>
      )}
      {q.isError && (
        <Card className="border-destructive/40">
          <CardContent className="pt-6 text-sm text-destructive">
            Erro ao carregar o funil. {(q.error as Error)?.message}
          </CardContent>
        </Card>
      )}

      {q.data && <FunnelContent data={q.data} />}
    </div>
  );
}

function FunnelContent({ data }: { data: FunnelResult }) {
  const max = data.steps[0]?.count || 1;

  return (
    <>
      {/* Alertas */}
      {data.alerts.length > 0 && (
        <div className="space-y-2">
          {data.alerts.map((a, i) => (
            <div
              key={i}
              className={
                "flex items-start gap-2 rounded-lg border px-3 py-2 text-sm " +
                (a.level === "danger"
                  ? "border-destructive/40 bg-destructive/10 text-destructive"
                  : a.level === "warning"
                    ? "border-yellow-500/40 bg-yellow-500/10 text-yellow-700 dark:text-yellow-400"
                    : "border-blue-500/40 bg-blue-500/10 text-blue-700 dark:text-blue-400")
              }
            >
              {a.level === "info" ? (
                <Info className="size-4 mt-0.5 shrink-0" />
              ) : (
                <AlertTriangle className="size-4 mt-0.5 shrink-0" />
              )}
              <span>{a.message}</span>
            </div>
          ))}
        </div>
      )}

      {/* Funil visual */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TrendingDown className="size-5" /> Funil ({data.steps.length} etapas)
          </CardTitle>
          <CardDescription>
            Largura proporcional à etapa de topo. Percentual exibido é de perda vs etapa anterior.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-2">
          {data.steps.map((s, i) => {
            const widthPct = max > 0 ? Math.max(4, (s.count / max) * 100) : 4;
            return (
              <div key={s.key} className="space-y-1">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-medium text-foreground">
                    {i + 1}. {s.label}
                  </span>
                  <span className="text-muted-foreground tabular-nums">
                    {s.count.toLocaleString("pt-BR")} ({s.convPct.toFixed(1)}%)
                  </span>
                </div>
                <div className="h-7 rounded-md bg-muted overflow-hidden relative">
                  <div
                    className="h-full bg-gradient-to-r from-primary to-primary/70 transition-all"
                    style={{ width: `${widthPct}%` }}
                  />
                </div>
                {i > 0 && s.dropPct > 0 && (
                  <div className="flex items-center gap-1 text-[11px] text-muted-foreground pl-1">
                    <TrendingDown className="size-3" />
                    <span>−{s.dropPct.toFixed(1)}% vs etapa anterior</span>
                  </div>
                )}
              </div>
            );
          })}
        </CardContent>
      </Card>

      {/* Abandono */}
      <Card>
        <CardHeader>
          <CardTitle>Métricas de Abandono</CardTitle>
          <CardDescription>Quantos usuários desistem em cada gargalo.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            {data.abandonment.map((a) => (
              <div
                key={a.key}
                className="rounded-lg border border-border bg-card p-3 space-y-1"
              >
                <p className="text-xs text-muted-foreground leading-snug">{a.label}</p>
                <p className="text-2xl font-semibold tabular-nums">
                  {a.count.toLocaleString("pt-BR")}
                </p>
                <Badge variant="outline" className="text-[10px]">
                  {a.pct.toFixed(1)}% de perda
                </Badge>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Modo Visitante */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Eye className="size-5" /> Exploração sem cadastro
          </CardTitle>
          <CardDescription>
            Visitantes que usam o app sem criar conta e taxa de conversão.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <Metric icon={<Users className="size-4" />} label="Visitantes únicos" value={data.visitor.visitors} />
            <Metric icon={<Eye className="size-4" />} label="Visualizaram descobrir" value={data.visitor.discoverViews} />
            <Metric icon={<UserPlus className="size-4" />} label="Voltaram e criaram conta" value={data.visitor.returnedAndSignedUp} />
            <Metric
              icon={<TrendingDown className="size-4" />}
              label="Visitante → Cadastro"
              value={`${data.visitor.visitorToSignupPct.toFixed(2)}%`}
            />
          </div>
        </CardContent>
      </Card>
    </>
  );
}

function Metric({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: number | string;
}) {
  return (
    <div className="rounded-lg border border-border bg-card p-3 space-y-1">
      <div className="flex items-center gap-1.5 text-muted-foreground text-xs">
        {icon}
        <span>{label}</span>
      </div>
      <p className="text-2xl font-semibold tabular-nums">
        {typeof value === "number" ? value.toLocaleString("pt-BR") : value}
      </p>
    </div>
  );
}
