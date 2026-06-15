import { useEffect, useState, type ReactNode } from "react";
import { Lightbulb, X } from "lucide-react";
import { cn } from "@/lib/utils";

const STORAGE_KEY = "wavechat:feature-tips:dismissed";

function getDismissed(): Record<string, true> {
  if (typeof window === "undefined") return {};
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}");
  } catch {
    return {};
  }
}

function markDismissed(id: string) {
  if (typeof window === "undefined") return;
  const d = getDismissed();
  d[id] = true;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(d));
  } catch {
    /* ignore */
  }
}

export function useFeatureTip(id: string) {
  const [shouldShow, setShouldShow] = useState(false);
  useEffect(() => {
    const d = getDismissed();
    if (!d[id]) setShouldShow(true);
  }, [id]);
  return {
    show: shouldShow,
    dismiss: () => {
      markDismissed(id);
      setShouldShow(false);
    },
  };
}

interface FeatureTipProps {
  id: string;
  title: string;
  children: ReactNode;
  icon?: ReactNode;
  className?: string;
  variant?: "card" | "banner";
}

export function FeatureTip({
  id,
  title,
  children,
  icon,
  className,
  variant = "card",
}: FeatureTipProps) {
  const { show, dismiss } = useFeatureTip(id);
  if (!show) return null;

  return (
    <div
      className={cn(
        "relative flex gap-3 rounded-xl border border-primary/30 bg-gradient-to-br from-primary/10 via-accent/5 to-transparent p-3 text-sm shadow-sm",
        variant === "banner" && "rounded-none border-x-0",
        className,
      )}
      role="note"
    >
      <div className="shrink-0 mt-0.5 text-primary">
        {icon ?? <Lightbulb className="size-4" />}
      </div>
      <div className="flex-1 min-w-0 pr-6">
        <p className="font-semibold text-foreground leading-tight">{title}</p>
        <div className="text-muted-foreground text-[13px] leading-snug mt-1">
          {children}
        </div>
      </div>
      <button
        type="button"
        onClick={dismiss}
        aria-label="Fechar dica"
        className="absolute top-2 right-2 size-6 grid place-items-center rounded-md text-muted-foreground hover:text-foreground hover:bg-accent/40 transition"
      >
        <X className="size-3.5" />
      </button>
    </div>
  );
}
