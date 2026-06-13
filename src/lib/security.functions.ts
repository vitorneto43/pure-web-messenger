import { createServerFn } from "@tanstack/react-start";
import { getRequestHeader, getRequestIP } from "@tanstack/react-start/server";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { createHash } from "crypto";
import { z } from "zod";

const PEPPER = process.env.SPAM_HASH_PEPPER || "wavechat-default-pepper";

function sha(value: string) {
  return createHash("sha256").update(`${PEPPER}:${value}`).digest("hex");
}

function getClientIp(): string | null {
  return (
    getRequestHeader("cf-connecting-ip") ||
    getRequestHeader("x-forwarded-for")?.split(",")[0]?.trim() ||
    getRequestIP({ xForwardedFor: true }) ||
    null
  );
}

async function isModerator(userId: string): Promise<boolean> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data } = await supabaseAdmin
    .from("user_roles")
    .select("role")
    .eq("user_id", userId)
    .in("role", ["admin", "moderator", "superadmin"]);
  return !!(data && data.length > 0);
}

async function isSuperadmin(userId: string): Promise<boolean> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data } = await supabaseAdmin
    .from("user_roles")
    .select("role")
    .eq("user_id", userId)
    .eq("role", "superadmin")
    .maybeSingle();
  return !!data;
}

// =====================================================================
// Registra o dispositivo do usuário autenticado (chamado no login/signup)
// =====================================================================
export const recordDeviceFingerprint = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: {
    platform: string;
    ua_class: string;
    screen_bucket: string;
    tz: string;
    native_id?: string | null;
  }) =>
    z
      .object({
        platform: z.string().max(40),
        ua_class: z.string().max(40),
        screen_bucket: z.string().max(40),
        tz: z.string().max(80),
        native_id: z.string().max(200).nullable().optional(),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { userId } = context;
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const fpRaw = JSON.stringify({
      p: data.platform,
      u: data.ua_class,
      s: data.screen_bucket,
      t: data.tz,
      n: data.native_id || null,
    });
    const fp_hash = sha(`fp:${fpRaw}`);

    const ip = getClientIp();
    const ip_hash = ip ? sha(`ip:${ip}`) : null;

    await supabaseAdmin.rpc("register_device_seen", {
      _user_id: userId,
      _fp_hash: fp_hash,
    });
    if (ip_hash) {
      await supabaseAdmin.rpc("register_ip_seen", {
        _user_id: userId,
        _ip_hash: ip_hash,
      });
    }

    // Verifica se o dispositivo está bloqueado
    const { data: fp } = await supabaseAdmin
      .from("device_fingerprints")
      .select("is_blocked, risk_level")
      .eq("fingerprint_hash", fp_hash)
      .maybeSingle();

    return {
      ok: true,
      device_blocked: !!fp?.is_blocked,
      device_risk: fp?.risk_level ?? "low",
    };
  });

// =====================================================================
// Verifica limite de ações para o usuário autenticado
// =====================================================================
export const checkRateLimit = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { action: "message" | "invite" | "group" | "link" }) =>
    z.object({ action: z.enum(["message", "invite", "group", "link"]) }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: result, error } = await supabaseAdmin.rpc("check_account_rate_limit", {
      _user_id: context.userId,
      _action: data.action,
    });
    if (error) throw new Error(error.message);
    // Registra o sinal de uso (para contar dentro da janela)
    await supabaseAdmin.from("behavior_signals").insert({
      user_id: context.userId,
      kind: `rate_${data.action}`,
      weight: 1,
      metadata: {},
    });
    return result as { allowed: boolean; is_new: boolean; used?: number; cap?: number };
  });

// =====================================================================
// Painel de segurança (SuperAdmin / moderadores)
// =====================================================================
export const listHighRiskUsers = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    if (!(await isModerator(context.userId))) throw new Error("Forbidden");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data } = await supabaseAdmin
      .from("user_trust_scores")
      .select("user_id, score, components, updated_at")
      .order("score", { ascending: true })
      .limit(50);
    const ids = (data ?? []).map((r) => r.user_id);
    const { data: profs } = ids.length
      ? await supabaseAdmin
          .from("profiles")
          .select("id, username, display_name, strike_count, banned_at, suspended_until")
          .in("id", ids)
      : { data: [] as any[] };
    const byId = new Map((profs ?? []).map((p: any) => [p.id, p]));
    return {
      users: (data ?? []).map((r) => ({ ...r, profile: byId.get(r.user_id) ?? null })),
    };
  });

export const listSuspiciousDevices = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    if (!(await isModerator(context.userId))) throw new Error("Forbidden");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data } = await supabaseAdmin
      .from("device_fingerprints")
      .select("*")
      .or("banned_account_count.gt.0,risk_level.in.(high,critical),is_blocked.eq.true")
      .order("banned_account_count", { ascending: false })
      .limit(100);
    return { devices: data ?? [] };
  });

export const listHighRiskIps = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    if (!(await isModerator(context.userId))) throw new Error("Forbidden");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data } = await supabaseAdmin
      .from("ip_reputation")
      .select("*")
      .in("risk_level", ["medium", "high", "critical"])
      .order("accounts_banned", { ascending: false })
      .limit(100);
    return { ips: data ?? [] };
  });

export const blockDeviceFingerprint = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { fingerprint_hash: string; reason?: string; block: boolean }) =>
    z
      .object({
        fingerprint_hash: z.string().min(10).max(128),
        reason: z.string().max(500).optional(),
        block: z.boolean(),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    if (!(await isSuperadmin(context.userId))) throw new Error("Forbidden");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    await supabaseAdmin
      .from("device_fingerprints")
      .update({
        is_blocked: data.block,
        blocked_reason: data.block ? data.reason ?? null : null,
        blocked_at: data.block ? new Date().toISOString() : null,
        risk_level: data.block ? "critical" : "high",
      })
      .eq("fingerprint_hash", data.fingerprint_hash);
    await supabaseAdmin.from("audit_logs").insert({
      actor_id: context.userId,
      action: data.block ? "device_blocked" : "device_unblocked",
      target_type: "device",
      target_id: data.fingerprint_hash,
      reason: data.reason ?? null,
    });
    return { ok: true };
  });

export const setIpRiskLevel = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { ip_hash: string; risk_level: "low" | "medium" | "high" | "critical"; notes?: string }) =>
    z
      .object({
        ip_hash: z.string().min(10).max(128),
        risk_level: z.enum(["low", "medium", "high", "critical"]),
        notes: z.string().max(500).optional(),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    if (!(await isSuperadmin(context.userId))) throw new Error("Forbidden");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    await supabaseAdmin
      .from("ip_reputation")
      .update({ risk_level: data.risk_level, notes: data.notes ?? null, updated_at: new Date().toISOString() })
      .eq("ip_hash", data.ip_hash);
    await supabaseAdmin.from("audit_logs").insert({
      actor_id: context.userId,
      action: "ip_risk_set",
      target_type: "ip",
      target_id: data.ip_hash,
      reason: data.notes ?? null,
      metadata: { risk_level: data.risk_level },
    });
    return { ok: true };
  });
