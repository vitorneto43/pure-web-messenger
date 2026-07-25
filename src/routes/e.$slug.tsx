import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { ArrowLeft, Loader2, Users, Copy, Settings2, Building2, Globe2, Mail, Sparkles, MessageCircle, Radio, PlaySquare, Flame, Video, ArrowRight } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { optimizeAvatarUrl } from "@/lib/avatar-optimize";
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
            <AvatarImage src={optimizeAvatarUrl(eco.logo_url ?? undefined, 18)} />
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

        <div className="rounded-2xl border border-border bg-card overflow-hidden">
          <div className="px-3 py-2 border-b border-border bg-muted/40">
            <div className="text-xs font-semibold">Ecossistema Wavechat</div>
            <div className="text-[10px] text-muted-foreground">Tudo da Wavechat, só para membros.</div>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-1 p-2">
            <EcoAction icon={<MessageCircle className="size-4" />} label="Chat" hint="Conversas em grupo" to="/e/$slug/chat" params={{ slug }} />
            <EcoAction icon={<Radio className="size-4" />} label="Lives" hint="Transmissões ao vivo" to="/e/$slug/live" params={{ slug }} />
            <EcoAction icon={<PlaySquare className="size-4" />} label="WaveTube" hint="Vídeos 16:9" to="/e/$slug/wavetube" params={{ slug }} />
            <EcoAction icon={<Flame className="size-4" />} label="WaveShorts" hint="Vídeos curtos" to="/e/$slug/waveshorts" params={{ slug }} />
            <EcoAction icon={<Video className="size-4" />} label="Meet" hint="Reuniões por vídeo" to="/e/$slug/meet" params={{ slug }} />
            {isAdmin && (
              <EcoAction icon={<Settings2 className="size-4" />} label="Admin" hint="Gerenciar ecossistema" to="/e/$slug/admin" params={{ slug }} />
            )}
          </div>
        </div>

        <div>
          <div className="text-xs font-semibold text-muted-foreground mb-2 px-1">Feed do ecossistema</div>
          {loadingPosts && (
            <div className="grid place-items-center py-10">
              <Loader2 className="size-5 animate-spin text-muted-foreground" />
            </div>
          )}
          {!loadingPosts && posts.length === 0 && (
            <div className="rounded-2xl border border-border bg-card p-6 text-center">
              <Sparkles className="size-8 mx-auto text-primary mb-2" />
              <p className="text-sm font-medium">Nenhuma publicação ainda</p>
              <p className="text-xs text-muted-foreground mt-1">
                Publique um post e escolha <strong>{eco.name}</strong> como destino para começar o feed interno.
              </p>
            </div>
          )}
          {!loadingPosts && posts.length > 0 && (
            <ul className="space-y-2">
              {posts.map((p: any) => (
                <li key={p.id} className="rounded-2xl border border-border bg-card p-3">
                  <div className="flex items-center gap-2 mb-1.5">
                    <Avatar className="size-7">
                      <AvatarImage src={optimizeAvatarUrl(p.author?.avatar_url ?? undefined, 14)} />
                      <AvatarFallback>{(p.author?.display_name ?? p.author?.username ?? "?")[0]?.toUpperCase()}</AvatarFallback>
                    </Avatar>
                    <div className="min-w-0 flex-1">
                      <div className="text-xs font-semibold truncate">
                        {p.author?.display_name ?? p.author?.username ?? "Membro"}
                      </div>
                      <div className="text-[10px] text-muted-foreground">
                        {new Date(p.created_at).toLocaleString("pt-BR")}
                      </div>
                    </div>
                  </div>
                  {p.content && (
                    <p className="text-sm whitespace-pre-wrap break-words">{p.content}</p>
                  )}
                  {p.media_url && p.kind === "image" && (
                    <img src={p.media_url} alt="" className="mt-2 rounded-lg w-full object-cover max-h-96" />
                  )}
                  {p.media_url && p.kind === "video" && (
                    <video src={p.media_url} controls className="mt-2 rounded-lg w-full max-h-96" />
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>
      </main>
    </div>
  );
}

function EcoAction({
  icon, label, hint, to, params,
}: {
  icon: React.ReactNode;
  label: string;
  hint: string;
  to: string;
  params: Record<string, string>;
}) {
  return (
    <Link
      to={to as any}
      params={params as any}
      className="flex items-center gap-3 rounded-xl p-2.5 hover:bg-muted/60 transition-colors"
    >
      <div className="size-9 rounded-lg bg-primary/10 text-primary grid place-items-center shrink-0">
        {icon}
      </div>
      <div className="min-w-0 flex-1">
        <div className="text-sm font-semibold flex items-center gap-1">
          <span className="truncate">{label}</span>
          <ArrowRight className="size-3.5 text-muted-foreground shrink-0" />
        </div>
        <div className="text-[11px] text-muted-foreground truncate">{hint}</div>
      </div>
    </Link>
  );
}
