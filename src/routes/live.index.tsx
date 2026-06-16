import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { getActiveLives, getTopHostsWeekly } from "@/lib/live.functions";
import { Eye, Coins, Radio, Trophy, Crown } from "lucide-react";
import { Button } from "@/components/ui/button";


export const Route = createFileRoute("/live/")({
  head: () => ({
    meta: [
      { title: "Lives ao vivo agora — WaveChat" },
      { name: "description", content: "Assista lives em tempo real no WaveChat. Bata papo, mande reações e presentes para os seus criadores favoritos." },
      { property: "og:title", content: "Lives ao vivo agora — WaveChat" },
      { property: "og:description", content: "Assista lives em tempo real no WaveChat." },
    ],
  }),
  component: LiveFeed,
});

function LiveFeed() {
  const [lives, setLives] = useState<Awaited<ReturnType<typeof getActiveLives>>>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    getActiveLives()
      .then((d) => active && setLives(d))
      .finally(() => active && setLoading(false));
    const t = setInterval(() => getActiveLives().then((d) => active && setLives(d)), 15000);
    return () => {
      active = false;
      clearInterval(t);
    };
  }, []);

  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="flex items-center justify-between p-4 border-b">
        <h1 className="text-xl font-bold flex items-center gap-2">
          <Radio className="w-5 h-5 text-red-500" /> Ao vivo
        </h1>
        <Link to="/live/new">
          <Button size="sm" className="bg-red-600 hover:bg-red-700 text-white">
            <Radio className="w-4 h-4 mr-1" /> Iniciar live
          </Button>
        </Link>
      </header>

      {loading ? (
        <div className="p-6 text-center text-muted-foreground">Carregando…</div>
      ) : lives.length === 0 ? (
        <div className="p-8 text-center text-muted-foreground">
          <Radio className="w-12 h-12 mx-auto mb-3 opacity-30" />
          <p>Ninguém está ao vivo agora.</p>
          <p className="text-sm mt-1">Seja o primeiro a transmitir!</p>
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2 p-2">
          {lives.map((l) => (
            <Link
              key={l.id}
              to="/live/$liveId"
              params={{ liveId: l.id }}
              className="relative aspect-[3/4] rounded-xl overflow-hidden bg-muted group"
            >
              {l.cover_url || l.host?.avatar_url ? (
                <img
                  src={l.cover_url || l.host?.avatar_url || ""}
                  alt={l.title}
                  className="absolute inset-0 w-full h-full object-cover group-hover:scale-105 transition"
                />
              ) : (
                <div className="absolute inset-0 bg-gradient-to-br from-pink-500 to-yellow-500" />
              )}
              <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/0 to-black/40" />
              <span className="absolute top-2 left-2 bg-red-600 text-white text-[10px] font-bold px-1.5 py-0.5 rounded">
                AO VIVO
              </span>
              <span className="absolute top-2 right-2 flex items-center gap-1 text-white text-xs bg-black/50 backdrop-blur px-1.5 py-0.5 rounded-full">
                <Eye className="w-3 h-3" /> {l.viewer_count}
              </span>
              <div className="absolute bottom-2 left-2 right-2 text-white">
                <p className="text-xs font-semibold truncate">{l.host?.display_name || l.host?.username || "Host"}</p>
                <p className="text-[11px] opacity-90 truncate">{l.title || "Ao vivo"}</p>
                {l.total_gift_coins > 0 && (
                  <p className="text-[10px] flex items-center gap-0.5 opacity-90 mt-0.5">
                    <Coins className="w-3 h-3 text-yellow-400" /> {l.total_gift_coins}
                  </p>
                )}
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
