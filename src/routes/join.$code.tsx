import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/use-auth";
import { joinByCode } from "@/lib/ecosystems";
import { logAppEvent } from "@/lib/analytics-events";
import { useEcosystems } from "@/hooks/use-ecosystem";

export const Route = createFileRoute("/join/$code")({
  component: JoinPage,
  head: () => ({
    meta: [
      { title: "Entrar em ecossistema — Wavechat" },
      { name: "robots", content: "noindex" },
    ],
  }),
});

function JoinPage() {
  const { code } = Route.useParams();
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const { refresh } = useEcosystems();
  const [status, setStatus] = useState<"idle" | "working" | "error">("idle");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      navigate({ to: "/auth", search: { mode: "login" } });
      return;
    }
    (async () => {
      setStatus("working");
      try {
        const eco = await joinByCode(code);
        logAppEvent("join_group", { group_type: "ecosystem", group_id: eco.id, method: "invite_code" });
        await refresh();
        toast.success(`Você entrou em ${eco.name}!`);
        navigate({ to: "/e/$slug", params: { slug: eco.slug } });
      } catch (e: any) {
        setError(e.message ?? "Não foi possível entrar.");
        setStatus("error");
      }
    })();
  }, [authLoading, user?.id, code]);

  return (
    <div className="min-h-screen grid place-items-center p-6 text-center">
      {status === "error" ? (
        <div>
          <p className="text-sm text-destructive mb-3">{error}</p>
          <Button variant="outline" onClick={() => navigate({ to: "/" })}>Voltar</Button>
        </div>
      ) : (
        <div className="flex flex-col items-center gap-3 text-muted-foreground">
          <Loader2 className="size-6 animate-spin" />
          <span className="text-sm">Entrando no ecossistema…</span>
        </div>
      )}
    </div>
  );
}
