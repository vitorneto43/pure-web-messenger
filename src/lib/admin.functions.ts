import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { getRequest, getRequestHeader } from "@tanstack/react-start/server";
import { scryptSync, randomBytes, timingSafeEqual } from "crypto";

// PIN hashing via scrypt (Node built-in).
function hashPin(pin: string): string {
  const salt = randomBytes(16);
  const key = scryptSync(pin, salt, 32);
  return `s1$${salt.toString("hex")}$${key.toString("hex")}`;
}
function verifyPin(pin: string, stored: string): boolean {
  const parts = stored.split("$");
  if (parts.length !== 3 || parts[0] !== "s1") return false;
  try {
    const salt = Buffer.from(parts[1], "hex");
    const expected = Buffer.from(parts[2], "hex");
    const actual = scryptSync(pin, salt, expected.length);
    return actual.length === expected.length && timingSafeEqual(actual, expected);
  } catch {
    return false;
  }
}

// ============ Helpers ============
async function assertAdmin(userId: string) {
  const { data, error } = await supabaseAdmin
    .from("user_roles")
    .select("role")
    .eq("user_id", userId)
    .eq("role", "admin")
    .maybeSingle();
  if (error) throw new Error("Falha ao verificar permissão");
  if (!data) throw new Error("Acesso negado");
}

function getClientIP() {
  try {
    const req = getRequest();
    const xff = req.headers.get("x-forwarded-for");
    if (xff) return xff.split(",")[0]!.trim();
    const cf = req.headers.get("cf-connecting-ip");
    if (cf) return cf;
    return req.headers.get("x-real-ip") ?? null;
  } catch {
    return null;
  }
}

async function logAdmin(
  userId: string | null,
  action: string,
  success: boolean,
  metadata: Record<string, unknown> = {},
) {
  try {
    await supabaseAdmin.from("admin_access_logs").insert({
      user_id: userId,
      action,
      success,
      ip: getClientIP(),
      user_agent: (() => {
        try {
          return getRequestHeader("user-agent") ?? null;
        } catch {
          return null;
        }
      })(),
      metadata: metadata as never,
    });
  } catch (e) {
    console.error("logAdmin failed", e);
  }
}

// ============ Role / PIN ============
export const checkAdminAccess = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { userId } = context;
    const { data: roleRow } = await supabaseAdmin
      .from("user_roles")
      .select("role")
      .eq("user_id", userId)
      .eq("role", "admin")
      .maybeSingle();
    const isAdmin = !!roleRow;
    const { data: pinRow } = await supabaseAdmin
      .from("admin_pins")
      .select("user_id")
      .eq("user_id", userId)
      .maybeSingle();
    return { isAdmin, hasPin: !!pinRow };
  });

export const setAdminPin = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({ pin: z.string().regex(/^\d{6}$/), currentPin: z.string().regex(/^\d{6}$/).optional() }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const { userId } = context;
    await assertAdmin(userId);

    const { data: existing } = await supabaseAdmin
      .from("admin_pins")
      .select("pin_hash")
      .eq("user_id", userId)
      .maybeSingle();

    if (existing) {
      if (!data.currentPin) throw new Error("PIN atual obrigatório");
      if (!verifyPin(data.currentPin, existing.pin_hash)) {
        await logAdmin(userId, "pin_change_fail", false);
        throw new Error("PIN atual incorreto");
      }
    }

    const newHash = hashPin(data.pin);
    const { error } = await supabaseAdmin
      .from("admin_pins")
      .upsert({ user_id: userId, pin_hash: newHash, updated_at: new Date().toISOString() });
    if (error) throw new Error(error.message);
    await logAdmin(userId, existing ? "pin_changed" : "pin_set", true);
    return { ok: true };
  });

export const verifyAdminPin = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ pin: z.string().regex(/^\d{6}$/) }).parse(d))
  .handler(async ({ data, context }) => {
    const { userId } = context;
    await assertAdmin(userId);
    const { data: row } = await supabaseAdmin
      .from("admin_pins")
      .select("pin_hash")
      .eq("user_id", userId)
      .maybeSingle();
    if (!row) {
      await logAdmin(userId, "pin_verify_no_pin", false);
      return { ok: false as const, reason: "no_pin" as const };
    }
    const ok = verifyPin(data.pin, row.pin_hash);
    await logAdmin(userId, ok ? "pin_ok" : "pin_fail", ok);
    return ok ? { ok: true as const } : { ok: false as const, reason: "invalid" as const };
  });

