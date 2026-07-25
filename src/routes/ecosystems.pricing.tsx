import { createFileRoute, Link } from "@tanstack/react-router";
import { Check, Zap, Rocket, Building2, Crown } from "lucide-react";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/ecosystems/pricing")({
  component: PricingPage,
  head: () => ({
    meta: [
      { title: "Planos Wavechat for — Crie a rede social da sua empresa" },
      { name: "description", content: "Planos Wavechat for: crie a rede social privada da sua empresa, escola, clube ou comunidade. Free até 100 membros, Pro R$60, Business R$100, Enterprise R$250. Tudo incluso." },
      { property: "og:title", content: "Planos Wavechat for" },
      { property: "og:description", content: "Rede social privada da sua marca com posts, stories, vídeos, lives e chat — tudo incluso na mensalidade." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
});

const PLANS = [
  {
    tier: "free",
    icon: <Zap className="w-6 h-6" />,
    name: "Free",
    price: 0,
    members: "Até 100 membros",
    highlight: false,
    features: [
      "Posts, stories, vídeos e lives ilimitados",
      "Chat e grupos internos ilimitados",
      "Painel de administração",
      "Convites por link e código",
    ],
  },
  {
    tier: "pro",
    icon: <Rocket className="w-6 h-6" />,
    name: "Pro",
    price: 60,
    members: "Até 500 membros",
    highlight: true,
    features: [
      "Tudo do Free",
      "Marca personalizada (logo, banner, cor)",
      "Métricas avançadas de engajamento",
      "Ranking de membros mais ativos",
    ],
  },
  {
    tier: "business",
    icon: <Building2 className="w-6 h-6" />,
    name: "Business",
    price: 100,
    members: "Até 1.000 membros",
    highlight: false,
    features: [
      "Tudo do Pro",
      "Subdomínio próprio em webconnectchat.com",
      "Suporte prioritário",
      "Onboarding assistido",
    ],
  },
  {
    tier: "enterprise",
    icon: <Crown className="w-6 h-6" />,
    name: "Enterprise",
    price: 250,
    members: "Membros ilimitados",
    highlight: false,
    features: [
      "Tudo do Business",
      "SLA dedicado",
      "Integrações sob demanda",
      "Gestor de conta",
    ],
  },
];

function PricingPage() {
  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-6xl mx-auto px-4 py-10 md:py-16">
        <div className="text-center mb-10 md:mb-14">
          <div className="inline-block px-3 py-1 rounded-full bg-primary/10 text-primary text-xs font-semibold mb-4">
            Wavechat for empresas, escolas, clubes e comunidades
          </div>
          <h1 className="text-3xl md:text-5xl font-bold mb-4">
            A rede social privada da sua marca
          </h1>
          <p className="text-muted-foreground max-w-2xl mx-auto text-lg">
            Crie um ecossistema fechado com <strong>posts, stories, vídeos, lives, chat e grupos</strong> —
            tudo incluso na mensalidade. Você paga apenas pela quantidade de membros.
          </p>
        </div>

        <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-4 mb-10">
          {PLANS.map((p) => (
            <div
              key={p.tier}
              className={`rounded-2xl border p-6 flex flex-col ${
                p.highlight ? "border-primary shadow-lg shadow-primary/10 bg-primary/5 scale-[1.02]" : "bg-card"
              }`}
            >
              {p.highlight && (
                <div className="text-[10px] font-semibold uppercase tracking-wide text-primary mb-2">
                  Mais popular
                </div>
              )}
              <div className="flex items-center gap-2 mb-3 text-primary">
                {p.icon}
                <h2 className="text-xl font-bold text-foreground">{p.name}</h2>
              </div>
              <div className="mb-2">
                {p.price === 0 ? (
                  <div className="text-3xl font-bold">Grátis</div>
                ) : (
                  <>
                    <span className="text-3xl font-bold">R$ {p.price}</span>
                    <span className="text-sm text-muted-foreground">/mês</span>
                  </>
                )}
              </div>
              <div className="text-sm text-muted-foreground mb-4 font-medium">{p.members}</div>
              <ul className="space-y-2 text-sm mb-6 flex-1">
                {p.features.map((f) => (
                  <li key={f} className="flex items-start gap-2">
                    <Check className="w-4 h-4 text-primary shrink-0 mt-0.5" />
                    <span>{f}</span>
                  </li>
                ))}
              </ul>
              <Link to="/ecosystems/new" className="w-full">
                <Button className="w-full" variant={p.highlight ? "default" : "outline"}>
                  {p.price === 0 ? "Começar grátis" : "Criar ecossistema"}
                </Button>
              </Link>
            </div>
          ))}
        </div>

        <div className="rounded-2xl border p-6 md:p-8 bg-card">
          <h3 className="text-xl font-bold mb-4">Tudo o que está incluso — em todos os planos</h3>
          <div className="grid gap-3 md:grid-cols-2 text-sm">
            {[
              "Posts, stories e reações ilimitados",
              "WaveTube (vídeos longos) ilimitado",
              "WaveShorts (vídeos curtos) ilimitado",
              "Lives ao vivo com chat e reações",
              "Chat 1:1 e grupos internos",
              "Notificações push em web, iOS e Android",
              "Painel administrativo com moderação",
              "Convites por link, código e QR",
            ].map((f) => (
              <div key={f} className="flex items-center gap-2">
                <Check className="w-4 h-4 text-primary shrink-0" />
                <span>{f}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="text-center mt-10">
          <p className="text-sm text-muted-foreground mb-4">
            Preços em reais (BRL). Cancele quando quiser. Sem taxa de setup.
          </p>
          <Link to="/ecosystems/new">
            <Button size="lg">Criar meu ecossistema agora</Button>
          </Link>
        </div>
      </div>
    </div>
  );
}
