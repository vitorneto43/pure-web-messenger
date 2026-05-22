import { useEffect, useState } from "react";
import { Loader2, Rocket } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { formatTime } from "@/lib/format-time";

type Boost = {
  id: string;
  package: string;
  views_total: number;
  views_remaining: number;
  amount_cents: number;
  currency: string;
  status: string;
  created_at: string;
  refunded_amount_cents: number | null;
};

const STATUS_LABEL: Record<string, { label: string; cls: string }> = {
  pending: { label: "Pendente", cls: "bg-yellow-500/15 text-yellow-700 dark:text-yellow-400" },
  active: { label: "Ativo", cls: "bg-green-500/15 text-green-700 dark:text-green-400" },
  completed: { label: "Concluído", cls: "bg-muted text-muted-foreground" },
  failed: { label: "Falhou", cls: "bg-red-500/15 text-red-700 dark:text-red-400" },
  refunded: { label: "Reembolsado", cls: "bg-blue-500/15 text-blue-700 dark:text-blue-400" },
};

function formatMoney(cents: number, currency: string) {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: currency.toUpperCase(),
  }).format(cents / 100);
}

export function BoostHistory() {
  const { user } = useAuth();
  const [items, setItems] = useState<Boost[] | null>(null);

  useEffect(() => {
    if (!user) return;
    let mounted = true;
    supabase
      .from("status_boosts")
      .select(
        "id, package, views_total, views_remaining, amount_cents, currency, status, created_at, refunded_amount_cents",
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
    <div className="rounded-2xl border border-border bg-card p-5">
      <div className="flex items-center gap-2 mb-4">
        <Rocket className="size-4 text-pink-500" />
        <h2 className="text-lg font-semibold">Histórico de impulsos</h2>
      </div>

      {items === null ? (
        <div className="flex justify-center py-6">
          <Loader2 className="size-5 animate-spin text-muted-foreground" />
        </div>
      ) : items.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          Você ainda não impulsionou nenhum status.
        </p>
      ) : (
        <ul className="divide-y divide-border">
          {items.map((b) => {
            const meta = STATUS_LABEL[b.status] ?? STATUS_LABEL.pending;
            return (
              <li key={b.id} className="py-3 flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-sm font-medium">
                    {b.views_total.toLocaleString("pt-BR")} visualizações
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {formatTime(b.created_at)}
                    {b.status === "active" && (
                      <> · {b.views_remaining.toLocaleString("pt-BR")} restantes</>
                    )}
                    {b.status === "refunded" && b.refunded_amount_cents != null && (
                      <> · {formatMoney(b.refunded_amount_cents, b.currency)} devolvido</>
                    )}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-sm font-semibold">
                    {formatMoney(b.amount_cents, b.currency)}
                  </p>
                  <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${meta.cls}`}>
                    {meta.label}
                  </span>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
