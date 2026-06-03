import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  checkAdminAccess,
  verifyAdminPin,
  setAdminPin,
  getOverviewMetrics,
  getUserAnalytics,
  getEngagementMetrics,
  getCallMetrics,
  getAIMetrics,
  getShareMetrics,
  getSystemStatus,
  getAdminAccessLogs,
  getUserConfirmationStats,
  getSignupSources,
} from "@/lib/admin.functions";
import { useAuth } from "@/hooks/use-auth";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Loader2, Shield, Users, MessageSquare, Phone, Sparkles, Server, ListChecks, Share2, LogOut, KeyRound, TrendingUp, Activity, Globe2, Smartphone, MailCheck, MailWarning, Megaphone } from "lucide-react";
import {
  LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, BarChart, Bar, CartesianGrid, PieChart, Pie, Cell, Legend,
} from "recharts";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/admin")({
  component: AdminGate,
  head: () => ({ meta: [{ title: "Admin · WaveChat" }, { name: "robots", content: "noindex,nofollow" }] }),
});

const PIN_KEY = "wc_admin_pin_ok";

function AdminGate() {
  const { session, loading } = useAuth();
  const navigate = useNavigate();
  const checkFn = useServerFn(checkAdminAccess);
  const access = useQuery({
    queryKey: ["admin", "access"],
    queryFn: () => checkFn(),
    enabled: !!session,
    retry: false,
  });

  const [pinOk, setPinOk] = useState<boolean>(() => {
    if (typeof window === "undefined") return false;
    return sessionStorage.getItem(PIN_KEY) === "1";
  });

  useEffect(() => {
    if (!loading && !session) navigate({ to: "/auth" });
  }, [loading, session, navigate]);

  if (loading || access.isLoading) {
    return (
      <div className="min-h-screen grid place-items-center bg-background">
        <Loader2 className="size-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (access.isError || !access.data?.isAdmin) {
    return (
      <div className="min-h-screen grid place-items-center bg-background p-6">
        <Card className="max-w-md w-full border-destructive/40">
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><Shield className="size-5 text-destructive" /> Acesso negado</CardTitle>
            <CardDescription>Esta área é restrita a administradores.</CardDescription>
          </CardHeader>
          <CardContent>
            <Button variant="outline" onClick={() => navigate({ to: "/" })}>Voltar</Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!pinOk) {
    return (
      <PinScreen
        hasPin={access.data.hasPin}
        onOk={() => {
          sessionStorage.setItem(PIN_KEY, "1");
          setPinOk(true);
        }}
      />
    );
  }

  return <AdminPanel />;
}

function PinScreen({ hasPin, onOk }: { hasPin: boolean; onOk: () => void }) {
  const verifyFn = useServerFn(verifyAdminPin);
  const setFn = useServerFn(setAdminPin);
  const [pin, setPin] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!/^\d{6}$/.test(pin)) return toast.error("PIN deve ter 6 dígitos");
    setBusy(true);
    try {
      if (hasPin) {
        const r = await verifyFn({ data: { pin } });
        if (r.ok) {
          toast.success("Acesso liberado");
          onOk();
        } else {
          toast.error("PIN inválido");
        }
      } else {
        if (pin !== confirm) return toast.error("PINs não conferem");
        await setFn({ data: { pin } });
        toast.success("PIN configurado");
        onOk();
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erro");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="min-h-screen grid place-items-center bg-gradient-to-br from-background via-background to-primary/5 p-6">
      <Card className="w-full max-w-sm border-border/50 backdrop-blur">
        <CardHeader className="text-center space-y-2">
          <div className="mx-auto size-12 rounded-full bg-primary/10 grid place-items-center">
            <KeyRound className="size-6 text-primary" />
          </div>
          <CardTitle>{hasPin ? "PIN administrativo" : "Configurar PIN"}</CardTitle>
          <CardDescription>
            {hasPin ? "Digite seu PIN de 6 dígitos para continuar." : "Defina um PIN de 6 dígitos para proteger o painel."}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={submit} className="space-y-3">
            <Input
              autoFocus
              type="password"
              inputMode="numeric"
              maxLength={6}
              placeholder="••••••"
              className="text-center text-2xl tracking-[0.6em] font-mono"
              value={pin}
              onChange={(e) => setPin(e.target.value.replace(/\D/g, ""))}
            />
            {!hasPin && (
              <Input
                type="password"
                inputMode="numeric"
                maxLength={6}
                placeholder="Confirmar PIN"
                className="text-center text-2xl tracking-[0.6em] font-mono"
                value={confirm}
                onChange={(e) => setConfirm(e.target.value.replace(/\D/g, ""))}
              />
            )}
            <Button type="submit" className="w-full" disabled={busy}>
              {busy && <Loader2 className="size-4 animate-spin mr-2" />}
              {hasPin ? "Entrar" : "Salvar PIN"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}

function AdminPanel() {
  const navigate = useNavigate();
  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="sticky top-0 z-20 border-b border-border/50 bg-background/80 backdrop-blur">
        <div className="max-w-7xl mx-auto px-4 h-14 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Shield className="size-5 text-primary" />
            <span className="font-semibold">WaveChat Admin</span>
            <Badge variant="outline" className="ml-2 text-[10px]">PROTEGIDO</Badge>
          </div>
          <div className="flex items-center gap-2">
            <Button
              size="sm"
              variant="ghost"
              onClick={async () => {
                sessionStorage.removeItem(PIN_KEY);
                await supabase.auth.signOut();
                navigate({ to: "/auth" });
              }}
            >
              <LogOut className="size-4 mr-1" /> Sair
            </Button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto p-4 md:p-6">
        <Tabs defaultValue="overview" className="w-full">
          <div className="w-full overflow-x-auto overflow-y-hidden scrollbar-thin -mx-1 px-1">
            <TabsList className="w-max flex">
              <TabsTrigger value="overview"><Activity className="size-4 mr-1.5" />Visão</TabsTrigger>
              <TabsTrigger value="signups"><MailCheck className="size-4 mr-1.5" />Cadastros</TabsTrigger>
              <TabsTrigger value="sources"><Megaphone className="size-4 mr-1.5" />Origens</TabsTrigger>
              <TabsTrigger value="users"><Users className="size-4 mr-1.5" />Usuários</TabsTrigger>
              <TabsTrigger value="engagement"><MessageSquare className="size-4 mr-1.5" />Engajamento</TabsTrigger>
              <TabsTrigger value="calls"><Phone className="size-4 mr-1.5" />Chamadas</TabsTrigger>
              <TabsTrigger value="ai"><Sparkles className="size-4 mr-1.5" />IA</TabsTrigger>
              <TabsTrigger value="shares"><Share2 className="size-4 mr-1.5" />Compart.</TabsTrigger>
              <TabsTrigger value="system"><Server className="size-4 mr-1.5" />Sistema</TabsTrigger>
              <TabsTrigger value="logs"><ListChecks className="size-4 mr-1.5" />Logs</TabsTrigger>
              <TabsTrigger value="settings"><KeyRound className="size-4 mr-1.5" />PIN</TabsTrigger>
            </TabsList>
          </div>

          <TabsContent value="overview" className="mt-4"><Overview /></TabsContent>
          <TabsContent value="signups" className="mt-4"><SignupsTab /></TabsContent>
          <TabsContent value="sources" className="mt-4"><SourcesTab /></TabsContent>
          <TabsContent value="users" className="mt-4"><UsersTab /></TabsContent>
          <TabsContent value="engagement" className="mt-4"><EngagementTab /></TabsContent>
          <TabsContent value="calls" className="mt-4"><CallsTab /></TabsContent>
          <TabsContent value="ai" className="mt-4"><AITab /></TabsContent>
          <TabsContent value="shares" className="mt-4"><SharesTab /></TabsContent>
          <TabsContent value="system" className="mt-4"><SystemTab /></TabsContent>
          <TabsContent value="logs" className="mt-4"><LogsTab /></TabsContent>
          <TabsContent value="settings" className="mt-4"><PinSettings /></TabsContent>
        </Tabs>
      </main>
    </div>
  );
}

// ============ Reusable ============
function Stat({ label, value, hint, icon: Icon }: { label: string; value: string | number; hint?: string; icon?: React.ComponentType<{ className?: string }> }) {
  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex items-center justify-between">
          <p className="text-xs text-muted-foreground uppercase tracking-wider">{label}</p>
          {Icon && <Icon className="size-4 text-muted-foreground" />}
        </div>
        <p className="mt-2 text-2xl font-bold">{value}</p>
        {hint && <p className="mt-1 text-xs text-muted-foreground">{hint}</p>}
      </CardContent>
    </Card>
  );
}

function ChartCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <Card>
      <CardHeader className="pb-2"><CardTitle className="text-sm font-medium">{title}</CardTitle></CardHeader>
      <CardContent className="h-64">{children}</CardContent>
    </Card>
  );
}

