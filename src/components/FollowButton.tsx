import { useEffect, useState } from "react";
import { toast } from "sonner";
import { UserPlus, UserCheck } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { useAuthGate } from "@/hooks/use-auth-gate";
import { Button } from "@/components/ui/button";

type Props = {
  targetUserId: string;
  size?: "sm" | "default";
  variant?: "default" | "secondary" | "outline" | "ghost";
  className?: string;
  labelFollow?: string;
  labelFollowing?: string;
  onChanged?: (following: boolean) => void;
};

export function FollowButton({
  targetUserId,
  size = "sm",
  variant,
  className,
  labelFollow = "Seguir",
  labelFollowing = "Seguindo",
  onChanged,
}: Props) {
  const { user } = useAuth();
  const { gate } = useAuthGate();
  const [following, setFollowing] = useState(false);
  const [busy, setBusy] = useState(false);
  const isSelf = user?.id === targetUserId;

  useEffect(() => {
    if (!user || isSelf || !targetUserId) return;
    let alive = true;
    (async () => {
      const { data } = await supabase
        .from("profile_follows")
        .select("follower_id")
        .eq("follower_id", user.id)
        .eq("following_id", targetUserId)
        .maybeSingle();
      if (alive) setFollowing(!!data);
    })();
    return () => {
      alive = false;
    };
  }, [user?.id, targetUserId, isSelf]);

  if (isSelf || !targetUserId) return null;

  const onClick = () =>
    gate("follow", async () => {
      if (busy) return;
      setBusy(true);
      const optimistic = !following;
      setFollowing(optimistic);
      const { data, error } = await supabase.rpc("toggle_follow", { _target: targetUserId });
      setBusy(false);
      if (error) {
        setFollowing(!optimistic);
        toast.error(error.message);
        return;
      }
      const now = !!data;
      setFollowing(now);
      onChanged?.(now);
      toast.success(now ? "Seguindo" : "Deixou de seguir");
    });

  return (
    <Button
      size={size}
      variant={variant ?? (following ? "secondary" : "default")}
      onClick={onClick}
      disabled={busy}
      className={className}
    >
      {following ? (
        <>
          <UserCheck className="size-4 mr-1.5" /> {labelFollowing}
        </>
      ) : (
        <>
          <UserPlus className="size-4 mr-1.5" /> {labelFollow}
        </>
      )}
    </Button>
  );
}