// ============ Metrics ============
export const getOverviewMetrics = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context.userId);
    await logAdmin(context.userId, "view_dashboard", true);

    const now = new Date();
    const d1 = new Date(now.getTime() - 24 * 3600 * 1000).toISOString();
    const d7 = new Date(now.getTime() - 7 * 86400 * 1000).toISOString();
    const d30 = new Date(now.getTime() - 30 * 86400 * 1000).toISOString();
    const d60 = new Date(now.getTime() - 60 * 86400 * 1000).toISOString();

    const c = (q: any) => q.then((r: any) => r.count ?? 0);

    const [total, new1, new7, new30, prev30, active1, active7, active30] = await Promise.all([
      c(supabaseAdmin.from("profiles").select("id", { count: "exact", head: true })),
      c(supabaseAdmin.from("profiles").select("id", { count: "exact", head: true }).gte("created_at", d1)),
      c(supabaseAdmin.from("profiles").select("id", { count: "exact", head: true }).gte("created_at", d7)),
      c(supabaseAdmin.from("profiles").select("id", { count: "exact", head: true }).gte("created_at", d30)),
      c(
        supabaseAdmin
          .from("profiles")
          .select("id", { count: "exact", head: true })
          .gte("created_at", d60)
          .lt("created_at", d30),
      ),
      c(supabaseAdmin.from("profiles").select("id", { count: "exact", head: true }).gte("last_seen", d1)),
      c(supabaseAdmin.from("profiles").select("id", { count: "exact", head: true }).gte("last_seen", d7)),
      c(supabaseAdmin.from("profiles").select("id", { count: "exact", head: true }).gte("last_seen", d30)),
    ]);

    const growthPct = prev30 > 0 ? ((new30 - prev30) / prev30) * 100 : new30 > 0 ? 100 : 0;

    // 30-day signup series
    const { data: rows } = await supabaseAdmin
      .from("profiles")
      .select("created_at")
      .gte("created_at", d30)
      .order("created_at", { ascending: true });
    const series = bucketByDay(rows ?? [], 30, "created_at");

    return {
      total,
      new1,
      new7,
      new30,
      active1,
      active7,
      active30,
      growthPct,
      series,
    };
  });

export const getUserAnalytics = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context.userId);

    const byCountry = await supabaseAdmin
      .from("profiles")
      .select("country")
      .not("country", "is", null);
    const byRegion = await supabaseAdmin
      .from("profiles")
      .select("region")
      .not("region", "is", null);
    const byCity = await supabaseAdmin
      .from("profiles")
      .select("city")
      .not("city", "is", null);
    const byPlat = await supabaseAdmin
      .from("profiles")
      .select("device_platform")
      .not("device_platform", "is", null);
    const byVer = await supabaseAdmin
      .from("profiles")
      .select("app_version")
      .not("app_version", "is", null);

    const { data: latest } = await supabaseAdmin
      .from("profiles")
      .select("id, username, display_name, last_seen, device_platform, country")
      .order("last_seen", { ascending: false })
      .limit(20);

    return {
      countries: countTop(byCountry.data ?? [], "country"),
      regions: countTop(byRegion.data ?? [], "region"),
      cities: countTop(byCity.data ?? [], "city"),
      platforms: countTop(byPlat.data ?? [], "device_platform"),
      versions: countTop(byVer.data ?? [], "app_version"),
      latestSeen: latest ?? [],
    };
  });

export const getEngagementMetrics = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context.userId);
    const now = new Date();
    const d30 = new Date(now.getTime() - 30 * 86400 * 1000).toISOString();
    const d1 = new Date(now.getTime() - 86400 * 1000).toISOString();

    const c = (q: any) => q.then((r: any) => r.count ?? 0);
    const [totalMsgs, msgs1, msgs30, totalGroups, groups30, totalUsers] = await Promise.all([
      c(supabaseAdmin.from("messages").select("id", { count: "exact", head: true })),
      c(supabaseAdmin.from("messages").select("id", { count: "exact", head: true }).gte("created_at", d1)),
      c(supabaseAdmin.from("messages").select("id", { count: "exact", head: true }).gte("created_at", d30)),
      c(supabaseAdmin.from("conversations").select("id", { count: "exact", head: true }).eq("is_group", true)),
      c(
        supabaseAdmin
          .from("conversations")
          .select("id", { count: "exact", head: true })
          .eq("is_group", true)
          .gte("created_at", d30),
      ),
      c(supabaseAdmin.from("profiles").select("id", { count: "exact", head: true })),
    ]);

    const { data: msgRows } = await supabaseAdmin
      .from("messages")
      .select("created_at")
      .gte("created_at", d30);
    const series = bucketByDay(msgRows ?? [], 30, "created_at");
    const byHour = bucketByHour(msgRows ?? [], "created_at");

    const avgPerUser = totalUsers > 0 ? totalMsgs / totalUsers : 0;

    return { totalMsgs, msgs1, msgs30, totalGroups, groups30, avgPerUser, series, byHour };
  });

