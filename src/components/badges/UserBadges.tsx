import { useUserBadges, type UserBadge } from "@/hooks/use-user-badges";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";

interface Props {
  userId: string | null | undefined;
  variant?: "inline" | "full";
  max?: number;
  className?: string;
}

/** Inline badge row (next to a username). Tap a badge to see its description. */
export function UserBadges({ userId, variant = "inline", max = 3, className }: Props) {
  const { data } = useUserBadges(userId);
  if (!data || data.length === 0) return null;
  const items = data.slice(0, max);
  return (
    <span className={cn("inline-flex items-center gap-0.5 align-middle", className)}>
      {items.map((b) => (
        <BadgePill key={b.code} badge={b} variant={variant} />
      ))}
    </span>
  );
}

function BadgePill({ badge, variant }: { badge: UserBadge; variant: "inline" | "full" }) {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          onClick={(e) => e.stopPropagation()}
          className={cn(
            "inline-flex items-center gap-1 rounded-full leading-none transition-transform hover:scale-110",
            variant === "inline" ? "text-[13px]" : "text-sm px-1.5 py-0.5 bg-muted",
          )}
          aria-label={badge.name}
          title={badge.name}
          style={variant === "full" ? { color: badge.color } : undefined}
        >
          <span>{badge.icon}</span>
          {variant === "full" && <span className="text-xs font-medium">{badge.name}</span>}
        </button>
      </PopoverTrigger>
      <PopoverContent side="top" className="w-56 p-3" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-start gap-2">
          <span className="text-2xl leading-none">{badge.icon}</span>
          <div className="min-w-0">
            <p className="text-sm font-semibold" style={{ color: badge.color }}>{badge.name}</p>
            <p className="text-xs text-muted-foreground mt-0.5">{badge.description}</p>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}
