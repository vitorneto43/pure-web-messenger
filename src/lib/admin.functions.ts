import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { EXCLUDED_ANALYTICS_USER_IDS_PG } from "@/lib/analytics-exclusions";
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
type RoleName = "user" | "moderator" | "admin" | "superadmin";
const ROLE_RANK: Record<RoleName, number> = { user: 10, moderator: 20, admin: 30, superadmin: 40 };

async function getUserRoles(userId: string): Promise<RoleName[]> {
  const { data, error } = await supabaseAdmin
    .from("user_roles")
    .select("role")
    .eq("user_id", userId);
  if (error) throw new Error("Falha ao verificar permissão");
  return (data ?? []).map((r) => r.role as RoleName);
}

function maxRank(roles: RoleName[]): number {
  return roles.reduce((m, r) => Math.max(m, ROLE_RANK[r] ?? 0), 0);
}

async function assertMinRole(userId: string, min: RoleName) {
  const roles = await getUserRoles(userId);
  if (maxRank(roles) < ROLE_RANK[min]) throw new Error("Acesso negado");
}

async function assertAdmin(userId: string) {
  await assertMinRole(userId, "moderator");
}

async function assertSuperadmin(userId: string) {
  await assertMinRole(userId, "superadmin");
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
    const roles = await getUserRoles(userId);
    const rank = maxRank(roles);
    const isAdmin = rank >= ROLE_RANK.moderator; // moderator+ can access painel
    const isSuperadmin = rank >= ROLE_RANK.superadmin;
    const canEdit = rank >= ROLE_RANK.admin;
    const topRole: RoleName =
      rank >= ROLE_RANK.superadmin ? "superadmin"
      : rank >= ROLE_RANK.admin ? "admin"
      : rank >= ROLE_RANK.moderator ? "moderator"
      : "user";
    const { data: pinRow } = await supabaseAdmin
      .from("admin_pins")
      .select("user_id")
      .eq("user_id", userId)
      .maybeSingle();
    return { isAdmin, isSuperadmin, canEdit, role: topRole, hasPin: !!pinRow };
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
      .from("profiles_private")
      .select("country")
      .not("country", "is", null);
    const byRegion = await supabaseAdmin
      .from("profiles_private")
      .select("region")
      .not("region", "is", null);
    const byCity = await supabaseAdmin
      .from("profiles_private")
      .select("city")
      .not("city", "is", null);
    const byPlat = await supabaseAdmin
      .from("profiles_private")
      .select("device_platform")
      .not("device_platform", "is", null);
    const byVer = await supabaseAdmin
      .from("profiles_private")
      .select("app_version")
      .not("app_version", "is", null);

    const { data: latestProfiles } = await supabaseAdmin
      .from("profiles")
      .select("id, username, display_name, last_seen")
      .order("last_seen", { ascending: false })
      .limit(20);
    const latestIds = (latestProfiles ?? []).map((p) => p.id);
    const { data: latestPriv } = latestIds.length
      ? await supabaseAdmin
          .from("profiles_private")
          .select("user_id, device_platform, country")
          .in("user_id", latestIds)
      : { data: [] as Array<{ user_id: string; device_platform: string | null; country: string | null }> };
    const privMap = new Map((latestPriv ?? []).map((r) => [r.user_id, r]));
    const latest = (latestProfiles ?? []).map((p) => ({
      ...p,
      device_platform: privMap.get(p.id)?.device_platform ?? null,
      country: privMap.get(p.id)?.country ?? null,
    }));

    return {
      countries: countTop(byCountry.data ?? [], "country"),
      regions: countTop(byRegion.data ?? [], "region"),
      cities: countTop(byCity.data ?? [], "city"),
      platforms: countTop(byPlat.data ?? [], "device_platform"),
      versions: countTop(byVer.data ?? [], "app_version"),
      latestSeen: latest,
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
    const { data: out, error } = await supabaseAdmin.rpc("admin_usage_analytics" as never, { _days: data.days } as never);
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

export const getPushLogs = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ days: z.number().int().min(1).max(60).default(7) }).parse(d))
  .handler(async ({ data, context }) => {
    await assertAdmin(context.userId);
    const { data: out, error } = await supabaseAdmin.rpc("admin_push_logs" as never, { _days: data.days } as never);
    if (error) throw new Error(error.message);
    return out as {
      total: number; success: number; failed: number; days: number;
      byChannel: Array<{ channel: string; kind: string; success: number; failed: number }>;
      recent: Array<{
        id: string; created_at: string; channel: string; kind: string;
        success: boolean; status_code: number | null; error: string | null;
        recipient_id: string; sender_id: string | null; conversation_id: string | null;
        recipient_username: string | null; recipient_name: string | null;
        sender_username: string | null; sender_name: string | null;
      }>;
      series: Array<{ date: string; success: number; failed: number }>;
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

// ============ Admin Management (SuperAdmin only) ============
export const listAdmins = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertMinRole(context.userId, "moderator");
    const { data, error } = await supabaseAdmin.rpc("admin_list_admins" as never);
    if (error) throw new Error(error.message);
    return (data ?? []) as Array<{
      user_id: string;
      role: RoleName;
      rank: number;
      created_at: string;
      username: string | null;
      display_name: string | null;
      avatar_url: string | null;
      email: string | null;
      protected: boolean;
    }>;
  });

export const grantAdminRole = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({
      email: z.string().email().max(255),
      role: z.enum(["moderator", "admin", "superadmin"]),
    }).parse(d),
  )
  .handler(async ({ data, context }) => {
    await assertSuperadmin(context.userId);

    // Find user by email
    const { data: priv, error: privErr } = await supabaseAdmin
      .from("profiles_private")
      .select("user_id")
      .ilike("email", data.email.trim())
      .maybeSingle();
    if (privErr) throw new Error(privErr.message);
    if (!priv) throw new Error("Usuário com este e-mail não foi encontrado");

    const { error } = await supabaseAdmin
      .from("user_roles")
      .upsert({ user_id: priv.user_id, role: data.role }, { onConflict: "user_id,role" });
    if (error) throw new Error(error.message);

    await logAdmin(context.userId, "grant_role", true, { target: priv.user_id, role: data.role });
    return { ok: true, user_id: priv.user_id };
  });

