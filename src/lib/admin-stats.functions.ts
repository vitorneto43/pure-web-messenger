import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

async function assertAdmin(userId: string) {
  const { data } = await supabaseAdmin
    .from("user_roles")
    .select("role")
    .eq("user_id", userId);
  const roles = (data ?? []).map((r: any) => r.role);
  if (!roles.some((r) => r === "admin" || r === "superadmin" || r === "moderator")) {
    throw new Error("Acesso negado");
  }
}

function daysBack(n: number) {
  const d = new Date();
  d.setUTCHours(0, 0, 0, 0);
  d.setUTCDate(d.getUTCDate() - (n - 1));
  return d.toISOString();
}

function emptyDailySeries(days: number): { date: string; count: number }[] {
  const out: { date: string; count: number }[] = [];
  const start = new Date();
  start.setUTCHours(0, 0, 0, 0);
  start.setUTCDate(start.getUTCDate() - (days - 1));
  for (let i = 0; i < days; i++) {
    const d = new Date(start);
    d.setUTCDate(start.getUTCDate() + i);
    out.push({ date: d.toISOString().slice(0, 10), count: 0 });
  }
  return out;
}

// ============================ STATUS ============================
export const getAdminStatusStats = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context.userId);

    const since1 = daysBack(1);
    const since7 = daysBack(7);
    const since30 = daysBack(30);

    const [
      { count: total },
      { count: today },
      { count: last7 },
      { count: last30 },
      { count: officialCount },
      viewsTotalRes,
      viewsBoostRes,
      ctaClicksRes,
      uniqueAuthorsRes,
      statusesForAvgRes,
      recentRes,
      seriesRes,
      topByViewsRes,
    ] = await Promise.all([
      supabaseAdmin.from("statuses").select("id", { count: "exact", head: true }),
      supabaseAdmin.from("statuses").select("id", { count: "exact", head: true }).gte("created_at", since1),
      supabaseAdmin.from("statuses").select("id", { count: "exact", head: true }).gte("created_at", since7),
      supabaseAdmin.from("statuses").select("id", { count: "exact", head: true }).gte("created_at", since30),
      supabaseAdmin.from("statuses").select("id", { count: "exact", head: true }).eq("is_official", true),
      supabaseAdmin.from("status_views").select("status_id", { count: "exact", head: true }),
      supabaseAdmin.from("status_views").select("status_id", { count: "exact", head: true }).eq("from_boost", true),
      supabaseAdmin.from("status_boost_clicks").select("id", { count: "exact", head: true }),
      supabaseAdmin.from("statuses").select("user_id"),
      supabaseAdmin.from("statuses").select("id"),
      supabaseAdmin.from("statuses").select("id, user_id, kind, cta_label, cta_url, is_official, created_at, expires_at").order("created_at", { ascending: false }).limit(20),
      supabaseAdmin.from("statuses").select("created_at").gte("created_at", since30),
      supabaseAdmin.from("status_views").select("status_id"),
    ]);

    const totalStatuses = total ?? 0;
    const totalViews = viewsTotalRes.count ?? 0;
    const totalCtaClicks = ctaClicksRes.count ?? 0;
    const boostedViews = viewsBoostRes.count ?? 0;
    const ctaCtr = boostedViews > 0 ? (totalCtaClicks / boostedViews) * 100 : 0;
    const avgViewsPerStatus = totalStatuses > 0 ? totalViews / totalStatuses : 0;

    const uniqAuthors = new Set<string>();
    (uniqueAuthorsRes.data ?? []).forEach((r: any) => uniqAuthors.add(r.user_id));

    // Daily series
    const series = emptyDailySeries(30);
    const idx = new Map(series.map((s, i) => [s.date, i] as const));
    (seriesRes.data ?? []).forEach((r: any) => {
      const k = String(r.created_at).slice(0, 10);
      const i = idx.get(k);
      if (i !== undefined) series[i].count++;
    });

    // Views per status -> top 10
    const viewsPerStatus = new Map<string, number>();
    (topByViewsRes.data ?? []).forEach((r: any) => {
      viewsPerStatus.set(r.status_id, (viewsPerStatus.get(r.status_id) ?? 0) + 1);
    });

    // Recent enrich with author + views
    const recent = recentRes.data ?? [];
    const userIds = Array.from(new Set(recent.map((r: any) => r.user_id)));
    const profilesRes = userIds.length
      ? await supabaseAdmin.from("profiles").select("id, display_name, username").in("id", userIds)
      : { data: [] as any[] };
    const profMap = new Map((profilesRes.data ?? []).map((p: any) => [p.id, p]));
    const recentEnriched = recent.map((s: any) => ({
      ...s,
      display_name: profMap.get(s.user_id)?.display_name ?? null,
      username: profMap.get(s.user_id)?.username ?? null,
      views: viewsPerStatus.get(s.id) ?? 0,
    }));

    // Top statuses by views
    const topIds = Array.from(viewsPerStatus.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10);
    const topStatusesRes = topIds.length
      ? await supabaseAdmin
          .from("statuses")
          .select("id, user_id, kind, caption, content, created_at")
          .in("id", topIds.map(([id]) => id))
      : { data: [] as any[] };
    const topUserIds = Array.from(new Set((topStatusesRes.data ?? []).map((s: any) => s.user_id)));
    const topProfRes = topUserIds.length
      ? await supabaseAdmin.from("profiles").select("id, display_name, username").in("id", topUserIds)
      : { data: [] as any[] };
    const topProfMap = new Map((topProfRes.data ?? []).map((p: any) => [p.id, p]));
    const topByViews = topIds.map(([id, count]) => {
      const s = (topStatusesRes.data ?? []).find((x: any) => x.id === id);
      const p = s ? topProfMap.get(s.user_id) : null;
      return {
        id,
        views: count,
        kind: s?.kind ?? null,
        caption: s?.caption ?? s?.content ?? null,
        display_name: p?.display_name ?? null,
        username: p?.username ?? null,
        created_at: s?.created_at ?? null,
      };
    });

    // By kind distribution
    const kindRes = await supabaseAdmin.from("statuses").select("kind");
    const byKind = new Map<string, number>();
    (kindRes.data ?? []).forEach((r: any) => byKind.set(r.kind, (byKind.get(r.kind) ?? 0) + 1));

    return {
      total: totalStatuses,
      today: today ?? 0,
      last7: last7 ?? 0,
      last30: last30 ?? 0,
      official: officialCount ?? 0,
      unique_authors: uniqAuthors.size,
      total_views: totalViews,
      boosted_views: boostedViews,
      total_cta_clicks: totalCtaClicks,
      cta_ctr: Number(ctaCtr.toFixed(2)),
      avg_views_per_status: Number(avgViewsPerStatus.toFixed(2)),
      series,
      by_kind: Array.from(byKind.entries()).map(([name, count]) => ({ name, count })),
      recent: recentEnriched,
      top_by_views: topByViews,
    };
  });

