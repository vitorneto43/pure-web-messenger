import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { ArrowLeft, Loader2, Video, Copy, ExternalLink } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { getEcosystemBySlug, getMyRole, type Ecosystem, type EcosystemRole } from "@/lib/ecosystems";
import { useAuth } from "@/hooks/use-auth";

export const Route = createFileRoute("/e/$slug/meet")({
  component: EcosystemMeet,
  head: () => ({
    meta: [
      { title: "Meet — Ecossistema Wavechat" },
      { name: "description", content: "Entre em uma reunião por vídeo do ecossistema." },
      { name: "robots", content: "noindex" },
    ],
  }),
});

function EcosystemMeet() {
  const { slug } = Route.useParams();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [eco, setEco] = useState<Ecosystem | null | undefined>(undefined);
  const [role, setRole] = useState<EcosystemRole | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const e = await getEcosystemBySlug(slug);
        setEco(e);
        if (e && user) setRole(await getMyRole(e.id));
      } catch {
        setEco(null);
      }
    })();
  }, [slug, user?.id]);

  useEffect(() => {
    if (eco && role) {
      const roomId = `eco-${slug}-${eco.id.slice(0, 8)}`;
      navigate({ to: "/meet/$roomId", params: { roomId } });
    }
  }, [eco, role]);

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
        <p className="text-sm text-muted-foreground">Ecossistema não encontrado.</p>
      </div>
    );
  }
  if (!role) {
    return (
      <div className="min-h-screen grid place-items-center text-center p-6">
        <p className="text-sm text-muted-foreground">Você precisa fazer parte do ecossistema para entrar no Meet.</p>
      </div>
    );
  }

  const roomId = `eco-${slug}-${eco.id.slice(0, 8)}`;
  const meetUrl = `${typeof window !== "undefined" ? window.location.origin : ""}/meet/${roomId}`;

  return (
    <div className="min-h-screen bg-background grid place-items-center text-center p-6">
      <div className="max-w-sm">
        <Button asChild size="icon" variant="ghost" className="absolute top-3 left-3">
          <Link to="/e/$slug" params={{ slug }}><ArrowLeft className="size-5" /></Link>
        </Button>
        <Video className="size-12 mx-auto text-primary mb-3" />
        <h1 className="text-lg font-bold mb-1">Reunião do {eco.name}</h1>
        <p className="text-sm text-muted-foreground mb-4">Entre na sala de videoconferência exclusiva do ecossistema.</p>
        <Button asChild className="w-full rounded-full">
          <Link to="/meet/$roomId" params={{ roomId }}>
            <ExternalLink className="size-4 mr-1.5" /> Entrar no Meet
          </Link>
        </Button>
        <div className="mt-4 flex items-center gap-2 rounded-xl border border-border p-2">
          <code className="flex-1 text-xs text-left truncate">{meetUrl}</code>
          <Button
            size="sm"
            variant="outline"
            onClick={async () => {
              try {
                await navigator.clipboard.writeText(meetUrl);
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
    </div>
  );
}
