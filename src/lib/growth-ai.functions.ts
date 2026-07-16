import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { EXCLUDED_ANALYTICS_USER_IDS_PG } from "@/lib/analytics-exclusions";

/**
 * Growth AI — módulo somente-leitura para análise e recomendações.
 * NUNCA modifica dados. Não usa APIs externas de IA. Apenas SQL + estatística.
 */

const InputSchema = z.object({
  period: z.enum(["today", "7d", "30d", "90d", "custom"]).default("30d"),
  from: z.string().optional(),
  to: z.string().optional(),
});

type Period = z.infer<typeof InputSchema>;

function resolveRange(p: Period): { start: Date; end: Date; days: number } {
  const end = p.to ? new Date(p.to) : new Date();
  let start: Date;
  switch (p.period) {
    case "today":
      start = new Date(); start.setHours(0, 0, 0, 0); break;
    case "7d":
      start = new Date(Date.now() - 7 * 86400_000); break;
    case "30d":
      start = new Date(Date.now() - 30 * 86400_000); break;
    case "90d":
      start = new Date(Date.now() - 90 * 86400_000); break;
    case "custom":
      start = p.from ? new Date(p.from) : new Date(Date.now() - 30 * 86400_000); break;
  }
  const days = Math.max(1, Math.round((end.getTime() - start.getTime()) / 86400_000));
  return { start, end, days };
}

// UA parsing (very light-weight)
function parseUA(ua: string | null): { browser: string; os: string; device: string } {
  if (!ua) return { browser: "Desconhecido", os: "Desconhecido", device: "Desconhecido" };
  const u = ua.toLowerCase();
  let browser = "Outro";
  if (u.includes("edg/")) browser = "Edge";
  else if (u.includes("chrome/") && !u.includes("edg/") && !u.includes("opr/")) browser = "Chrome";
  else if (u.includes("firefox/")) browser = "Firefox";
  else if (u.includes("safari/") && !u.includes("chrome/")) browser = "Safari";
  else if (u.includes("opr/") || u.includes("opera")) browser = "Opera";
  else if (u.includes("samsungbrowser")) browser = "Samsung";

  let os = "Outro";
  if (u.includes("android")) os = "Android";
  else if (u.includes("iphone") || u.includes("ipad") || u.includes("ios")) os = "iOS";
  else if (u.includes("windows")) os = "Windows";
  else if (u.includes("mac os") || u.includes("macintosh")) os = "macOS";
  else if (u.includes("linux")) os = "Linux";

  const device = /mobile|iphone|android/.test(u) ? "Mobile" : "Desktop";
  return { browser, os, device };
}

function langToCountry(lang: string | null): string {
  if (!lang) return "N/D";
  const parts = lang.split(/[-_]/);
  const region = parts[1]?.toUpperCase() ?? parts[0]?.toUpperCase() ?? "N/D";
  const map: Record<string, string> = {
    BR: "Brasil", PT: "Portugal", US: "Estados Unidos", GB: "Reino Unido", ES: "Espanha",
    MX: "México", AR: "Argentina", FR: "França", DE: "Alemanha", IT: "Itália",
    JP: "Japão", CN: "China", IN: "Índia", NG: "Nigéria", AO: "Angola", MZ: "Moçambique",
    CA: "Canadá", RU: "Rússia", CL: "Chile", CO: "Colômbia", PE: "Peru", VE: "Venezuela",
    AU: "Austrália", NL: "Holanda", SE: "Suécia", NO: "Noruega", KR: "Coreia do Sul",
  };
  return map[region] ?? region;
}

function topN<T extends { key: string; value: number }>(m: Map<string, number>, n = 8): T[] {
  const arr = Array.from(m.entries()).map(([key, value]) => ({ key: key || "N/D", value }));
  arr.sort((a, b) => b.value - a.value);
  return arr.slice(0, n) as T[];
}