// ============================ FOLLOWERS ============================
export const getAdminFollowersStats = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context.userId);

    const since1 = daysBack(1);
    const since7 = daysBack(7);
    const since30 = daysBack(30);

    const [
      { count: total },
      { count: today },
      { count: last7 },
      { count: last30 },
      allFollowsRes,
      seriesRes,
    ] = await Promise.all([
      supabaseAdmin.from("profile_follows").select("follower_id", { count: "exact", head: true }),
      supabaseAdmin.from("profile_follows").select("follower_id", { count: "exact", head: true }).gte("created_at", since1),
      supabaseAdmin.from("profile_follows").select("follower_id", { count: "exact", head: true }).gte("created_at", since7),
      supabaseAdmin.from("profile_follows").select("follower_id", { count: "exact", head: true }).gte("created_at", since30),
      supabaseAdmin.from("profile_follows").select("follower_id, following_id"),
      supabaseAdmin.from("profile_follows").select("created_at").gte("created_at", since30),
    ]);

    // Top followed
    const followedCount = new Map<string, number>();
    const uniqFollowers = new Set<string>();
    const uniqFollowed = new Set<string>();
    (allFollowsRes.data ?? []).forEach((r: any) => {
      followedCount.set(r.following_id, (followedCount.get(r.following_id) ?? 0) + 1);
      uniqFollowers.add(r.follower_id);
      uniqFollowed.add(r.following_id);
    });
    const topIds = Array.from(followedCount.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 25);
    const topProfRes = topIds.length
      ? await supabaseAdmin
          .from("profiles")
          .select("id, display_name, username, avatar_url")
          .in("id", topIds.map(([id]) => id))
      : { data: [] as any[] };
    const profMap = new Map((topProfRes.data ?? []).map((p: any) => [p.id, p]));
    const topFollowed = topIds.map(([id, count]) => ({
      id,
      followers: count,
      display_name: profMap.get(id)?.display_name ?? null,
      username: profMap.get(id)?.username ?? null,
      avatar_url: profMap.get(id)?.avatar_url ?? null,
    }));

    const series = emptyDailySeries(30);
    const idx = new Map(series.map((s, i) => [s.date, i] as const));
    (seriesRes.data ?? []).forEach((r: any) => {
      const k = String(r.created_at).slice(0, 10);
      const i = idx.get(k);
      if (i !== undefined) series[i].count++;
    });

    return {
      total: total ?? 0,
      today: today ?? 0,
      last7: last7 ?? 0,
      last30: last30 ?? 0,
      unique_followers: uniqFollowers.size,
      unique_followed: uniqFollowed.size,
      avg_followers_per_user: uniqFollowed.size > 0 ? Number(((total ?? 0) / uniqFollowed.size).toFixed(2)) : 0,
      series,
      top_followed: topFollowed,
    };
  });

