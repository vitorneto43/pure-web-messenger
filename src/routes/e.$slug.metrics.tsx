import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { ArrowLeft, Loader2, Users, FileText, Image as ImageIcon, Video, Radio, Heart, MessageCircle, TrendingUp } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { getEcosystemBySlug, getMyRole, type Ecosystem, type EcosystemRole } from "@/lib/ecosystems";

export const Route = createFileRoute("/e/$slug/metrics")({
  component: EcosystemMetrics,
  head: () => ({
    meta: [
      { title: "Métricas — Ecossistema Wavechat" },
      { name: "description", content: "Painel de métricas do ecossistema." },
      { name: "robots", content: "noindex" },
    ],
  }),
});

interface TopAuthor {
  user_id: string;
  posts: number;
  display_name: string | null;
  username: string | null;
  avatar_url: string | null;
}
interface DayRow { day: string; posts: number; statuses: number; videos: number }
interface Metrics {
  members_total: number;
  members_new: number;
  members_banned: number;
  members_pending: number;
  posts_total: number;
  posts_recent: number;
  statuses_recent: number;
  videos_total: number;
  videos_recent: number;
  lives_recent: number;
  lives_live_now: number;
  reactions_recent: number;
  comments_recent: number;
  top_authors: TopAuthor[];
  activity_by_day: DayRow[];
}

