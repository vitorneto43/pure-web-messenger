import { useEffect, useState } from "react";
import { Loader2, Rocket, BarChart3 } from "lucide-react";
import { useTranslation } from "react-i18next";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { formatTime } from "@/lib/format-time";
import { Button } from "@/components/ui/button";
import { BoostReportDialog } from "@/components/status/BoostReportDialog";

type Boost = {
  id: string;
  post_id: string;
  package: string;
  views_total: number;
  views_remaining: number;
  amount_cents: number;
  currency: string;
  status: string;
  created_at: string;
  refunded_amount_cents: number | null;
  review_status: string | null;
  review_reason: string | null;
};

const STATUS_CLS: Record<string, string> = {
  pending: "bg-yellow-500/15 text-yellow-700 dark:text-yellow-400",
  active: "bg-green-500/15 text-green-700 dark:text-green-400",
  completed: "bg-muted text-muted-foreground",
  failed: "bg-red-500/15 text-red-700 dark:text-red-400",
  refunded: "bg-blue-500/15 text-blue-700 dark:text-blue-400",
};

const STATUS_KEY: Record<string, string> = {
  pending: "profile.statusPending",
  active: "profile.statusActive",
  completed: "profile.statusCompleted",
  failed: "profile.statusFailed",
  refunded: "profile.statusRefunded",
};

function formatMoney(cents: number, currency: string) {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: currency.toUpperCase(),
  }).format(cents / 100);
}

export function PostBoostHistory() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const [items, setItems] = useState<Boost[] | null>(null);
  const [reportId, setReportId] = useState<string | null>(null);

  useEffect(() => {
    if (!user) return;
    let mounted = true;
    supabase
      .from("post_boosts")
      .select(
        "id, post_id, package, views_total, views_remaining, amount_cents, currency, status, created_at, refunded_amount_cents, review_status, review_reason",
      )
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(20)
      .then(({ data }) => {
        if (mounted) setItems((data as Boost[]) ?? []);
      });
    return () => {
      mounted = false;
    };
  }, [user?.id]);

  return (
    <div className="rounded-2xl border border-border bg-card p-5 mt-4">
      <div className="flex items-center gap-2 mb-4">
        <Rocket className="size-4 text-pink-500" />
        <h2 className="text-lg font-semibold">Impulsos de Posts</h2>
      </div>

      {items === null ? (
        <div className="flex justify-center py-6">
          <Loader2 className="size-5 animate-spin text-muted-foreground" />
        </div>
      ) : items.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          Você ainda não impulsionou nenhum post.
        </p>
      ) : (
        <ul className="divide-y divide-border">
          {items.map((b) => {
            const cls = STATUS_CLS[b.status] ?? STATUS_CLS.pending;
            const labelKey = STATUS_KEY[b.status] ?? STATUS_KEY.pending;
            return (
              <li key={b.id} className="py-3 flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-sm font-medium">
                    {t("profile.boostViews", { count: b.views_total.toLocaleString("pt-BR") })}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {formatTime(b.created_at)}
                    {b.status === "active" && (
                      <> · {b.views_remaining.toLocaleString("pt-BR")} {t("profile.boostRemaining")}</>
                    )}
                    {b.status === "refunded" && b.refunded_amount_cents != null && (
                      <> · {formatMoney(b.refunded_amount_cents, b.currency)} {t("profile.boostRefunded")}</>
                    )}
                  </p>
                  {b.review_status === "under_review" && (
                    <p className="text-[11px] mt-1 inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full bg-amber-500/15 text-amber-700 dark:text-amber-400">
                      ⏳ Em análise
                    </p>
                  )}
                  {b.review_status === "rejected" && (
                    <p className="text-[11px] mt-1 text-destructive">
                      ⛔ Reprovado{b.review_reason ? ` — ${b.review_reason}` : ""}
                    </p>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <div className="text-right">
                    <p className="text-sm font-semibold">
                      {formatMoney(b.amount_cents, b.currency)}
                    </p>
                    <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${cls}`}>
                      {t(labelKey)}
                    </span>
                  </div>
                  {(b.status === "active" || b.status === "completed") && (
                    <Button
                      size="icon"
                      variant="ghost"
                      className="size-8"
                      onClick={() => setReportId(b.id)}
                      title="Ver relatório"
                    >
                      <BarChart3 className="size-4" />
                    </Button>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      )}
      <BoostReportDialog
        boostId={reportId}
        open={!!reportId}
        onOpenChange={(v) => !v && setReportId(null)}
        kind="post"
      />
    </div>
  );
}