// ============================ BOOSTS (extended) ============================
export const getAdminBoostStatsFull = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context.userId);

    const since30 = daysBack(30);
    const since7 = daysBack(7);
    const since1 = daysBack(1);

    const [boostsRes, clicksRes, viewsBoostRes, recent30Res] = await Promise.all([
      supabaseAdmin.from("status_boosts").select("id, user_id, status, amount_cents, refunded_amount_cents, views_total, views_remaining, boost_type, objective, package, target_states, created_at, activated_at, ends_at, is_free_reward, currency"),
      supabaseAdmin.from("status_boost_clicks").select("id, boost_id, created_at"),
      supabaseAdmin.from("status_views").select("boost_id, viewed_at").eq("from_boost", true),
      supabaseAdmin.from("status_boosts").select("created_at, amount_cents, status").gte("created_at", since30),
    ]);

    const boosts = boostsRes.data ?? [];
    const clicks = clicksRes.data ?? [];
    const boostViews = viewsBoostRes.data ?? [];

    // Aggregations
    const active = boosts.filter((b: any) => b.status === "active").length;
    const completed = boosts.filter((b: any) => b.status === "completed").length;
    const pending = boosts.filter((b: any) => b.status === "pending").length;
    const failed = boosts.filter((b: any) => b.status === "failed").length;
    const refunded = boosts.filter((b: any) => b.status === "refunded" || (b.refunded_amount_cents ?? 0) > 0).length;
    const last30 = boosts.filter((b: any) => new Date(b.created_at) >= new Date(since30)).length;
    const last7 = boosts.filter((b: any) => new Date(b.created_at) >= new Date(since7)).length;
    const last1 = boosts.filter((b: any) => new Date(b.created_at) >= new Date(since1)).length;

    const paidBoosts = boosts.filter((b: any) => !b.is_free_reward && b.status !== "failed" && b.status !== "pending");
    const totalInvested = paidBoosts.reduce((s: number, b: any) => s + (b.amount_cents ?? 0) - (b.refunded_amount_cents ?? 0), 0);
    const totalRefunded = boosts.reduce((s: number, b: any) => s + (b.refunded_amount_cents ?? 0), 0);
    const avgTicket = paidBoosts.length > 0 ? totalInvested / paidBoosts.length : 0;

    const impressionsDelivered = boostViews.length;
    const impressionsContracted = boosts.reduce((s: number, b: any) => s + (b.views_total ?? 0), 0);
    const impressionsRemaining = boosts
      .filter((b: any) => b.status === "active")
      .reduce((s: number, b: any) => s + (b.views_remaining ?? 0), 0);
    const totalClicks = clicks.length;
    const ctr = impressionsDelivered > 0 ? (totalClicks / impressionsDelivered) * 100 : 0;
    const realCpmCents = impressionsDelivered > 0 ? (totalInvested / impressionsDelivered) * 1000 : 0;
    const avgCpcCents = totalClicks > 0 ? totalInvested / totalClicks : 0;

    // 30d daily series (revenue + impressions + clicks)
    const series = emptyDailySeries(30).map((d) => ({ date: d.date, revenue_cents: 0, impressions: 0, clicks: 0, count: 0 }));
    const sIdx = new Map(series.map((s, i) => [s.date, i] as const));
    (recent30Res.data ?? []).forEach((r: any) => {
      if (r.status === "failed" || r.status === "pending") return;
      const k = String(r.created_at).slice(0, 10);
      const i = sIdx.get(k);
      if (i !== undefined) {
        series[i].revenue_cents += r.amount_cents ?? 0;
        series[i].count++;
      }
    });
    boostViews.forEach((v: any) => {
      const k = String(v.viewed_at).slice(0, 10);
      const i = sIdx.get(k);
      if (i !== undefined) series[i].impressions++;
    });
    clicks.forEach((c: any) => {
      const k = String(c.created_at).slice(0, 10);
      const i = sIdx.get(k);
      if (i !== undefined) series[i].clicks++;
    });

    // By objective / type / package
    const byObjective = new Map<string, { count: number; revenue: number; clicks: number; impressions: number }>();
    const byType = new Map<string, number>();
    const byPackage = new Map<string, number>();
    const byState = new Map<string, number>();
    const clicksByBoost = new Map<string, number>();
    clicks.forEach((c: any) => clicksByBoost.set(c.boost_id, (clicksByBoost.get(c.boost_id) ?? 0) + 1));
    const impressionsByBoost = new Map<string, number>();
    boostViews.forEach((v: any) => {
      if (v.boost_id) impressionsByBoost.set(v.boost_id, (impressionsByBoost.get(v.boost_id) ?? 0) + 1);
    });

    boosts.forEach((b: any) => {
      const o = b.objective || "—";
      const slot = byObjective.get(o) ?? { count: 0, revenue: 0, clicks: 0, impressions: 0 };
      slot.count++;
      slot.revenue += (b.amount_cents ?? 0) - (b.refunded_amount_cents ?? 0);
      slot.clicks += clicksByBoost.get(b.id) ?? 0;
      slot.impressions += impressionsByBoost.get(b.id) ?? 0;
      byObjective.set(o, slot);

      byType.set(b.boost_type || "—", (byType.get(b.boost_type || "—") ?? 0) + 1);
      byPackage.set(b.package || "—", (byPackage.get(b.package || "—") ?? 0) + 1);
      (b.target_states ?? []).forEach((st: string) => {
        byState.set(st, (byState.get(st) ?? 0) + 1);
      });
    });

    // Top campaigns by performance
    const topUserIds = Array.from(new Set(boosts.slice(-200).map((b: any) => b.user_id)));
    const profilesRes = topUserIds.length
      ? await supabaseAdmin.from("profiles").select("id, display_name, username").in("id", topUserIds)
      : { data: [] as any[] };
    const profMap = new Map((profilesRes.data ?? []).map((p: any) => [p.id, p]));

    const campaigns = boosts
      .map((b: any) => {
        const imp = impressionsByBoost.get(b.id) ?? 0;
        const clk = clicksByBoost.get(b.id) ?? 0;
        const p = profMap.get(b.user_id);
        return {
          id: b.id,
          user_id: b.user_id,
          display_name: p?.display_name ?? null,
          username: p?.username ?? null,
          status: b.status,
          objective: b.objective,
          boost_type: b.boost_type,
          amount_cents: b.amount_cents,
          views_total: b.views_total,
          views_remaining: b.views_remaining,
          impressions: imp,
          clicks: clk,
          ctr: imp > 0 ? Number(((clk / imp) * 100).toFixed(2)) : 0,
          conversion_rate: b.views_total > 0 ? Number(((clk / b.views_total) * 100).toFixed(2)) : 0,
          created_at: b.created_at,
          is_free_reward: b.is_free_reward,
        };
      })
      .sort((a: any, b: any) => b.clicks - a.clicks)
      .slice(0, 25);

    return {
      kpis: {
        total: boosts.length,
        active,
        completed,
        pending,
        failed,
        refunded,
        last1,
        last7,
        last30,
        total_invested_cents: totalInvested,
        total_refunded_cents: totalRefunded,
        avg_ticket_cents: Math.round(avgTicket),
        impressions_contracted: impressionsContracted,
        impressions_delivered: impressionsDelivered,
        impressions_remaining: impressionsRemaining,
        total_clicks: totalClicks,
        ctr: Number(ctr.toFixed(2)),
        real_cpm_cents: Math.round(realCpmCents),
        avg_cpc_cents: Math.round(avgCpcCents),
      },
      series,
      by_objective: Array.from(byObjective.entries()).map(([name, v]) => ({
        name,
        count: v.count,
        revenue_cents: v.revenue,
        clicks: v.clicks,
        impressions: v.impressions,
        ctr: v.impressions > 0 ? Number(((v.clicks / v.impressions) * 100).toFixed(2)) : 0,
      })),
      by_type: Array.from(byType.entries()).map(([name, count]) => ({ name, count })),
      by_package: Array.from(byPackage.entries()).map(([name, count]) => ({ name, count })),
      by_state: Array.from(byState.entries())
        .map(([name, count]) => ({ name, count }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 12),
      campaigns,
    };
  });