function pct(a: number, b: number): number {
  if (b === 0) return a === 0 ? 0 : 100;
  return ((a - b) / b) * 100;
}

export const analyzeGrowth = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => InputSchema.parse(data ?? {}))
  .handler(async ({ data, context }) => {
    // authz: moderator+
    const { data: role } = await context.supabase
      .rpc("has_role", { _user_id: context.userId, _role: "moderator" });
    const { data: adminRole } = await context.supabase
      .rpc("has_role", { _user_id: context.userId, _role: "admin" });
    if (!role && !adminRole) throw new Error("Acesso negado");

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { start, end, days } = resolveRange(data);
    const startISO = start.toISOString();
    const endISO = end.toISOString();
    const prevStart = new Date(start.getTime() - (end.getTime() - start.getTime())).toISOString();

    // ================= CRESCIMENTO =================
    const { data: profs } = await supabaseAdmin
      .from("profiles")
      .select("id, created_at, last_seen, signup_source, signup_medium, signup_campaign, invited_by")
      .gte("created_at", startISO)
      .lte("created_at", endISO)
      .order("created_at", { ascending: true })
      .limit(50000);

    const { count: prevCount } = await supabaseAdmin
      .from("profiles")
      .select("id", { count: "exact", head: true })
      .gte("created_at", prevStart)
      .lt("created_at", startISO);

    const { count: totalUsers } = await supabaseAdmin
      .from("profiles")
      .select("id", { count: "exact", head: true });

    const dailySeries = new Map<string, number>();
    for (let i = 0; i < days; i++) {
      const d = new Date(start.getTime() + i * 86400_000);
      dailySeries.set(d.toISOString().slice(0, 10), 0);
    }
    for (const p of profs ?? []) {
      const k = new Date(p.created_at).toISOString().slice(0, 10);
      dailySeries.set(k, (dailySeries.get(k) ?? 0) + 1);
    }
    const series = Array.from(dailySeries.entries()).map(([date, count]) => ({ date, count }));
    const totalPeriod = profs?.length ?? 0;
    const avgPerDay = totalPeriod / days;
    const growthDelta = pct(totalPeriod, prevCount ?? 0);

    // tendência linear simples (últimos 7 dias)
    const last7 = series.slice(-7);
    const first7 = series.slice(0, 7);
    const last7Avg = last7.reduce((s, x) => s + x.count, 0) / Math.max(1, last7.length);
    const first7Avg = first7.reduce((s, x) => s + x.count, 0) / Math.max(1, first7.length);
    const trendPct = pct(last7Avg, first7Avg);

    // previsões (média móvel simples)
    const forecast = {
      tomorrow: Math.round(last7Avg),
      next7: Math.round(last7Avg * 7),
      next30: Math.round(last7Avg * 30),
      basis: `média dos últimos ${last7.length} dias = ${last7Avg.toFixed(1)}/dia`,
    };

    // ================= AQUISIÇÃO (origens, campanhas) =================
    const bySource = new Map<string, number>();
    const byMedium = new Map<string, number>();
    const byCampaign = new Map<string, number>();
    const byHour = new Array(24).fill(0) as number[];
    for (const p of profs ?? []) {
      bySource.set(p.signup_source ?? "direct", (bySource.get(p.signup_source ?? "direct") ?? 0) + 1);
      byMedium.set(p.signup_medium ?? "N/D", (byMedium.get(p.signup_medium ?? "N/D") ?? 0) + 1);
      if (p.signup_campaign) byCampaign.set(p.signup_campaign, (byCampaign.get(p.signup_campaign) ?? 0) + 1);
      byHour[new Date(p.created_at).getHours()]++;
    }
    const bestSignupHour = byHour.indexOf(Math.max(...byHour));

    // ================= DEVICE / BROWSER / OS / COUNTRY via analytics_events =================
    const profileIds = new Set((profs ?? []).map((p) => p.id));
    const { data: eventsForSignups } = profileIds.size > 0
      ? await supabaseAdmin
          .from("analytics_events")
          .select("user_id, user_agent, metadata")
          .in("user_id", Array.from(profileIds).slice(0, 5000))
          .eq("event_name", "page_view")
          .order("created_at", { ascending: true })
          .limit(20000)
      : { data: [] as { user_id: string | null; user_agent: string | null; metadata: any }[] };

    const seen = new Set<string>();
    const byBrowser = new Map<string, number>();
    const byOS = new Map<string, number>();
    const byDevice = new Map<string, number>();
    const byCountry = new Map<string, number>();
    for (const e of eventsForSignups ?? []) {
      if (!e.user_id || seen.has(e.user_id)) continue;
      seen.add(e.user_id);
      const { browser, os, device } = parseUA(e.user_agent);
      byBrowser.set(browser, (byBrowser.get(browser) ?? 0) + 1);
      byOS.set(os, (byOS.get(os) ?? 0) + 1);
      byDevice.set(device, (byDevice.get(device) ?? 0) + 1);
      const lang = (e.metadata as any)?.language ?? null;
      const country = langToCountry(lang);
      byCountry.set(country, (byCountry.get(country) ?? 0) + 1);
    }

    // ================= RETENÇÃO =================
    // D1: usuários criados no período que voltaram ≥ 1 dia depois (last_seen > created_at + 1d)
    let d1Retained = 0;
    let d7Retained = 0;
    let churnRisk = 0;
    for (const p of profs ?? []) {
      const created = new Date(p.created_at).getTime();
      const seen = new Date(p.last_seen).getTime();
      const diffH = (seen - created) / 3600_000;
      if (diffH >= 24) d1Retained++;
      if (diffH >= 24 * 7) d7Retained++;
      // risco de abandono: last_seen mais de 7 dias atrás
      if ((Date.now() - seen) > 7 * 86400_000) churnRisk++;
    }
    const retentionD1 = totalPeriod > 0 ? (d1Retained / totalPeriod) * 100 : 0;
    const retentionD7 = totalPeriod > 0 ? (d7Retained / totalPeriod) * 100 : 0;

    // Retenção por país (D1)
    const retByCountry = new Map<string, { total: number; ret: number }>();
    for (const e of eventsForSignups ?? []) {
      if (!e.user_id) continue;
      const p = (profs ?? []).find((x) => x.id === e.user_id);
      if (!p) continue;
      const country = langToCountry((e.metadata as any)?.language ?? null);
      const rec = retByCountry.get(country) ?? { total: 0, ret: 0 };
      rec.total++;
      const diffH = (new Date(p.last_seen).getTime() - new Date(p.created_at).getTime()) / 3600_000;
      if (diffH >= 24) rec.ret++;
      retByCountry.set(country, rec);
    }
    const countryRetention = Array.from(retByCountry.entries())
      .filter(([, v]) => v.total >= 3)
      .map(([country, v]) => ({ country, total: v.total, retention_pct: (v.ret / v.total) * 100 }))
      .sort((a, b) => b.retention_pct - a.retention_pct)
      .slice(0, 8);

    // ================= ENGAJAMENTO =================
    const engagementQueries = await Promise.all([
      supabaseAdmin.from("posts").select("id, created_at, user_id", { count: "exact", head: false }).gte("created_at", startISO).lte("created_at", endISO).limit(50000),
      supabaseAdmin.from("statuses").select("id, created_at, user_id", { count: "exact", head: false }).gte("created_at", startISO).lte("created_at", endISO).limit(50000),
      supabaseAdmin.from("live_sessions").select("id, started_at, host_id", { count: "exact", head: false }).gte("started_at", startISO).lte("started_at", endISO).limit(10000),
      supabaseAdmin.from("messages").select("id", { count: "exact", head: true }).gte("created_at", startISO).lte("created_at", endISO),
      supabaseAdmin.from("post_comments").select("id", { count: "exact", head: true }).gte("created_at", startISO).lte("created_at", endISO),
      supabaseAdmin.from("post_reactions").select("id", { count: "exact", head: true }).gte("created_at", startISO).lte("created_at", endISO),
      supabaseAdmin.from("profile_follows").select("follower_id", { count: "exact", head: true }),
    ]);
    const posts = engagementQueries[0].data ?? [];
    const statuses = engagementQueries[1].data ?? [];
    const lives = engagementQueries[2].data ?? [];
    const engagement = {
      posts: engagementQueries[0].count ?? posts.length,
      statuses: engagementQueries[1].count ?? statuses.length,
      lives: engagementQueries[2].count ?? lives.length,
      messages: engagementQueries[3].count ?? 0,
      comments: engagementQueries[4].count ?? 0,
      reactions: engagementQueries[5].count ?? 0,
      total_follows: engagementQueries[6].count ?? 0,
    };

    // horários ideais para publicar / stories / lives
    function hourOf(items: { created_at?: string; started_at?: string }[]): number[] {
      const h = new Array(24).fill(0);
      for (const it of items) {
        const t = it.created_at ?? it.started_at;
        if (!t) continue;
        h[new Date(t).getHours()]++;
      }
      return h;
    }
    const postHours = hourOf(posts);
    const statusHours = hourOf(statuses);
    const liveHours = hourOf(lives);
    const bestPostHour = postHours.indexOf(Math.max(...postHours));
    const bestStatusHour = statusHours.indexOf(Math.max(...statusHours));
    const bestLiveHour = liveHours.indexOf(Math.max(...liveHours));

    // usuários que publicaram status vs retenção
    const statusUserIds = new Set(statuses.map((s) => s.user_id));
    let statusUsersRet = 0, statusUsersTotal = 0;
    for (const p of profs ?? []) {
      if (statusUserIds.has(p.id)) {
        statusUsersTotal++;
        const diffH = (new Date(p.last_seen).getTime() - new Date(p.created_at).getTime()) / 3600_000;
        if (diffH >= 24) statusUsersRet++;
      }
    }
    const statusRetPct = statusUsersTotal > 0 ? (statusUsersRet / statusUsersTotal) * 100 : 0;

    // ================= RECOMENDAÇÕES (regras) =================
    const recs: { level: "info" | "success" | "warn"; text: string }[] = [];
    if (totalPeriod === 0) {
      recs.push({ level: "warn", text: "Nenhum novo cadastro no período selecionado. Considere ampliar a divulgação." });
    }
    if (growthDelta < -20 && (prevCount ?? 0) > 5) {
      recs.push({ level: "warn", text: `Cadastros caíram ${Math.abs(growthDelta).toFixed(0)}% vs período anterior. Revise campanhas e canais.` });
    } else if (growthDelta > 20) {
      recs.push({ level: "success", text: `Cadastros cresceram ${growthDelta.toFixed(0)}% vs período anterior. Bom momento para intensificar investimento.` });
    }
    if (trendPct > 15 && last7.length >= 3) {
      recs.push({ level: "success", text: `Tendência de aceleração: últimos 7 dias +${trendPct.toFixed(0)}% vs primeiros 7 dias do período.` });
    } else if (trendPct < -15 && last7.length >= 3) {
      recs.push({ level: "warn", text: `Desaceleração detectada: últimos 7 dias ${trendPct.toFixed(0)}% vs início do período.` });
    }
    if (byHour.some((v) => v > 0)) {
      recs.push({ level: "info", text: `Melhor horário para cadastros: ${bestSignupHour}h (${byHour[bestSignupHour]} novos usuários neste horário).` });
    }
    if (bestPostHour >= 0 && postHours[bestPostHour] > 0) {
      recs.push({ level: "info", text: `Publique posts próximo das ${bestPostHour}h — foi o horário com mais posts no período.` });
    }
    if (bestStatusHour >= 0 && statusHours[bestStatusHour] > 0) {
      recs.push({ level: "info", text: `Melhor horário para Status: ${bestStatusHour}h.` });
    }
    if (bestLiveHour >= 0 && liveHours[bestLiveHour] > 0) {
      recs.push({ level: "info", text: `Melhor horário para Lives: ${bestLiveHour}h.` });
    }
    if (statusRetPct > retentionD1 + 10 && statusUsersTotal >= 5) {
      recs.push({ level: "success", text: `Usuários que publicaram Status têm ${statusRetPct.toFixed(0)}% de retorno vs ${retentionD1.toFixed(0)}% da média. Incentive Stories.` });
    }
    if (churnRisk > 0 && totalPeriod > 0 && (churnRisk / totalPeriod) > 0.4) {
      recs.push({ level: "warn", text: `${churnRisk} usuários (${((churnRisk / totalPeriod) * 100).toFixed(0)}%) estão sem acessar há mais de 7 dias — risco de abandono.` });
    }
    if (countryRetention.length > 0) {
      const top = countryRetention[0];
      recs.push({ level: "info", text: `${top.country} apresenta a melhor retenção (${top.retention_pct.toFixed(0)}%). Considere campanhas segmentadas.` });
    }
    const topSrc = topN(bySource, 1)[0];
    if (topSrc && totalPeriod >= 5) {
      recs.push({ level: "info", text: `Principal origem no período: "${topSrc.key}" (${topSrc.value} cadastros, ${((topSrc.value / totalPeriod) * 100).toFixed(0)}%).` });
    }
    const topCampaign = topN(byCampaign, 1)[0];
    if (topCampaign) {
      recs.push({ level: "success", text: `Campanha destaque: "${topCampaign.key}" trouxe ${topCampaign.value} cadastros.` });
    }
    if (recs.length === 0) {
      recs.push({ level: "info", text: "Ainda não há dados suficientes para gerar recomendações confiáveis." });
    }

    return {
      period: { label: data.period, start: startISO, end: endISO, days },
      totals: {
        total_users_platform: totalUsers ?? 0,
        new_users_period: totalPeriod,
        prev_period: prevCount ?? 0,
        growth_delta_pct: growthDelta,
        avg_per_day: avgPerDay,
        churn_risk_users: churnRisk,
      },
      series,
      trend: { last7_avg: last7Avg, first7_avg: first7Avg, trend_pct: trendPct },
      forecast,
      acquisition: {
        sources: topN(bySource),
        mediums: topN(byMedium),
        campaigns: topN(byCampaign),
        by_hour: byHour.map((count, hour) => ({ hour, count })),
        best_signup_hour: bestSignupHour,
      },
      audience: {
        browsers: topN(byBrowser),
        os: topN(byOS),
        devices: topN(byDevice),
        countries: topN(byCountry),
      },
      retention: {
        d1_pct: retentionD1,
        d7_pct: retentionD7,
        d1_users: d1Retained,
        d7_users: d7Retained,
        by_country: countryRetention,
        status_publishers_ret_pct: statusRetPct,
      },
      engagement: {
        ...engagement,
        best_post_hour: bestPostHour,
        best_status_hour: bestStatusHour,
        best_live_hour: bestLiveHour,
        post_hours: postHours.map((count, hour) => ({ hour, count })),
      },
      recommendations: recs,
      generated_at: new Date().toISOString(),
    };
  });

