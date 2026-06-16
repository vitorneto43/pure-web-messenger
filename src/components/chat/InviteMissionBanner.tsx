import { useEffect, useState } from "react";
import { Rocket, Sparkles } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { InviteDialog } from "@/components/InviteDialog";
import { useAuth } from "@/hooks/use-auth";
import { useAuthGate } from "@/hooks/use-auth-gate";

interface Stats {
  invited: number;
  invited_credited: number;
  invited_until_next_reward: number;
  pending_views: number;
}

export function InviteMissionBanner() {
  const { user } = useAuth();
  const { gate, GateDialog } = useAuthGate();
  const [stats, setStats] = useState<Stats | null>(null);
  const [open, setOpen] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    if (typeof window !== "undefined") {
      setDismissed(window.localStorage.getItem("invite-mission-dismissed") === "1");
    }
    if (!user) {
      setStats({ invited: 0, invited_credited: 0, invited_until_next_reward: 2, pending_views: 0 });
      return;
    }
    (async () => {
      const { data } = await (supabase as any).rpc("get_invite_stats");
      if (data) setStats(data as Stats);
    })();
  }, [user?.id]);

  if (!stats || dismissed) return null;

  // progress within current cycle of 3
  const progress = 3 - (stats.invited_until_next_reward || 3);
  const filled = Math.max(0, Math.min(3, progress));

  // hide if user already has lots of pending views and finished cycles
  if (stats.invited >= 3 && filled === 0 && stats.pending_views === 0) return null;

  return (
    <>
      <button
        type="button"
        onClick={() => gate("default", () => setOpen(true))}
        className="mx-3 mt-3 w-[calc(100%-1.5rem)] rounded-2xl border border-pink-500/30 bg-gradient-to-r from-pink-500/15 via-purple-500/10 to-amber-500/15 p-3 text-left transition hover:from-pink-500/25 hover:to-amber-500/25 active:scale-[0.99]"
      >
        <div className="flex items-center gap-3">
          <div className="grid size-10 shrink-0 place-items-center rounded-xl bg-gradient-to-br from-pink-500 to-purple-600 text-white shadow-md">
            <Rocket className="size-5" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-1.5">
              <p className="text-[13px] font-semibold leading-tight">
                Convide 3 amigos e ganhe <span className="text-pink-600 dark:text-pink-400">100 views grátis</span>
              </p>
            </div>
            <p className="text-[11px] text-muted-foreground mt-0.5">
              Toque para convidar agora
            </p>
            <div className="flex items-center gap-1.5 mt-1.5">
              {[0, 1, 2].map((i) => {
                const on = i < filled;
                return (
                  <div key={i} className="flex items-center gap-1.5">
                    <div
                      className={`relative size-3.5 rounded-full transition-all ${
                        on
                          ? "bg-gradient-to-br from-pink-500 to-amber-500 shadow-[0_0_10px_rgba(236,72,153,0.7)]"
                          : "bg-muted border border-border"
                      }`}
                    >
                      {on && (
                        <Sparkles className="absolute inset-0 m-auto size-2 text-white" />
                      )}
                    </div>
                    {i < 2 && (
                      <div
                        className={`h-0.5 w-4 rounded-full ${
                          i < filled - 1
                            ? "bg-gradient-to-r from-pink-500 to-amber-500"
                            : "bg-muted"
                        }`}
                      />
                    )}
                  </div>
                );
              })}
              <span className="ml-1 text-[10px] font-medium text-muted-foreground">
                {filled}/3
              </span>
            </div>
          </div>
        </div>
      </button>

      <InviteDialog open={open} onOpenChange={setOpen} />
      {GateDialog}
    </>
  );
}
