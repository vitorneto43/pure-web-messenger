import { useState } from "react";
import { MapPin, Radio, Loader2 } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  conversationId: string;
  userId: string;
  onSent: (message: {
    content: string;
    attachment_url: string;
    attachment_type: string;
  }) => Promise<void> | void;
}

const DURATIONS: { label: string; minutes: number }[] = [
  { label: "15 minutos", minutes: 15 },
  { label: "1 hora", minutes: 60 },
  { label: "8 horas", minutes: 480 },
];

async function getPosition(): Promise<{ coords: { latitude: number; longitude: number; accuracy: number } }> {
  // Use Capacitor Geolocation on native (handles permissions properly)
  try {
    const { Capacitor } = await import("@capacitor/core");
    if (Capacitor.isNativePlatform()) {
      const { Geolocation } = await import("@capacitor/geolocation");
      const perm = await Geolocation.checkPermissions();
      if (perm.location !== "granted" && perm.coarseLocation !== "granted") {
        const req = await Geolocation.requestPermissions({ permissions: ["location", "coarseLocation"] });
        if (req.location !== "granted" && req.coarseLocation !== "granted") {
          throw new Error("Permissão de localização negada. Habilite nas configurações do app.");
        }
      }
      const pos = await Geolocation.getCurrentPosition({ enableHighAccuracy: true, timeout: 15000 });
      return { coords: { latitude: pos.coords.latitude, longitude: pos.coords.longitude, accuracy: pos.coords.accuracy } };
    }
  } catch (e: any) {
    if (e?.message?.includes("Permissão")) throw e;
    // fall through to web API
  }

  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) {
      reject(new Error("Geolocalização não suportada"));
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (p) => resolve({ coords: { latitude: p.coords.latitude, longitude: p.coords.longitude, accuracy: p.coords.accuracy } }),
      (err) => {
        if (err.code === err.PERMISSION_DENIED) {
          reject(new Error("Permissão de localização negada. Habilite nas configurações do navegador/app."));
        } else if (err.code === err.POSITION_UNAVAILABLE) {
          reject(new Error("Localização indisponível. Verifique se o GPS está ativado."));
        } else if (err.code === err.TIMEOUT) {
          reject(new Error("Tempo esgotado ao obter localização."));
        } else {
          reject(new Error(err.message || "Falha ao obter localização"));
        }
      },
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 }
    );
  });
}

export function ShareLocationDialog({
  open,
  onOpenChange,
  conversationId,
  userId,
  onSent,
}: Props) {
  const [loading, setLoading] = useState<string | null>(null);

  async function sendStatic() {
    setLoading("static");
    try {
      const pos = await getPosition();
      const { latitude, longitude } = pos.coords;
      await onSent({
        content: "📍 Localização",
        attachment_url: `geo:${latitude},${longitude}`,
        attachment_type: "location",
      });
      onOpenChange(false);
    } catch (e: any) {
      toast.error(e.message ?? "Falha ao obter localização");
    } finally {
      setLoading(null);
    }
  }

  async function sendLive(minutes: number) {
    setLoading(`live-${minutes}`);
    try {
      const pos = await getPosition();
      const { latitude, longitude, accuracy } = pos.coords;
      const expiresAt = new Date(Date.now() + minutes * 60_000).toISOString();

      const { data: row, error } = await (supabase as any)
        .from("live_locations")
        .insert({
          user_id: userId,
          conversation_id: conversationId,
          latitude,
          longitude,
          accuracy,
          expires_at: expiresAt,
        })
        .select("id")
        .single();

      if (error || !row) throw error ?? new Error("Falha");

      await onSent({
        content: `📡 Localização ao vivo (${minutes < 60 ? `${minutes}m` : `${minutes / 60}h`})`,
        attachment_url: `live:${row.id}`,
        attachment_type: "live-location",
      });
      toast.success("Compartilhando localização ao vivo");
      onOpenChange(false);
    } catch (e: any) {
      toast.error(e.message ?? "Falha ao iniciar compartilhamento");
    } finally {
      setLoading(null);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Compartilhar localização</DialogTitle>
          <DialogDescription>
            Envie sua posição atual ou compartilhe ao vivo por um período.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-2">
          <Button
            variant="outline"
            className="w-full justify-start h-auto py-3"
            disabled={loading !== null}
            onClick={sendStatic}
          >
            {loading === "static" ? (
              <Loader2 className="size-5 mr-3 animate-spin" />
            ) : (
              <MapPin className="size-5 mr-3 text-primary" />
            )}
            <div className="text-left">
              <div className="font-medium text-sm">Enviar localização atual</div>
              <div className="text-xs text-muted-foreground">Apenas uma vez</div>
            </div>
          </Button>

          <div className="pt-2 text-xs font-medium text-muted-foreground flex items-center gap-2">
            <Radio className="size-3.5 text-emerald-500" />
            Compartilhar ao vivo
          </div>

          {DURATIONS.map((d) => (
            <Button
              key={d.minutes}
              variant="outline"
              className="w-full justify-start h-auto py-3"
              disabled={loading !== null}
              onClick={() => sendLive(d.minutes)}
            >
              {loading === `live-${d.minutes}` ? (
                <Loader2 className="size-5 mr-3 animate-spin" />
              ) : (
                <Radio className="size-5 mr-3 text-emerald-500" />
              )}
              <div className="text-left">
                <div className="font-medium text-sm">{d.label}</div>
                <div className="text-xs text-muted-foreground">
                  Sua posição é atualizada em tempo real
                </div>
              </div>
            </Button>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}