export const getCallMetrics = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context.userId);
    const now = new Date();
    const d30 = new Date(now.getTime() - 30 * 86400 * 1000).toISOString();
    const d1 = new Date(now.getTime() - 86400 * 1000).toISOString();

    const { data: all } = await supabaseAdmin
      .from("calls")
      .select("id, kind, status, started_at, ended_at, created_at")
      .gte("created_at", d30);

    const rows = all ?? [];
    const totalAudio = rows.filter((r) => r.kind === "audio").length;
    const totalVideo = rows.filter((r) => r.kind === "video").length;
    const completed = rows.filter((r) => r.status === "ended" && r.started_at && r.ended_at);
    const durations = completed.map(
      (r) => (new Date(r.ended_at!).getTime() - new Date(r.started_at!).getTime()) / 1000,
    );
    const avgDuration = durations.length ? durations.reduce((a, b) => a + b, 0) / durations.length : 0;
    const success = completed.length;
    const failed = rows.filter((r) => ["missed", "rejected", "failed", "canceled"].includes(r.status)).length;
    const total = rows.length;
    const successRate = total ? (success / total) * 100 : 0;
    const failRate = total ? (failed / total) * 100 : 0;

    const statusCounts = countTop(rows.map((r) => ({ status: r.status })), "status");

    const d1Count = rows.filter((r) => new Date(r.created_at) >= new Date(d1)).length;
    const series = bucketByDay(rows, 30, "created_at");

    return {
      totalAudio,
      totalVideo,
      total,
      avgDuration,
      successRate,
      failRate,
      callsToday: d1Count,
      series,
      statusCounts,
    };
  });

export const getAIMetrics = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context.userId);
    const now = new Date();
    const d30 = new Date(now.getTime() - 30 * 86400 * 1000).toISOString();
    const { data: rows } = await supabaseAdmin
      .from("ai_usage_logs")
      .select("feature, input_chars, output_chars, created_at")
      .gte("created_at", d30);
    const r = rows ?? [];
    const total = r.length;
    const byFeature = countTop(r.map((x) => ({ feature: x.feature })), "feature");
    const totalInput = r.reduce((s, x) => s + (x.input_chars ?? 0), 0);
    const totalOutput = r.reduce((s, x) => s + (x.output_chars ?? 0), 0);
    // very rough estimate: chars/4 = tokens; gemini-flash ~ $0.075 / 1M input, $0.30 / 1M output
    const tokensIn = totalInput / 4;
    const tokensOut = totalOutput / 4;
    const costUsd = (tokensIn / 1_000_000) * 0.075 + (tokensOut / 1_000_000) * 0.3;
    const series = bucketByDay(r, 30, "created_at");
    return { total, byFeature, totalInput, totalOutput, tokensIn, tokensOut, costUsd, series };
  });

export const getShareMetrics = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context.userId);
    const now = new Date();
    const d30 = new Date(now.getTime() - 30 * 86400 * 1000).toISOString();
    const { data: rows } = await supabaseAdmin
      .from("share_logs")
      .select("target, content_type, created_at")
      .gte("created_at", d30);
    const r = rows ?? [];
    return {
      total: r.length,
      byTarget: countTop(r.map((x) => ({ target: x.target })), "target"),
      byType: countTop(r.map((x) => ({ content_type: x.content_type })), "content_type"),
      series: bucketByDay(r, 30, "created_at"),
    };
  });

export const getSystemStatus = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context.userId);

    // DB ping
    const dbStart = Date.now();
    const { error: dbErr } = await supabaseAdmin.from("profiles").select("id").limit(1);
    const dbMs = Date.now() - dbStart;

    // AI Gateway ping (HEAD; if fails just mark offline)
    let aiOk = false;
    let aiMs = 0;
    if (process.env.LOVABLE_API_KEY) {
      const aiStart = Date.now();
      try {
        const r = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${process.env.LOVABLE_API_KEY}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            model: "google/gemini-2.5-flash-lite",
            messages: [{ role: "user", content: "ping" }],
            max_tokens: 1,
          }),
        });
        aiMs = Date.now() - aiStart;
        aiOk = r.ok || r.status === 429; // rate limit still means service is up
      } catch {
        aiOk = false;
      }
    }

    // Metered (TURN) ping
    let meteredOk = false;
    if (process.env.METERED_API_KEY && process.env.METERED_APP_NAME) {
      try {
        const r = await fetch(
          `https://${process.env.METERED_APP_NAME}.metered.live/api/v1/turn/credentials?apiKey=${process.env.METERED_API_KEY}`,
        );
        meteredOk = r.ok;
      } catch {
        meteredOk = false;
      }
    }

    // recent errors from admin logs
    const { data: errs } = await supabaseAdmin
      .from("admin_access_logs")
      .select("id, action, success, created_at, user_id")
      .eq("success", false)
      .order("created_at", { ascending: false })
      .limit(20);

    return {
      db: { ok: !dbErr, ms: dbMs },
      ai: { ok: aiOk, ms: aiMs, configured: !!process.env.LOVABLE_API_KEY },
      metered: { ok: meteredOk, configured: !!(process.env.METERED_API_KEY && process.env.METERED_APP_NAME) },
      server: { ok: true, ts: new Date().toISOString() },
      recentErrors: errs ?? [],
    };
  });

