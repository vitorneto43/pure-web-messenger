import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Activity, Eye, Users, MousePointerClick, Link2, TrendingUp, ChevronDown } from "lucide-react";
import { getMyProfileTraffic, getSiteTrafficByHour, getProfileTrafficByUsername } from "@/lib/traffic.functions";
import { Button } from "@/components/ui/button";

function fmt(n: number) {
  return new Intl.NumberFormat("pt-BR").format(n);
}

export function TrafficInsightsCard({ username, title }: { username?: string; title?: string } = {}) {
  const myFn = useServerFn(getMyProfileTraffic);
  const publicFn = useServerFn(getProfileTrafficByUsername);
  const siteFn = useServerFn(getSiteTrafficByHour);
  const [showPeak, setShowPeak] = useState(false);

  const { data: mine, isLoading } = useQuery({
    queryKey: username ? ["profile-traffic", username] : ["my-profile-traffic"],
    queryFn: () => (username ? publicFn({ data: { username } }) : myFn()),
    staleTime: 60_000,
  });

  const { data: site, isLoading: loadingSite } = useQuery({
    queryKey: ["site-traffic-hours"],
    queryFn: () => siteFn(),
    staleTime: 5 * 60_000,
    enabled: showPeak,
  });

  return (
    <div className="mt-6 glass border border-border rounded-2xl p-5 sm:p-6">
      <div className="flex items-center gap-2">
        <Activity className="size-5 text-primary" />
        <h2 className="text-lg font-semibold">Tráfego do seu perfil</h2>
      </div>
      <p className="text-xs text-muted-foreground mt-1">Últimos 30 dias</p>

      <div className="mt-4 grid grid-cols-2 gap-3">
        <Stat
          icon={Eye}
          label="Visitas no perfil"
          value={isLoading ? "…" : fmt(mine?.profile_page_views ?? 0)}
        />
        <Stat
          icon={Users}
          label="Visitantes únicos"
          value={isLoading ? "…" : fmt(mine?.profile_views_unique ?? 0)}
        />
        <Stat
          icon={MousePointerClick}
          label="Visualizações totais"
          value={isLoading ? "…" : fmt(mine?.profile_views_total ?? 0)}
        />
        <Stat
          icon={Link2}
          label="Cliques nos meus links"
          value={isLoading ? "…" : fmt(mine?.social_link_clicks_total ?? 0)}
        />
      </div>

      <Button
        variant="outline"
        size="sm"
        onClick={() => setShowPeak((s) => !s)}
        className="mt-4 w-full"
      >
        <TrendingUp className="size-4 mr-2" />
        {showPeak ? "Ocultar" : "Ver"} horários de pico do WaveChat
        <ChevronDown className={`size-4 ml-2 transition-transform ${showPeak ? "rotate-180" : ""}`} />
      </Button>

      {showPeak && (
        <div className="mt-4 rounded-xl bg-muted/40 border border-border p-4">
          <p className="text-xs text-muted-foreground">
            Quando há mais gente online nos últimos 7 dias — poste nesses horários para alcançar mais pessoas.
          </p>
          {loadingSite || !site ? (
            <div className="h-32 grid place-items-center text-xs text-muted-foreground">Carregando…</div>
          ) : (
            <>
              <p className="mt-3 text-sm">
                Pico:{" "}
                <span className="font-semibold text-primary">
                  {String(site.peak_hour).padStart(2, "0")}:00
                </span>
              </p>
              <HourBars hours={site.hours} peak={site.peak_hour} />
            </>
          )}
        </div>
      )}
    </div>
  );
}

function Stat({
  icon: Icon,
  label,
  value,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-xl bg-muted/40 border border-border p-3">
      <div className="flex items-center gap-2 text-muted-foreground">
        <Icon className="size-3.5" />
        <span className="text-[11px] uppercase tracking-wide">{label}</span>
      </div>
      <p className="mt-1 text-xl font-semibold">{value}</p>
    </div>
  );
}

function HourBars({ hours, peak }: { hours: { hour: number; count: number }[]; peak: number }) {
  const max = Math.max(1, ...hours.map((h) => h.count));
  return (
    <div className="mt-3 flex items-end gap-[2px] h-24">
      {hours.map((h) => {
        const pct = (h.count / max) * 100;
        const isPeak = h.hour === peak;
        return (
          <div
            key={h.hour}
            className="flex-1 flex flex-col items-center justify-end gap-1"
            title={`${String(h.hour).padStart(2, "0")}:00 — ${h.count} eventos`}
          >
            <div
              className={`w-full rounded-t ${isPeak ? "bg-primary" : "bg-primary/30"}`}
              style={{ height: `${Math.max(4, pct)}%` }}
            />
            {h.hour % 6 === 0 && (
              <span className="text-[9px] text-muted-foreground">{String(h.hour).padStart(2, "0")}</span>
            )}
          </div>
        );
      })}
    </div>
  );
}