// ============================ APP ACQUISITION ============================
type AnyRow = Record<string, any>;

function bucketByDay(rows: AnyRow[], days: number, dateField = "created_at") {
  const series = emptyDailySeries(days);
  const map = new Map(series.map((s) => [s.date, 0]));
  for (const r of rows) {
    const d = r[dateField];
    if (!d) continue;
    const key = String(d).slice(0, 10);
    if (map.has(key)) map.set(key, (map.get(key) ?? 0) + 1);
  }
  return series.map((s) => ({ date: s.date, count: map.get(s.date) ?? 0 }));
}

function isAndroidUA(ua: string | null | undefined) {
  if (!ua) return false;
  return /android/i.test(ua) && !/wv\)/i.test(ua) === false ? true : /android/i.test(ua);
}

export const getAdminAppAcquisitionStats = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context.userId);

    const since30 = daysBack(30);
    const since1 = daysBack(1);
    const since7 = daysBack(7);

    const [
      playstoreClicksRes,
      pageViewsRes,
      signupClicksRes,
      loginClicksRes,
      signupCompletedRes,
      appInstallRes,
      appFirstOpenRes,
      appSignupRes,
      appLoginRes,
      profilesAllRes,
      profilesPrivateRes,
      invitesRes,
    ] = await Promise.all([
      supabaseAdmin
        .from("analytics_events")
        .select("id, created_at, user_agent, metadata, path, referrer, session_id")
        .eq("event_name", "playstore_click")
        .gte("created_at", since30)
        .order("created_at", { ascending: false })
        .limit(5000),
      supabaseAdmin
        .from("analytics_events")
        .select("id, created_at")
        .eq("event_name", "page_view")
        .gte("created_at", since30)
        .limit(20000),
      supabaseAdmin
        .from("analytics_events")
        .select("id, created_at")
        .eq("event_name", "signup_click")
        .gte("created_at", since30)
        .limit(5000),
      supabaseAdmin
        .from("analytics_events")
        .select("id, created_at")
        .eq("event_name", "login_click")
        .gte("created_at", since30)
        .limit(5000),
      supabaseAdmin
        .from("analytics_events")
        .select("id, user_id, created_at, user_agent, metadata")
        .eq("event_name", "signup_completed")
        .gte("created_at", since30)
        .limit(5000),
      supabaseAdmin
        .from("analytics_events")
        .select("id, created_at, session_id")
        .eq("event_name", "app_install")
        .gte("created_at", since30)
        .limit(10000),
      supabaseAdmin
        .from("analytics_events")
        .select("id, created_at, user_id")
        .eq("event_name", "app_first_open")
        .gte("created_at", since30)
        .limit(10000),
      supabaseAdmin
        .from("analytics_events")
        .select("id, created_at, user_id")
        .eq("event_name", "app_signup")
        .gte("created_at", since30)
        .limit(10000),
      supabaseAdmin
        .from("analytics_events")
        .select("id, created_at, user_id")
        .eq("event_name", "app_login")
        .gte("created_at", since30)
        .limit(20000),
      supabaseAdmin
        .from("profiles")
        .select("id, created_at, last_seen, signup_source, signup_medium, signup_campaign, signup_referrer, username, display_name, avatar_url")
        .limit(20000),
      supabaseAdmin
        .from("profiles_private")
        .select("user_id, device_platform, country, region, city, app_version")
        .limit(20000),
      supabaseAdmin
        .from("profiles")
        .select("id, invited_by, created_at")
        .not("invited_by", "is", null)
        .limit(20000),
    ]);

    const clicks = playstoreClicksRes.data ?? [];
    const pageViews = pageViewsRes.data ?? [];
    const signupClicks = signupClicksRes.data ?? [];
    const loginClicks = loginClicksRes.data ?? [];
    const signupCompleted = signupCompletedRes.data ?? [];
    const appInstalls = appInstallRes.data ?? [];
    const appFirstOpens = appFirstOpenRes.data ?? [];
    const appSignups = appSignupRes.data ?? [];
    const appLogins = appLoginRes.data ?? [];
    const profiles = profilesAllRes.data ?? [];
    const priv = profilesPrivateRes.data ?? [];
    const invites = invitesRes.data ?? [];

    // Map device by user
    const deviceByUser = new Map<string, string>();
    const geoByUser = new Map<string, { country?: string; region?: string; city?: string }>();
    for (const p of priv) {
      if (p.device_platform) deviceByUser.set(p.user_id, p.device_platform);
      geoByUser.set(p.user_id, { country: p.country ?? undefined, region: p.region ?? undefined, city: p.city ?? undefined });
    }

    // Android profiles (proxy for "instalou e abriu o app")
    const androidProfiles = profiles.filter((p: any) => deviceByUser.get(p.id) === "android");
    const androidIds = new Set(androidProfiles.map((p: any) => p.id));

    // Clicks breakdown by "from"
    const clicksFrom = new Map<string, number>();
    for (const c of clicks) {
      const from = (c.metadata as AnyRow)?.from ?? "outro";
      clicksFrom.set(from, (clicksFrom.get(from) ?? 0) + 1);
    }

    // Origin (signup_source) breakdown
    const sourceMap = new Map<string, number>();
    for (const p of profiles) {
      const src = (p as any).signup_source || "direct";
      sourceMap.set(src, (sourceMap.get(src) ?? 0) + 1);
    }

    // Country / region
    const countryMap = new Map<string, number>();
    const regionMap = new Map<string, number>();
    const cityMap = new Map<string, number>();
    for (const p of priv) {
      if (p.country) countryMap.set(p.country, (countryMap.get(p.country) ?? 0) + 1);
      if (p.region) regionMap.set(p.region, (regionMap.get(p.region) ?? 0) + 1);
      if (p.city) cityMap.set(p.city, (cityMap.get(p.city) ?? 0) + 1);
    }
    const androidCountryMap = new Map<string, number>();
    for (const p of androidProfiles) {
      const g = geoByUser.get((p as any).id);
      if (g?.country) androidCountryMap.set(g.country, (androidCountryMap.get(g.country) ?? 0) + 1);
    }

    // DAU/MAU (android)
    const now = Date.now();
    const dayMs = 24 * 60 * 60 * 1000;
    const dau = androidProfiles.filter((p: any) => p.last_seen && now - new Date(p.last_seen).getTime() < dayMs).length;
    const mau = androidProfiles.filter((p: any) => p.last_seen && now - new Date(p.last_seen).getTime() < 30 * dayMs).length;

    // Retention (android) — D1, D7, D30: % of users whose last_seen is >= created_at + N days
    function retention(days: number) {
      const cohort = androidProfiles.filter((p: any) => {
        const created = new Date(p.created_at).getTime();
        return now - created >= days * dayMs;
      });
      if (cohort.length === 0) return 0;
      const retained = cohort.filter((p: any) => {
        const created = new Date(p.created_at).getTime();
        const seen = p.last_seen ? new Date(p.last_seen).getTime() : 0;
        return seen - created >= days * dayMs;
      }).length;
      return Number(((retained / cohort.length) * 100).toFixed(1));
    }

    // Engagement post-install (android users)
    let messagesCount = 0, callsCount = 0, statusesCount = 0, followersGainedCount = 0, groupsCount = 0;
    if (androidIds.size > 0) {
      const ids = Array.from(androidIds);
      const [m, c, s, f, g] = await Promise.all([
        supabaseAdmin.from("messages").select("id", { count: "exact", head: true }).in("sender_id", ids),
        supabaseAdmin.from("calls").select("id", { count: "exact", head: true }).in("caller_id", ids),
        supabaseAdmin.from("statuses").select("id", { count: "exact", head: true }).in("user_id", ids),
        supabaseAdmin.from("profile_follows").select("follower_id", { count: "exact", head: true }).in("following_id", ids),
        supabaseAdmin.from("conversations").select("id", { count: "exact", head: true }).eq("is_group", true).in("created_by", ids),
      ]);
      messagesCount = m.count ?? 0;
      callsCount = c.count ?? 0;
      statusesCount = s.count ?? 0;
      followersGainedCount = f.count ?? 0;
      groupsCount = g.count ?? 0;
    }

    // Top invitadores (using profiles.invited_by)
    const inviteCount = new Map<string, number>();
    for (const i of invites) {
      const inv = (i as any).invited_by;
      if (inv) inviteCount.set(inv, (inviteCount.get(inv) ?? 0) + 1);
    }
    const topInviters = Array.from(inviteCount.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([id, count]) => {
        const p: any = profiles.find((x: any) => x.id === id);
        return { id, count, display_name: p?.display_name, username: p?.username, avatar_url: p?.avatar_url };
      });

    // Top active android users
    const topActive = androidProfiles
      .slice()
      .sort((a: any, b: any) => new Date(b.last_seen).getTime() - new Date(a.last_seen).getTime())
      .slice(0, 10)
      .map((p: any) => ({ id: p.id, display_name: p.display_name, username: p.username, avatar_url: p.avatar_url, last_seen: p.last_seen }));

    // Últimos cadastros via app (evento app_signup)
    const profileById = new Map(profiles.map((p: any) => [p.id, p]));
    const recentAppSignups = appSignups
      .filter((e: any) => e.user_id)
      .sort((a: any, b: any) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
      .slice(0, 20)
      .map((e: any) => {
        const p: any = profileById.get(e.user_id) ?? {};
        const g = geoByUser.get(e.user_id) ?? {};
        return {
          id: e.user_id,
          created_at: e.created_at,
          display_name: p.display_name ?? null,
          username: p.username ?? null,
          avatar_url: p.avatar_url ?? null,
          device_platform: deviceByUser.get(e.user_id) ?? "android",
          country: g.country ?? null,
          city: g.city ?? null,
        };
      });

    // Series (30d)
    const clicksSeries = bucketByDay(clicks as AnyRow[], 30);
    const signupsSeries = bucketByDay(androidProfiles as AnyRow[], 30);
    const allSignupsSeries = bucketByDay(profiles as AnyRow[], 30);

    // Active per day (android, by last_seen)
    const activeSeries = (() => {
      const series = emptyDailySeries(30);
      const map = new Map(series.map((s) => [s.date, 0]));
      for (const p of androidProfiles as any[]) {
        if (!p.last_seen) continue;
        const key = String(p.last_seen).slice(0, 10);
        if (map.has(key)) map.set(key, (map.get(key) ?? 0) + 1);
      }
      return series.map((s) => ({ date: s.date, count: map.get(s.date) ?? 0 }));
    })();

    // Funnel — usa eventos reais quando disponíveis (últimos 30d), com fallback p/ proxy
    const totalVisitors = new Set(pageViews.map((p: any) => p.id)).size || pageViews.length;
    const totalClicks = clicks.length;
    // Instalações: distintas por session_id do evento app_install (uma por dispositivo)
    const installSessions = new Set(appInstalls.map((e: any) => e.session_id).filter(Boolean));
    const eventInstalls = installSessions.size || appInstalls.length;
    const totalInstalls = eventInstalls > 0 ? eventInstalls : androidProfiles.length;
    // Primeira abertura: distinta por user_id
    const firstOpenUsers = new Set(appFirstOpens.map((e: any) => e.user_id).filter(Boolean));
    const eventFirstOpens = firstOpenUsers.size || appFirstOpens.length;
    const totalFirstOpens = eventFirstOpens > 0 ? eventFirstOpens : androidProfiles.length;
    // Cadastros via app: evento app_signup OR perfis android criados nos últimos 30d
    const signupUsers = new Set(appSignups.map((e: any) => e.user_id).filter(Boolean));
    const eventSignups = signupUsers.size || appSignups.length;
    const since30Ms = new Date(since30).getTime();
    const androidSignups30d = androidProfiles.filter((p: any) => new Date(p.created_at).getTime() >= since30Ms).length;
    const totalSignupsApp = eventSignups > 0 ? eventSignups : androidSignups30d;
    // Logins via app: cada app_login conta; fallback p/ heurística last_seen
    const eventLogins = appLogins.length;
    const totalLoginsApp = eventLogins > 0
      ? eventLogins
      : androidProfiles.filter((p: any) => p.last_seen && new Date(p.last_seen).getTime() > new Date(p.created_at).getTime() + 60_000).length;
    const totalActive = mau;

    function pct(num: number, den: number) {
      return den > 0 ? Number(((num / den) * 100).toFixed(1)) : 0;
    }

    return {
      // Summary
      total_clicks: totalClicks,
      total_installs: totalInstalls,
      total_first_opens: totalFirstOpens,
      total_signups_app: totalSignupsApp,
      total_logins_app: totalLoginsApp,
      conv_click_to_install: pct(totalInstalls, totalClicks),
      conv_install_to_signup: pct(totalSignupsApp, totalInstalls),
      conv_signup_to_login: pct(totalLoginsApp, totalSignupsApp),
      dau,
      mau,
      // Web context
      total_pageviews: pageViews.length,
      total_signup_clicks: signupClicks.length,
      total_login_clicks: loginClicks.length,
      total_signups_global: new Set(signupCompleted.map((e: any) => e.user_id ?? e.id).filter(Boolean)).size || signupCompleted.length,
      // Funnel stages
      funnel: [
        { stage: "Visitas web (30d)", value: pageViews.length },
        { stage: "Cliques baixar app", value: totalClicks },
        { stage: "Instalações (Android)", value: totalInstalls },
        { stage: "Primeira abertura", value: totalFirstOpens },
        { stage: "Cadastro app", value: totalSignupsApp },
        { stage: "Login app", value: totalLoginsApp },
        { stage: "Usuário ativo (MAU)", value: totalActive },
      ],
      // Series
      clicks_series: clicksSeries,
      signups_series: signupsSeries,
      all_signups_series: allSignupsSeries,
      active_series: activeSeries,
      // Breakdowns
      clicks_by_source: Array.from(clicksFrom.entries()).map(([name, count]) => ({ name, count })),
      sources: Array.from(sourceMap.entries()).map(([name, count]) => ({ name, count })).sort((a, b) => b.count - a.count),
      countries: Array.from(countryMap.entries()).map(([name, count]) => ({ name, count })).sort((a, b) => b.count - a.count).slice(0, 15),
      regions: Array.from(regionMap.entries()).map(([name, count]) => ({ name, count })).sort((a, b) => b.count - a.count).slice(0, 15),
      cities: Array.from(cityMap.entries()).map(([name, count]) => ({ name, count })).sort((a, b) => b.count - a.count).slice(0, 15),
      android_countries: Array.from(androidCountryMap.entries()).map(([name, count]) => ({ name, count })).sort((a, b) => b.count - a.count).slice(0, 15),
      // Retention
      retention_d1: retention(1),
      retention_d7: retention(7),
      retention_d30: retention(30),
      // Engagement
      engagement: {
        messages: messagesCount,
        calls: callsCount,
        statuses: statusesCount,
        followers_gained: followersGainedCount,
        groups: groupsCount,
        invites_sent: invites.filter((i: any) => androidIds.has(i.invited_by)).length,
      },
      // Rankings
      top_inviters: topInviters,
      top_active: topActive,
    };
  });
