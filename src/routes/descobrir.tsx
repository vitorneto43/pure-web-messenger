import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Loader2, ArrowLeft, Users, MessageCircle, Phone, Heart, Sparkles, HelpCircle } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useAuth } from "@/hooks/use-auth";
import { getRecommendedProfilesPublic, type PublicProfile } from "@/lib/public-discover.functions";
import wavechatLogo from "@/assets/wavechat-logo.png.asset.json";

export const Route = createFileRoute("/descobrir")({
  component: DiscoverPage,
  head: () => ({
    meta: [
      { title: "Descobrir pessoas no WaveChat — sem precisar de conta" },
      { name: "description", content: "Veja perfis públicos, descubra pessoas interessantes e conheça o WaveChat antes de criar sua conta." },
      { property: "og:title", content: "Descobrir pessoas no WaveChat" },
      { property: "og:description", content: "Explore perfis públicos e veja o que está acontecendo no WaveChat." },
    ],
  }),
});

function DiscoverPage() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [profiles, setProfiles] = useState<PublicProfile[] | null>(null);

  useEffect(() => {
    getRecommendedProfilesPublic({ data: { limit: 30 } })
      .then((r) => setProfiles(r.profiles))
      .catch(() => setProfiles([]));
  }, []);

  return (
    <div className="min-h-screen">
      <header className="sticky top-0 z-10 bg-background/80 backdrop-blur border-b border-border">
        <div className="mx-auto max-w-3xl flex items-center justify-between px-4 py-3">
          <Link to="/" className="flex items-center gap-2">
            <img src={wavechatLogo.url} alt="WaveChat" className="size-7 rounded-lg" />
            <span className="font-bold">WaveChat</span>
          </Link>
          {user ? (
            <Button size="sm" onClick={() => navigate({ to: "/chat" })}>Ir para chat</Button>
          ) : (
            <div className="flex gap-2">
              <Button size="sm" variant="ghost" onClick={() => navigate({ to: "/auth" })}>Entrar</Button>
              <Button size="sm" onClick={() => navigate({ to: "/auth" })}>Criar conta</Button>
            </div>
          )}
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-4 py-6 space-y-8">
        {!user && (
          <section className="rounded-2xl border border-border bg-card p-5">
            <div className="flex items-center gap-2 mb-3">
              <Sparkles className="size-5 text-primary" />
              <h1 className="text-lg font-bold">Explore sem cadastro</h1>
            </div>
            <p className="text-sm text-muted-foreground mb-4">
              Veja como o WaveChat funciona antes de criar sua conta. Quando quiser interagir, é grátis.
            </p>
            <div className="grid grid-cols-2 gap-2 text-sm">
              <FeatureItem icon="check" label="Ver perfis públicos" />
              <FeatureItem icon="check" label="Ver pessoas recomendadas" />
              <FeatureItem icon="check" label="Conhecer o app" />
              <FeatureItem icon="check" label="Ver funcionalidades" />
              <FeatureItem icon="lock" label="Enviar mensagens" />
              <FeatureItem icon="lock" label="Seguir pessoas" />
              <FeatureItem icon="lock" label="Criar status" />
              <FeatureItem icon="lock" label="Fazer chamadas" />
            </div>
          </section>
        )}

        <section>
          <div className="flex items-center gap-2 mb-3">
            <Users className="size-5 text-primary" />
            <h2 className="text-base font-bold">Pessoas no WaveChat</h2>
          </div>
          {profiles === null ? (
            <div className="flex justify-center py-12">
              <Loader2 className="size-6 animate-spin text-muted-foreground" />
            </div>
          ) : profiles.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">Nenhum perfil público disponível agora.</p>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              {profiles.map((p) => (
                <Link
                  key={p.id}
                  to="/u/$username"
                  params={{ username: p.username }}
                  className="flex flex-col items-center gap-2 p-4 rounded-xl border border-border bg-card hover:bg-accent/30 transition"
                >
                  <Avatar className="size-16">
                    <AvatarImage src={p.avatar_url ?? undefined} />
                    <AvatarFallback>{(p.display_name ?? p.username).slice(0, 2).toUpperCase()}</AvatarFallback>
                  </Avatar>
                  <div className="text-center min-w-0 w-full">
                    <p className="text-sm font-semibold truncate">{p.display_name}</p>
                    <p className="text-xs text-muted-foreground truncate">@{p.username}</p>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </section>

        {!user && (
          <section className="rounded-2xl border border-primary/30 bg-primary/5 p-5 text-center">
            <h3 className="font-bold mb-1">Pronto pra conversar?</h3>
            <p className="text-sm text-muted-foreground mb-4">Crie sua conta gratuita e comece a usar todas as funcionalidades.</p>
            <div className="flex flex-col sm:flex-row gap-2 justify-center">
              <Button onClick={() => navigate({ to: "/auth" })}>Criar conta grátis</Button>
              <Button variant="outline" onClick={() => navigate({ to: "/auth" })}>Já tenho conta</Button>
            </div>
            <div className="mt-4 flex justify-center gap-4 text-xs text-muted-foreground">
              <span className="inline-flex items-center gap-1"><MessageCircle className="size-3.5" /> Mensagens</span>
              <span className="inline-flex items-center gap-1"><Phone className="size-3.5" /> Chamadas</span>
              <span className="inline-flex items-center gap-1"><Heart className="size-3.5" /> Status</span>
            </div>
          </section>
        )}
      </main>
    </div>
  );
}

function FeatureItem({ icon, label }: { icon: "check" | "lock"; label: string }) {
  return (
    <div className="flex items-center gap-2">
      <span className={icon === "check" ? "text-green-500" : "text-muted-foreground"}>
        {icon === "check" ? "✅" : "🔒"}
      </span>
      <span className={icon === "check" ? "" : "text-muted-foreground"}>{label}</span>
    </div>
  );
}
