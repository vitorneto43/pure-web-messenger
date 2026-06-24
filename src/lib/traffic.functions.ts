import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/**
 * Métricas de tráfego do perfil do usuário autenticado (últimos 30 dias).
 * - profile_views_total: visualizações registradas em profile_views
 * - profile_views_unique: viewers únicos
 * - profile_page_views: pageviews na página /u/<username> (analytics_events)
 * - social_link_clicks: cliques nos links das redes sociais
 */
export const getMyProfileTraffic = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { userId } = context;
    const since = new Date(Date.now() - 30 * 24 * 3600 * 1000).toISOString();

    const { data: prof } = await supabaseAdmin
      .from("profiles")
      .select("username")
      .eq("id", userId)
      .maybeSingle();
    const username = prof?.username ?? null;

    const { data: views } = await supabaseAdmin
      .from("profile_views")
      .select("viewer_id, viewed_at")
      .eq("owner_id", userId)
      .gte("viewed_at", since);
    const total = views?.length ?? 0;
    const unique = new Set((views ?? []).map((v) => v.viewer_id)).size;

    let pageViews = 0;
    if (username) {
      const { count } = await supabaseAdmin
        .from("analytics_events")
        .select("id", { count: "exact", head: true })
        .eq("event_name", "public_profile_view")
        .eq("path", `/u/${username}`)
        .gte("created_at", since);
      pageViews = count ?? 0;
    }

    const { count: socialClicks } = await supabaseAdmin
      .from("analytics_events")
      .select("id", { count: "exact", head: true })
      .eq("event_name", "social_link_click")
      .eq("user_id", userId)
      .gte("created_at", since);

    // cliques nos MEUS links (de qualquer visitante) — quando alguém clica num link do meu perfil
    const { count: socialClicksOnMe } = username
      ? await supabaseAdmin
          .from("analytics_events")
          .select("id", { count: "exact", head: true })
          .eq("event_name", "social_link_click_on_profile")
          .contains("metadata", { owner_username: username })
          .gte("created_at", since)
      : { count: 0 };

    return {
      profile_views_total: total,
      profile_views_unique: unique,
      profile_page_views: pageViews,
      social_link_clicks_total: socialClicksOnMe ?? 0,
      social_link_clicks_own: socialClicks ?? 0,
    };
  });

/**
 * Métricas públicas de tráfego de um perfil (por username).
 * Visível a qualquer usuário autenticado.
 */
export const getProfileTrafficByUsername = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { username: string }) => data)
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const since = new Date(Date.now() - 30 * 24 * 3600 * 1000).toISOString();

    const { data: prof } = await supabaseAdmin
      .from("profiles")
      .select("id, username")
      .eq("username", data.username)
      .maybeSingle();
    if (!prof) {
      return {
        profile_views_total: 0,
        profile_views_unique: 0,
        profile_page_views: 0,
        social_link_clicks_total: 0,
      };
    }

    const { data: views } = await supabaseAdmin
      .from("profile_views")
      .select("viewer_id, viewed_at")
      .eq("owner_id", prof.id)
      .gte("viewed_at", since);
    const total = views?.length ?? 0;
    const unique = new Set((views ?? []).map((v) => v.viewer_id)).size;

    const { count: pageViews } = await supabaseAdmin
      .from("analytics_events")
      .select("id", { count: "exact", head: true })
      .eq("event_name", "public_profile_view")
      .eq("path", `/u/${prof.username}`)
      .gte("created_at", since);

    const { count: socialClicks } = await supabaseAdmin
      .from("analytics_events")
      .select("id", { count: "exact", head: true })
      .eq("event_name", "social_link_click_on_profile")
      .contains("metadata", { owner_username: prof.username })
      .gte("created_at", since);

    return {
      profile_views_total: total,
      profile_views_unique: unique,
      profile_page_views: pageViews ?? 0,
      social_link_clicks_total: socialClicks ?? 0,
    };
  });

/**
 * Tráfego global do site nos últimos 7 dias, agrupado por hora do dia (0–23)
 * no fuso horário do servidor (UTC). Cliente converte se quiser.
 */
export const getSiteTrafficByHour = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async () => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const since = new Date(Date.now() - 7 * 24 * 3600 * 1000).toISOString();

    const { data } = await supabaseAdmin
      .from("analytics_events")
      .select("created_at")
      .gte("created_at", since)
      .not("user_id", "in", EXCLUDED_ANALYTICS_USER_IDS_PG)
        .limit(50000);

    const buckets = new Array(24).fill(0) as number[];
    for (const row of data ?? []) {
      const h = new Date(row.created_at).getHours(); // server local
      buckets[h] = (buckets[h] ?? 0) + 1;
    }
    const total = buckets.reduce((a, b) => a + b, 0);
    const peak = buckets.indexOf(Math.max(...buckets));
    return {
      hours: buckets.map((count, hour) => ({ hour, count })),
      total,
      peak_hour: peak,
      window_days: 7,
    };
  });
