import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Radio, Video } from "lucide-react";
import { toast } from "sonner";
import { notifyLiveStart } from "@/lib/live-push.functions";
import { SchedulePicker } from "@/components/SchedulePicker";
import { scheduleLive } from "@/lib/schedule.functions";
import { startLiveRecording, getRecordingConfig } from "@/lib/recordings.functions";
import { PolicyHint } from "@/components/PolicyHint";
import { scanLocally } from "@/lib/content-policy";

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
  const [scheduledAt, setScheduledAt] = useState<string | null>(null);
  const [willRecord, setWillRecord] = useState(false);
  const [recordingAvailable, setRecordingAvailable] = useState(true);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setUserId(data.user?.id ?? null));
    getRecordingConfig()
      .then((c) => setRecordingAvailable(c.enabled))
      .catch(() => setRecordingAvailable(false));
  }, []);

  const isScheduled = !!scheduledAt && new Date(scheduledAt).getTime() > Date.now() + 30_000;

  async function start() {
    if (!userId) {
      navigate({ to: "/auth", search: { mode: "login" } });
      return;
    }
    const policy = scanLocally(title, "live");
    if (policy.verdict === "block") {
      toast.error("Título bloqueado pelas Diretrizes", { description: policy.reasons[0] });
      return;
    }
    setBusy(true);
    try {
      if (isScheduled) {
        await scheduleLive({
          data: { title: title.trim() || "Live agendada", scheduled_at: scheduledAt!, will_record: willRecord },
        });
        toast.success("Live agendada!", { description: new Date(scheduledAt!).toLocaleString("pt-BR") });
        navigate({ to: "/live" });
        return;
      }

      const { data, error } = await supabase.rpc("start_live", { p_title: title });
      if (error) throw error;
      const live = Array.isArray(data) ? data[0] : data;
      if (!live?.id) throw new Error("Falha ao iniciar live");

      notifyLiveStart({ data: { liveId: live.id } }).catch((e) =>
        console.error("notifyLiveStart failed", e),
      );

      if (willRecord && recordingAvailable) {
        try {
          await startLiveRecording({ data: { liveId: live.id } });
        } catch (e) {
          console.error("startLiveRecording failed", e);
          toast.error("Não foi possível iniciar a gravação", {
            description: e instanceof Error ? e.message : "Tente novamente pelo botão dentro da live.",
          });
        }
      }
      navigate({ to: "/live/$liveId", params: { liveId: live.id } });
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Falha ao iniciar");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-6 bg-background">
      <div className="w-full max-w-md space-y-6">
        <div className="text-center">
          <div className="w-16 h-16 rounded-full bg-gradient-to-br from-red-500 to-pink-600 flex items-center justify-center mx-auto mb-3">
            <Radio className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-2xl font-bold">{isScheduled ? "Agendar uma live" : "Iniciar uma live"}</h1>
          <p className="text-sm text-muted-foreground mt-1">
            {isScheduled
              ? "Seus seguidores serão avisados 30 minutos antes."
              : "Sua câmera e microfone serão usados para transmitir ao vivo."}
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
          <PolicyHint text={title} kind="live" className="mt-2" />
        </div>

        <div className="rounded-lg border border-border bg-muted/30 p-3">
          <SchedulePicker value={scheduledAt} onChange={setScheduledAt} label="Programar para" />
        </div>

        <div className="rounded-lg border border-border bg-muted/30 p-3 flex items-center justify-between gap-3">
          <div className="flex items-start gap-2">
            <Video className="size-4 mt-0.5 text-primary" />
            <div>
              <p className="text-sm font-medium leading-tight">Gravar esta live</p>
              <p className="text-[11px] text-muted-foreground">
                {recordingAvailable
                  ? "A gravação ficará disponível em \"Minhas gravações\" quando a live acabar."
                  : "Gravação ainda não habilitada nesta conta."}
              </p>
            </div>
          </div>
          <Switch checked={willRecord} onCheckedChange={setWillRecord} disabled={!recordingAvailable} />
        </div>

        <Button
          onClick={start}
          disabled={busy}
          size="lg"
          className="w-full bg-red-600 hover:bg-red-700 text-white"
        >
          {busy ? "Salvando…" : isScheduled ? "Agendar live" : "Começar transmissão"}
        </Button>
        <p className="text-xs text-center text-muted-foreground">
          {isScheduled
            ? "Você pode entrar pela página de live na hora marcada."
            : "Ao iniciar, qualquer pessoa poderá entrar na sua live."}
        </p>
      </div>
    </div>
  );
}