export const getAdminAccessLogs = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context.userId);
    const { data } = await supabaseAdmin
      .from("admin_access_logs")
      .select("id, user_id, action, success, ip, user_agent, created_at")
      .order("created_at", { ascending: false })
      .limit(100);
    return { logs: data ?? [] };
  });

export const getUserConfirmationStats = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context.userId);
    const { data, error } = await supabaseAdmin.rpc("admin_user_confirmation_stats" as never);
    if (error) throw new Error(error.message);
    return data as {
      confirmed: number;
      unconfirmed: number;
      unconfirmedList: Array<{
        id: string;
        email: string | null;
        created_at: string;
        username: string | null;
        display_name: string | null;
      }>;
      confirmedRecent: Array<{
        id: string;
        email: string | null;
        created_at: string;
        email_confirmed_at: string | null;
        username: string | null;
        display_name: string | null;
      }>;
    };
  });

export const getSignupSources = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context.userId);
    const { data, error } = await supabaseAdmin.rpc("admin_signup_sources" as never);
    if (error) throw new Error(error.message);
    return data as {
      total: number;
      bySource: Array<{ source: string; count: number }>;
      byCampaign: Array<{ source: string; campaign: string; medium: string; count: number }>;
      recent: Array<{
        id: string;
        username: string | null;
        display_name: string | null;
        created_at: string;
        source: string;
        signup_medium: string | null;
        signup_campaign: string | null;
        signup_referrer: string | null;
      }>;
      series: Array<{ date: string; source: string; count: number }>;
    };
  });

export const getUsageAnalytics = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ days: z.number().int().min(1).max(180).default(30) }).parse(d))
  .handler(async ({ data, context }) => {
    await assertAdmin(context.userId);
    const { data: out, error } = await supabaseAdmin.rpc("admin_usage_analytics" as never, { _days: data.days });
    if (error) throw new Error(error.message);
    return out as {
      totalEvents: number;
      uniqueSessions: number;
      pageViews: number;
      days: number;
      byEvent: Array<{ name: string; count: number }>;
      byPath: Array<{ path: string; views: number; unique_sessions: number }>;
      funnel: {
        visits: number;
        signup_clicks: number;
        signup_completed: number;
        login_clicks: number;
        help_clicks: number;
        abandon_after_click: number;
        click_through_rate: number;
        conversion_rate: number;
      };
      series: Array<{ date: string; views: number; visits: number; signup_clicks: number; signups: number }>;
    };
  });

// ============ Utils ============
function bucketByDay(rows: { [k: string]: unknown }[], days: number, key: string) {
  const map = new Map<string, number>();
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(today.getTime() - i * 86400 * 1000);
    map.set(d.toISOString().slice(0, 10), 0);
  }
  for (const r of rows) {
    const v = r[key] as string | undefined;
    if (!v) continue;
    const day = v.slice(0, 10);
    if (map.has(day)) map.set(day, (map.get(day) ?? 0) + 1);
  }
  return Array.from(map.entries()).map(([date, count]) => ({ date, count }));
}

function bucketByHour(rows: { [k: string]: unknown }[], key: string) {
  const arr = Array.from({ length: 24 }, (_, h) => ({ hour: h, count: 0 }));
  for (const r of rows) {
    const v = r[key] as string | undefined;
    if (!v) continue;
    const h = new Date(v).getHours();
    arr[h].count += 1;
  }
  return arr;
}

function countTop<T extends Record<string, unknown>>(rows: T[], key: keyof T) {
  const map = new Map<string, number>();
  for (const r of rows) {
    const v = String(r[key] ?? "—");
    map.set(v, (map.get(v) ?? 0) + 1);
  }
  return Array.from(map.entries())
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 15);
}
