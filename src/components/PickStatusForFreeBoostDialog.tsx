import { useEffect, useState } from "react";
import { Loader2, Gift, Sparkles, Clock } from "lucide-react";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";

interface Status {
  id: string;
  kind: string;
  media_url: string | null;
  caption: string | null;
  content: string | null;
  created_at: string;
  expires_at: string;
}

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  freeViews: number;
  onRedeemed?: () => void;
}

export function PickStatusForFreeBoostDialog({ open, onOpenChange, freeViews, onRedeemed }: Props) {
  const [statuses, setStatuses] = useState<Status[] | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const [redeeming, setRedeeming] = useState(false);

  useEffect(() => {
    if (!open) return;
    setSelected(null);
    setStatuses(null);
    (async () => {
      const { data: u } = await supabase.auth.getUser();
      if (!u.user) return;
      const { data } = await supabase
        .from("statuses")
        .select("id, kind, media_url, caption, content, created_at, expires_at")
        .eq("user_id", u.user.id)
        .in("kind", ["image", "video"])
        .gt("expires_at", new Date().toISOString())
        .order("created_at", { ascending: false })
        .limit(20);
      setStatuses((data as any) ?? []);
    })();
  }, [open]);

  async function confirm() {
    if (!selected) return;
    setRedeeming(true);
    try {
      const { data, error } = await (supabase as any).rpc("redeem_free_boost", {
        _status_id: selected,
      });
      if (error) throw error;
      toast.success(`${(data as any)?.views ?? 100} views grátis ativadas!`, {
        description: "Seu status ficará disponível por até 30 dias até as visualizações acabarem.",
      });
      onOpenChange(false);
      onRedeemed?.();
    } catch (e: any) {
      toast.error(e.message ?? "Falha ao resgatar");
    } finally {
      setRedeeming(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Gift className="size-5 text-pink-500" /> Escolha o status para impulsionar
          </DialogTitle>
          <DialogDescription>
            Você tem <b>{freeViews} visualizações grátis</b>. Escolha qual foto ou vídeo do seu status receberá o impulso. Ele ficará acessível por até 30 dias até as views acabarem.
          </DialogDescription>
        </DialogHeader>

        {statuses === null ? (
          <div className="flex justify-center py-8">
            <Loader2 className="size-6 animate-spin text-muted-foreground" />
          </div>
        ) : statuses.length === 0 ? (
          <div className="text-center py-8 text-sm text-muted-foreground">
            Você ainda não tem fotos ou vídeos no status. Publique uma mídia primeiro para impulsioná-la.
          </div>
        ) : (
          <div className="grid grid-cols-3 gap-2 max-h-[50vh] overflow-y-auto">
            {statuses.map((s) => {
              const isSel = selected === s.id;
              return (
                <button
                  key={s.id}
                  onClick={() => setSelected(s.id)}
                  className={`relative aspect-[9/16] rounded-lg overflow-hidden border-2 transition ${
                    isSel ? "border-pink-500 ring-2 ring-pink-500/50" : "border-border"
                  }`}
                >
                  {s.kind === "video" ? (
                    <video src={s.media_url ?? undefined} className="w-full h-full object-cover" muted playsInline />
                  ) : (
                    <img src={s.media_url ?? undefined} alt="" className="w-full h-full object-cover" />
                  )}
                  {s.caption && (
                    <div className="absolute bottom-0 left-0 right-0 bg-black/60 px-1.5 py-1 text-[10px] text-white truncate">
                      {s.caption}
                    </div>
                  )}
                  {isSel && (
                    <div className="absolute top-1 right-1 bg-pink-500 rounded-full p-0.5">
                      <Sparkles className="size-3 text-white" />
                    </div>
                  )}
                </button>
              );
            })}
          </div>
        )}

        <div className="flex items-center gap-2 text-xs text-muted-foreground bg-muted/30 rounded-lg p-2.5">
          <Clock className="size-3.5 shrink-0" />
          <span>Ao ativar, a validade do status escolhido será estendida por até 30 dias.</span>
        </div>

        <Button
          onClick={confirm}
          disabled={!selected || redeeming}
          className="w-full bg-pink-500 hover:bg-pink-600 text-white"
        >
          {redeeming ? <Loader2 className="size-4 animate-spin" /> : <Sparkles className="size-4 mr-1.5" />}
          Ativar {freeViews} views grátis
        </Button>
      </DialogContent>
    </Dialog>
  );
}
