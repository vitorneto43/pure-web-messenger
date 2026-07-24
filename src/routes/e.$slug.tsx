import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { ArrowLeft, Loader2, Users, Copy, Settings2, Building2, Globe2, Mail, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useAuth } from "@/hooks/use-auth";
import { useEcosystems } from "@/hooks/use-ecosystem";
import { getEcosystemBySlug, getMyRole, listEcosystemPosts, type Ecosystem, type EcosystemRole, CATEGORIES } from "@/lib/ecosystems";

export const Route = createFileRoute("/e/$slug")({
  component: EcosystemHome,
  head: () => ({
    meta: [
      { title: "Ecossistema — Wavechat" },
      { name: "description", content: "Espaço privado dentro da Wavechat." },
      { name: "robots", content: "noindex" },
    ],
  }),
});

function EcosystemHome() {
  const { slug } = Route.useParams();
  const { user } = useAuth();
  const { setCurrentEcosystemId } = useEcosystems();
  const navigate = useNavigate();
  const [eco, setEco] = useState<Ecosystem | null | undefined>(undefined);
  const [role, setRole] = useState<EcosystemRole | null>(null);
  const [posts, setPosts] = useState<any[]>([]);
  const [loadingPosts, setLoadingPosts] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const e = await getEcosystemBySlug(slug);
        setEco(e);
        if (e && user) {
          const r = await getMyRole(e.id);
          setRole(r);
          if (r) {
            setCurrentEcosystemId(e.id);
            setLoadingPosts(true);
            try {
              const list = await listEcosystemPosts(e.id);
              setPosts(list);
            } finally {
              setLoadingPosts(false);
            }
          }
        }
      } catch {
        setEco(null);
      }
    })();
  }, [slug, user?.id]);

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
  if (!role) {
    return (
      <div className="min-h-screen grid place-items-center text-center p-6">
        <div className="max-w-sm">
          <div className="size-16 rounded-2xl bg-primary/10 grid place-items-center mx-auto mb-3">
            <Building2 className="size-8 text-primary" />
          </div>
          <h1 className="text-lg font-bold">{eco.name}</h1>
          <p className="text-sm text-muted-foreground mb-4">
            Este é um ecossistema privado. Você precisa de um convite para entrar.
          </p>
          <Button asChild variant="outline"><Link to="/">Voltar</Link></Button>
        </div>
      </div>
    );
  }

  const isAdmin = role === "owner" || role === "admin";
  const catLabel = CATEGORIES.find((c) => c.value === eco.category)?.label ?? "Ecossistema";

  const inviteUrl = eco.join_code
    ? `${typeof window !== "undefined" ? window.location.origin : ""}/join/${eco.join_code}`
    : null;

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-10 bg-background/85 backdrop-blur border-b border-border">
        <div className="mx-auto max-w-[640px] flex items-center gap-2 px-3 py-2.5">
          <Button size="icon" variant="ghost" onClick={() => navigate({ to: "/" })} aria-label="Voltar">
            <ArrowLeft className="size-5" />
          </Button>
          <Avatar className="size-9 shrink-0">
            <AvatarImage src={eco.logo_url ?? undefined} />
            <AvatarFallback>{eco.name[0]?.toUpperCase()}</AvatarFallback>
          </Avatar>
          <div className="min-w-0 flex-1">
            <h1 className="text-sm font-bold leading-tight truncate">{eco.name}</h1>
            <p className="text-[11px] text-muted-foreground leading-tight truncate">{catLabel}</p>
          </div>
          {isAdmin && (
            <Button asChild size="icon" variant="ghost" aria-label="Configurações">
              <Link to="/e/$slug/admin" params={{ slug }}>
                <Settings2 className="size-5" />
              </Link>
            </Button>
          )}
        </div>
      </header>

      <main className="mx-auto max-w-[640px] px-3 py-4 space-y-4">
        {eco.banner_url && (
          <img src={eco.banner_url} alt="" className="w-full aspect-[4/1] object-cover rounded-2xl" />
        )}

        {eco.description && (
          <p className="text-sm text-foreground/80 whitespace-pre-wrap">{eco.description}</p>
        )}

        <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
          <span className="inline-flex items-center gap-1"><Users className="size-3.5" /> {catLabel}</span>
          {eco.website && (
            <a href={eco.website} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 hover:underline">
              <Globe2 className="size-3.5" /> {eco.website.replace(/^https?:\/\//, "")}
            </a>
          )}
          {eco.contact_email && (
            <a href={`mailto:${eco.contact_email}`} className="inline-flex items-center gap-1 hover:underline">
              <Mail className="size-3.5" /> {eco.contact_email}
            </a>
          )}
        </div>

        {isAdmin && inviteUrl && (
          <div className="rounded-2xl border border-primary/30 bg-primary/5 p-3">
            <div className="text-xs font-semibold mb-1">Convidar membros</div>
            <p className="text-[11px] text-muted-foreground mb-2">
              Compartilhe este link com quem você quer trazer para <strong>{eco.name}</strong>.
            </p>
            <div className="flex items-center gap-2">
              <code className="flex-1 text-xs bg-background px-2 py-1.5 rounded-md border border-border truncate">
                {inviteUrl}
              </code>
              <Button
                size="sm"
                variant="outline"
                onClick={async () => {
                  try {
                    await navigator.clipboard.writeText(inviteUrl);
                    toast.success("Link copiado!");
                  } catch {
                    toast.error("Não foi possível copiar.");
                  }
                }}
              >
                <Copy className="size-3.5 mr-1" /> Copiar
              </Button>
            </div>
          </div>
        )}

        <div className="rounded-2xl border border-border bg-card p-4 text-sm text-muted-foreground">
          O feed interno deste ecossistema será exibido aqui. Enquanto isso, todos os posts, stories, lives e vídeos publicados com destino <strong>{eco.name}</strong> já ficam salvos com segurança e visíveis apenas para membros.
        </div>
      </main>
    </div>
  );
}
