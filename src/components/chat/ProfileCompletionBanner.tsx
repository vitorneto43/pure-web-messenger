import { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import { UserCircle2, X, ArrowRight } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";

const DISMISS_KEY = "wc.profileCompletion.dismissedAt";
const DISMISS_HOURS = 24;

export function ProfileCompletionBanner() {
  const { user } = useAuth();
  const [percent, setPercent] = useState<number | null>(null);
  const [missing, setMissing] = useState<string[]>([]);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    const ts = Number(localStorage.getItem(DISMISS_KEY) ?? 0);
    if (ts && Date.now() - ts < DISMISS_HOURS * 3600 * 1000) {
      setDismissed(true);
    }
  }, []);

  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    (async () => {
      const [{ data: p }, { data: priv }, { data: survey }] = await Promise.all([
        supabase
          .from("profiles")
          .select("avatar_url, display_name, bio, username, goal")
          .eq("id", user.id)
          .maybeSingle(),
        supabase
          .from("profiles_private")
          .select("city")
          .eq("user_id", user.id)
          .maybeSingle(),
        supabase
          .from("user_onboarding_survey")
          .select("id")
          .eq("user_id", user.id)
          .maybeSingle(),
      ]);
      if (cancelled) return;

      const checks: { key: string; label: string; ok: boolean }[] = [
        { key: "avatar", label: "foto", ok: !!p?.avatar_url },
        { key: "name", label: "nome", ok: !!p?.display_name?.trim() },
        { key: "username", label: "username", ok: !!p?.username?.trim() },
        { key: "bio", label: "bio", ok: !!p?.bio?.trim() },
        { key: "goal", label: "objetivo", ok: !!p?.goal },
        { key: "city", label: "cidade", ok: !!priv?.city },
        { key: "interests", label: "interesses", ok: !!survey?.id },
      ];
      const filled = checks.filter((c) => c.ok).length;
      setPercent(Math.round((filled / checks.length) * 100));
      setMissing(checks.filter((c) => !c.ok).map((c) => c.label));
    })();
    return () => {
      cancelled = true;
    };
  }, [user]);

  if (dismissed || percent === null || percent >= 100) return null;

  function dismiss() {
    localStorage.setItem(DISMISS_KEY, String(Date.now()));
    setDismissed(true);
  }

  return (
    <div className="mx-3 mt-3 rounded-xl border border-primary/30 bg-gradient-to-br from-primary/10 via-accent/10 to-transparent p-3">
      <div className="flex items-start gap-2">
        <div className="size-8 rounded-lg bg-primary/20 grid place-items-center shrink-0">
          <UserCircle2 className="size-5 text-primary" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-2">
            <div className="text-xs font-semibold">Complete seu perfil</div>
            <button
              type="button"
              onClick={dismiss}
              className="text-muted-foreground hover:text-foreground"
              aria-label="Dispensar"
            >
              <X className="size-3.5" />
            </button>
          </div>
          <div className="mt-1.5 flex items-center gap-2">
            <div className="flex-1 h-1.5 rounded-full bg-muted overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-primary to-accent transition-all"
                style={{ width: `${percent}%` }}
              />
            </div>
            <span className="text-[11px] font-medium text-primary tabular-nums">{percent}%</span>
          </div>
          {missing.length > 0 && (
            <div className="mt-1.5 text-[11px] text-muted-foreground truncate">
              Falta: {missing.slice(0, 3).join(", ")}
              {missing.length > 3 ? "…" : ""}
            </div>
          )}
          <Button asChild size="sm" variant="ghost" className="mt-1.5 -ml-2 h-7 text-xs text-primary hover:text-primary">
            <Link to="/profile">
              Completar agora <ArrowRight className="size-3 ml-1" />
            </Link>
          </Button>
        </div>
      </div>
    </div>
  );
}
