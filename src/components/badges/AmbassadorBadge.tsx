import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { getAmbassadorLevel } from "@/lib/invites.functions";

export function AmbassadorBadge({ userId, compact = false }: { userId: string; compact?: boolean }) {
  const fn = useServerFn(getAmbassadorLevel);
  const q = useQuery({
    queryKey: ["ambassador-level", userId],
    queryFn: () => fn({ data: { userId } }),
    enabled: !!userId,
    staleTime: 60_000,
  });
  if (!q.data || !q.data.tier) return null;
  const { tier, invited } = q.data;
  if (compact) {
    return (
      <span
        title={`${tier.name} — ${invited} pessoas convidadas`}
        className="inline-flex items-center gap-1 rounded-full bg-amber-500/15 px-2 py-0.5 text-[11px] font-semibold text-amber-600 dark:text-amber-400"
      >
        <span>{tier.icon}</span>
        <span>{invited}</span>
      </span>
    );
  }
  return (
    <div className="inline-flex items-center gap-2 rounded-full border border-amber-500/40 bg-amber-500/10 px-3 py-1 text-sm font-medium text-amber-700 dark:text-amber-300">
      <span className="text-base">{tier.icon}</span>
      <div className="flex flex-col leading-tight">
        <span className="text-xs uppercase tracking-wide">{tier.name}</span>
        <span className="text-[11px] opacity-80">{invited} pessoas convidadas</span>
      </div>
    </div>
  );
}
