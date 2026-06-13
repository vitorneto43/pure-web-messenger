import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { getRequestHeader } from "@tanstack/react-start/server";

// ============================================================================
// Compliance & Auditoria
//
// PRIVACIDADE: conversas privadas NÃO são acessíveis ao admin no painel comum.
// Apenas o SuperAdmin pode executar procedimentos excepcionais, sempre
// vinculados a uma solicitação de autoridade (compliance_requests) e a uma
// justificativa. Todo acesso fica registrado de forma imutável em
// compliance_access_logs e audit_logs.
// ============================================================================

async function assertSuperadmin(supabase: any, userId: string) {
  const { data, error } = await supabase.rpc("has_role", {
    _user_id: userId,
    _role: "superadmin",
  });
  if (error) throw new Error(error.message);
  if (!data) throw new Error("Acesso restrito ao SuperAdmin");
}

async function assertAdmin(supabase: any, userId: string) {
  const { data, error } = await supabase.rpc("has_min_role", {
    _user_id: userId,
    _min: "admin",
  });
  if (error) throw new Error(error.message);
  if (!data) throw new Error("Acesso restrito a administradores");
}

function hashString(v: string | null | undefined): string | undefined {
  if (!v) return undefined;
  let h = 0;
  for (let i = 0; i < v.length; i++) h = (h * 31 + v.charCodeAt(i)) | 0;
  return `h${(h >>> 0).toString(16)}_${v.length}`;
}

function getClientIpHash(): string | undefined {
  const ip =
    getRequestHeader("cf-connecting-ip") ||
    getRequestHeader("x-forwarded-for")?.split(",")[0]?.trim() ||
    getRequestHeader("x-real-ip") ||
    null;
  return hashString(ip);
}

function getUserAgent(): string | undefined {
  return getRequestHeader("user-agent") ?? undefined;
}

// ============================================================================
// Estado do módulo (liga/desliga compliance)
// ============================================================================

export const getComplianceState = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    await assertAdmin(supabase, userId);
    const { data } = await supabase
      .from("app_settings")
      .select("value")
      .eq("key", "compliance_enabled")
      .maybeSingle();
    return { enabled: data?.value === true };
  });

export const setComplianceEnabled = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ enabled: z.boolean() }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    await assertSuperadmin(supabase, userId);
    const { error } = await supabase
      .from("app_settings")
      .upsert({ key: "compliance_enabled", value: data.enabled, updated_at: new Date().toISOString() });
    if (error) throw new Error(error.message);

    await supabase.rpc("write_audit_log", {
      _action: data.enabled ? "compliance.enabled" : "compliance.disabled",
      _ip_hash: getClientIpHash(),
      _user_agent: getUserAgent(),
      _metadata: {},
    });
    return { ok: true };
  });

// ============================================================================
// Solicitações (compliance_requests) — apenas SuperAdmin
// ============================================================================

const requestSchema = z.object({
  process_number: z.string().min(1).max(120),
  requesting_authority: z.string().min(1).max(200),
  requester_name: z.string().max(200).optional(),
  requester_contact: z.string().max(200).optional(),
  legal_basis: z.string().max(500).optional(),
  reason: z.string().min(10).max(2000),
  target_user_id: z.string().uuid().nullable().optional(),
  target_username: z.string().max(100).optional(),
  date_range_start: z.string().datetime().nullable().optional(),
  date_range_end: z.string().datetime().nullable().optional(),
  notes: z.string().max(2000).optional(),
});

export const createComplianceRequest = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => requestSchema.parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    await assertSuperadmin(supabase, userId);

    const { data: row, error } = await supabase
      .from("compliance_requests")
      .insert({
        process_number: data.process_number,
        requesting_authority: data.requesting_authority,
        requester_name: data.requester_name ?? null,
        requester_contact: data.requester_contact ?? null,
        legal_basis: data.legal_basis ?? null,
        reason: data.reason,
        target_user_id: data.target_user_id ?? null,
        target_username: data.target_username ?? null,
        date_range_start: data.date_range_start ?? null,
        date_range_end: data.date_range_end ?? null,
        notes: data.notes ?? null,
        created_by: userId,
      })
      .select("id")
      .single();
    if (error) throw new Error(error.message);

    await supabase.rpc("write_audit_log", {
      _action: "compliance.request_created",
      _target_type: "compliance_request",
      _target_id: row.id,
      _target_user_id: data.target_user_id ?? undefined,
      _metadata: { process_number: data.process_number, authority: data.requesting_authority },
      _ip_hash: getClientIpHash(),
      _user_agent: getUserAgent(),
    });
    return { ok: true, id: row.id };
  });

export const updateComplianceRequestStatus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({
      id: z.string().uuid(),
      status: z.enum(["pending", "approved", "fulfilled", "denied", "expired"]),
      notes: z.string().max(2000).optional(),
    }).parse(d)
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    await assertSuperadmin(supabase, userId);

    const patch: {
      status: typeof data.status;
      approved_by?: string;
      approved_at?: string;
      fulfilled_at?: string;
      notes?: string;
    } = { status: data.status };
    if (data.status === "approved") {
      patch.approved_by = userId;
      patch.approved_at = new Date().toISOString();
    }
    if (data.status === "fulfilled") patch.fulfilled_at = new Date().toISOString();
    if (data.notes !== undefined) patch.notes = data.notes;

    const { error } = await supabase.from("compliance_requests").update(patch).eq("id", data.id);
    if (error) throw new Error(error.message);

    await supabase.rpc("write_audit_log", {
      _action: `compliance.request_${data.status}`,
      _target_type: "compliance_request",
      _target_id: data.id,
      _metadata: { status: data.status },
      _ip_hash: getClientIpHash(),
      _user_agent: getUserAgent(),
    });
    return { ok: true };
  });

