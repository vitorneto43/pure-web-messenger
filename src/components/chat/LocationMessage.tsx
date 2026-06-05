import { useEffect, useState } from "react";
import { ExternalLink, MapPin, Radio, Square } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { LocationMap } from "./LocationMap";
import { toast } from "sonner";

interface StaticProps {
  kind: "static";
  lat: number;
  lng: number;
  isMine: boolean;
}

interface LiveProps {
  kind: "live";
  liveId: string;
  isMine: boolean;
  ownerId: string;
}

type Props = StaticProps | LiveProps;

interface LiveRow {
  latitude: number;
  longitude: number;
  accuracy: number | null;
  updated_at: string;
  expires_at: string;
  ended_at: string | null;
}

export function LocationMessage(props: Props) {
  const [expanded, setExpanded] = useState(false);
  const [live, setLive] = useState<LiveRow | null>(null);

  useEffect(() => {
    if (props.kind !== "live") return;
    let cancelled = false;

    const load = async () => {
      const { data } = await (supabase as any)
        .from("live_locations")
        .select("latitude,longitude,accuracy,updated_at,expires_at,ended_at")
        .eq("id", props.liveId)
        .maybeSingle();
      if (!cancelled && data) setLive(data as LiveRow);
    };
    load();

    const ch = supabase
      .channel(`live-loc-${props.liveId}`)
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "live_locations",
          filter: `id=eq.${props.liveId}`,
        },
        (payload) => {
          setLive(payload.new as LiveRow);
        },
      )
      .subscribe();

    return () => {
      cancelled = true;
      supabase.removeChannel(ch);
    };
  }, [props.kind, props.kind === "live" ? props.liveId : ""]);

  const isLive = props.kind === "live";
  const lat = isLive ? live?.latitude : props.lat;
  const lng = isLive ? live?.longitude : props.lng;
  const accuracy = isLive ? live?.accuracy ?? undefined : undefined;

  const expiresAt = live?.expires_at ? new Date(live.expires_at) : null;
  const endedAt = live?.ended_at ? new Date(live.ended_at) : null;
  const active = isLive && !!expiresAt && expiresAt > new Date() && !endedAt;

  const remainingMin = expiresAt
    ? Math.max(0, Math.round((expiresAt.getTime() - Date.now()) / 60000))
    : 0;

  async function stopSharing() {
    if (props.kind !== "live") return;
    const { error } = await (supabase as any)
      .from("live_locations")
      .update({ ended_at: new Date().toISOString() })
      .eq("id", props.liveId);
    if (error) toast.error("Não foi possível parar");
    else toast.success("Localização ao vivo encerrada");
  }

  if (lat == null || lng == null) {
    return (
      <div className="mb-1 flex items-center gap-2 text-sm opacity-70">
        <MapPin className="size-4" />
        {isLive ? "Carregando localização ao vivo…" : "Localização indisponível"}
      </div>
    );
  }

  return (
    <>
      <div className="mb-1 rounded-lg overflow-hidden border border-border bg-card/60 w-[240px] sm:w-[280px]">
        <button
          type="button"
          onClick={() => setExpanded(true)}
          className="block w-full text-left"
        >
          <LocationMap
            lat={lat}
            lng={lng}
            accuracy={accuracy}
            className="h-32 w-full"
            zoom={15}
          />
          <div className="px-3 py-2 flex items-center justify-between gap-2">
            <div className="flex items-center gap-2 min-w-0">
              {isLive ? (
                <Radio
                  className={`size-4 shrink-0 ${active ? "text-emerald-500 animate-pulse" : "text-muted-foreground"}`}
                />
              ) : (
                <MapPin className="size-4 shrink-0 text-primary" />
              )}
              <div className="min-w-0">
                <div className="text-xs font-medium truncate">
                  {isLive ? (active ? "Localização ao vivo" : "Localização ao vivo (encerrada)") : "Localização"}
                </div>
                <div className="text-[10px] text-muted-foreground truncate">
                  {isLive && active
                    ? `Atualiza ao vivo • expira em ${remainingMin} min`
                    : isLive
                      ? "Compartilhamento encerrado"
                      : `${lat.toFixed(5)}, ${lng.toFixed(5)}`}
                </div>
              </div>
            </div>
            <ExternalLink className="size-3.5 text-muted-foreground shrink-0" />
          </div>
        </button>
        {isLive && active && props.isMine && (
          <button
            type="button"
            onClick={stopSharing}
            className="w-full px-3 py-1.5 text-xs font-medium text-destructive border-t border-border hover:bg-destructive/10 flex items-center justify-center gap-1.5"
          >
            <Square className="size-3 fill-current" /> Parar de compartilhar
          </button>
        )}
      </div>

      <Dialog open={expanded} onOpenChange={setExpanded}>
        <DialogContent className="max-w-2xl p-0 overflow-hidden">
          <DialogHeader className="px-4 pt-4 pb-2">
            <DialogTitle className="flex items-center gap-2">
              {isLive ? <Radio className="size-4 text-emerald-500" /> : <MapPin className="size-4 text-primary" />}
              {isLive ? "Localização ao vivo" : "Localização"}
            </DialogTitle>
          </DialogHeader>
          <LocationMap
            lat={lat}
            lng={lng}
            accuracy={accuracy}
            interactive
            zoom={16}
            className="h-[60vh] w-full"
          />
          <div className="p-3 flex flex-wrap gap-2 items-center justify-between">
            <div className="text-xs text-muted-foreground">
              {lat.toFixed(6)}, {lng.toFixed(6)}
              {accuracy ? ` • precisão ±${Math.round(accuracy)}m` : ""}
            </div>
            <div className="flex gap-2">
              <Button
                asChild
                size="sm"
                variant="secondary"
              >
                <a
                  href={`https://www.openstreetmap.org/?mlat=${lat}&mlon=${lng}#map=17/${lat}/${lng}`}
                  target="_blank"
                  rel="noreferrer"
                >
                  Abrir no mapa
                </a>
              </Button>
              <Button asChild size="sm">
                <a
                  href={`https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`}
                  target="_blank"
                  rel="noreferrer"
                >
                  Como chegar
                </a>
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
