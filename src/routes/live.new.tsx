import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Radio } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/live/new")({
  head: () => ({
    meta: [{ title: "Iniciar live — WaveChat" }, { name: "robots", content: "noindex" }],
  }),
  component: NewLive,
});

function NewLive() {
  const navigate = useNavigate();
  const [title, setTitle] = useState("");
  const [busy, setBusy] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setUserId(data.user?.id ?? null));
  }, []);

  async function start() {
    if (!userId) {
      navigate({ to: "/auth" });
      return;
    }
    setBusy(true);
    const { data, error } = await supabase.rpc("start_live", { p_title: title, p_cover_url: null });
    setBusy(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    const live = Array.isArray(data) ? data[0] : data;
    if (live?.id) navigate({ to: "/live/$liveId", params: { liveId: live.id } });
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-6 bg-background">
      <div className="w-full max-w-md space-y-6">
        <div className="text-center">
          <div className="w-16 h-16 rounded-full bg-gradient-to-br from-red-500 to-pink-600 flex items-center justify-center mx-auto mb-3">
            <Radio className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-2xl font-bold">Iniciar uma live</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Sua câmera e microfone serão usados para transmitir ao vivo.
          </p>
        </div>
        <div className="space-y-3">
          <label className="text-sm font-medium">Título da live</label>
          <Input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Ex: Bate-papo da noite 🎙️"
            maxLength={120}
          />
        </div>
        <Button
          onClick={start}
          disabled={busy}
          size="lg"
          className="w-full bg-red-600 hover:bg-red-700 text-white"
        >
          {busy ? "Criando…" : "Começar transmissão"}
        </Button>
        <p className="text-xs text-center text-muted-foreground">
          Ao iniciar, qualquer pessoa poderá entrar na sua live.
        </p>
      </div>
    </div>
  );
}
