import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useAuth } from "@/hooks/use-auth";
import { listMyRecordings, getRecordingSignedUrl, togglePublishRecording, deleteRecording } from "@/lib/recordings.functions";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Video, Trash2, Download, ArrowLeft, Loader2 } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/recordings")({
  head: () => ({ meta: [{ title: "Minhas gravações — WaveChat" }, { name: "robots", content: "noindex" }] }),
  component: RecordingsPage,
});

function RecordingsPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [items, setItems] = useState<Awaited<ReturnType<typeof listMyRecordings>>>([]);
  const [loading, setLoading] = useState(true);

  async function refresh() {
    setLoading(true);
    try {
      const r = await listMyRecordings();
      setItems(r);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { if (user) refresh(); }, [user?.id]);

  async function open(id: string) {
    try {
      const { url } = await getRecordingSignedUrl({ data: { id } });
      window.open(url, "_blank");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro");
    }
  }

  async function togglePublic(id: string, v: boolean) {
    await togglePublishRecording({ data: { id, isPublic: v } });
    toast.success(v ? "Gravação pública" : "Gravação privada");
    refresh();
  }

  async function remove(id: string) {
    if (!confirm("Apagar esta gravação?")) return;
    await deleteRecording({ data: { id } });
    toast.success("Removida");
    refresh();
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="flex items-center gap-2 p-4 border-b">
        <Button variant="ghost" size="icon" onClick={() => navigate({ to: "/live" })}>
          <ArrowLeft className="size-5" />
        </Button>
        <h1 className="text-xl font-bold flex items-center gap-2">
          <Video className="size-5 text-red-500" /> Minhas gravações
        </h1>
      </header>
      {loading ? (
        <div className="p-6 text-center"><Loader2 className="size-5 animate-spin mx-auto" /></div>
      ) : items.length === 0 ? (
        <div className="p-8 text-center text-muted-foreground">
          <Video className="size-12 mx-auto opacity-30 mb-2" />
          <p>Você ainda não gravou nenhuma live.</p>
          <Link to="/live/new"><Button className="mt-3">Iniciar uma live</Button></Link>
        </div>
      ) : (
        <ul className="divide-y">
          {items.map((r) => (
            <li key={r.id} className="p-4 flex items-center gap-3">
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold">{new Date(r.created_at).toLocaleString("pt-BR")}</p>
                <p className="text-xs text-muted-foreground">
                  Status: <span className="font-medium">{r.status}</span>
                  {r.duration_sec ? ` · ${Math.round(r.duration_sec / 60)} min` : ""}
                  {r.size_bytes ? ` · ${(Number(r.size_bytes) / 1024 / 1024).toFixed(1)} MB` : ""}
                </p>
                {r.status === "ready" && (
                  <div className="mt-1 flex items-center gap-2 text-xs">
                    <Switch
                      checked={r.is_public}
                      onCheckedChange={(v) => togglePublic(r.id, v)}
                    />
                    <span>{r.is_public ? "Pública" : "Privada"}</span>
                  </div>
                )}
              </div>
              <div className="flex items-center gap-1">
                {r.status === "ready" && (
                  <Button size="icon" variant="ghost" onClick={() => open(r.id)}><Download className="size-4" /></Button>
                )}
                <Button size="icon" variant="ghost" onClick={() => remove(r.id)}><Trash2 className="size-4 text-destructive" /></Button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