export const revokeAdminRole = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({
      user_id: z.string().uuid(),
      role: z.enum(["moderator", "admin", "superadmin"]),
    }).parse(d),
  )
  .handler(async ({ data, context }) => {
    await assertSuperadmin(context.userId);

    if (data.user_id === context.userId && data.role === "superadmin") {
      throw new Error("Você não pode remover seu próprio SuperAdmin");
    }

    const { error } = await supabaseAdmin
      .from("user_roles")
      .delete()
      .eq("user_id", data.user_id)
      .eq("role", data.role);
    if (error) throw new Error(error.message);

    await logAdmin(context.userId, "revoke_role", true, { target: data.user_id, role: data.role });
    return { ok: true };
  });

export const getInvitesOverview = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context.userId);
    const { data, error } = await supabaseAdmin.rpc("admin_invites_overview" as never);
    if (error) throw new Error(error.message);
    return data as {
      totals: { total_invites: number; confirmed: number; pending: number; unique_inviters: number };
      inviters: Array<{
        inviter_id: string;
        inviter_username: string | null;
        inviter_name: string | null;
        inviter_email: string | null;
        total: number;
        confirmed: number;
        pending: number;
        invitees: Array<{
          id: string;
          username: string | null;
          display_name: string | null;
          email: string | null;
          created_at: string;
          confirmed_at: string | null;
          status: "confirmed" | "pending";
        }>;
      }>;
      recent: Array<{
        id: string;
        username: string | null;
        display_name: string | null;
        email: string | null;
        created_at: string;
        email_confirmed_at: string | null;
        status: "confirmed" | "pending";
        inviter_id: string;
        inviter_username: string | null;
        inviter_name: string | null;
      }>;
    };
  });

export const getUserActivityStats = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context.userId);
    const { data, error } = await supabaseAdmin.rpc("admin_user_activity_stats" as any);
    if (error) throw new Error(error.message);
    return data as {
      total: number;
      active_today: number;
      active_7: number;
      active_30: number;
      total_logins: number;
      messages_total: number;
      calls_total: number;
      top_countries: Array<{ name: string; count: number }>;
      top_languages: Array<{ name: string; count: number }>;
      top_sources: Array<{ name: string; count: number }>;
      retention: {
        d1: { cohort: number; returned: number; rate: number };
        d7: { cohort: number; returned: number; rate: number };
        d30: { cohort: number; returned: number; rate: number };
      };
      series: Array<{ date: string; signups: number; active: number }>;
      recent: Array<{ id: string; username: string; display_name: string; created_at: string; last_seen: string; days_since_signup: number }>;
    };
  });

