import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Eye, X, UserPlus, UserCheck } from "lucide-react";
import { LiveModerationMenu } from "./LiveModerationMenu";
import { toast } from "sonner";

interface Host {
  id?: string | null;
  username?: string | null;
  display_name?: string | null;
  avatar_url?: string | null;
}

export function LiveHeader({
  liveId,
  hostId,
  title,
  host,
  isHost,
  initialViewerCount,
  onClose,
  isFollowing,
  onToggleFollow,
}: {
  liveId: string;
  hostId: string;
  title: string;
  host: Host | null;
  isHost: boolean;
  initialViewerCount: number;
  onClose: () => void;
  isFollowing?: boolean;
  onToggleFollow?: () => void;
}) {
  const [viewers, setViewers] = useState<number>(initialViewerCount);

  // Heartbeat every 20s — also updates viewer_count on server
  useEffect(() => {
    let cancelled = false;
    const beat = async () => {
      const { data } = await supabase.rpc("heartbeat_viewer", { p_live_id: liveId });
      if (!cancelled && typeof data === "number") setViewers(data);
    };
    beat();
    const t = setInterval(beat, 20000);
    return () => {
      cancelled = true;
      clearInterval(t);
    };
  }, [liveId]);

  return (
    <div className="absolute top-0 left-0 right-0 p-3 flex items-start justify-between z-20 bg-gradient-to-b from-black/70 to-transparent">
      <div className="flex items-center gap-2 max-w-[70%]">
        <div className="w-9 h-9 rounded-full bg-muted overflow-hidden flex-shrink-0">
          {host?.avatar_url ? (
            <img src={host.avatar_url} alt="" className="w-full h-full object-cover" />
          ) : (
            <div className="w-full h-full bg-gradient-to-br from-pink-500 to-yellow-500" />
          )}
        </div>
        <div className="text-white min-w-0">
          <div className="flex items-center gap-1.5">
            <p className="text-sm font-semibold truncate">{host?.display_name || host?.username || "Host"}</p>
            {onToggleFollow && !isHost && (
              <button
                onClick={onToggleFollow}
                className={
                  isFollowing
                    ? "text-[10px] font-medium px-1.5 py-0.5 rounded-full border border-white/40 text-white/90 bg-white/10"
                    : "text-[10px] font-medium px-1.5 py-0.5 rounded-full border border-white text-white hover:bg-white/20"
                }
              >
                {isFollowing ? "Seguindo" : "Seguir"}
              </button>
            )}
          </div>
          <p className="text-xs opacity-80 truncate">{title || "Ao vivo"}</p>
        </div>
        <span className="ml-2 bg-red-600 text-white text-xs font-bold px-2 py-0.5 rounded">AO VIVO</span>
      </div>
      <div className="flex items-center gap-2">
        <span className="flex items-center gap-1 text-white text-xs bg-black/50 backdrop-blur px-2 py-1 rounded-full">
          <Eye className="w-3.5 h-3.5" /> {viewers}
        </span>
        <LiveModerationMenu liveId={liveId} hostId={hostId} isHost={isHost} onTakendown={onClose} />
        <Button size="icon" variant="ghost" className="bg-black/50 hover:bg-black/70 text-white rounded-full" onClick={onClose}>
          <X className="w-5 h-5" />
        </Button>
      </div>
    </div>
  );
}