export const listComplianceRequests = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    await assertSuperadmin(supabase, userId);
    const { data, error } = await supabase
      .from("compliance_requests")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(200);
    if (error) throw new Error(error.message);
    return { items: data ?? [] };
  });

// ============================================================================
// Exportação excepcional de dados (sob ordem judicial)
// ============================================================================

const exportSchema = z.object({
  request_id: z.string().uuid(),
  reason: z.string().min(10).max(2000),
  include_messages: z.boolean().default(false),
});

export const exportUserDataForRequest = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => exportSchema.parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    await assertSuperadmin(supabase, userId);

    // Módulo precisa estar habilitado
    const { data: setting } = await supabase
      .from("app_settings").select("value").eq("key", "compliance_enabled").maybeSingle();
    if (setting?.value !== true) {
      throw new Error("Módulo de Compliance está desabilitado");
    }

    const { data: req, error: reqErr } = await supabase
      .from("compliance_requests").select("*").eq("id", data.request_id).maybeSingle();
    if (reqErr) throw new Error(reqErr.message);
    if (!req) throw new Error("Solicitação não encontrada");
    if (req.status !== "approved" && req.status !== "fulfilled") {
      throw new Error("Solicitação precisa estar aprovada antes da exportação");
    }
    if (!req.target_user_id) throw new Error("Solicitação sem usuário-alvo");

    const targetUserId: string = req.target_user_id;
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    // Coleta de dados de conta (NUNCA inclui conversas privadas a menos que
    // explicitamente solicitado E o módulo esteja habilitado)
    const [profile, profilePriv, roles, sessionsAudit, behavior, reports, actions] = await Promise.all([
      supabaseAdmin.from("profiles").select("*").eq("id", targetUserId).maybeSingle(),
      supabaseAdmin.from("profiles_private").select("*").eq("user_id", targetUserId).maybeSingle(),
      supabaseAdmin.from("user_roles").select("role, created_at").eq("user_id", targetUserId),
      supabaseAdmin.from("audit_logs").select("*").eq("target_user_id", targetUserId).order("created_at", { ascending: false }).limit(500),
      supabaseAdmin.from("behavior_signals").select("*").eq("user_id", targetUserId).order("created_at", { ascending: false }).limit(500),
      supabaseAdmin.from("content_reports").select("*").or(`reporter_id.eq.${targetUserId},reported_user_id.eq.${targetUserId}`).limit(500),
      supabaseAdmin.from("moderation_actions").select("*").eq("target_user_id", targetUserId).limit(500),
    ]);

    const payload: Record<string, unknown> = {
      exported_at: new Date().toISOString(),
      request: req,
      account: {
        profile: profile.data,
        profile_private: profilePriv.data,
        roles: roles.data,
      },
      audit_logs: sessionsAudit.data,
      behavior_signals: behavior.data,
      content_reports: reports.data,
      moderation_actions: actions.data,
    };

    let messagesIncluded = 0;
    if (data.include_messages) {
      const { data: msgs } = await supabaseAdmin
        .from("messages")
        .select("id, conversation_id, sender_id, content, attachment_url, attachment_type, created_at")
        .eq("sender_id", targetUserId)
        .order("created_at", { ascending: false })
        .limit(2000);
      payload.messages_sent = msgs;
      messagesIncluded = msgs?.length ?? 0;
    }

    // Log obrigatório do acesso
    await supabase.rpc("log_compliance_access", {
      _request_id: data.request_id,
      _reason: data.reason,
      _target_user_id: targetUserId,
      _data_accessed: data.include_messages ? "account_and_messages" : "account_only",
      _data_summary: {
        messages_included: messagesIncluded,
        audit_logs: sessionsAudit.data?.length ?? 0,
        reports: reports.data?.length ?? 0,
      },
      _ip_hash: getClientIpHash(),
      _user_agent: getUserAgent(),
    });

    // Marca como fulfilled se ainda não estiver
    if (req.status === "approved") {
      await supabase.from("compliance_requests").update({ fulfilled_at: new Date().toISOString(), status: "fulfilled" }).eq("id", req.id);
    }

    return { ok: true, payload };
  });

// ============================================================================
// Audit logs — leitura para admins
// ============================================================================

export const listAuditLogs = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({
      limit: z.number().min(1).max(500).default(100),
      action: z.string().optional(),
      actor_id: z.string().uuid().optional(),
      target_user_id: z.string().uuid().optional(),
    }).partial().parse(d ?? {})
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    await assertAdmin(supabase, userId);

    let q = supabase.from("audit_logs").select("*").order("created_at", { ascending: false }).limit(data.limit ?? 100);
    if (data.action) q = q.eq("action", data.action);
    if (data.actor_id) q = q.eq("actor_id", data.actor_id);
    if (data.target_user_id) q = q.eq("target_user_id", data.target_user_id);
    const { data: rows, error } = await q;
    if (error) throw new Error(error.message);
    return { items: rows ?? [] };
  });

export const listComplianceAccessLogs = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    await assertSuperadmin(supabase, userId);
    const { data, error } = await supabase
      .from("compliance_access_logs")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(300);
    if (error) throw new Error(error.message);
    return { items: data ?? [] };
  });
