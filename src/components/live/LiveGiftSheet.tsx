import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Gift, Coins } from "lucide-react";
import { toast } from "sonner";

interface Catalog {
  id: string;
  name: string;
  emoji: string;
  coins_cost: number;
  rarity: string;
}

export function LiveGiftSheet({ liveId, userId }: { liveId: string; userId: string | null }) {
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<Catalog[]>([]);
  const [balance, setBalance] = useState<number>(0);
  const [busy, setBusy] = useState<string | null>(null);
  const [bursts, setBursts] = useState<{ id: number; emoji: string }[]>([]);

  useEffect(() => {
    supabase
      .from("live_gifts_catalog")
      .select("id,name,emoji,coins_cost,rarity")
      .eq("enabled", true)
      .order("sort_order")
      .then(({ data }) => setItems(data ?? []));
  }, []);

  useEffect(() => {
    if (!userId) return;
    const load = async () => {
      const { data } = await supabase.from("user_coins").select("balance").eq("user_id", userId).maybeSingle();
      setBalance(data?.balance ?? 0);
    };
    load();
    const ch = supabase
      .channel(`coins-${userId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "user_coins", filter: `user_id=eq.${userId}` },
        load,
      )
      .subscribe();
    return () => {
      supabase.removeChannel(ch);
    };
  }, [userId]);

  // gift burst layer (animation when anyone sends a gift)
  useEffect(() => {
    const ch = supabase
      .channel(`gift-burst-${liveId}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "live_gifts_sent", filter: `live_id=eq.${liveId}` },
        async (payload) => {
          const giftId = (payload.new as { gift_id: string }).gift_id;
          const item = items.find((i) => i.id === giftId);
          if (!item) return;
          const id = Date.now() + Math.random();
          setBursts((p) => [...p, { id, emoji: item.emoji }]);
          setTimeout(() => setBursts((p) => p.filter((b) => b.id !== id)), 2500);
        },
      )
      .subscribe();
    return () => {
      supabase.removeChannel(ch);
    };
  }, [liveId, items]);

  async function send(item: Catalog) {
    if (!userId) {
      toast.error("Entre na conta para enviar presentes");
      return;
    }
    if (balance < item.coins_cost) {
      toast.error("Moedas insuficientes — compre mais para presentear");
      return;
    }
    setBusy(item.id);
    const { error } = await supabase.rpc("send_live_gift", {
      p_live_id: liveId,
      p_gift_id: item.id,
      p_quantity: 1,
    });
    setBusy(null);
    if (error) toast.error(error.message);
    else toast.success(`Você enviou ${item.emoji} ${item.name}!`);
  }

  const rarityClass = (r: string) =>
    r === "legendary"
      ? "from-yellow-400 to-orange-500"
      : r === "epic"
        ? "from-fuchsia-500 to-purple-600"
        : r === "rare"
          ? "from-sky-400 to-blue-600"
          : "from-zinc-500 to-zinc-700";

  return (
    <>
      {/* center-screen gift bursts */}
      <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
        {bursts.map((b) => (
          <span
            key={b.id}
            className="absolute text-7xl animate-[gift_2.5s_ease-out_forwards]"
            style={{ left: `${30 + Math.random() * 40}%`, top: `${30 + Math.random() * 30}%` }}
          >
            {b.emoji}
          </span>
        ))}
        <style>{`@keyframes gift { 0%{opacity:0;transform:scale(0.2) rotate(-20deg)} 20%{opacity:1;transform:scale(1.4) rotate(10deg)} 80%{opacity:1;transform:scale(1)} 100%{opacity:0;transform:scale(1.6) translateY(-60px)} }`}</style>
      </div>

      <Sheet open={open} onOpenChange={setOpen}>
        <SheetTrigger asChild>
          <Button size="icon" className="bg-gradient-to-br from-pink-500 to-yellow-500 text-white rounded-full shadow-lg">
            <Gift className="w-5 h-5" />
          </Button>
        </SheetTrigger>
        <SheetContent side="bottom" className="h-[70vh]">
          <SheetHeader>
            <SheetTitle className="flex items-center justify-between">
              <span>Presentes</span>
              <span className="flex items-center gap-1 text-sm font-normal">
                <Coins className="w-4 h-4 text-yellow-500" />
                {balance}
              </span>
            </SheetTitle>
          </SheetHeader>
          <div className="grid grid-cols-3 gap-3 mt-4 overflow-y-auto pb-4">
            {items.map((g) => (
              <button
                key={g.id}
                onClick={() => send(g)}
                disabled={busy === g.id}
                className={`flex flex-col items-center p-3 rounded-2xl bg-gradient-to-br ${rarityClass(g.rarity)} text-white shadow-md active:scale-95 transition`}
              >
                <span className="text-4xl">{g.emoji}</span>
                <span className="text-xs font-medium mt-1 truncate w-full text-center">{g.name}</span>
                <span className="text-[11px] flex items-center gap-0.5 mt-0.5 opacity-90">
                  <Coins className="w-3 h-3" /> {g.coins_cost}
                </span>
              </button>
            ))}
          </div>
          <p className="text-center text-xs text-muted-foreground">
            Sem moedas? Em breve você poderá comprar pacotes para presentear seus criadores.
          </p>
        </SheetContent>
      </Sheet>
    </>
  );
}
