import { useEffect, useState } from "react";
import { Music, Loader2, Play, Square, RotateCcw } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  isNativeApp,
  getNativeRingtone,
  pickNativeRingtone,
  clearNativeRingtone,
  previewNativeRingtone,
  stopPreviewNativeRingtone,
} from "@/integrations/native-call";

export function RingtoneSettings() {
  // Custom ringtone picking is only available on the native Android app.
  if (!isNativeApp()) return null;

  const [name, setName] = useState<string | null>(null);
  const [isDefault, setIsDefault] = useState(true);
  const [busy, setBusy] = useState(false);
  const [playing, setPlaying] = useState(false);

  useEffect(() => {
    getNativeRingtone().then((r) => {
      if (!r) return;
      setName(r.name);
      setIsDefault(r.isDefault);
    });
    return () => {
      stopPreviewNativeRingtone().catch(() => {});
    };
  }, []);

  async function pick() {
    setBusy(true);
    try {
      const r = await pickNativeRingtone();
      if (!r || r.cancelled) return;
      if (!r.ok) {
        toast.error("Não foi possível selecionar o arquivo");
        return;
      }
      setName(r.name ?? "Toque personalizado");
      setIsDefault(false);
      toast.success("Toque atualizado");
    } finally {
      setBusy(false);
    }
  }

  async function reset() {
    setBusy(true);
    try {
      await clearNativeRingtone();
      setName(null);
      setIsDefault(true);
      toast.success("Toque padrão restaurado");
    } finally {
      setBusy(false);
    }
  }

  async function togglePreview() {
    if (playing) {
      await stopPreviewNativeRingtone();
      setPlaying(false);
      return;
    }
    await previewNativeRingtone();
    setPlaying(true);
    // Preview auto-stops after 5s on native; mirror that on the UI.
    setTimeout(() => setPlaying(false), 5000);
  }

  return (
    <div className="rounded-xl border border-border p-4 sm:p-5">
      <div className="flex items-start gap-3">
        <div className="size-10 rounded-lg bg-primary/10 grid place-items-center shrink-0">
          <Music className="size-5 text-primary" />
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="font-semibold">Toque de chamada</h3>
          <p className="text-sm text-muted-foreground mt-0.5">
            Escolha qualquer música ou áudio do seu celular como toque. O som
            é reproduzido em volume máximo para chamar sua atenção.
          </p>

          <div className="mt-3 text-xs">
            <span className="text-muted-foreground">Atual: </span>
            <span className="font-medium">
              {isDefault ? "Toque padrão do sistema" : name ?? "Toque personalizado"}
            </span>
          </div>

          <div className="mt-4 flex flex-wrap gap-2">
            <Button size="sm" onClick={pick} disabled={busy}>
              {busy && <Loader2 className="size-3.5 animate-spin mr-1.5" />}
              Escolher música/áudio
            </Button>
            <Button size="sm" variant="secondary" onClick={togglePreview} disabled={busy}>
              {playing ? (
                <>
                  <Square className="size-3.5 mr-1.5" />
                  Parar
                </>
              ) : (
                <>
                  <Play className="size-3.5 mr-1.5" />
                  Testar
                </>
              )}
            </Button>
            {!isDefault && (
              <Button size="sm" variant="ghost" onClick={reset} disabled={busy}>
                <RotateCcw className="size-3.5 mr-1.5" />
                Restaurar padrão
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
