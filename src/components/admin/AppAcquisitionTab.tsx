import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Loader2, Download, Smartphone, MousePointerClick, UserPlus, LogIn, Activity, Globe2, Repeat, MessageSquare, Phone, FileImage, Gift, Users } from "lucide-react";
import { getAdminAppAcquisitionStats } from "@/lib/admin-stats.functions";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import {
  LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, BarChart, Bar,
  CartesianGrid, PieChart, Pie, Cell, Legend, AreaChart, Area,
} from "recharts";

const COLORS = ["#3b82f6", "#22c55e", "#f59e0b", "#ec4899", "#a855f7", "#06b6d4", "#ef4444", "#84cc16", "#eab308"];

export function AppAcquisitionTab() {
  const fn = useServerFn(getAdminAppAcquisitionStats);
  const { data, isLoading } = useQuery({
    queryKey: ["admin-app-acquisition"],
    queryFn: () => fn(),
    refetchInterval: 60000,
  });

  if (isLoading || !data) {
    return <div className="flex justify-center py-12"><Loader2 className="size-6 animate-spin text-muted-foreground" /></div>;
  }

  return (
    <div className="space-y-4">
      {/* Banner integração */}
      <Card className="border-blue-500/30 bg-blue-500/5">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm flex items-center gap-2"><Smartphone className="size-4 text-blue-500" /> Aquisição do app Android · WaveChat</CardTitle>
          <CardDescription className="text-xs">
            Métricas baseadas nos dados internos do app. Instalações reais, retenção precisa e atribuição por campanha ficam ainda mais ricas depois da integração com <strong>Google Play Console</strong>, <strong>Firebase Analytics</strong>, <strong>GA4</strong>, <strong>AppsFlyer</strong> e <strong>Meta SDK</strong> (a estrutura já está pronta para receber esses dados).
          </CardDescription>
        </CardHeader>
      </Card>

      {/* Resumo geral */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Stat label="Cliques baixar app" value={data.total_clicks} icon={MousePointerClick} />
        <Stat label="Instalações (Android)" value={data.total_installs} icon={Download} hint="Proxy: perfis com plataforma Android" />
        <Stat label="Primeira abertura" value={data.total_first_opens} icon={Smartphone} />
        <Stat label="Cadastros via app" value={data.total_signups_app} icon={UserPlus} />
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Stat label="Logins via app" value={data.total_logins_app} icon={LogIn} />
        <Stat label="DAU (Android)" value={data.dau} icon={Activity} />
        <Stat label="MAU (Android)" value={data.mau} icon={Activity} />
        <Stat label="Cadastros globais (30d)" value={data.total_signups_global} icon={UserPlus} />
      </div>

      {/* Conversões */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <Stat label="Clique → Instalação" value={`${data.conv_click_to_install}%`} icon={Repeat} />
        <Stat label="Instalação → Cadastro" value={`${data.conv_install_to_signup}%`} icon={Repeat} />
        <Stat label="Cadastro → Login" value={`${data.conv_signup_to_login}%`} icon={Repeat} />
      </div>

      {/* Funil */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">Funil de conversão</CardTitle>
          <CardDescription className="text-xs">Queda percentual em cada etapa</CardDescription>
        </CardHeader>
        <CardContent className="space-y-2">
          {data.funnel.map((step: any, i: number) => {
            const prev = i === 0 ? null : data.funnel[i - 1];
            const dropPct = prev && prev.value > 0 ? (((prev.value - step.value) / prev.value) * 100).toFixed(1) : null;
            const widthPct = data.funnel[0].value > 0 ? Math.max(5, (step.value / data.funnel[0].value) * 100) : 100;
            return (
              <div key={step.stage}>
                <div className="flex items-center justify-between text-xs mb-1">
                  <span className="font-medium">{step.stage}</span>
                  <span className="tabular-nums">
                    {step.value.toLocaleString("pt-BR")}
                    {dropPct !== null && <span className="ml-2 text-muted-foreground">(-{dropPct}%)</span>}
                  </span>
                </div>
                <div className="h-7 rounded bg-muted/30 overflow-hidden">
                  <div
                    className="h-full bg-gradient-to-r from-blue-500 to-purple-500 transition-all"
                    style={{ width: `${widthPct}%` }}
                  />
                </div>
              </div>
            );
          })}
        </CardContent>
      </Card>

      {/* Séries temporais */}
      <div className="grid md:grid-cols-2 gap-3">
        <ChartBlock title="Cliques baixar app (30d)" data={data.clicks_series} color="#3b82f6" />
        <ChartBlock title="Cadastros via app (30d)" data={data.signups_series} color="#22c55e" />
        <ChartBlock title="Cadastros globais (30d)" data={data.all_signups_series} color="#f59e0b" />
        <ChartBlock title="Usuários ativos app/dia (30d)" data={data.active_series} color="#a855f7" />
      </div>

      {/* Crescimento acumulado */}
      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-sm">Crescimento acumulado de cadastros (30d)</CardTitle></CardHeader>
        <CardContent className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={cumulative(data.all_signups_series)}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis dataKey="date" fontSize={10} tickFormatter={(d) => String(d).slice(5)} />
              <YAxis fontSize={10} />
              <Tooltip contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))" }} />
              <Area type="monotone" dataKey="count" stroke="#22c55e" fill="#22c55e" fillOpacity={0.2} strokeWidth={2} />
            </AreaChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {/* Origem dos downloads */}
      <div className="grid md:grid-cols-2 gap-3">
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm">Origem dos usuários (signup_source)</CardTitle></CardHeader>
          <CardContent className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={data.sources} dataKey="count" nameKey="name" outerRadius={90} label={(e: any) => e.name}>
                  {data.sources.map((_: any, i: number) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                </Pie>
                <Tooltip /><Legend />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm">Cliques por local do botão</CardTitle></CardHeader>
          <CardContent>
            {data.clicks_by_source.length === 0 ? (
              <p className="text-xs text-muted-foreground py-6 text-center">Ainda sem cliques registrados.</p>
            ) : (
              <table className="w-full text-xs">
                <thead className="text-muted-foreground border-b border-border">
                  <tr>
                    <th className="text-left py-2">Botão</th>
                    <th className="text-right py-2">Cliques</th>
                    <th className="text-right py-2">% do total</th>
                  </tr>
                </thead>
                <tbody>
                  {data.clicks_by_source.map((c: any) => (
                    <tr key={c.name} className="border-b border-border/50">
                      <td className="py-2 font-medium">{labelClickFrom(c.name)}</td>
                      <td className="py-2 text-right tabular-nums">{c.count}</td>
                      <td className="py-2 text-right text-muted-foreground tabular-nums">
                        {data.total_clicks > 0 ? ((c.count / data.total_clicks) * 100).toFixed(1) : 0}%
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
            <p className="mt-3 text-[10px] text-muted-foreground">Conversão real em instalação/cadastro por origem chega quando integrarmos UTM completo + Firebase / AppsFlyer.</p>
          </CardContent>
        </Card>
      </div>

      {/* Geografia */}
      <div className="grid md:grid-cols-2 gap-3">
        <GeoCard title="Downloads/Cadastros por país" rows={data.countries} icon={Globe2} />
        <GeoCard title="Usuários Android por país" rows={data.android_countries} icon={Smartphone} />
        <GeoCard title="Estados brasileiros" rows={data.regions} icon={Globe2} />
        <GeoCard title="Top cidades" rows={data.cities} icon={Globe2} />
      </div>

      {/* Retenção */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">Retenção (Android)</CardTitle>
          <CardDescription className="text-xs">Calculada por last_seen vs created_at. Dados precisos virão do Firebase Analytics.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-3 gap-3">
            <Stat label="Retenção D1" value={`${data.retention_d1}%`} icon={Repeat} />
            <Stat label="Retenção D7" value={`${data.retention_d7}%`} icon={Repeat} />
            <Stat label="Retenção D30" value={`${data.retention_d30}%`} icon={Repeat} />
          </div>
          <div className="h-48 mt-4">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={[
                { day: "D1", retention: data.retention_d1 },
                { day: "D7", retention: data.retention_d7 },
                { day: "D30", retention: data.retention_d30 },
              ]}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="day" fontSize={11} />
                <YAxis fontSize={11} domain={[0, 100]} tickFormatter={(v) => `${v}%`} />
                <Tooltip formatter={(v: any) => `${v}%`} />
                <Bar dataKey="retention" fill="#a855f7" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      {/* Engajamento pós-instalação */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">Engajamento pós-instalação (usuários Android)</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            <Stat label="Mensagens enviadas" value={data.engagement.messages.toLocaleString("pt-BR")} icon={MessageSquare} />
            <Stat label="Chamadas realizadas" value={data.engagement.calls.toLocaleString("pt-BR")} icon={Phone} />
            <Stat label="Status publicados" value={data.engagement.statuses.toLocaleString("pt-BR")} icon={FileImage} />
            <Stat label="Convites enviados" value={data.engagement.invites_sent.toLocaleString("pt-BR")} icon={Gift} />
            <Stat label="Seguidores obtidos" value={data.engagement.followers_gained.toLocaleString("pt-BR")} icon={Users} />
            <Stat label="Grupos criados" value={data.engagement.groups.toLocaleString("pt-BR")} icon={Users} />
          </div>
        </CardContent>
      </Card>

      {/* Rankings */}
      <div className="grid md:grid-cols-2 gap-3">
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm">Top usuários que mais convidaram</CardTitle></CardHeader>
          <CardContent>
            {data.top_inviters.length === 0 ? (
              <p className="text-xs text-muted-foreground py-4 text-center">Ainda sem convites registrados.</p>
            ) : (
              <div className="space-y-2">
                {data.top_inviters.map((p: any, i: number) => (
                  <Row key={p.id} rank={i + 1} p={p} value={p.count} unit="convites" />
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm">Top usuários ativos (Android)</CardTitle></CardHeader>
          <CardContent>
            {data.top_active.length === 0 ? (
              <p className="text-xs text-muted-foreground py-4 text-center">Sem usuários Android ainda.</p>
            ) : (
              <div className="space-y-2">
                {data.top_active.map((p: any, i: number) => (
                  <Row key={p.id} rank={i + 1} p={p} value={new Date(p.last_seen).toLocaleDateString("pt-BR")} unit="visto" />
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Integração futura */}
      <Card className="border-dashed">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">Integrações preparadas (em breve)</CardTitle>
          <CardDescription className="text-xs">A estrutura já recebe dados externos sem quebrar o painel.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-5 gap-2">
            {[
              "Google Play Console",
              "Firebase Analytics",
              "Google Analytics 4",
              "AppsFlyer",
              "Meta SDK",
            ].map((n) => (
              <Badge key={n} variant="outline" className="justify-center py-2 text-[10px]">{n}</Badge>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function cumulative(series: { date: string; count: number }[]) {
  let acc = 0;
  return series.map((s) => { acc += s.count; return { date: s.date, count: acc }; });
}

function labelClickFrom(name: string) {
  const map: Record<string, string> = {
    auth: "Tela de login",
    header: "Header (home)",
    sidebar: "Sidebar do chat",
    banner: "Banner mobile",
    newsletter: "Newsletter",
    cta: "CTA interno",
    outro: "Outros",
  };
  return map[name] ?? name;
}

function Stat({ label, value, hint, icon: Icon }: { label: string; value: string | number; hint?: string; icon?: React.ComponentType<{ className?: string }> }) {
  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex items-center justify-between">
          <p className="text-xs text-muted-foreground uppercase tracking-wider">{label}</p>
          {Icon && <Icon className="size-4 text-muted-foreground" />}
        </div>
        <p className="mt-2 text-2xl font-bold">{value}</p>
        {hint && <p className="mt-1 text-[10px] text-muted-foreground">{hint}</p>}
      </CardContent>
    </Card>
  );
}

function ChartBlock({ title, data, color }: { title: string; data: { date: string; count: number }[]; color: string }) {
  return (
    <Card>
      <CardHeader className="pb-2"><CardTitle className="text-sm">{title}</CardTitle></CardHeader>
      <CardContent className="h-48">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data}>
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
            <XAxis dataKey="date" fontSize={10} tickFormatter={(d) => String(d).slice(5)} />
            <YAxis fontSize={10} allowDecimals={false} />
            <Tooltip contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))" }} />
            <Line type="monotone" dataKey="count" stroke={color} strokeWidth={2} dot={false} />
          </LineChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}

function GeoCard({ title, rows, icon: Icon }: { title: string; rows: any[]; icon: any }) {
  return (
    <Card>
      <CardHeader className="pb-2"><CardTitle className="text-sm flex items-center gap-2"><Icon className="size-4 text-muted-foreground" />{title}</CardTitle></CardHeader>
      <CardContent>
        {rows.length === 0 ? (
          <p className="text-xs text-muted-foreground py-4 text-center">Sem dados ainda.</p>
        ) : (
          <div className="space-y-1.5">
            {rows.map((r: any) => (
              <div key={r.name} className="flex items-center justify-between text-xs py-1 border-b border-border/40 last:border-0">
                <span className="font-medium">{r.name}</span>
                <span className="tabular-nums">{r.count}</span>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function Row({ rank, p, value, unit }: { rank: number; p: any; value: string | number; unit: string }) {
  return (
    <div className="flex items-center gap-3 py-1.5 border-b border-border/40 last:border-0">
      <span className="text-xs text-muted-foreground w-5 text-right">#{rank}</span>
      <Avatar className="size-8">
        <AvatarImage src={p.avatar_url ?? undefined} />
        <AvatarFallback>{(p.display_name || p.username || "?").slice(0, 2).toUpperCase()}</AvatarFallback>
      </Avatar>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium truncate">{p.display_name || p.username || p.id?.slice(0, 8)}</p>
        {p.username && <p className="text-[10px] text-muted-foreground truncate">@{p.username}</p>}
      </div>
      <div className="text-right text-xs">
        <p className="font-bold tabular-nums">{value}</p>
        <p className="text-[10px] text-muted-foreground">{unit}</p>
      </div>
    </div>
  );
}