export const getOnboardingSurveyStats = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context.userId);
    const { data, error } = await supabaseAdmin.rpc("admin_onboarding_survey_stats" as never, { _days: 3650 } as never);
    if (error) throw new Error(error.message);
    return data as {
      total: number;
      today: number;
      week: number;
      month: number;
      byReason: Array<{ name: string; count: number }>;
      bySource: Array<{ name: string; count: number }>;
      byFeature: Array<{ name: string; count: number }>;
      byGoal: Array<{ name: string; count: number }>;
      byAge: Array<{ name: string; count: number }>;
      byCountry: Array<{ name: string; count: number }>;
      byCity: Array<{ name: string; count: number }>;
      recent: Array<{
        id: string;
        user_id: string;
        reason_joined: string;
        source_channel: string;
        favorite_feature: string;
        main_goal: string;
        age_range: string;
        created_at: string;
        username: string | null;
        display_name: string | null;
        country: string | null;
        city: string | null;
      }>;
      days: number;
    };
  });

// ============ Traffic by source (UTM / referrer / fbclid) ============
// Aggregates page_view events from analytics_events using metadata.source
// captured by src/lib/track.ts. Lets the admin see Facebook/Instagram/TikTok/
// Google clicks even when the referrer is stripped by in-app browsers.
export const getTrafficBySource = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({ days: z.number().int().min(1).max(90).default(7) }).parse(d),
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context.userId);
    const since = new Date(Date.now() - data.days * 24 * 3600_000).toISOString();
    const { data: rows, error } = await supabaseAdmin
      .from("analytics_events")
      .select("session_id, metadata, created_at, path")
      .eq("event_name", "page_view")
      .gte("created_at", since)
      .not("user_id", "in", EXCLUDED_ANALYTICS_USER_IDS_PG)
      .limit(50000);
    if (error) throw new Error(error.message);

    type Row = {
      session_id: string | null;
      metadata: Record<string, unknown> | null;
      created_at: string;
      path: string | null;
    };
    const list = (rows ?? []) as Row[];

    const bySource = new Map<string, { views: number; sessions: Set<string> }>();
    const byCampaign = new Map<
      string,
      { source: string; medium: string; campaign: string; views: number; sessions: Set<string> }
    >();
    const byDay = new Map<string, Map<string, number>>(); // date -> source -> views
    const byPath = new Map<string, number>();
    const totalSessions = new Set<string>();
    let totalViews = 0;

    for (const r of list) {
      const md = (r.metadata ?? {}) as Record<string, unknown>;
      const source = String(md.source ?? "direct") || "direct";
      const medium = (md.utm_medium as string) ?? "";
      const campaign = (md.utm_campaign as string) ?? "";
      const sid = r.session_id ?? "";

      totalViews++;
      if (sid) totalSessions.add(sid);

      const s = bySource.get(source) ?? { views: 0, sessions: new Set<string>() };
      s.views++;
      if (sid) s.sessions.add(sid);
      bySource.set(source, s);

      if (campaign || medium) {
        const key = `${source}::${medium}::${campaign}`;
        const c =
          byCampaign.get(key) ??
          { source, medium: medium || "—", campaign: campaign || "—", views: 0, sessions: new Set<string>() };
        c.views++;
        if (sid) c.sessions.add(sid);
        byCampaign.set(key, c);
      }

      const day = r.created_at.slice(0, 10);
      const dayMap = byDay.get(day) ?? new Map<string, number>();
      dayMap.set(source, (dayMap.get(source) ?? 0) + 1);
      byDay.set(day, dayMap);

      if (r.path) byPath.set(r.path, (byPath.get(r.path) ?? 0) + 1);
    }

    const sources = [...bySource.entries()]
      .map(([source, v]) => ({ source, views: v.views, sessions: v.sessions.size }))
      .sort((a, b) => b.views - a.views);

    const campaigns = [...byCampaign.values()]
      .map((c) => ({ source: c.source, medium: c.medium, campaign: c.campaign, views: c.views, sessions: c.sessions.size }))
      .sort((a, b) => b.views - a.views)
      .slice(0, 30);

    const series = [...byDay.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, m]) => {
        const o: Record<string, number | string> = { date };
        for (const [src, v] of m.entries()) o[src] = v;
        return o;
      });

    const topPaths = [...byPath.entries()]
      .map(([path, views]) => ({ path, views }))
      .sort((a, b) => b.views - a.views)
      .slice(0, 15);

    return {
      days: data.days,
      totalViews,
      totalSessions: totalSessions.size,
      sources,
      campaigns,
      series,
      topPaths,
    };
  });
