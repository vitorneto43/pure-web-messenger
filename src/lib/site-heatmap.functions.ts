import { createServerFn } from "@tanstack/react-start";
import { EXCLUDED_ANALYTICS_USER_IDS_PG } from "@/lib/analytics-exclusions";

/**
 * Mapa de calor público: eventos dos últimos 7 dias agrupados por
 * dia-da-semana (0=Dom..6=Sáb) e hora (0-23), no fuso local do servidor.
 * Retorna também o pico e uma classificação por bucket.
 */
export const getSiteHeatmap = createServerFn({ method: "GET" }).handler(async () => {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const since = new Date(Date.now() - 7 * 24 * 3600 * 1000).toISOString();

  const { data } = await supabaseAdmin
    .from("analytics_events")
    .select("created_at")
    .gte("created_at", since)
    .not("user_id", "in", EXCLUDED_ANALYTICS_USER_IDS_PG)
    .limit(100000);

  // grid[day][hour]
  const grid: number[][] = Array.from({ length: 7 }, () => new Array(24).fill(0));
  const hours = new Array(24).fill(0) as number[];
  for (const row of data ?? []) {
    const d = new Date(row.created_at);
    const day = d.getDay();
    const h = d.getHours();
    grid[day][h] += 1;
    hours[h] += 1;
  }

  const total = hours.reduce((a, b) => a + b, 0);
  const peakHour = hours.indexOf(Math.max(...hours));
  const max = Math.max(1, ...grid.flat());

  return {
    grid,
    hours: hours.map((count, hour) => ({ hour, count })),
    total,
    peak_hour: peakHour,
    max_cell: max,
    window_days: 7,
    generated_at: new Date().toISOString(),
  };
});