function useFn<T>(fn: () => Promise<T>, key: string[], refetchMs?: number) {
  return useQuery({ queryKey: key, queryFn: fn, refetchInterval: refetchMs });
}

const PIE_COLORS = ["hsl(var(--primary))", "#22c55e", "#f59e0b", "#ef4444", "#a855f7", "#06b6d4", "#ec4899"];

// ============ Overview ============
function Overview() {
  const fn = useServerFn(getOverviewMetrics);
  const { data, isLoading } = useFn(() => fn(), ["admin", "overview"], 30000);
  if (isLoading || !data) return <LoadingBlock />;
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Stat label="Total de usuários" value={data.total} icon={Users} />
        <Stat label="Novos (24h)" value={data.new1} icon={TrendingUp} />
        <Stat label="Ativos (24h)" value={data.active1} icon={Activity} />
        <Stat label="Crescimento 30d" value={`${data.growthPct.toFixed(1)}%`} hint={`${data.new30} novos vs ${data.new30 - Math.round((data.growthPct / 100) * data.new30)} ant.`} />
      </div>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Stat label="Novos (7d)" value={data.new7} />
        <Stat label="Ativos (7d)" value={data.active7} />
        <Stat label="Novos (30d)" value={data.new30} />
        <Stat label="Ativos (30d)" value={data.active30} />
      </div>
      <ChartCard title="Cadastros nos últimos 30 dias">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data.series}>
            <CartesianGrid stroke="hsl(var(--border))" strokeDasharray="3 3" />
            <XAxis dataKey="date" stroke="hsl(var(--muted-foreground))" fontSize={11} tickFormatter={(d) => d.slice(5)} />
            <YAxis stroke="hsl(var(--muted-foreground))" fontSize={11} allowDecimals={false} />
            <Tooltip contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8 }} />
            <Line type="monotone" dataKey="count" stroke="hsl(var(--primary))" strokeWidth={2} dot={false} />
          </LineChart>
        </ResponsiveContainer>
      </ChartCard>
    </div>
  );
}

