import { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Heart } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { cn } from "@/lib/utils";
import { sendStatusPush } from "@/lib/status-push.functions";

const EMOJIS = ["❤️", "😂", "😮", "😢", "🔥", "👏", "🙏"];

interface FlyingEmoji {
  id: number;
  emoji: string;
  x: number;
}

export function StatusReactions({
  statusId,
  ownerId,
  onReact,
}: {
  statusId: string;
  ownerId: string;
  onReact?: () => void;
}) {
  const { user } = useAuth();
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [mine, setMine] = useState<string | null>(null);
  const [flying, setFlying] = useState<FlyingEmoji[]>([]);
  const idRef = useRef(0);
  const isOwner = user?.id === ownerId;

  async function load() {
    const { data } = await supabase
      .from("status_reactions")
      .select("emoji,user_id")
      .eq("status_id", statusId);
    const c: Record<string, number> = {};
    let m: string | null = null;
    (data ?? []).forEach((r: any) => {
      c[r.emoji] = (c[r.emoji] ?? 0) + 1;
      if (r.user_id === user?.id) m = r.emoji;
    });
    setCounts(c);
    setMine(m);
  }

  useEffect(() => {
    load();
    const ch = supabase
      .channel(`status-reactions-${statusId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "status_reactions", filter: `status_id=eq.${statusId}` },
        () => load(),
      )
      .subscribe();
    return () => {
      supabase.removeChannel(ch);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [statusId, user?.id]);

  function pop(emoji: string) {
    const id = ++idRef.current;
    const x = (Math.random() - 0.5) * 120;
    setFlying((f) => [...f, { id, emoji, x }]);
    setTimeout(() => setFlying((f) => f.filter((e) => e.id !== id)), 1400);
  }

  async function react(emoji: string) {
    if (!user || isOwner) return;
    pop(emoji);
    onReact?.();
    if (mine === emoji) {
      setMine(null);
      setCounts((c) => ({ ...c, [emoji]: Math.max(0, (c[emoji] ?? 1) - 1) }));
      await supabase.from("status_reactions").delete().eq("status_id", statusId).eq("user_id", user.id);
      return;
    }
    const prev = mine;
    setMine(emoji);
    setCounts((c) => {
      const next = { ...c };
      if (prev) next[prev] = Math.max(0, (next[prev] ?? 1) - 1);
      next[emoji] = (next[emoji] ?? 0) + 1;
      return next;
    });
    await supabase
      .from("status_reactions")
      .upsert(
        { status_id: statusId, user_id: user.id, emoji },
        { onConflict: "status_id,user_id" },
      );
  }

  const totals = Object.entries(counts).filter(([, n]) => n > 0);

  return (
    <>
      {/* Flying emojis layer */}
      <div className="pointer-events-none absolute inset-0 z-30 overflow-hidden">
        <AnimatePresence>
          {flying.map((f) => (
            <motion.div
              key={f.id}
              initial={{ opacity: 0, y: 0, scale: 0.6, x: f.x }}
              animate={{ opacity: [0, 1, 1, 0], y: -260, scale: [0.6, 1.4, 1.1, 0.9], x: f.x + (Math.random() - 0.5) * 60 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 1.4, ease: "easeOut" }}
              className="absolute left-1/2 bottom-24 text-5xl drop-shadow-lg"
              style={{ filter: "drop-shadow(0 6px 20px rgba(255,255,255,0.25))" }}
            >
              {f.emoji}
            </motion.div>
          ))}
        </AnimatePresence>
      </div>

      {/* Reaction bar (only for non-owners) */}
      {!isOwner && (
        <div className="relative z-20 mx-3 mb-2 flex items-center justify-center">
          <div className="flex items-center gap-1 rounded-full bg-white/10 backdrop-blur-xl border border-white/15 px-2 py-1.5 shadow-2xl">
            {EMOJIS.map((e) => {
              const active = mine === e;
              return (
                <button
                  key={e}
                  type="button"
                  onClick={(ev) => {
                    ev.stopPropagation();
                    react(e);
                  }}
                  onPointerDown={(ev) => ev.stopPropagation()}
                  className={cn(
                    "relative grid place-items-center size-9 rounded-full text-xl transition-transform",
                    "hover:scale-125 active:scale-95",
                    active && "bg-white/25 scale-110",
                  )}
                  aria-label={`Reagir com ${e}`}
                >
                  <span className="leading-none">{e}</span>
                  {counts[e] > 0 && (
                    <span className="absolute -bottom-1 -right-1 text-[10px] font-bold bg-white text-black rounded-full min-w-[16px] h-4 px-1 grid place-items-center shadow">
                      {counts[e]}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Owner sees aggregate */}
      {isOwner && totals.length > 0 && (
        <div className="relative z-20 mx-3 mb-2 flex flex-wrap gap-1.5 justify-center">
          {totals.map(([e, n]) => (
            <div
              key={e}
              className="flex items-center gap-1 rounded-full bg-white/10 backdrop-blur-xl border border-white/15 px-2.5 py-1 text-white text-sm"
            >
              <span>{e}</span>
              <span className="font-semibold text-xs">{n}</span>
            </div>
          ))}
          <div className="flex items-center gap-1 rounded-full bg-white/10 backdrop-blur-xl border border-white/15 px-2.5 py-1 text-white/80 text-xs">
            <Heart className="size-3.5" />
            {totals.reduce((s, [, n]) => s + n, 0)}
          </div>
        </div>
      )}
    </>
  );
}
