import { useEffect, useState, useRef } from "react";
import { X, ChevronLeft, ChevronRight, Rocket, Eye, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { formatTime } from "@/lib/format-time";
import type { StatusRow } from "./StatusBar";
import { BoostDialog } from "./BoostDialog";

interface Props {
  statuses: StatusRow[];
  startIndex: number;
  onClose: () => void;
}

const DURATION_MS = 6000;

export function StatusViewer({ statuses, startIndex, onClose }: Props) {
  const { user } = useAuth();
  const [index, setIndex] = useState(startIndex);
  const [progress, setProgress] = useState(0);
  const [paused, setPaused] = useState(false);
  const [author, setAuthor] = useState<{ display_name: string; avatar_url: string | null } | null>(null);
  const [boostOpen, setBoostOpen] = useState(false);
  const [viewerCount, setViewerCount] = useState<number | null>(null);
  const startedRef = useRef<number>(Date.now());
  const current = statuses[index];
  const isOwner = !!user && current?.user_id === user.id;

  useEffect(() => {
    let mounted = true;
    if (!current) return;
    (async () => {
      const { data: p } = await supabase
        .from("profiles")
        .select("display_name, avatar_url")
        .eq("id", current.user_id)
        .maybeSingle();
      if (mounted) setAuthor(p as any);
    })();
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
  }, [current?.id, user?.id]);

  // progress timer (skip for video which we let play out)
  useEffect(() => {
    if (!current || current.kind === "video") {
      setProgress(0);
      return;
    }
    startedRef.current = Date.now();
    setProgress(0);
    const id = setInterval(() => {
      if (paused) {
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
  }, [index, paused]);

  function next() {
    if (index >= statuses.length - 1) onClose();
    else setIndex(index + 1);
  }
  function prev() {
    if (index > 0) setIndex(index - 1);
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
      <div
        className="flex-1 relative grid place-items-center overflow-hidden"
        onMouseDown={() => setPaused(true)}
        onMouseUp={() => setPaused(false)}
        onTouchStart={() => setPaused(true)}
        onTouchEnd={() => setPaused(false)}
      >
        {current.kind === "text" && (
          <div
            className="w-full h-full grid place-items-center p-8 text-center text-white text-2xl font-semibold"
            style={{ background: current.background ?? "linear-gradient(135deg,#7c3aed,#ec4899)" }}
          >
            {current.content}
          </div>
        )}
        {current.kind === "image" && current.media_url && (
          <img src={current.media_url} className="max-h-full max-w-full object-contain" alt="" />
        )}
        {current.kind === "video" && current.media_url && (
          <video
            src={current.media_url}
            autoPlay
            playsInline
            controls={false}
            onEnded={next}
            className="max-h-full max-w-full"
          />
        )}
        {current.caption && (
          <p className="absolute bottom-4 left-4 right-4 text-center text-white bg-black/40 backdrop-blur rounded-lg px-3 py-2 text-sm">
            {current.caption}
          </p>
        )}

        {/* nav zones */}
        <button
          onClick={prev}
          className="absolute left-0 top-0 bottom-0 w-1/4 grid place-items-start pt-20 pl-2 text-white/0 hover:text-white/40"
          aria-label="Anterior"
        >
          <ChevronLeft className="size-6" />
        </button>
        <button
          onClick={next}
          className="absolute right-0 top-0 bottom-0 w-1/4 grid place-items-start pt-20 pr-2 justify-self-end text-white/0 hover:text-white/40"
          aria-label="Próximo"
        >
          <ChevronRight className="size-6 ml-auto" />
        </button>
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
