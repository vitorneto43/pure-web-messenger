import { useEffect, useState } from "react";
import { Gift, Loader2, Sparkles, UserPlus, Rocket } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { InviteDialog } from "./InviteDialog";
import { PickStatusForFreeBoostDialog } from "./PickStatusForFreeBoostDialog";
import { useTranslation } from "react-i18next";

interface Stats {
  invited: number;
  invited_credited: number;
  invited_until_next_reward: number;
  pending_rewards: number;
  pending_views: number;
}

export function InviteRewardsCard() {
  const { t } = useTranslation();
  const [stats, setStats] = useState<Stats | null>(null);
  const [claiming, setClaiming] = useState(false);
  const [inviteOpen, setInviteOpen] = useState(false);
  const [pickOpen, setPickOpen] = useState(false);

  async function load() {
    const { data } = await (supabase as any).rpc("get_invite_stats");
    if (data) setStats(data as Stats);
  }

  useEffect(() => {
    void load();
  }, []);

  async function claim() {
    setClaiming(true);
    try {
      const { data, error } = await (supabase as any).rpc("claim_invite_reward");
      if (error) throw error;
      const granted = (data as any)?.granted ?? 0;
      if (granted > 0) {
        toast.success(t("app.inviteRewards.toastClaimed", { views: granted * 100 }));
      } else {
        toast.info(t("app.inviteRewards.toastNone"));
      }
      await load();
    } catch (e: any) {
      toast.error(e.message ?? t("app.inviteRewards.toastFail"));
    } finally {
      setClaiming(false);
    }
  }

  if (!stats) {
    return (
      <div className="rounded-2xl border border-border bg-card p-5 flex justify-center">
        <Loader2 className="size-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const eligibleNew = Math.floor((stats.invited - stats.invited_credited) / 3);

  return (
    <>
      <div className="rounded-2xl border border-border bg-gradient-to-br from-pink-500/10 via-card to-purple-500/10 p-5">
        <div className="flex items-center gap-2 mb-3">
          <Gift className="size-5 text-pink-500" />
          <h2 className="text-lg font-semibold">{t("app.inviteRewards.title")}</h2>
        </div>
        <p
          className="text-sm text-muted-foreground mb-4"
          dangerouslySetInnerHTML={{ __html: t("app.inviteRewards.desc") }}
        />

        <div className="grid grid-cols-3 gap-2 mb-4">
          <Stat label={t("app.inviteRewards.statInvited")} value={stats.invited} />
          <Stat label={t("app.inviteRewards.statMissing")} value={stats.invited_until_next_reward || 3} />
          <Stat label={t("app.inviteRewards.statViews")} value={stats.pending_views} highlight={stats.pending_views > 0} />
        </div>

        <div className="flex gap-2">
          <Button onClick={() => setInviteOpen(true)} className="flex-1">
            <UserPlus className="size-4 mr-1.5" /> {t("app.inviteRewards.btnInvite")}
          </Button>
          {eligibleNew > 0 && (
            <Button onClick={claim} disabled={claiming} variant="secondary">
              {claiming ? <Loader2 className="size-4 animate-spin" /> : <Sparkles className="size-4 mr-1" />}
              {t("app.inviteRewards.btnClaim", { views: eligibleNew * 100 })}
            </Button>
          )}
        </div>

        {stats.pending_views >= 100 && (
          <Button
            onClick={() => setPickOpen(true)}
            className="w-full mt-2 bg-gradient-to-r from-pink-500 to-purple-500 text-white hover:opacity-90"
          >
            <Rocket className="size-4 mr-1.5" />
            Usar {stats.pending_views} views grátis em um status
          </Button>
        )}
      </div>

      <InviteDialog open={inviteOpen} onOpenChange={setInviteOpen} />
      <PickStatusForFreeBoostDialog
        open={pickOpen}
        onOpenChange={setPickOpen}
        freeViews={stats.pending_views}
        onRedeemed={load}
      />
    </>
  );
}

function Stat({ label, value, highlight }: { label: string; value: number; highlight?: boolean }) {
  return (
    <div className={`rounded-lg p-2.5 text-center ${highlight ? "bg-pink-500/15" : "bg-muted/40"}`}>
      <div className={`text-xl font-bold ${highlight ? "text-pink-600 dark:text-pink-400" : ""}`}>{value}</div>
      <div className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</div>
    </div>
  );
}