/**
 * Perguntas prontas → resposta textual determinística baseada no snapshot já calculado.
 */
export const askGrowthQuestion = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) =>
    z.object({
      question: z.string().min(1),
      period: z.enum(["today", "7d", "30d", "90d", "custom"]).default("30d"),
      from: z.string().optional(),
      to: z.string().optional(),
    }).parse(data),
  )
  .handler(async ({ data, context }) => {
    const { data: mod } = await context.supabase
      .rpc("has_role", { _user_id: context.userId, _role: "moderator" });
    const { data: adm } = await context.supabase
      .rpc("has_role", { _user_id: context.userId, _role: "admin" });
    if (!mod && !adm) throw new Error("Acesso negado");

    // reuse analyze
    const snapshot = await (analyzeGrowth as any)({ data: { period: data.period, from: data.from, to: data.to } });

    const q = data.question;
    const insufficient = "Não há dados suficientes para concluir.";
    let answer = insufficient;

    const format = (n: number) => n.toLocaleString("pt-BR");

    switch (q) {
      case "country_most_users": {
        const top = snapshot.audience.countries[0];
        answer = top ? `${top.key} — ${format(top.value)} usuários no período.` : insufficient;
        break;
      }
      case "country_best_retention": {
        const top = snapshot.retention.by_country[0];
        answer = top ? `${top.country} — retenção D1 de ${top.retention_pct.toFixed(1)}% (${top.total} usuários).` : insufficient;
        break;
      }
      case "best_signup_hour": {
        const h = snapshot.acquisition.best_signup_hour;
        const c = snapshot.acquisition.by_hour[h]?.count ?? 0;
        answer = c > 0 ? `Melhor horário para cadastros: ${h}h (${format(c)} novos usuários).` : insufficient;
        break;
      }
      case "best_source_active": {
        const top = snapshot.acquisition.sources[0];
        answer = top ? `Origem com mais cadastros: "${top.key}" (${format(top.value)}).` : insufficient;
        break;
      }
      case "d1_returned": {
        answer = snapshot.totals.new_users_period > 0
          ? `${format(snapshot.retention.d1_users)} usuários voltaram no dia seguinte (${snapshot.retention.d1_pct.toFixed(1)}% de retenção D1).`
          : insufficient;
        break;
      }
      case "top_feature_used": {
        const e = snapshot.engagement;
        const items = [
          ["Mensagens", e.messages],
          ["Reações", e.reactions],
          ["Posts", e.posts],
          ["Comentários", e.comments],
          ["Status", e.statuses],
          ["Lives", e.lives],
        ].sort((a, b) => (b[1] as number) - (a[1] as number));
        const top = items[0];
        answer = (top[1] as number) > 0 ? `${top[0]} — ${format(top[1] as number)} eventos no período.` : insufficient;
        break;
      }
      case "growth_direction": {
        const d = snapshot.totals.growth_delta_pct;
        const t = snapshot.trend.trend_pct;
        if (snapshot.totals.new_users_period === 0 && snapshot.totals.prev_period === 0) { answer = insufficient; break; }
        answer = `Vs período anterior: ${d >= 0 ? "+" : ""}${d.toFixed(1)}%. Tendência interna: ${t >= 0 ? "+" : ""}${t.toFixed(1)}% (últimos 7 dias vs primeiros 7 dias). ${d > 0 && t > 0 ? "Crescimento acelerando." : d < 0 && t < 0 ? "Crescimento desacelerando." : "Ritmo misto."}`;
        break;
      }
      case "best_campaign": {
        const top = snapshot.acquisition.campaigns[0];
        answer = top ? `Melhor campanha: "${top.key}" com ${format(top.value)} cadastros.` : insufficient;
        break;
      }
      case "avg_daily": {
        answer = snapshot.totals.new_users_period > 0
          ? `Média de ${snapshot.totals.avg_per_day.toFixed(1)} novos cadastros por dia no período (${snapshot.period.days} dias).`
          : insufficient;
        break;
      }
      case "forecast": {
        const f = snapshot.forecast;
        answer = f.next7 > 0
          ? `Projeção: ${format(f.tomorrow)} amanhã, ${format(f.next7)} em 7 dias, ${format(f.next30)} em 30 dias. Base: ${f.basis}. Apenas estimativa.`
          : insufficient;
        break;
      }
      default:
        answer = insufficient;
    }

    return { question: q, answer, generated_at: new Date().toISOString() };
  });
