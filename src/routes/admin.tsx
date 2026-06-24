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
  getUsageAnalytics,
  getPushLogs,
  listAdmins,
  grantAdminRole,
  revokeAdminRole,
  getInvitesOverview,
  getUserActivityStats,
} from "@/lib/admin.functions";
import { useAuth } from "@/hooks/use-auth";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Loader2, Shield, Users, MessageSquare, Phone, Sparkles, Server, ListChecks, Share2, LogOut, KeyRound, TrendingUp, Activity, Globe2, Smartphone, MailCheck, MailWarning, Megaphone, MousePointerClick, Bell, Gift, ChevronDown, ChevronRight, Mail, Repeat, LogIn, Languages, ClipboardList, Rocket, LifeBuoy, FileImage, Heart, Download } from "lucide-react";
import {
  LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, BarChart, Bar, CartesianGrid, PieChart, Pie, Cell, Legend,
} from "recharts";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { NewsletterTab } from "@/components/admin/NewsletterTab";
import { OnboardingSurveyTab } from "@/components/admin/OnboardingSurveyTab";
import { BoostsTab } from "@/components/admin/BoostsTab";
import { SupportTab } from "@/components/admin/SupportTab";
import { StatusAdminTab } from "@/components/admin/StatusAdminTab";
import { FollowersAdminTab } from "@/components/admin/FollowersAdminTab";
import { AppAcquisitionTab } from "@/components/admin/AppAcquisitionTab";
import { TrafficSourcesCard } from "@/components/admin/TrafficSourcesCard";
import { ModerationTab } from "@/components/admin/ModerationTab";
import { ComplianceTab } from "@/components/admin/ComplianceTab";
import { SecurityTab } from "@/components/admin/SecurityTab";
import { ShieldAlert, Scale, ShieldCheck, TrendingDown } from "lucide-react";
import { ConversionFunnelTab } from "@/components/admin/ConversionFunnelTab";
import { BadgesTab } from "@/components/admin/BadgesTab";
import { MusicAdminTab } from "@/components/admin/MusicAdminTab";
import { GroupReportsTab } from "@/components/admin/GroupReportsTab";
import { Award, Music, Globe } from "lucide-react";

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
    if (!loading && !session) navigate({ to: "/auth", search: { mode: "login" } });
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

  return <AdminPanel role={access.data.role} isSuperadmin={access.data.isSuperadmin} />;
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