function EcosystemMetrics() {
  const { slug } = Route.useParams();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [eco, setEco] = useState<Ecosystem | null | undefined>(undefined);
  const [role, setRole] = useState<EcosystemRole | null>(null);
  const [days, setDays] = useState<number>(30);
  const [metrics, setMetrics] = useState<Metrics | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const e = await getEcosystemBySlug(slug);
        setEco(e);
        if (!e || !user) return;
        const r = await getMyRole(e.id);
        setRole(r);
      } catch {
        setEco(null);
      }
    })();
  }, [slug, user?.id]);

  useEffect(() => {
    if (!eco || (role !== "owner" && role !== "admin")) return;
    setLoading(true);
    (async () => {
      const { data, error } = await supabase.rpc("get_ecosystem_metrics", {
        _ecosystem_id: eco.id,
        _days: days,
      });
      if (error) {
        toast.error("Falha ao carregar métricas", { description: error.message });
      } else {
        setMetrics(data as unknown as Metrics);
      }
      setLoading(false);
    })();
  }, [eco?.id, role, days]);

  if (eco === undefined) {
    return (
      <div className="min-h-screen grid place-items-center">
        <Loader2 className="size-6 animate-spin text-muted-foreground" />
      </div>
    );
  }
  if (!eco) {
    return (
      <div className="min-h-screen grid place-items-center text-center p-6">
        <div>
          <p className="text-sm text-muted-foreground mb-3">Ecossistema não encontrado.</p>
          <Button asChild variant="outline"><Link to="/">Voltar</Link></Button>
        </div>
      </div>
    );
  }
  if (role !== "owner" && role !== "admin") {
    return (
      <div className="min-h-screen grid place-items-center text-center p-6">
        <div>
          <p className="text-sm text-muted-foreground mb-3">Apenas administradores podem ver as métricas.</p>
          <Button asChild variant="outline">
            <Link to="/e/$slug" params={{ slug }}>Voltar ao ecossistema</Link>
          </Button>
        </div>
      </div>
    );
  }

  const maxDay = metrics?.activity_by_day.reduce((m, d) => Math.max(m, d.posts + d.statuses + d.videos), 0) ?? 0;

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-10 bg-background/85 backdrop-blur border-b border-border">
        <div className="mx-auto max-w-[720px] flex items-center gap-2 px-3 py-2.5">
          <Button size="icon" variant="ghost" onClick={() => navigate({ to: "/e/$slug", params: { slug } })} aria-label="Voltar">
            <ArrowLeft className="size-5" />
          </Button>
          <div className="min-w-0 flex-1">
            <h1 className="text-sm font-bold leading-tight truncate">Métricas — {eco.name}</h1>
            <p className="text-[11px] text-muted-foreground leading-tight">Últimos {days} dias</p>
          </div>
          <select
            value={days}
            onChange={(e) => setDays(parseInt(e.target.value, 10))}
            className="h-8 rounded-md border border-input bg-background px-2 text-xs"
          >
            <option value={7}>7 dias</option>
            <option value={30}>30 dias</option>
            <option value={90}>90 dias</option>
          </select>
        </div>
      </header>

      <main className="mx-auto max-w-[720px] px-3 py-4 space-y-4">
        {loading || !metrics ? (
          <div className="py-16 grid place-items-center">
            <Loader2 className="size-6 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <>
            {/* KPI grid */}
            <section className="grid grid-cols-2 md:grid-cols-4 gap-2">
              <KpiCard icon={<Users className="size-4" />} label="Membros ativos" value={metrics.members_total} sub={`+${metrics.members_new} novos`} />
              <KpiCard icon={<FileText className="size-4" />} label="Posts" value={metrics.posts_recent} sub={`total ${metrics.posts_total}`} />
              <KpiCard icon={<ImageIcon className="size-4" />} label="Stories" value={metrics.statuses_recent} />
              <KpiCard icon={<Video className="size-4" />} label="Vídeos" value={metrics.videos_recent} sub={`total ${metrics.videos_total}`} />
              <KpiCard icon={<Radio className="size-4" />} label="Lives" value={metrics.lives_recent} sub={metrics.lives_live_now > 0 ? `${metrics.lives_live_now} ao vivo` : undefined} />
              <KpiCard icon={<Heart className="size-4" />} label="Reações" value={metrics.reactions_recent} />
              <KpiCard icon={<MessageCircle className="size-4" />} label="Comentários" value={metrics.comments_recent} />
              <KpiCard icon={<TrendingUp className="size-4" />} label="Pendentes" value={metrics.members_pending} sub={metrics.members_banned > 0 ? `${metrics.members_banned} banidos` : undefined} />
            </section>

            {/* Activity chart */}
            <section className="rounded-2xl border border-border bg-card p-4">
              <h2 className="text-sm font-bold mb-3">Atividade por dia</h2>
              {metrics.activity_by_day.length === 0 ? (
                <p className="text-xs text-muted-foreground">Sem dados no período.</p>
              ) : (
                <div className="flex items-end gap-1 h-40 overflow-x-auto">
                  {metrics.activity_by_day.map((d) => {
                    const total = d.posts + d.statuses + d.videos;
                    const h = maxDay > 0 ? (total / maxDay) * 100 : 0;
                    return (
                      <div key={d.day} className="flex flex-col items-center gap-1 flex-1 min-w-[10px]">
                        <div
                          className="w-full bg-primary/70 rounded-t"
                          style={{ height: `${Math.max(h, total > 0 ? 4 : 0)}%` }}
                          title={`${d.day}: ${total} (${d.posts}p / ${d.statuses}s / ${d.videos}v)`}
                        />
                        <span className="text-[9px] text-muted-foreground rotate-45 origin-left whitespace-nowrap">
                          {new Date(d.day).toLocaleDateString(undefined, { day: "2-digit", month: "2-digit" })}
                        </span>
                      </div>
                    );
                  })}
                </div>
              )}
              <div className="flex gap-3 text-[10px] text-muted-foreground mt-2 pt-2 border-t border-border">
                <span>Posts + Stories + Vídeos por dia</span>
              </div>
            </section>

            {/* Top authors */}
            <section className="rounded-2xl border border-border bg-card p-4">
              <h2 className="text-sm font-bold mb-3">Principais autores</h2>
              {metrics.top_authors.length === 0 ? (
                <p className="text-xs text-muted-foreground">Ninguém publicou no período.</p>
              ) : (
                <ul className="divide-y divide-border">
                  {metrics.top_authors.map((a, idx) => {
                    const name = a.display_name || a.username || "Usuário";
                    return (
                      <li key={a.user_id} className="flex items-center gap-3 py-2">
                        <span className="text-xs font-bold w-5 text-muted-foreground">#{idx + 1}</span>
                        <Avatar className="size-8">
                          <AvatarImage src={a.avatar_url ?? undefined} />
                          <AvatarFallback>{name[0]?.toUpperCase()}</AvatarFallback>
                        </Avatar>
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-medium truncate">{name}</p>
                          {a.username && <p className="text-[11px] text-muted-foreground truncate">@{a.username}</p>}
                        </div>
                        <span className="text-sm font-bold">{a.posts}</span>
                        <span className="text-[10px] text-muted-foreground">posts</span>
                      </li>
                    );
                  })}
                </ul>
              )}
            </section>
          </>
        )}
      </main>
    </div>
  );
}

function KpiCard({ icon, label, value, sub }: { icon: React.ReactNode; label: string; value: number; sub?: string }) {
  return (
    <div className="rounded-xl border border-border bg-card p-3">
      <div className="flex items-center gap-1.5 text-muted-foreground text-[11px]">
        {icon}
        <span className="truncate">{label}</span>
      </div>
      <p className="text-xl font-bold mt-1">{value.toLocaleString()}</p>
      {sub && <p className="text-[10px] text-muted-foreground truncate">{sub}</p>}
    </div>
  );
}
