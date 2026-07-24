import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { ArrowLeft, Loader2, Check, Crown, Zap, Building2, Rocket, Globe2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/use-auth";
import {
  getEcosystemBySlug,
  getMyRole,
  getEcosystemBilling,
  listPlanCatalog,
  listBillingRequests,
  requestEcosystemUpgrade,
  type Ecosystem,
  type EcosystemBilling,
  type EcosystemRole,
  type EcosystemPlanTier,
  type PlanLimitRow,
} from "@/lib/ecosystems";

export const Route = createFileRoute("/e/$slug/billing")({
  component: EcosystemBillingPage,
  head: () => ({
    meta: [
      { title: "Planos & Faturamento — Wavechat" },
      { name: "description", content: "Gerencie o plano do seu ecossistema Wavechat." },
      { name: "robots", content: "noindex" },
    ],
  }),
});

const PLAN_ICON: Record<EcosystemPlanTier, React.ReactNode> = {
  free: <Zap className="w-5 h-5" />,
  pro: <Rocket className="w-5 h-5" />,
  business: <Building2 className="w-5 h-5" />,
  enterprise: <Crown className="w-5 h-5" />,
};

function UsageBar({ label, used, ceiling }: { label: string; used: number; ceiling: number }) {
  const pct = ceiling > 0 ? Math.min(100, (used / ceiling) * 100) : 0;
  const danger = pct >= 90;
  return (
    <div>
      <div className="flex justify-between text-xs mb-1">
        <span className="text-muted-foreground">{label}</span>
        <span className={danger ? "text-destructive font-semibold" : ""}>
          {used.toLocaleString("pt-BR")} / {ceiling.toLocaleString("pt-BR")}
        </span>
      </div>
      <div className="h-2 rounded-full bg-muted overflow-hidden">
        <div
          className={`h-full transition-all ${danger ? "bg-destructive" : "bg-primary"}`}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}

function EcosystemBillingPage() {
  const { slug } = Route.useParams();
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();

  const [eco, setEco] = useState<Ecosystem | null>(null);
  const [role, setRole] = useState<EcosystemRole | null>(null);
  const [billing, setBilling] = useState<EcosystemBilling | null>(null);
  const [plans, setPlans] = useState<PlanLimitRow[]>([]);
  const [requests, setRequests] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [pendingTier, setPendingTier] = useState<EcosystemPlanTier | null>(null);
  const [cycle, setCycle] = useState<"monthly" | "yearly">("monthly");

  useEffect(() => {
    if (authLoading) return;
    if (!user) { navigate({ to: "/auth" }); return; }
    (async () => {
      try {
        const e = await getEcosystemBySlug(slug);
        if (!e) { toast.error("Ecossistema não encontrado."); navigate({ to: "/" }); return; }
        setEco(e);
        const r = await getMyRole(e.id);
        setRole(r);
        if (r !== "owner" && r !== "admin") {
          toast.error("Apenas administradores podem gerenciar o plano.");
          navigate({ to: "/e/$slug", params: { slug } });
          return;
        }
        const [b, cat, reqs] = await Promise.all([
          getEcosystemBilling(e.id),
          listPlanCatalog(),
          listBillingRequests(e.id).catch(() => []),
        ]);
        setBilling(b);
        setPlans(cat);
        setRequests(reqs);
      } catch (err: any) {
        toast.error(err?.message ?? "Erro ao carregar faturamento.");
      } finally {
        setLoading(false);
      }
    })();
  }, [authLoading, user, slug, navigate]);

  async function handleUpgrade(tier: EcosystemPlanTier) {
    if (!eco) return;
    setPendingTier(tier);
    try {
      await requestEcosystemUpgrade(eco.id, tier, cycle);
      toast.success("Solicitação enviada! Nossa equipe entrará em contato em até 24h.");
      const reqs = await listBillingRequests(eco.id);
      setRequests(reqs);
    } catch (err: any) {
      toast.error(err?.message ?? "Falha ao solicitar upgrade.");
    } finally {
      setPendingTier(null);
    }
  }

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center min-h-screen">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!eco || !billing) return null;

  const currentTier = billing.tier;

  return (
    <div className="flex-1 flex flex-col min-h-screen bg-background">
      <div className="sticky top-0 z-10 flex items-center justify-between px-4 py-3 border-b bg-background/95 backdrop-blur">
        <div className="flex items-center gap-3">
          <Link to="/e/$slug/admin" params={{ slug }}>
            <Button size="icon" variant="ghost"><ArrowLeft className="w-5 h-5" /></Button>
          </Link>
          <div>
            <h1 className="text-lg font-semibold">Planos & Faturamento</h1>
            <p className="text-xs text-muted-foreground">{eco.name}</p>
          </div>
        </div>
      </div>

      <div className="max-w-3xl mx-auto w-full p-4 space-y-6">
        {/* Plano atual e uso */}
        <section className="rounded-xl border p-5 bg-card">
          <div className="flex items-start justify-between gap-4 mb-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-primary/10 text-primary">
                {PLAN_ICON[currentTier]}
              </div>
              <div>
                <div className="text-xs uppercase text-muted-foreground">Plano atual</div>
                <div className="text-xl font-bold">{billing.limits.display_name}</div>
                <div className="text-xs text-muted-foreground capitalize">Status: {billing.status}</div>
              </div>
            </div>
            {billing.limits.price_brl_month > 0 && (
              <div className="text-right">
                <div className="text-2xl font-bold">R$ {billing.limits.price_brl_month.toFixed(2)}</div>
                <div className="text-xs text-muted-foreground">/mês</div>
              </div>
            )}
          </div>

          <div className="space-y-3">
            <UsageBar label="Membros ativos" used={billing.usage.members} ceiling={billing.limits.members} />
          </div>
          <div className="mt-4 p-3 rounded-lg bg-muted/50 text-sm">
            <strong>Tudo incluso na mensalidade:</strong> posts, stories, vídeos, lives, chat e grupos — sem limite mensal. Você paga apenas pela quantidade de membros do seu ecossistema.
          </div>


          {billing.custom_subdomain && (
            <div className="mt-4 flex items-center gap-2 text-sm p-3 rounded-lg bg-primary/5 border border-primary/20">
              <Globe2 className="w-4 h-4 text-primary" />
              <span>Seu subdomínio: <strong>{billing.custom_subdomain}.webconnectchat.com</strong></span>
            </div>
          )}
        </section>

        {/* Ciclo */}
        <div className="flex items-center gap-2 justify-center">
          <button
            onClick={() => setCycle("monthly")}
            className={`px-4 py-2 rounded-full text-sm transition ${cycle === "monthly" ? "bg-primary text-primary-foreground" : "bg-muted"}`}
          >Mensal</button>
          <button
            onClick={() => setCycle("yearly")}
            className={`px-4 py-2 rounded-full text-sm transition ${cycle === "yearly" ? "bg-primary text-primary-foreground" : "bg-muted"}`}
          >Anual <span className="text-xs opacity-80">(2 meses grátis)</span></button>
        </div>

        {/* Planos disponíveis */}
        <section className="grid gap-4 md:grid-cols-2">
          {plans.map((p) => {
            const isCurrent = p.tier === currentTier;
            const isDowngrade = plans.findIndex((x) => x.tier === p.tier) < plans.findIndex((x) => x.tier === currentTier);
            const price = cycle === "yearly" ? p.price_brl_month * 10 : p.price_brl_month;
            return (
              <div
                key={p.tier}
                className={`rounded-xl border p-5 flex flex-col ${isCurrent ? "border-primary bg-primary/5" : ""}`}
              >
                <div className="flex items-center gap-2 mb-2">
                  {PLAN_ICON[p.tier]}
                  <h3 className="font-bold">{p.display_name}</h3>
                  {isCurrent && <span className="text-[10px] uppercase font-semibold px-2 py-0.5 rounded-full bg-primary text-primary-foreground">Atual</span>}
                </div>
                <div className="mb-3">
                  {p.tier === "enterprise" ? (
                    <div className="text-xl font-bold">Sob consulta</div>
                  ) : p.price_brl_month === 0 ? (
                    <div className="text-xl font-bold">Grátis</div>
                  ) : (
                    <>
                      <span className="text-2xl font-bold">R$ {price.toFixed(2)}</span>
                      <span className="text-xs text-muted-foreground"> /{cycle === "yearly" ? "ano" : "mês"}</span>
                    </>
                  )}
                </div>
                <ul className="space-y-1.5 text-sm mb-4 flex-1">
                  <li className="flex items-center gap-2"><Check className="w-4 h-4 text-primary" /> Até {p.member_limit >= 1000000 ? "membros ilimitados" : `${p.member_limit.toLocaleString("pt-BR")} membros`}</li>
                  <li className="flex items-center gap-2"><Check className="w-4 h-4 text-primary" /> Posts, stories, vídeos e lives <strong>ilimitados</strong></li>
                  <li className="flex items-center gap-2"><Check className="w-4 h-4 text-primary" /> Chat e grupos internos ilimitados</li>
                  {p.custom_branding && <li className="flex items-center gap-2"><Check className="w-4 h-4 text-primary" /> Marca personalizada</li>}
                  {p.advanced_metrics && <li className="flex items-center gap-2"><Check className="w-4 h-4 text-primary" /> Métricas avançadas</li>}
                  {p.custom_subdomain && <li className="flex items-center gap-2"><Check className="w-4 h-4 text-primary" /> Subdomínio próprio em <strong>webconnectchat.com</strong></li>}
                  {p.priority_support && <li className="flex items-center gap-2"><Check className="w-4 h-4 text-primary" /> Suporte prioritário</li>}
                </ul>

                <Button
                  disabled={isCurrent || pendingTier === p.tier}
                  variant={isCurrent ? "outline" : isDowngrade ? "secondary" : "default"}
                  onClick={() => handleUpgrade(p.tier)}
                >
                  {pendingTier === p.tier ? <Loader2 className="w-4 h-4 animate-spin" /> : isCurrent ? "Plano atual" : isDowngrade ? "Solicitar downgrade" : p.tier === "enterprise" ? "Falar com vendas" : "Solicitar upgrade"}
                </Button>
              </div>
            );
          })}
        </section>

        {/* Histórico */}
        {requests.length > 0 && (
          <section className="rounded-xl border p-5 bg-card">
            <h3 className="font-semibold mb-3">Histórico de solicitações</h3>
            <div className="space-y-2">
              {requests.slice(0, 10).map((r) => (
                <div key={r.id} className="flex items-center justify-between text-sm py-2 border-b last:border-0">
                  <div>
                    <div className="font-medium capitalize">{r.requested_tier} · {r.billing_cycle === "yearly" ? "anual" : "mensal"}</div>
                    <div className="text-xs text-muted-foreground">{new Date(r.created_at).toLocaleString("pt-BR")}</div>
                  </div>
                  <div className="text-right">
                    <div className="font-semibold">R$ {Number(r.amount_brl).toFixed(2)}</div>
                    <div className="text-xs uppercase text-muted-foreground">{r.status}</div>
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

        <p className="text-xs text-muted-foreground text-center pb-4">
          Após solicitar, nossa equipe envia instruções de pagamento (Pix/boleto) para o e-mail do administrador em até 24h.
        </p>
      </div>
    </div>
  );
}
