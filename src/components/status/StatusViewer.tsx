import { useEffect, useState, useRef } from "react";
import { X, ChevronLeft, ChevronRight, Rocket, Eye, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { formatTime } from "@/lib/format-time";
import type { UserGroup } from "./StatusBar";
import { BoostDialog } from "./BoostDialog";

interface Props {
  groups: UserGroup[];
  startGroupIndex: number;
  startStatusIndex: number;
  onClose: () => void;
}

const DURATION_MS = 6000;

export function StatusViewer({ groups, startGroupIndex, startStatusIndex, onClose }: Props) {
  const { user } = useAuth();
  const [groupIndex, setGroupIndex] = useState(startGroupIndex);
  const [index, setIndex] = useState(startStatusIndex);
  const [progress, setProgress] = useState(0);
  const [paused, setPaused] = useState(false);
  const [author, setAuthor] = useState<{ display_name: string; avatar_url: string | null } | null>(null);
  const [boostOpen, setBoostOpen] = useState(false);
  const [viewerCount, setViewerCount] = useState<number | null>(null);
  const startedRef = useRef<number>(Date.now());
  const currentGroup = groups[groupIndex];
  const statuses = currentGroup?.statuses ?? [];
  const current = statuses[index];
  const isOwner = !!user && current?.user_id === user.id;

  useEffect(() => {
    let mounted = true;
    if (!current) return;
    setAuthor(currentGroup?.user ?? null);
    // register the view
    supabase.rpc("register_status_view", { _status_id: current.id }).then(({ error }) => {
      if (error) console.warn("register view:", error.message);
    });
    // load viewer count if owner
    if (user?.id === current.user_id) {
      supabase
        .from("status_views")
        .select("viewer_id", { count: "exact", head: true })
        .eq("status_id", current.id)
        .then(({ count }) => {
          if (mounted) setViewerCount(count ?? 0);
        });
    } else {
      setViewerCount(null);
    }
    return () => {
      mounted = false;
    };
  }, [current?.id, currentGroup?.user, user?.id]);

  // progress timer (skip for video which we let play out)
  useEffect(() => {
    if (!current || current.kind === "video") {
      setProgress(0);
      return;
    }
    startedRef.current = Date.now();
    setProgress(0);
    const id = setInterval(() => {
      if (paused || boostOpen) {
        startedRef.current = Date.now() - progress * DURATION_MS;
        return;
      }
      const pct = (Date.now() - startedRef.current) / DURATION_MS;
      if (pct >= 1) {
        clearInterval(id);
        next();
      } else {
        setProgress(pct);
      }
    }, 50);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [current?.id, index, paused, boostOpen]);

  function next() {
    if (index < statuses.length - 1) {
      setIndex(index + 1);
      return;
    }
    if (groupIndex < groups.length - 1) {
      setGroupIndex(groupIndex + 1);
      setIndex(0);
      return;
    }
    onClose();
  }
  function prev() {
    if (index > 0) {
      setIndex(index - 1);
      return;
    }
    if (groupIndex > 0) {
      const previousStatuses = groups[groupIndex - 1]?.statuses ?? [];
      setGroupIndex(groupIndex - 1);
      setIndex(Math.max(previousStatuses.length - 1, 0));
    }
  }

  async function remove() {
    if (!current) return;
    if (!confirm("Apagar este status?")) return;
    const { error } = await supabase.from("statuses").delete().eq("id", current.id);
    if (error) toast.error(error.message);
    else {
      toast.success("Status apagado");
      onClose();
    }
  }

  if (!current) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/95 flex flex-col" onClick={(e) => e.stopPropagation()}>
      {/* progress bars */}
      <div className="flex gap-1 px-3 pt-3">
        {statuses.map((_, i) => (
          <div key={i} className="flex-1 h-0.5 bg-white/20 rounded overflow-hidden">
            <div
              className="h-full bg-white transition-[width]"
              style={{
                width: i < index ? "100%" : i === index ? `${progress * 100}%` : "0%",
              }}
            />
          </div>
        ))}
      </div>

      {/* header */}
      <div className="flex items-center gap-2.5 px-4 py-3 text-white">
        <Avatar className="size-9">
          <AvatarImage src={author?.avatar_url ?? undefined} />
          <AvatarFallback>{author?.display_name?.[0] ?? "?"}</AvatarFallback>
        </Avatar>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium truncate">{author?.display_name ?? "..."}</p>
          <p className="text-[11px] text-white/60">{formatTime(current.created_at)}</p>
        </div>
        <Button size="icon" variant="ghost" className="text-white hover:bg-white/10" onClick={onClose}>
          <X className="size-5" />
        </Button>
      </div>

      {/* content */}
      <div className="flex-1 relative grid place-items-center overflow-hidden select-none">
        {current.kind === "text" && (
          <div
            className="w-full h-full grid place-items-center p-8 text-center text-white text-2xl font-semibold"
            style={{ background: current.background ?? "linear-gradient(135deg,#7c3aed,#ec4899)" }}
          >
            {current.content}
          </div>
        )}
        {current.kind === "image" && current.media_url && (
          <img src={current.media_url} className="max-h-full max-w-full object-contain pointer-events-none" alt="" />
        )}
        {current.kind === "video" && current.media_url && (
          <video
            src={current.media_url}
            autoPlay={!boostOpen}
            playsInline
            controls={false}
            onEnded={next}
            ref={(el) => {
              if (!el) return;
              if (boostOpen) el.pause();
              else el.play().catch(() => {});
            }}
            className="max-h-full max-w-full pointer-events-none"
          />
        )}
        {current.caption && (
          <p className="absolute bottom-4 left-4 right-4 text-center text-white bg-black/40 backdrop-blur rounded-lg px-3 py-2 text-sm pointer-events-none">
            {current.caption}
          </p>
        )}

        {/* tap/hold zones — tap navigates, hold pauses (WhatsApp/Instagram behavior) */}
        <TapZone side="left" onTap={prev} onHoldChange={setPaused} ariaLabel="Anterior">
          <ChevronLeft className="size-6 text-white/0" />
        </TapZone>
        <TapZone side="right" onTap={next} onHoldChange={setPaused} ariaLabel="Próximo">
          <ChevronRight className="size-6 text-white/0 ml-auto" />
        </TapZone>
      </div>

      {/* footer */}
      <div className="px-4 py-3 flex items-center gap-2">
        {isOwner ? (
          <>
            <div className="flex items-center gap-1.5 text-white/80 text-xs">
              <Eye className="size-4" />
              {viewerCount ?? "—"} visualizações
            </div>
            <div className="flex-1" />
            <Button
              size="sm"
              variant="ghost"
              className="text-white hover:bg-white/10"
              onClick={remove}
            >
              <Trash2 className="size-4 mr-1" /> Apagar
            </Button>
            <Button
              size="sm"
              onClick={() => setBoostOpen(true)}
              className="bg-gradient-to-r from-amber-500 to-pink-500 text-white hover:opacity-90"
            >
              <Rocket className="size-4 mr-1.5" /> Impulsionar
            </Button>
          </>
        ) : (
          <p className="text-xs text-white/50">Mantenha pressionado para pausar</p>
        )}
      </div>

      {isOwner && (
        <BoostDialog
          open={boostOpen}
          onOpenChange={setBoostOpen}
          statusId={current.id}
        />
      )}
    </div>
  );
}

function TapZone({
  side,
  onTap,
  onHoldChange,
  ariaLabel,
  children,
}: {
  side: "left" | "right";
  onTap: () => void;
  onHoldChange: (paused: boolean) => void;
  ariaLabel: string;
  children: React.ReactNode;
}) {
  const holdTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const heldRef = useRef(false);

  function onPointerDown(e: React.PointerEvent) {
    try { e.currentTarget.setPointerCapture?.(e.pointerId); } catch {}
    heldRef.current = false;
    holdTimer.current = setTimeout(() => {
      heldRef.current = true;
      onHoldChange(true);
    }, 220);
  }
  function clearHold() {
    if (holdTimer.current) {
      clearTimeout(holdTimer.current);
      holdTimer.current = null;
    }
  }
  function onPointerUp() {
    clearHold();
    if (heldRef.current) {
      onHoldChange(false);
      heldRef.current = false;
      return;
    }
    onTap();
  }
  function onPointerCancel() {
    clearHold();
    if (heldRef.current) {
      onHoldChange(false);
      heldRef.current = false;
    }
  }

  return (
    <button
      type="button"
      aria-label={ariaLabel}
      onPointerDown={onPointerDown}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerCancel}
      onPointerLeave={onPointerCancel}
      onContextMenu={(e) => e.preventDefault()}
      className={`absolute top-0 bottom-0 ${side === "left" ? "left-0" : "right-0"} w-1/3 grid place-items-start pt-20 ${side === "left" ? "pl-2" : "pr-2 justify-self-end"} touch-none`}
    >
      {children}
    </button>
  );
}