// ============ Cadastros (Email confirmation) ============
function SignupsTab() {
  const fn = useServerFn(getUserConfirmationStats);
  const { data, isLoading } = useFn(() => fn(), ["admin", "signups"], 30000);
  if (isLoading || !data) return <LoadingBlock />;
  const total = data.confirmed + data.unconfirmed;
  const pct = total > 0 ? (data.confirmed / total) * 100 : 0;
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Stat label="Total de contas" value={total} icon={Users} />
        <Stat label="E-mail confirmado" value={data.confirmed} icon={MailCheck} hint={`${pct.toFixed(1)}% finalizaram`} />
        <Stat label="Pendentes" value={data.unconfirmed} icon={MailWarning} hint="Não confirmaram o e-mail" />
        <Stat label="Taxa de conclusão" value={`${pct.toFixed(1)}%`} icon={TrendingUp} />
      </div>

      <Card className="border-yellow-500/30">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm flex items-center gap-2">
            <MailWarning className="size-4 text-yellow-600" />
            Cadastros não finalizados ({data.unconfirmedList.length})
          </CardTitle>
          <CardDescription>Usuários que ainda não confirmaram o e-mail. Eles não aparecem na busca para iniciar conversas.</CardDescription>
        </CardHeader>
        <CardContent>
          {data.unconfirmedList.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nenhum cadastro pendente. 🎉</p>
          ) : (
            <div className="divide-y divide-border/50">
              {data.unconfirmedList.map((u) => (
                <div key={u.id} className="py-2 flex items-center justify-between text-sm gap-3">
                  <div className="min-w-0">
                    <p className="font-medium truncate">{u.display_name ?? u.email ?? "—"}</p>
                    <p className="text-xs text-muted-foreground truncate">
                      {u.username ? `@${u.username} · ` : ""}{u.email ?? "sem email"}
                    </p>
                  </div>
                  <div className="text-right text-xs text-muted-foreground shrink-0">
                    <Badge variant="outline" className="border-yellow-500/40 text-yellow-700 dark:text-yellow-400">Pendente</Badge>
                    <p className="mt-1">{new Date(u.created_at).toLocaleString("pt-BR")}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Card className="border-emerald-500/30">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm flex items-center gap-2">
            <MailCheck className="size-4 text-emerald-600" />
            Últimos cadastros confirmados
          </CardTitle>
        </CardHeader>
        <CardContent>
          {data.confirmedRecent.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nenhum cadastro confirmado ainda.</p>
          ) : (
            <div className="divide-y divide-border/50">
              {data.confirmedRecent.map((u) => (
                <div key={u.id} className="py-2 flex items-center justify-between text-sm gap-3">
                  <div className="min-w-0">
                    <p className="font-medium truncate">{u.display_name ?? u.email ?? "—"}</p>
                    <p className="text-xs text-muted-foreground truncate">
                      {u.username ? `@${u.username} · ` : ""}{u.email ?? "sem email"}
                    </p>
                  </div>
                  <div className="text-right text-xs text-muted-foreground shrink-0">
                    <Badge variant="outline" className="border-emerald-500/40 text-emerald-700 dark:text-emerald-400">Confirmado</Badge>
                    <p className="mt-1">{u.email_confirmed_at ? new Date(u.email_confirmed_at).toLocaleString("pt-BR") : "—"}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

// ============ Users ============
function UsersTab() {
  const fn = useServerFn(getUserAnalytics);
  const { data, isLoading } = useFn(() => fn(), ["admin", "users"], 60000);
  if (isLoading || !data) return <LoadingBlock />;
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <TopList title="Países" icon={Globe2} items={data.countries} />
        <TopList title="Estados / Regiões" icon={Globe2} items={data.regions} />
        <TopList title="Cidades" icon={Globe2} items={data.cities} />
        <TopList title="Dispositivos" icon={Smartphone} items={data.platforms} />
        <TopList title="Versões do app" icon={Smartphone} items={data.versions} />
      </div>
      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-sm">Últimos online</CardTitle></CardHeader>
        <CardContent>
          <div className="divide-y divide-border/50">
            {data.latestSeen.map((u: any) => (
              <div key={u.id} className="py-2 flex items-center justify-between text-sm">
                <div>
                  <p className="font-medium">{u.display_name}</p>
                  <p className="text-xs text-muted-foreground">@{u.username}</p>
                </div>
                <div className="text-right text-xs text-muted-foreground">
                  <p>{u.country ?? "—"} · {u.device_platform ?? "—"}</p>
                  <p>{new Date(u.last_seen).toLocaleString("pt-BR")}</p>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function TopList({ title, items, icon: Icon }: { title: string; items: { name: string; count: number }[]; icon?: React.ComponentType<{ className?: string }> }) {
  return (
    <Card>
      <CardHeader className="pb-2"><CardTitle className="text-sm flex items-center gap-2">{Icon && <Icon className="size-4 text-muted-foreground" />}{title}</CardTitle></CardHeader>
      <CardContent className="space-y-1.5 max-h-64 overflow-auto">
        {items.length === 0 && <p className="text-xs text-muted-foreground">Sem dados ainda.</p>}
        {items.map((i) => (
          <div key={i.name} className="flex items-center justify-between text-sm">
            <span className="truncate">{i.name}</span>
            <Badge variant="secondary">{i.count}</Badge>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

// ============ Engagement ============
function EngagementTab() {
  const fn = useServerFn(getEngagementMetrics);
  const { data, isLoading } = useFn(() => fn(), ["admin", "engagement"], 30000);
  if (isLoading || !data) return <LoadingBlock />;
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Stat label="Mensagens (total)" value={data.totalMsgs.toLocaleString("pt-BR")} />
        <Stat label="Mensagens hoje" value={data.msgs1.toLocaleString("pt-BR")} />
        <Stat label="Mensagens 30d" value={data.msgs30.toLocaleString("pt-BR")} />
        <Stat label="Média / usuário" value={data.avgPerUser.toFixed(1)} />
        <Stat label="Total de grupos" value={data.totalGroups} />
        <Stat label="Grupos 30d" value={data.groups30} />
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <ChartCard title="Mensagens por dia (30d)">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data.series}>
              <CartesianGrid stroke="hsl(var(--border))" strokeDasharray="3 3" />
              <XAxis dataKey="date" stroke="hsl(var(--muted-foreground))" fontSize={11} tickFormatter={(d) => d.slice(5)} />
              <YAxis stroke="hsl(var(--muted-foreground))" fontSize={11} />
              <Tooltip contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8 }} />
              <Bar dataKey="count" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>
        <ChartCard title="Atividade por hora">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data.byHour}>
              <CartesianGrid stroke="hsl(var(--border))" strokeDasharray="3 3" />
              <XAxis dataKey="hour" stroke="hsl(var(--muted-foreground))" fontSize={11} />
              <YAxis stroke="hsl(var(--muted-foreground))" fontSize={11} />
              <Tooltip contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8 }} />
              <Bar dataKey="count" fill="#22c55e" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>
      </div>
    </div>
  );
}

// ============ Calls ============
function CallsTab() {
  const fn = useServerFn(getCallMetrics);
  const { data, isLoading } = useFn(() => fn(), ["admin", "calls"], 30000);
  if (isLoading || !data) return <LoadingBlock />;
  const fmtDur = (s: number) => {
    const m = Math.floor(s / 60);
    const sec = Math.floor(s % 60);
    return `${m}m ${sec}s`;
  };
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Stat label="Áudio (30d)" value={data.totalAudio} />
        <Stat label="Vídeo (30d)" value={data.totalVideo} />
        <Stat label="Chamadas hoje" value={data.callsToday} />
        <Stat label="Duração média" value={fmtDur(data.avgDuration)} />
        <Stat label="Sucesso" value={`${data.successRate.toFixed(1)}%`} />
        <Stat label="Falhas" value={`${data.failRate.toFixed(1)}%`} />
        <Stat label="Total" value={data.total} />
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <ChartCard title="Chamadas por dia (30d)">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={data.series}>
              <CartesianGrid stroke="hsl(var(--border))" strokeDasharray="3 3" />
              <XAxis dataKey="date" stroke="hsl(var(--muted-foreground))" fontSize={11} tickFormatter={(d) => d.slice(5)} />
              <YAxis stroke="hsl(var(--muted-foreground))" fontSize={11} allowDecimals={false} />
              <Tooltip contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8 }} />
              <Line type="monotone" dataKey="count" stroke="#06b6d4" strokeWidth={2} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </ChartCard>
        <ChartCard title="Status das chamadas">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie data={data.statusCounts} dataKey="count" nameKey="name" innerRadius={50} outerRadius={80}>
                {data.statusCounts.map((_: any, i: number) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}
              </Pie>
              <Legend />
              <Tooltip contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8 }} />
            </PieChart>
          </ResponsiveContainer>
        </ChartCard>
      </div>
    </div>
  );
}

// ============ AI ============
function AITab() {
  const fn = useServerFn(getAIMetrics);
  const { data, isLoading } = useFn(() => fn(), ["admin", "ai"], 60000);
  if (isLoading || !data) return <LoadingBlock />;
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Stat label="Requisições (30d)" value={data.total} />
        <Stat label="Tokens entrada" value={Math.round(data.tokensIn).toLocaleString("pt-BR")} />
        <Stat label="Tokens saída" value={Math.round(data.tokensOut).toLocaleString("pt-BR")} />
        <Stat label="Custo estimado" value={`US$ ${data.costUsd.toFixed(4)}`} hint="Estimativa Gemini Flash" />
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <ChartCard title="Uso de IA por dia (30d)">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data.series}>
              <CartesianGrid stroke="hsl(var(--border))" strokeDasharray="3 3" />
              <XAxis dataKey="date" stroke="hsl(var(--muted-foreground))" fontSize={11} tickFormatter={(d) => d.slice(5)} />
              <YAxis stroke="hsl(var(--muted-foreground))" fontSize={11} allowDecimals={false} />
              <Tooltip contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8 }} />
              <Bar dataKey="count" fill="#a855f7" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>
        <TopList title="Por funcionalidade" items={data.byFeature} icon={Sparkles} />
      </div>
    </div>
  );
}

// ============ Shares ============
function SharesTab() {
  const fn = useServerFn(getShareMetrics);
  const { data, isLoading } = useFn(() => fn(), ["admin", "shares"], 60000);
  if (isLoading || !data) return <LoadingBlock />;
  return (
    <div className="space-y-4">
      <Stat label="Compartilhamentos (30d)" value={data.total} icon={Share2} />
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <TopList title="Por destino" items={data.byTarget} icon={Share2} />
        <TopList title="Por tipo de conteúdo" items={data.byType} icon={Share2} />
      </div>
      <ChartCard title="Compartilhamentos por dia (30d)">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data.series}>
            <CartesianGrid stroke="hsl(var(--border))" strokeDasharray="3 3" />
            <XAxis dataKey="date" stroke="hsl(var(--muted-foreground))" fontSize={11} tickFormatter={(d) => d.slice(5)} />
            <YAxis stroke="hsl(var(--muted-foreground))" fontSize={11} allowDecimals={false} />
            <Tooltip contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8 }} />
            <Line type="monotone" dataKey="count" stroke="#ec4899" strokeWidth={2} dot={false} />
          </LineChart>
        </ResponsiveContainer>
      </ChartCard>
    </div>
  );
}

