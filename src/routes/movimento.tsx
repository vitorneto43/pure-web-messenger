import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Activity, Flame, Clock, TrendingUp } from "lucide-react";
import { PublicLayout } from "@/components/public/PublicLayout";
import { getSiteHeatmap } from "@/lib/site-heatmap.functions";

export const Route = createFileRoute("/movimento")({
  head: () => ({
    meta: [
      { title: "Movimento — WaveChat" },
      {
        name: "description",
        content:
          "Mapa de calor do WaveChat: veja os horários mais movimentados da semana e o melhor momento para postar.",
      },
      { property: "og:title", content: "Movimento — WaveChat" },
      {
        property: "og:description",
        content: "Descubra quando o WaveChat está mais movimentado.",
      },
    ],
  }),
  component: MovimentoPage,
});

const DAYS = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];

function levelFor(count: number, max: number): 0 | 1 | 2 | 3 {
  if (count <= 0) return 0;
  const pct = count / max;
  if (pct >= 0.66) return 3; // muito movimentado
  if (pct >= 0.33) return 2; // médio
  return 1; // pouco
}

const LEVEL_BG = ["bg-muted/40", "bg-primary/25", "bg-primary/60", "bg-primary"];
const LEVEL_LABEL = ["Sem dados", "Pouco movimento", "Movimento médio", "Muito movimentado"];

function MovimentoPage() {
  const fn = useServerFn(getSiteHeatmap);
  const { data, isLoading } = useQuery({
    queryKey: ["site-heatmap"],
    queryFn: () => fn(),
    staleTime: 5 * 60_000,
  });

  const peak = data?.peak_hour ?? 0;
  const max = data?.max_cell ?? 1;

  return (
    <PublicLayout>
      <article className="max-w-4xl mx-auto px-4 py-10">
        <div className="flex items-center gap-3">
          <div className="size-12 rounded-2xl bg-primary/15 text-primary grid place-items-center">
            <Activity className="size-6" />
          </div>
          <div>
            <h1 className="text-3xl sm:text-4xl font-bold tracking-tight">Mapa de movimento</h1>
            <p className="text-sm text-muted-foreground mt-1">
              Últimos 7 dias — descubra os melhores horários para postar e conversar.
            </p>
          </div>
        </div>

        <div className="mt-6 grid gap-3 sm:grid-cols-3">
          <div className="rounded-2xl border border-border bg-card/60 p-4">
            <div className="flex items-center gap-2 text-muted-foreground text-xs uppercase tracking-wide">
              <TrendingUp className="size-3.5" /> Melhor horário
            </div>
            <p className="mt-1 text-2xl font-bold text-primary">
              {isLoading ? "…" : `${String(peak).padStart(2, "0")}:00`}
            </p>
            <p className="text-xs text-muted-foreground mt-0.5">Pico de atividade</p>
          </div>
          <div className="rounded-2xl border border-border bg-card/60 p-4">
            <div className="flex items-center gap-2 text-muted-foreground text-xs uppercase tracking-wide">
              <Flame className="size-3.5" /> Eventos (7d)
            </div>
            <p className="mt-1 text-2xl font-bold">
              {isLoading ? "…" : new Intl.NumberFormat("pt-BR").format(data?.total ?? 0)}
            </p>
            <p className="text-xs text-muted-foreground mt-0.5">Interações registradas</p>
          </div>
          <div className="rounded-2xl border border-border bg-card/60 p-4">
            <div className="flex items-center gap-2 text-muted-foreground text-xs uppercase tracking-wide">
              <Clock className="size-3.5" /> Fuso
            </div>
            <p className="mt-1 text-2xl font-bold">Local</p>
            <p className="text-xs text-muted-foreground mt-0.5">
              Horários exibidos no fuso do servidor (Brasil)
            </p>
          </div>
        </div>

        <section className="mt-8 rounded-2xl border border-border bg-card/60 p-4 sm:p-6">
          <h2 className="text-lg font-semibold">Movimento por dia e hora</h2>
          <p className="text-xs text-muted-foreground mt-1">
            Quanto mais forte a cor, mais gente ativa naquele horário.
          </p>

          {isLoading || !data ? (
            <div className="h-64 grid place-items-center text-sm text-muted-foreground">
              Carregando…
            </div>
          ) : (
            <div className="mt-4 overflow-x-auto">
              <div className="min-w-[640px]">
                {/* header hours */}
                <div className="grid grid-cols-[36px_repeat(24,1fr)] gap-[3px] mb-1">
                  <div />
                  {Array.from({ length: 24 }).map((_, h) => (
                    <div
                      key={h}
                      className="text-[9px] text-muted-foreground text-center leading-none"
                    >
                      {h % 3 === 0 ? String(h).padStart(2, "0") : ""}
                    </div>
                  ))}
                </div>
                {DAYS.map((label, day) => (
                  <div
                    key={day}
                    className="grid grid-cols-[36px_repeat(24,1fr)] gap-[3px] mb-[3px]"
                  >
                    <div className="text-[11px] text-muted-foreground pr-1 self-center">
                      {label}
                    </div>
                    {Array.from({ length: 24 }).map((_, h) => {
                      const count = data.grid[day]?.[h] ?? 0;
                      const level = levelFor(count, max);
                      const isPeak = h === peak;
                      return (
                        <div
                          key={h}
                          title={`${label} ${String(h).padStart(2, "0")}:00 — ${count} eventos (${LEVEL_LABEL[level]})`}
                          className={`aspect-square rounded-[3px] ${LEVEL_BG[level]} ${
                            isPeak ? "ring-1 ring-primary" : ""
                          }`}
                        />
                      );
                    })}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* legend */}
          <div className="mt-5 flex flex-wrap items-center gap-3 text-xs">
            <span className="text-muted-foreground">Legenda:</span>
            {[1, 2, 3].map((lv) => (
              <span key={lv} className="inline-flex items-center gap-1.5">
                <span className={`inline-block size-3 rounded-[3px] ${LEVEL_BG[lv]}`} />
                {LEVEL_LABEL[lv]}
              </span>
            ))}
            <span className="inline-flex items-center gap-1.5">
              <span className={`inline-block size-3 rounded-[3px] ${LEVEL_BG[0]}`} />
              Sem dados
            </span>
          </div>
        </section>

        <section className="mt-6 rounded-2xl border border-primary/20 bg-primary/5 p-5">
          <h3 className="font-semibold flex items-center gap-2">
            <TrendingUp className="size-4 text-primary" /> Dica
          </h3>
          <p className="mt-1 text-sm text-foreground/85">
            Publique posts, status e lives por volta das{" "}
            <strong className="text-primary">{String(peak).padStart(2, "0")}:00</strong> para
            alcançar mais pessoas — é quando o WaveChat está mais movimentado.
          </p>
        </section>
      </article>
    </PublicLayout>
  );
}
