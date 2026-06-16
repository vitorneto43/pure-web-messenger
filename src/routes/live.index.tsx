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
  const [top, setTop] = useState<Awaited<ReturnType<typeof getTopHostsWeekly>>>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    getActiveLives()
      .then((d) => active && setLives(d))
      .finally(() => active && setLoading(false));
    getTopHostsWeekly({ data: { limit: 10 } }).then((d) => active && setTop(d));
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

      {top.length > 0 && (
        <section className="px-3 pt-3">
          <div className="flex items-center gap-2 mb-2">
            <Trophy className="w-4 h-4 text-yellow-500" />
            <h2 className="text-sm font-bold">Top criadores da semana</h2>
          </div>
          <div className="flex gap-3 overflow-x-auto pb-2 -mx-3 px-3 scrollbar-none">
            {top.map((h, i) => (
              <Link
                key={h.host_id}
                to="/u/$username"
                params={{ username: h.username ?? "" }}
                className="flex flex-col items-center min-w-[80px] group"
              >
                <div className="relative">
                  <div
                    className={`w-16 h-16 rounded-full p-[2px] ${
                      i === 0
                        ? "bg-gradient-to-br from-yellow-400 to-orange-500"
                        : i === 1
                          ? "bg-gradient-to-br from-zinc-300 to-zinc-500"
                          : i === 2
                            ? "bg-gradient-to-br from-amber-600 to-amber-800"
                            : "bg-muted"
                    }`}
                  >
                    <div className="w-full h-full rounded-full overflow-hidden bg-muted">
                      {h.avatar_url ? (
                        <img src={h.avatar_url} alt={h.display_name ?? h.username ?? ""} className="w-full h-full object-cover" />
                      ) : (
                        <div className="w-full h-full bg-gradient-to-br from-pink-500 to-yellow-500" />
                      )}
                    </div>
                  </div>
                  <span
                    className={`absolute -top-1 -right-1 w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold text-white shadow ${
                      i === 0
                        ? "bg-yellow-500"
                        : i === 1
                          ? "bg-zinc-400"
                          : i === 2
                            ? "bg-amber-700"
                            : "bg-muted-foreground"
                    }`}
                  >
                    {i === 0 ? <Crown className="w-3 h-3" /> : `#${i + 1}`}
                  </span>
                </div>
                <p className="text-[11px] font-medium mt-1 truncate w-16 text-center">
                  {h.display_name ?? h.username ?? "Host"}
                </p>
                <p className="text-[10px] flex items-center gap-0.5 text-muted-foreground">
                  <Coins className="w-2.5 h-2.5 text-yellow-500" /> {h.total_coins}
                </p>
              </Link>
            ))}
          </div>
        </section>
      )}

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
