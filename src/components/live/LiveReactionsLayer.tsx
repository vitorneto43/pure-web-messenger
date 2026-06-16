import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Heart } from "lucide-react";

const EMOJIS = ["❤️", "🔥", "👏", "😂", "🎉", "💯"];

interface Burst {
  id: number;
  emoji: string;
  x: number;
}

export function LiveReactionsLayer({ liveId, userId }: { liveId: string; userId: string | null }) {
  const [bursts, setBursts] = useState<Burst[]>([]);

  useEffect(() => {
    const channel = supabase
      .channel(`live-reactions-${liveId}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "live_reactions", filter: `live_id=eq.${liveId}` },
        (payload) => {
          const emoji = (payload.new as { emoji: string }).emoji;
          spawn(emoji);
        },
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [liveId]);

  function spawn(emoji: string) {
    const id = Date.now() + Math.random();
    const x = 20 + Math.random() * 60;
    setBursts((prev) => [...prev.slice(-30), { id, emoji, x }]);
    setTimeout(() => setBursts((p) => p.filter((b) => b.id !== id)), 3000);
  }

  async function react(emoji: string) {
    spawn(emoji);
    if (userId) {
      await supabase.rpc("send_live_reaction", { p_live_id: liveId, p_emoji: emoji });
    }
  }

  return (
    <>
      {/* burst layer */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        {bursts.map((b) => (
          <span
            key={b.id}
            className="absolute bottom-20 text-3xl animate-[float_3s_ease-out_forwards]"
            style={{ left: `${b.x}%` }}
          >
            {b.emoji}
          </span>
        ))}
        <style>{`@keyframes float { 0%{opacity:0;transform:translateY(0) scale(0.6)} 15%{opacity:1;transform:translateY(-20px) scale(1.1)} 100%{opacity:0;transform:translateY(-320px) scale(0.9) rotate(15deg)} }`}</style>
      </div>
      {/* picker */}
      <div className="absolute bottom-24 right-3 flex flex-col gap-1.5 items-center">
        {EMOJIS.map((e) => (
          <Button
            key={e}
            size="icon"
            variant="ghost"
            className="bg-black/40 hover:bg-black/60 text-2xl rounded-full w-10 h-10 backdrop-blur"
            onClick={() => react(e)}
          >
            {e}
          </Button>
        ))}
        <Button
          size="icon"
          className="bg-pink-600 hover:bg-pink-700 text-white rounded-full w-12 h-12"
          onClick={() => react("❤️")}
        >
          <Heart className="w-5 h-5 fill-white" />
        </Button>
      </div>
    </>
  );
}
