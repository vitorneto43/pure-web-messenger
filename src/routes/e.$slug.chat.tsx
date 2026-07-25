import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Loader2, ArrowLeft, MessageCircle } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { getEcosystemBySlug, getMyRole, type Ecosystem, type EcosystemRole } from "@/lib/ecosystems";

export const Route = createFileRoute("/e/$slug/chat")({
  component: EcosystemChatRedirect,
  head: () => ({
    meta: [
      { title: "Chat — Ecossistema Wavechat" },
      { name: "description", content: "Acesse o chat do ecossistema." },
      { name: "robots", content: "noindex" },
    ],
  }),
});

function EcosystemChatRedirect() {
  const { slug } = Route.useParams();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [eco, setEco] = useState<Ecosystem | null | undefined>(undefined);
  const [role, setRole] = useState<EcosystemRole | null>(null);
  const [busy, setBusy] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const e = await getEcosystemBySlug(slug);
        setEco(e);
        if (!e || !user) return;
        const r = await getMyRole(e.id);
        setRole(r);
        if (!r) { setBusy(false); return; }

        const { data, error } = await supabase.rpc("get_or_create_ecosystem_conversation", {
          _ecosystem_id: e.id,
        });
        if (error) throw error;
        navigate({ to: "/chat/$conversationId", params: { conversationId: data as string } });
      } catch (e: any) {
        toast.error("Não foi possível abrir o chat", { description: e?.message });
        setBusy(false);
      }
    })();
  }, [slug, user?.id]);

  if (eco === undefined || busy) {
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
        <div className="max-w-sm">
          <MessageCircle className="size-12 mx-auto text-muted-foreground mb-3" />
          <p className="text-sm text-muted-foreground">Você precisa fazer parte do ecossistema para acessar o chat.</p>
          <Button asChild className="mt-4" variant="outline"><Link to="/">Voltar</Link></Button>
        </div>
      </div>
    );
  }
  return (
    <div className="min-h-screen grid place-items-center text-center p-6">
      <Loader2 className="size-6 animate-spin text-muted-foreground" />
    </div>
  );
}