function AdminPanel({ role, isSuperadmin }: { role: string; isSuperadmin: boolean }) {
  const navigate = useNavigate();
  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="sticky top-0 z-20 border-b border-border/50 bg-background/80 backdrop-blur">
        <div className="max-w-7xl mx-auto px-4 h-14 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Shield className="size-5 text-primary" />
            <span className="font-semibold">WaveChat Admin</span>
            <Badge variant="outline" className="ml-2 text-[10px] uppercase">{role}</Badge>
          </div>
          <div className="flex items-center gap-2">
            <Button
              size="sm"
              variant="ghost"
              onClick={async () => {
                sessionStorage.removeItem(PIN_KEY);
                await supabase.auth.signOut();
                navigate({ to: "/" });
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
              <TabsTrigger value="funnel"><TrendingDown className="size-4 mr-1.5" />Funil</TabsTrigger>
              <TabsTrigger value="signups"><MailCheck className="size-4 mr-1.5" />Cadastros</TabsTrigger>
              <TabsTrigger value="invites"><Gift className="size-4 mr-1.5" />Convites</TabsTrigger>
              <TabsTrigger value="sources"><Megaphone className="size-4 mr-1.5" />Origens</TabsTrigger>
              <TabsTrigger value="usage"><MousePointerClick className="size-4 mr-1.5" />Uso</TabsTrigger>
              <TabsTrigger value="users"><Users className="size-4 mr-1.5" />Usuários</TabsTrigger>
              <TabsTrigger value="retention"><Repeat className="size-4 mr-1.5" />Atividade</TabsTrigger>
              <TabsTrigger value="engagement"><MessageSquare className="size-4 mr-1.5" />Engajamento</TabsTrigger>
              <TabsTrigger value="calls"><Phone className="size-4 mr-1.5" />Chamadas</TabsTrigger>
              <TabsTrigger value="ai"><Sparkles className="size-4 mr-1.5" />IA</TabsTrigger>
              <TabsTrigger value="shares"><Share2 className="size-4 mr-1.5" />Compart.</TabsTrigger>
              <TabsTrigger value="system"><Server className="size-4 mr-1.5" />Sistema</TabsTrigger>
              <TabsTrigger value="push"><Bell className="size-4 mr-1.5" />Push</TabsTrigger>
              <TabsTrigger value="logs"><ListChecks className="size-4 mr-1.5" />Logs</TabsTrigger>
              <TabsTrigger value="admins"><Shield className="size-4 mr-1.5" />Admins</TabsTrigger>
              <TabsTrigger value="newsletter"><Mail className="size-4 mr-1.5" />Newsletter</TabsTrigger>
              <TabsTrigger value="survey"><ClipboardList className="size-4 mr-1.5" />Pesquisa</TabsTrigger>
              <TabsTrigger value="boosts"><Rocket className="size-4 mr-1.5" />Impulsos</TabsTrigger>
              <TabsTrigger value="status"><FileImage className="size-4 mr-1.5" />Status</TabsTrigger>
              <TabsTrigger value="music"><Music className="size-4 mr-1.5" />Músicas</TabsTrigger>
              <TabsTrigger value="followers"><Heart className="size-4 mr-1.5" />Seguidores</TabsTrigger>
              <TabsTrigger value="support"><LifeBuoy className="size-4 mr-1.5" />Suporte</TabsTrigger>
              <TabsTrigger value="app-acquisition"><Download className="size-4 mr-1.5" />Aquisição App</TabsTrigger>
              <TabsTrigger value="moderation"><ShieldAlert className="size-4 mr-1.5" />Moderação</TabsTrigger>
              <TabsTrigger value="compliance"><Scale className="size-4 mr-1.5" />Compliance</TabsTrigger>
              <TabsTrigger value="security"><ShieldCheck className="size-4 mr-1.5" />Segurança</TabsTrigger>
              <TabsTrigger value="badges"><Award className="size-4 mr-1.5" />Selos</TabsTrigger>
              <TabsTrigger value="groups"><Globe className="size-4 mr-1.5" />Grupos</TabsTrigger>
              <TabsTrigger value="settings"><KeyRound className="size-4 mr-1.5" />PIN</TabsTrigger>
            </TabsList>
          </div>

          <TabsContent value="overview" className="mt-4"><Overview /></TabsContent>
          <TabsContent value="funnel" className="mt-4"><ConversionFunnelTab /></TabsContent>
          <TabsContent value="signups" className="mt-4"><SignupsTab /></TabsContent>
          <TabsContent value="invites" className="mt-4"><InvitesTab /></TabsContent>
          <TabsContent value="sources" className="mt-4"><SourcesTab /></TabsContent>
          <TabsContent value="usage" className="mt-4"><UsageTab /></TabsContent>
          <TabsContent value="users" className="mt-4"><UsersTab /></TabsContent>
          <TabsContent value="retention" className="mt-4"><RetentionTab /></TabsContent>
          <TabsContent value="engagement" className="mt-4"><EngagementTab /></TabsContent>
          <TabsContent value="calls" className="mt-4"><CallsTab /></TabsContent>
          <TabsContent value="ai" className="mt-4"><AITab /></TabsContent>
          <TabsContent value="shares" className="mt-4"><SharesTab /></TabsContent>
          <TabsContent value="system" className="mt-4"><SystemTab /></TabsContent>
          <TabsContent value="push" className="mt-4"><PushTab /></TabsContent>
          <TabsContent value="logs" className="mt-4"><LogsTab /></TabsContent>
          <TabsContent value="admins" className="mt-4"><AdminsTab canEdit={isSuperadmin} /></TabsContent>
          <TabsContent value="newsletter" className="mt-4"><NewsletterTab /></TabsContent>
          <TabsContent value="survey" className="mt-4"><OnboardingSurveyTab /></TabsContent>
          <TabsContent value="boosts" className="mt-4"><BoostsTab /></TabsContent>
          <TabsContent value="status" className="mt-4"><StatusAdminTab /></TabsContent>
          <TabsContent value="music" className="mt-4"><MusicAdminTab /></TabsContent>
          <TabsContent value="followers" className="mt-4"><FollowersAdminTab /></TabsContent>
          <TabsContent value="support" className="mt-4"><SupportTab /></TabsContent>
          <TabsContent value="app-acquisition" className="mt-4"><AppAcquisitionTab /></TabsContent>
          <TabsContent value="moderation" className="mt-4"><ModerationTab /></TabsContent>
          <TabsContent value="compliance" className="mt-4"><ComplianceTab isSuperadmin={isSuperadmin} /></TabsContent>
          <TabsContent value="security" className="mt-4"><SecurityTab isSuperadmin={isSuperadmin} /></TabsContent>
          <TabsContent value="badges" className="mt-4"><BadgesTab /></TabsContent>
          <TabsContent value="groups" className="mt-4"><GroupReportsTab /></TabsContent>
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

// ============ Sources / Ad attribution ============
function SourcesTab() {
  const fn = useServerFn(getSignupSources);
  const { data, isLoading } = useFn(() => fn(), ["admin", "sources"], 30000);
  if (isLoading || !data) return <LoadingBlock />;

  const colors = ["hsl(var(--primary))", "#22c55e", "#f59e0b", "#3b82f6", "#a855f7", "#ef4444", "#14b8a6"];
  const meta = data.bySource.find((s) => /meta/i.test(s.source))?.count ?? 0;
  const google = data.bySource.find((s) => /google ads/i.test(s.source))?.count ?? 0;
  const tiktok = data.bySource.find((s) => /tiktok/i.test(s.source))?.count ?? 0;
  const direct = data.bySource.find((s) => /direto|desconhecido/i.test(s.source))?.count ?? 0;

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Stat label="Meta Ads" value={meta} icon={Megaphone} hint="Facebook / Instagram" />
        <Stat label="Google Ads" value={google} icon={Megaphone} hint="Pesquisa / Display" />
        <Stat label="TikTok Ads" value={tiktok} icon={Megaphone} />
        <Stat label="Direto / Sem origem" value={direct} icon={Users} hint="Antes do rastreamento" />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <ChartCard title="Cadastros por origem">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie data={data.bySource} dataKey="count" nameKey="source" outerRadius={90} label={(e) => `${e.source} (${e.count})`}>
                {data.bySource.map((_, i) => <Cell key={i} fill={colors[i % colors.length]} />)}
              </Pie>
              <Tooltip />
            </PieChart>
          </ResponsiveContainer>
        </ChartCard>
        <ChartCard title="Top origens (30d)">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data.bySource.slice(0, 8)}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis dataKey="source" tick={{ fontSize: 11 }} interval={0} angle={-15} textAnchor="end" height={60} />
              <YAxis tick={{ fontSize: 11 }} />
              <Tooltip />
              <Bar dataKey="count" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>
      </div>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">Campanhas (origem + utm_campaign)</CardTitle>
          <CardDescription>Use parâmetros <code>utm_source</code>, <code>utm_medium</code> e <code>utm_campaign</code> nos seus anúncios para ver detalhes aqui.</CardDescription>
        </CardHeader>
        <CardContent>
          {data.byCampaign.length === 0 ? (
            <p className="text-sm text-muted-foreground">Sem dados de campanhas ainda.</p>
          ) : (
            <div className="divide-y divide-border/50">
              {data.byCampaign.map((c, i) => (
                <div key={i} className="py-2 flex items-center justify-between text-sm gap-3">
                  <div className="min-w-0">
                    <p className="font-medium truncate">{c.source}</p>
                    <p className="text-xs text-muted-foreground truncate">
                      campanha: {c.campaign} · meio: {c.medium}
                    </p>
                  </div>
                  <Badge variant="secondary" className="shrink-0">{c.count}</Badge>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">Últimos cadastros por origem</CardTitle>
        </CardHeader>
        <CardContent>
          {data.recent.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nenhum cadastro ainda.</p>
          ) : (
            <div className="divide-y divide-border/50">
              {data.recent.map((u) => (
                <div key={u.id} className="py-2 flex items-center justify-between text-sm gap-3">
                  <div className="min-w-0">
                    <p className="font-medium truncate">{u.display_name ?? u.username ?? "—"}</p>
                    <p className="text-xs text-muted-foreground truncate">
                      {u.username ? `@${u.username} · ` : ""}{new Date(u.created_at).toLocaleString("pt-BR")}
                    </p>
                    {u.signup_campaign && (
                      <p className="text-[11px] text-muted-foreground truncate">campanha: {u.signup_campaign}</p>
                    )}
                  </div>
                  <Badge variant="outline" className="shrink-0">{u.source}</Badge>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

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

// ============ Retention / Activity ============
function RetentionTab() {
  const fn = useServerFn(getUserActivityStats);
  const { data, isLoading } = useFn(() => fn(), ["admin", "retention"], 60000);
  if (isLoading || !data) return <LoadingBlock />;
  const r = data.retention;
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Stat label="Cadastrados (total)" value={data.total.toLocaleString("pt-BR")} icon={Users} />
        <Stat label="Ativos hoje" value={data.active_today.toLocaleString("pt-BR")} icon={Activity} />
        <Stat label="Ativos 7 dias" value={data.active_7.toLocaleString("pt-BR")} icon={Activity} />
        <Stat label="Ativos 30 dias" value={data.active_30.toLocaleString("pt-BR")} icon={Activity} />
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
        <Stat label="Total de logins" value={(data.total_logins ?? 0).toLocaleString("pt-BR")} icon={LogIn} />
        <Stat label="Mensagens enviadas" value={(data.messages_total ?? 0).toLocaleString("pt-BR")} icon={MessageSquare} />
        <Stat label="Chamadas realizadas" value={(data.calls_total ?? 0).toLocaleString("pt-BR")} icon={Phone} />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <TopList title="País" items={data.top_countries ?? []} icon={Globe2} />
        <TopList title="Idioma detectado" items={data.top_languages ?? []} icon={Languages} />
        <TopList title="Origem" items={data.top_sources ?? []} icon={Megaphone} />
      </div>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm flex items-center gap-2"><Repeat className="size-4 text-muted-foreground" />Retenção</CardTitle>
          <CardDescription className="text-xs">% de cadastrados que voltaram ao app após N dias.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <RetCard label="D+1 (voltou após 1 dia)" returned={r.d1.returned} cohort={r.d1.cohort} rate={r.d1.rate} />
            <RetCard label="D+7 (voltou após 7 dias)" returned={r.d7.returned} cohort={r.d7.cohort} rate={r.d7.rate} />
            <RetCard label="D+30 (voltou após 30 dias)" returned={r.d30.returned} cohort={r.d30.cohort} rate={r.d30.rate} />
          </div>
        </CardContent>
      </Card>


      <ChartCard title="Cadastros vs Ativos (30 dias)">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data.series}>
            <CartesianGrid stroke="hsl(var(--border))" strokeDasharray="3 3" />
            <XAxis dataKey="date" stroke="hsl(var(--muted-foreground))" fontSize={11} tickFormatter={(d) => d.slice(5)} />
            <YAxis stroke="hsl(var(--muted-foreground))" fontSize={11} />
            <Tooltip contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8 }} />
            <Legend />
            <Line type="monotone" dataKey="signups" name="Cadastros" stroke="hsl(var(--primary))" strokeWidth={2} dot={false} />
            <Line type="monotone" dataKey="active" name="Ativos" stroke="#22c55e" strokeWidth={2} dot={false} />
          </LineChart>
        </ResponsiveContainer>
      </ChartCard>

      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-sm">Usuários recentes</CardTitle></CardHeader>
        <CardContent>
          <div className="divide-y divide-border/50 max-h-96 overflow-auto">
            {data.recent.map((u) => {
              const days = Number(u.days_since_signup) || 0;
              const returned = days >= 1;
              return (
                <div key={u.id} className="py-2 flex items-center justify-between text-sm gap-3">
                  <div className="min-w-0">
                    <p className="font-medium truncate">{u.display_name}</p>
                    <p className="text-xs text-muted-foreground truncate">@{u.username}</p>
                  </div>
                  <div className="text-right text-xs text-muted-foreground shrink-0">
                    <p>Criado: {new Date(u.created_at).toLocaleDateString("pt-BR")}</p>
                    <p>
                      Último: {new Date(u.last_seen).toLocaleString("pt-BR")}{" "}
                      <Badge variant={returned ? "default" : "secondary"} className="ml-1">
                        {returned ? `voltou (${days.toFixed(1)}d)` : "não voltou"}
                      </Badge>
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function RetCard({ label, returned, cohort, rate }: { label: string; returned: number; cohort: number; rate: number }) {
  return (
    <div className="rounded-lg border border-border bg-card p-4">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="text-2xl font-bold mt-1">{rate.toFixed(1)}%</p>
      <p className="text-xs text-muted-foreground mt-1">
        {returned.toLocaleString("pt-BR")} de {cohort.toLocaleString("pt-BR")} voltaram
      </p>
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

// ============ Usage / Funnel ============
function UsageTab() {
  const fn = useServerFn(getUsageAnalytics);
  const [days, setDays] = useState(30);
  const { data, isLoading } = useQuery({
    queryKey: ["admin", "usage", days],
    queryFn: () => fn({ data: { days } }),
    refetchInterval: 60000,
  });
  if (isLoading || !data) return <LoadingBlock />;
  const f = data.funnel;
  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <span className="text-sm text-muted-foreground">Período:</span>
        {[7, 30, 90].map((d) => (
          <Button key={d} size="sm" variant={days === d ? "default" : "outline"} onClick={() => setDays(d)}>
            {d}d
          </Button>
        ))}
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Stat label="Visitas únicas" value={f.visits} icon={Users} />
        <Stat label="Visualizações" value={data.pageViews} icon={Activity} />
        <Stat label="Cliques em Cadastrar" value={f.signup_clicks} icon={MousePointerClick} />
        <Stat label="Cadastros iniciados" value={f.signup_completed} hint={`Conversão: ${f.conversion_rate}%`} icon={MailCheck} />
        <Stat label="Cliques em Entrar" value={f.login_clicks} />
        <Stat label="Cliques em Ajuda/Suporte" value={f.help_clicks} />
        <Stat label="Desistiram após clicar" value={f.abandon_after_click} hint="Clicou em Cadastrar mas não concluiu" />
        <Stat label="CTR Cadastro" value={`${f.click_through_rate}%`} hint="Visitas → clique" />
      </div>

      <div className="grid lg:grid-cols-2 gap-4">
        <ChartCard title="Funil de conversão">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={[
              { name: "Visitas", v: f.visits },
              { name: "Clique Cadastrar", v: f.signup_clicks },
              { name: "Cadastro feito", v: f.signup_completed },
            ]}>
              <CartesianGrid strokeDasharray="3 3" opacity={0.2} />
              <XAxis dataKey="name" fontSize={12} />
              <YAxis fontSize={12} />
              <Tooltip />
              <Bar dataKey="v" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard title="Visitas e cadastros por dia">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={data.series}>
              <CartesianGrid strokeDasharray="3 3" opacity={0.2} />
              <XAxis dataKey="date" fontSize={11} />
              <YAxis fontSize={11} />
              <Tooltip />
              <Legend />
              <Line type="monotone" dataKey="visits" name="Visitas" stroke="hsl(var(--primary))" strokeWidth={2} />
              <Line type="monotone" dataKey="signup_clicks" name="Cliques Cadastrar" stroke="#f59e0b" strokeWidth={2} />
              <Line type="monotone" dataKey="signups" name="Cadastros" stroke="#22c55e" strokeWidth={2} />
            </LineChart>
          </ResponsiveContainer>
        </ChartCard>
      </div>

      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-sm font-medium">Telas mais navegadas</CardTitle>
        <CardDescription>Onde os usuários estão passando o tempo — gargalos costumam ser saltos nesta lista.</CardDescription></CardHeader>
        <CardContent>
          <ScrollArea className="h-80">
            <table className="w-full text-sm">
              <thead className="text-left text-xs text-muted-foreground uppercase">
                <tr><th className="py-2">Caminho</th><th className="py-2 text-right">Visualizações</th><th className="py-2 text-right">Sessões únicas</th></tr>
              </thead>
              <tbody>
                {data.byPath.map((p) => (
                  <tr key={p.path} className="border-t border-border/40">
                    <td className="py-2 font-mono text-xs">{p.path}</td>
                    <td className="py-2 text-right">{p.views}</td>
                    <td className="py-2 text-right">{p.unique_sessions}</td>
                  </tr>
                ))}
                {data.byPath.length === 0 && (
                  <tr><td colSpan={3} className="py-6 text-center text-muted-foreground">Sem dados ainda. Aguarde algumas visitas.</td></tr>
                )}
              </tbody>
            </table>
          </ScrollArea>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-sm font-medium">Eventos registrados</CardTitle></CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-2">
            {data.byEvent.map((e) => (
              <Badge key={e.name} variant="secondary" className="text-xs">{e.name}: {e.count}</Badge>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function PushTab() {
  const fn = useServerFn(getPushLogs);
  const [days, setDays] = useState(7);
  const { data, isLoading, refetch, isFetching } = useQuery({
    queryKey: ["admin", "push-logs", days],
    queryFn: () => fn({ data: { days } }),
  });
  if (isLoading) return <Loader2 className="size-5 animate-spin" />;
  if (!data) return null;
  return (
    <div className="grid gap-4">
      <div className="flex flex-wrap items-center gap-2">
        {[1,7,30].map((d)=>(
          <Button key={d} size="sm" variant={days===d?"default":"secondary"} onClick={()=>setDays(d)}>
            {d}d
          </Button>
        ))}
        <Button size="sm" variant="outline" onClick={()=>refetch()} disabled={isFetching}>
          {isFetching && <Loader2 className="size-3.5 mr-1.5 animate-spin" />}Atualizar
        </Button>
      </div>
      <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
        <Stat label="Envios" value={data.total} />
        <Stat label="Sucesso" value={data.success} />
        <Stat label="Falhas" value={data.failed} />
      </div>
      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-sm font-medium">Por canal</CardTitle></CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-2">
            {data.byChannel.length === 0 && <p className="text-sm text-muted-foreground">Sem envios no período.</p>}
            {data.byChannel.map((c, i) => (
              <Badge key={i} variant="secondary" className="text-xs">
                {c.channel}/{c.kind}: ✅ {c.success} · ❌ {c.failed}
              </Badge>
            ))}
          </div>
        </CardContent>
      </Card>
      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-sm font-medium">Linha do tempo</CardTitle></CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={220}>
            <LineChart data={data.series}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis dataKey="date" stroke="hsl(var(--muted-foreground))" fontSize={11} />
              <YAxis stroke="hsl(var(--muted-foreground))" fontSize={11} />
              <Tooltip />
              <Line type="monotone" dataKey="success" stroke="#22c55e" strokeWidth={2} dot={false} />
              <Line type="monotone" dataKey="failed" stroke="#ef4444" strokeWidth={2} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>
      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-sm font-medium">Últimos envios</CardTitle></CardHeader>
        <CardContent>
          <ScrollArea className="h-[420px]">
            <div className="space-y-2">
              {data.recent.length === 0 && <p className="text-sm text-muted-foreground">Sem registros.</p>}
              {data.recent.map((r) => (
                <div key={r.id} className="text-xs rounded-md border border-border p-2">
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <Badge variant={r.success ? "default" : "destructive"} className="text-[10px]">
                        {r.success ? "OK" : "FALHA"}
                      </Badge>
                      <Badge variant="secondary" className="text-[10px]">{r.channel}</Badge>
                      <Badge variant="outline" className="text-[10px]">{r.kind}</Badge>
                      {r.status_code != null && (
                        <span className="text-muted-foreground">HTTP {r.status_code}</span>
                      )}
                    </div>
                    <span className="text-muted-foreground">{new Date(r.created_at).toLocaleString("pt-BR")}</span>
                  </div>
                  <div className="mt-1 text-muted-foreground">
                    Para: <strong className="text-foreground">{r.recipient_name || r.recipient_username || r.recipient_id.slice(0,8)}</strong>
                    {r.sender_id && (
                      <> · De: <strong className="text-foreground">{r.sender_name || r.sender_username || r.sender_id.slice(0,8)}</strong></>
                    )}
                  </div>
                  {r.error && <div className="mt-1 text-destructive truncate">{r.error}</div>}
                </div>
              ))}
            </div>
          </ScrollArea>
        </CardContent>
      </Card>
    </div>
  );
}


function AdminsTab({ canEdit }: { canEdit: boolean }) {
  const listFn = useServerFn(listAdmins);
  const grantFn = useServerFn(grantAdminRole);
  const revokeFn = useServerFn(revokeAdminRole);
  const q = useQuery({ queryKey: ["admin", "admins"], queryFn: () => listFn() });

  const [email, setEmail] = useState("");
  const [role, setRole] = useState<"moderator" | "admin" | "superadmin">("admin");

  const grant = useMutation({
    mutationFn: () => grantFn({ data: { email: email.trim(), role } }),
    onSuccess: () => {
      toast.success("Permissão concedida");
      setEmail("");
      q.refetch();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const revoke = useMutation({
    mutationFn: (v: { user_id: string; role: "moderator" | "admin" | "superadmin" }) =>
      revokeFn({ data: v }),
    onSuccess: () => {
      toast.success("Permissão removida");
      q.refetch();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><Shield className="size-5" /> Administradores</CardTitle>
          <CardDescription>
            Permissões salvas no banco — independentes do login. Sair da conta não remove o acesso administrativo.
            {!canEdit && " Apenas o SuperAdmin pode adicionar ou remover."}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {canEdit && (
            <div className="flex flex-col md:flex-row gap-2 p-3 rounded-lg bg-muted/40 border border-border/50">
              <Input
                placeholder="e-mail do usuário"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="flex-1"
              />
              <select
                value={role}
                onChange={(e) => setRole(e.target.value as typeof role)}
                className="h-10 rounded-md border border-input bg-background px-3 text-sm"
              >
                <option value="moderator">Moderator</option>
                <option value="admin">Admin</option>
                <option value="superadmin">SuperAdmin</option>
              </select>
              <Button onClick={() => grant.mutate()} disabled={!email || grant.isPending}>
                {grant.isPending ? <Loader2 className="size-4 animate-spin" /> : "Conceder"}
              </Button>
            </div>
          )}

          {q.isLoading ? (
            <div className="grid place-items-center py-8"><Loader2 className="size-5 animate-spin text-muted-foreground" /></div>
          ) : (
            <ScrollArea className="max-h-[480px]">
              <div className="space-y-2">
                {(q.data ?? []).map((a) => (
                  <div key={`${a.user_id}-${a.role}`} className="flex items-center justify-between gap-3 p-3 rounded-lg border border-border/50">
                    <div className="min-w-0">
                      <div className="font-medium truncate">{a.display_name ?? a.username ?? "—"}</div>
                      <div className="text-xs text-muted-foreground truncate">{a.email ?? a.user_id}</div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <Badge variant={a.role === "superadmin" ? "default" : "outline"} className="uppercase text-[10px]">
                        {a.role}
                      </Badge>
                      {a.protected && <Badge variant="secondary" className="text-[10px]">PROTEGIDO</Badge>}
                      {canEdit && !a.protected && (
                        <Button
                          size="sm"
                          variant="ghost"
                          className="text-destructive hover:text-destructive"
                          onClick={() => {
                            if (confirm(`Remover ${a.role} de ${a.email ?? a.user_id}?`)) {
                              revoke.mutate({ user_id: a.user_id, role: a.role as "moderator" | "admin" | "superadmin" });
                            }
                          }}
                          disabled={revoke.isPending}
                        >
                          Remover
                        </Button>
                      )}
                    </div>
                  </div>
                ))}
                {(q.data ?? []).length === 0 && (
                  <p className="text-sm text-muted-foreground text-center py-6">Nenhum administrador cadastrado.</p>
                )}
              </div>
            </ScrollArea>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

// ============ Invites Tab ============
function InvitesTab() {
  const fn = useServerFn(getInvitesOverview);
  const { data, isLoading } = useFn(() => fn(), ["admin", "invites"], 30000);
  const [expanded, setExpanded] = useState<string | null>(null);
  if (isLoading || !data) return <LoadingBlock />;

  const totals = data.totals ?? { total_invites: 0, confirmed: 0, pending: 0, unique_inviters: 0 };
  const attemptTotals = (data as any).attempt_totals ?? { unique_attempters: 0, total_attempts: 0, with_signup: 0, without_signup: 0 };
  const attempters = ((data as any).attempters ?? []) as Array<any>;
  const pct = totals.total_invites > 0 ? (totals.confirmed / totals.total_invites) * 100 : 0;

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Stat label="Tentaram convidar" value={attemptTotals.unique_attempters} icon={Share2} hint={`${attemptTotals.total_attempts} cliques de compartilhar/copiar/QR`} />
        <Stat label="Convites aceitos" value={totals.total_invites} icon={Gift} hint="Amigo criou conta pelo link" />
        <Stat label="Deram certo" value={totals.confirmed} icon={MailCheck} hint={`${pct.toFixed(1)}% confirmaram e-mail`} />
        <Stat label="Sem nenhum cadastro" value={attemptTotals.without_signup} icon={MailWarning} hint="Compartilhou mas ninguém criou conta" />
      </div>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm flex items-center gap-2">
            <Share2 className="size-4" /> Quem tentou convidar (todos)
          </CardTitle>
          <CardDescription>
            Cada usuário que clicou em WhatsApp, Copiar link, Compartilhar ou baixou o QR. Inclui quem ainda não trouxe ninguém.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {attempters.length === 0 ? (
            <p className="text-sm text-muted-foreground">Ninguém clicou em compartilhar ainda.</p>
          ) : (
            <ScrollArea className="h-[360px]">
              <div className="divide-y divide-border/50 pr-2">
                {attempters.map((a) => (
                  <div key={a.user_id} className="py-2 flex items-center justify-between gap-3 text-sm">
                    <div className="min-w-0">
                      <p className="font-medium truncate">{a.display_name ?? a.email ?? "—"}</p>
                      <p className="text-xs text-muted-foreground truncate">
                        {a.username ? `@${a.username}` : ""}
                        {a.email ? ` · ${a.email}` : ""}
                      </p>
                      <p className="text-[11px] text-muted-foreground mt-0.5">
                        WhatsApp {a.attempts_whatsapp} · Copiar {a.attempts_copy} · Compartilhar {a.attempts_native} · QR {a.attempts_qr}
                        {a.last_attempt ? ` · último: ${new Date(a.last_attempt).toLocaleString("pt-BR")}` : ""}
                      </p>
                    </div>
                    <div className="flex flex-col items-end gap-1 shrink-0 text-xs">
                      <Badge variant="outline">{a.attempts} cliques</Badge>
                      {a.accepted > 0 ? (
                        <Badge variant="outline" className="border-emerald-500/40 text-emerald-700 dark:text-emerald-400">
                          {a.accepted} cadastro{a.accepted > 1 ? "s" : ""} ({a.accepted_confirmed} ✓)
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="border-yellow-500/40 text-yellow-700 dark:text-yellow-400">
                          0 cadastros
                        </Badge>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </ScrollArea>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm flex items-center gap-2">
            <Users className="size-4" /> Ranking de quem mais convidou
          </CardTitle>
          <CardDescription>
            Clique em um nome para ver quem foi convidado por ele. "Pendente" = criou conta mas não confirmou e-mail.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {data.inviters.length === 0 ? (
            <p className="text-sm text-muted-foreground">Ninguém convidou alguém ainda.</p>
          ) : (
            <div className="divide-y divide-border/50">
              {data.inviters.map((inv) => {
                const open = expanded === inv.inviter_id;
                return (
                  <div key={inv.inviter_id} className="py-2">
                    <button
                      onClick={() => setExpanded(open ? null : inv.inviter_id)}
                      className="w-full flex items-center gap-3 text-left hover:bg-accent/30 rounded-md p-2"
                    >
                      {open ? <ChevronDown className="size-4 shrink-0" /> : <ChevronRight className="size-4 shrink-0" />}
                      <div className="min-w-0 flex-1">
                        <p className="font-medium truncate text-sm">
                          {inv.inviter_name ?? inv.inviter_username ?? "—"}
                        </p>
                        <p className="text-xs text-muted-foreground truncate">
                          {inv.inviter_username ? `@${inv.inviter_username}` : ""}
                          {inv.inviter_email ? ` · ${inv.inviter_email}` : ""}
                        </p>
                      </div>
                      <div className="flex items-center gap-1.5 shrink-0 text-xs">
                        <Badge variant="outline">{inv.total} total</Badge>
                        <Badge variant="outline" className="border-emerald-500/40 text-emerald-700 dark:text-emerald-400">
                          {inv.confirmed} ✓
                        </Badge>
                        {inv.pending > 0 && (
                          <Badge variant="outline" className="border-yellow-500/40 text-yellow-700 dark:text-yellow-400">
                            {inv.pending} pend.
                          </Badge>
                        )}
                      </div>
                    </button>
                    {open && (
                      <div className="mt-2 ml-7 border-l border-border/50 pl-3 space-y-1.5">
                        {inv.invitees.map((g) => (
                          <div key={g.id} className="flex items-center justify-between gap-3 text-xs py-1">
                            <div className="min-w-0">
                              <p className="font-medium truncate">{g.display_name ?? g.email ?? "—"}</p>
                              <p className="text-muted-foreground truncate">
                                {g.username ? `@${g.username}` : ""}
                                {g.email ? ` · ${g.email}` : ""}
                              </p>
                            </div>
                            <div className="text-right shrink-0">
                              {g.status === "confirmed" ? (
                                <Badge variant="outline" className="border-emerald-500/40 text-emerald-700 dark:text-emerald-400">
                                  Confirmado
                                </Badge>
                              ) : (
                                <Badge variant="outline" className="border-yellow-500/40 text-yellow-700 dark:text-yellow-400">
                                  Pendente
                                </Badge>
                              )}
                              <p className="mt-0.5 text-muted-foreground">
                                {new Date(g.created_at).toLocaleDateString("pt-BR")}
                              </p>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm flex items-center gap-2">
            <Activity className="size-4" /> Últimos 100 convites aceitos
          </CardTitle>
          <CardDescription>
            Use isto para conferir uma alegação específica de "fulano disse que aceitou meu convite".
          </CardDescription>
        </CardHeader>
        <CardContent>
          {data.recent.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nenhum convite aceito ainda.</p>
          ) : (
            <ScrollArea className="h-[420px]">
              <div className="divide-y divide-border/50 pr-2">
                {data.recent.map((r) => (
                  <div key={r.id} className="py-2 flex items-center justify-between gap-3 text-sm">
                    <div className="min-w-0">
                      <p className="font-medium truncate">
                        {r.display_name ?? r.email ?? "—"}
                        <span className="text-xs text-muted-foreground font-normal">
                          {" "}← convidado por {r.inviter_name ?? r.inviter_username ?? "—"}
                        </span>
                      </p>
                      <p className="text-xs text-muted-foreground truncate">
                        {r.username ? `@${r.username}` : ""}
                        {r.email ? ` · ${r.email}` : ""}
                      </p>
                    </div>
                    <div className="text-right text-xs shrink-0">
                      {r.status === "confirmed" ? (
                        <Badge variant="outline" className="border-emerald-500/40 text-emerald-700 dark:text-emerald-400">
                          Confirmado
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="border-yellow-500/40 text-yellow-700 dark:text-yellow-400">
                          Pendente
                        </Badge>
                      )}
                      <p className="mt-1 text-muted-foreground">
                        {new Date(r.created_at).toLocaleString("pt-BR")}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </ScrollArea>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