// ============ System ============
function SystemTab() {
  const fn = useServerFn(getSystemStatus);
  const { data, isLoading, refetch } = useFn(() => fn(), ["admin", "system"], 15000);
  if (isLoading || !data) return <LoadingBlock />;
  const Dot = ({ ok }: { ok: boolean }) => (
    <span className={`inline-block size-2.5 rounded-full ${ok ? "bg-emerald-500" : "bg-destructive"} animate-pulse`} />
  );
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
        <Card><CardContent className="p-4 flex items-center justify-between"><div><p className="text-xs text-muted-foreground uppercase">Servidor</p><p className="font-semibold mt-1">Online</p></div><Dot ok={data.server.ok} /></CardContent></Card>
        <Card><CardContent className="p-4 flex items-center justify-between"><div><p className="text-xs text-muted-foreground uppercase">Banco de dados</p><p className="font-semibold mt-1">{data.db.ms}ms</p></div><Dot ok={data.db.ok} /></CardContent></Card>
        <Card><CardContent className="p-4 flex items-center justify-between"><div><p className="text-xs text-muted-foreground uppercase">IA Gateway</p><p className="font-semibold mt-1">{data.ai.configured ? `${data.ai.ms}ms` : "N/A"}</p></div><Dot ok={data.ai.ok} /></CardContent></Card>
        <Card><CardContent className="p-4 flex items-center justify-between"><div><p className="text-xs text-muted-foreground uppercase">Metered (TURN)</p><p className="font-semibold mt-1">{data.metered.configured ? "Configurado" : "N/A"}</p></div><Dot ok={data.metered.ok} /></CardContent></Card>
      </div>
      <Button size="sm" variant="outline" onClick={() => refetch()}>Atualizar agora</Button>
      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-sm">Erros recentes</CardTitle></CardHeader>
        <CardContent>
          {data.recentErrors.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nenhum erro recente. 🎉</p>
          ) : (
            <div className="divide-y divide-border/50 text-sm">
              {data.recentErrors.map((e: any) => (
                <div key={e.id} className="py-2 flex items-center justify-between">
                  <div>
                    <p className="font-medium">{e.action}</p>
                    <p className="text-xs text-muted-foreground font-mono">{e.user_id?.slice(0, 8) ?? "—"}</p>
                  </div>
                  <span className="text-xs text-muted-foreground">{new Date(e.created_at).toLocaleString("pt-BR")}</span>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

// ============ Logs ============
function LogsTab() {
  const fn = useServerFn(getAdminAccessLogs);
  const { data, isLoading } = useFn(() => fn(), ["admin", "logs"], 30000);
  if (isLoading || !data) return <LoadingBlock />;
  return (
    <Card>
      <CardHeader className="pb-2"><CardTitle className="text-sm">Acessos administrativos (últimos 100)</CardTitle></CardHeader>
      <CardContent>
        <div className="divide-y divide-border/50 text-sm">
          {data.logs.map((l: any) => (
            <div key={l.id} className="py-2 flex items-center justify-between gap-2">
              <div className="min-w-0">
                <p className="font-medium truncate">{l.action}</p>
                <p className="text-xs text-muted-foreground font-mono truncate">{l.ip ?? "—"} · {l.user_id?.slice(0, 8) ?? "—"}</p>
              </div>
              <div className="text-right shrink-0">
                <Badge variant={l.success ? "secondary" : "destructive"}>{l.success ? "ok" : "falha"}</Badge>
                <p className="text-[11px] text-muted-foreground mt-0.5">{new Date(l.created_at).toLocaleString("pt-BR")}</p>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

// ============ PIN Settings ============
function PinSettings() {
  const setFn = useServerFn(setAdminPin);
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const m = useMutation({
    mutationFn: async () => setFn({ data: { pin: next, currentPin: current } }),
    onSuccess: () => {
      toast.success("PIN atualizado");
      setCurrent(""); setNext("");
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Erro"),
  });
  return (
    <Card className="max-w-md">
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2"><KeyRound className="size-4" />Alterar PIN administrativo</CardTitle>
        <CardDescription>Use 6 dígitos numéricos.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <Input type="password" inputMode="numeric" maxLength={6} placeholder="PIN atual" value={current} onChange={(e) => setCurrent(e.target.value.replace(/\D/g, ""))} />
        <Input type="password" inputMode="numeric" maxLength={6} placeholder="Novo PIN" value={next} onChange={(e) => setNext(e.target.value.replace(/\D/g, ""))} />
        <Button onClick={() => m.mutate()} disabled={m.isPending || !/^\d{6}$/.test(current) || !/^\d{6}$/.test(next)}>
          {m.isPending && <Loader2 className="size-4 animate-spin mr-2" />}Atualizar
        </Button>
      </CardContent>
    </Card>
  );
}

function LoadingBlock() {
  return <div className="h-64 grid place-items-center"><Loader2 className="size-6 animate-spin text-muted-foreground" /></div>;
}
