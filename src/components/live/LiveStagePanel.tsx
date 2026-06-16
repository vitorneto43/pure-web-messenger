import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Mic, Check, X, UserPlus } from "lucide-react";
import { toast } from "sonner";

interface Req {
  id: string;
  user_id: string;
  status: string;
  username?: string | null;
  display_name?: string | null;
  avatar_url?: string | null;
}

export function LiveStagePanel({ liveId, isHost }: { liveId: string; isHost: boolean }) {
  const [requests, setRequests] = useState<Req[]>([]);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!isHost) return;
    let active = true;
    const load = async () => {
      const { data } = await supabase
        .from("live_stage_requests")
        .select("id,user_id,status")
        .eq("live_id", liveId)
        .in("status", ["pending", "approved"])
        .order("created_at", { ascending: true });
      if (!active || !data) return;
      const ids = Array.from(new Set(data.map((r) => r.user_id)));
      const { data: profs } = await supabase
        .from("profiles")
        .select("id,username,display_name,avatar_url")
        .in("id", ids);
      const byId = new Map((profs ?? []).map((p) => [p.id, p]));
      setRequests(data.map((r) => ({ ...r, ...byId.get(r.user_id) })));
    };
    load();
    const channel = supabase
      .channel(`stage-${liveId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "live_stage_requests", filter: `live_id=eq.${liveId}` },
        () => load(),
      )
      .subscribe();
    return () => {
      active = false;
      supabase.removeChannel(channel);
    };
  }, [liveId, isHost]);

  async function resolve(id: string, status: "approved" | "rejected" | "kicked") {
    const { error } = await supabase.rpc("resolve_stage_request", { p_request_id: id, p_new_status: status });
    if (error) toast.error(error.message);
  }

  if (!isHost) return null;
  const pending = requests.filter((r) => r.status === "pending");
  const onStage = requests.filter((r) => r.status === "approved");

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button size="icon" variant="ghost" className="bg-black/40 hover:bg-black/60 text-white relative rounded-full">
          <UserPlus className="w-5 h-5" />
          {pending.length > 0 && (
            <span className="absolute -top-1 -right-1 bg-pink-500 text-white text-xs w-5 h-5 rounded-full flex items-center justify-center">
              {pending.length}
            </span>
          )}
        </Button>
      </SheetTrigger>
      <SheetContent side="bottom" className="h-[60vh]">
        <SheetHeader>
          <SheetTitle>Palco</SheetTitle>
        </SheetHeader>
        <div className="mt-4 space-y-4 overflow-y-auto">
          {onStage.length > 0 && (
            <section>
              <h3 className="text-sm font-semibold mb-2">No palco ({onStage.length})</h3>
              <ul className="space-y-2">
                {onStage.map((r) => (
                  <li key={r.id} className="flex items-center justify-between p-2 rounded-lg bg-muted">
                    <span className="text-sm">{r.display_name || r.username || "User"}</span>
                    <Button size="sm" variant="destructive" onClick={() => resolve(r.id, "kicked")}>
                      Tirar
                    </Button>
                  </li>
                ))}
              </ul>
            </section>
          )}
          <section>
            <h3 className="text-sm font-semibold mb-2">Pedidos ({pending.length})</h3>
            {pending.length === 0 ? (
              <p className="text-xs text-muted-foreground">Nenhum pedido pendente.</p>
            ) : (
              <ul className="space-y-2">
                {pending.map((r) => (
                  <li key={r.id} className="flex items-center justify-between p-2 rounded-lg bg-muted">
                    <span className="text-sm">{r.display_name || r.username || "User"}</span>
                    <div className="flex gap-1">
                      <Button size="icon" variant="default" onClick={() => resolve(r.id, "approved")}>
                        <Check className="w-4 h-4" />
                      </Button>
                      <Button size="icon" variant="ghost" onClick={() => resolve(r.id, "rejected")}>
                        <X className="w-4 h-4" />
                      </Button>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>
      </SheetContent>
    </Sheet>
  );
}

export function RequestStageButton({ liveId, userId }: { liveId: string; userId: string | null }) {
  const [status, setStatus] = useState<string | null>(null);

  useEffect(() => {
    if (!userId) return;
    let active = true;
    const load = async () => {
      const { data } = await supabase
        .from("live_stage_requests")
        .select("status")
        .eq("live_id", liveId)
        .eq("user_id", userId)
        .maybeSingle();
      if (active) setStatus(data?.status ?? null);
    };
    load();
    const channel = supabase
      .channel(`my-stage-${liveId}-${userId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "live_stage_requests", filter: `live_id=eq.${liveId}` },
        load,
      )
      .subscribe();
    return () => {
      active = false;
      supabase.removeChannel(channel);
    };
  }, [liveId, userId]);

  if (!userId) return null;

  async function ask() {
    const { error } = await supabase.rpc("request_stage", { p_live_id: liveId });
    if (error) toast.error(error.message);
    else toast.success("Pedido enviado ao host");
  }

  if (status === "approved") {
    return (
      <Button size="sm" className="bg-green-600 hover:bg-green-700 text-white rounded-full">
        <Mic className="w-4 h-4 mr-1" /> No palco
      </Button>
    );
  }
  if (status === "pending") {
    return (
      <Button size="sm" variant="secondary" className="rounded-full" disabled>
        Aguardando…
      </Button>
    );
  }
  return (
    <Button size="sm" variant="ghost" className="bg-black/40 hover:bg-black/60 text-white rounded-full" onClick={ask}>
      <Mic className="w-4 h-4 mr-1" /> Pedir palco
    </Button>
  );
}
