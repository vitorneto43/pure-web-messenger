import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const reportSchema = z.object({
  target_type: z.enum(["profile", "status", "message", "group", "conversation", "post", "post_comment"]),
  target_id: z.string().min(1).max(255),
  reported_user_id: z.string().uuid().nullable().optional(),
  reason: z.string().min(1).max(100),
  details: z.string().max(1000).optional(),
});

export const submitReport = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => reportSchema.parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;

    // PRIVACIDADE: denúncias de mensagens passam por um RPC que valida que o
    // denunciante é participante da conversa e cria um snapshot do conteúdo
    // no momento da denúncia. Nenhum outro caminho do código acessa o
    // conteúdo de mensagens privadas.
    if (data.target_type === "message") {
      const { data: reportId, error } = await supabase.rpc("report_message_with_snapshot", {
        _message_id: data.target_id,
        _reason: data.reason,
        _details: data.details ?? undefined,
      });
      if (error) throw new Error(error.message);
      return { ok: true, id: reportId as string };
    }

    const { error, data: row } = await supabase
      .from("content_reports")
      .insert({
        reporter_id: userId,
        reported_user_id: data.reported_user_id ?? null,
        target_type: data.target_type,
        target_id: data.target_id,
        reason: data.reason,
        details: data.details ?? null,
      })
      .select("id")
      .single();
    if (error) throw new Error(error.message);
    return { ok: true, id: row.id };
  });

export const blockUser = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { user_id: string }) => z.object({ user_id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    if (data.user_id === userId) throw new Error("Não é possível bloquear a si mesmo");
    const { error } = await supabase
      .from("user_blocks")
      .insert({ blocker_id: userId, blocked_id: data.user_id });
    if (error && !error.message.includes("duplicate")) throw new Error(error.message);
    return { ok: true };
  });

export const unblockUser = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { user_id: string }) => z.object({ user_id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { error } = await supabase
      .from("user_blocks")
      .delete()
      .eq("blocker_id", userId)
      .eq("blocked_id", data.user_id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const getMyRestrictions = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase } = context;
    const { data, error } = await supabase.rpc("get_my_restrictions");
    if (error) throw new Error(error.message);
    return data as {
      banned: boolean;
      suspended: boolean;
      suspended_until?: string | null;
      banned_at?: string | null;
      strike_count?: number;
      last_action?: {
        action_type: string;
        reason: string | null;
        created_at: string;
        expires_at: string | null;
      } | null;
    };
  });

// --- Admin endpoints ---

async function assertModerator(supabase: any, userId: string) {
  const { data: isAdmin } = await supabase.rpc("has_role", { _user_id: userId, _role: "admin" });
  const { data: isMod } = await supabase.rpc("has_role", { _user_id: userId, _role: "moderator" });
  const { data: isSuper } = await supabase.rpc("has_role", { _user_id: userId, _role: "superadmin" });
  if (!isAdmin && !isMod && !isSuper) throw new Error("Forbidden");
}

export const listReports = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({ status: z.enum(["pending", "in_review", "resolved", "rejected", "all"]).default("pending") }).parse(d ?? {}),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    await assertModerator(supabase, userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    let q = supabaseAdmin
      .from("content_reports")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(200);
    if (data.status !== "all") q = q.eq("status", data.status);
    const { data: rows, error } = await q;
    if (error) throw new Error(error.message);

    const userIds = Array.from(
      new Set(
        (rows ?? [])
          .flatMap((r) => [r.reporter_id, r.reported_user_id])
          .filter((x): x is string => !!x),
      ),
    );
    let profilesMap = new Map<string, any>();
    if (userIds.length) {
      const { data: profs } = await supabaseAdmin
        .from("profiles")
        .select("id, username, display_name, avatar_url, strike_count, suspended_until, banned_at")
        .in("id", userIds);
      profilesMap = new Map((profs ?? []).map((p) => [p.id, p]));
    }

    // PRIVACIDADE: o conteúdo de mensagens privadas vem do snapshot
    // capturado no momento da denúncia (content_reports.evidence_snapshot).
    // NÃO consultamos a tabela `messages` aqui — o moderador só vê o que
    // o denunciante explicitamente compartilhou. Conteúdo público (status,
    // perfis) pode ser consultado normalmente.
    const statusIds = Array.from(
      new Set((rows ?? []).filter((r) => r.target_type === "status").map((r) => r.target_id)),
    );
    const profileIds = Array.from(
      new Set((rows ?? []).filter((r) => r.target_type === "profile").map((r) => r.target_id)),
    );
    const contentMap = new Map<string, any>();
    if (statusIds.length) {
      const { data: sts } = await supabaseAdmin
        .from("statuses")
        .select("id, caption, content, media_url, kind, user_id, created_at")
        .in("id", statusIds);
      for (const s of sts ?? []) contentMap.set(`status:${s.id}`, s);
    }
    if (profileIds.length) {
      const { data: profs2 } = await supabaseAdmin
        .from("profiles")
        .select("id, username, display_name, bio, avatar_url")
        .in("id", profileIds);
      for (const p of profs2 ?? []) contentMap.set(`profile:${p.id}`, p);
    }

    return {
      reports: (rows ?? []).map((r) => ({
        ...r,
        reporter: profilesMap.get(r.reporter_id) ?? null,
        reported_user: r.reported_user_id ? profilesMap.get(r.reported_user_id) ?? null : null,
        // Para mensagens, target_content vem do snapshot (preservado mesmo se a
        // mensagem for apagada). Para status/perfil, vem do banco diretamente.
        target_content:
          r.target_type === "message"
            ? (r as any).evidence_snapshot ?? null
            : contentMap.get(`${r.target_type}:${r.target_id}`) ?? null,
      })),
    };
  });

const actionSchema = z.object({
  report_id: z.string().uuid(),
  action: z.enum(["warning", "content_removed", "suspended", "banned", "report_rejected", "unsuspended", "unbanned"]),
  severity: z.enum(["light", "grave", "gravissima"]).default("light"),
  duration_days: z.number().int().min(1).max(365).optional(),
  reason: z.string().max(500).optional(),
});

export const applyModerationAction = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => actionSchema.parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    await assertModerator(supabase, userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: report, error: rErr } = await supabaseAdmin
      .from("content_reports")
      .select("*")
      .eq("id", data.report_id)
      .single();
    if (rErr || !report) throw new Error("Denúncia não encontrada");

    const targetUser = report.reported_user_id;
    let expiresAt: string | null = null;

    // Apply effect to profile
    if (data.action === "suspended" && targetUser) {
      const days = data.duration_days ?? (data.severity === "gravissima" ? 30 : data.severity === "grave" ? 7 : 3);
      expiresAt = new Date(Date.now() + days * 86400_000).toISOString();
      await supabaseAdmin
        .from("profiles")
        .update({ suspended_until: expiresAt, strike_count: ((report as any).strike_count ?? 0) })
        .eq("id", targetUser);
      // increment strike
      await supabaseAdmin.rpc("has_role", { _user_id: targetUser, _role: "user" }); // no-op
      const { data: p } = await supabaseAdmin.from("profiles").select("strike_count").eq("id", targetUser).single();
      await supabaseAdmin.from("profiles").update({ strike_count: (p?.strike_count ?? 0) + 1 }).eq("id", targetUser);
    } else if (data.action === "banned" && targetUser) {
      await supabaseAdmin
        .from("profiles")
        .update({ banned_at: new Date().toISOString() })
        .eq("id", targetUser);
      // Atualiza contadores em fingerprints/IPs vinculados
      await supabaseAdmin.rpc("register_ban", { _user_id: targetUser });
      // Em casos gravíssimos, propaga: bloqueia dispositivos e marca IPs como críticos
      if (data.severity === "gravissima") {
        await supabaseAdmin.rpc("propagate_severe_ban", {
          _user_id: targetUser,
          _reason: data.reason ?? "severe_ban",
        });
      }
    } else if (data.action === "unsuspended" && targetUser) {
      await supabaseAdmin.from("profiles").update({ suspended_until: null }).eq("id", targetUser);
    } else if (data.action === "unbanned" && targetUser) {
      await supabaseAdmin.from("profiles").update({ banned_at: null }).eq("id", targetUser);
    } else if (data.action === "warning" && targetUser) {
      const { data: p } = await supabaseAdmin.from("profiles").select("strike_count").eq("id", targetUser).single();
      await supabaseAdmin.from("profiles").update({ strike_count: (p?.strike_count ?? 0) + 1 }).eq("id", targetUser);
    }

    // Log action
    await supabaseAdmin.from("moderation_actions").insert({
      moderator_id: userId,
      target_user_id: targetUser,
      report_id: data.report_id,
      action_type: data.action,
      severity: data.severity,
      reason: data.reason ?? null,
      duration_days: data.duration_days ?? null,
      expires_at: expiresAt,
    });

    // Update report status
    const newStatus =
      data.action === "report_rejected" ? "rejected" : "resolved";
    await supabaseAdmin
      .from("content_reports")
      .update({
        status: newStatus,
        reviewer_id: userId,
        reviewer_notes: data.reason ?? null,
        resolved_at: new Date().toISOString(),
      })
      .eq("id", data.report_id);

    // Notify user
    if (targetUser && data.action !== "report_rejected") {
      const titles: Record<string, string> = {
        warning: "Você recebeu um aviso",
        content_removed: "Seu conteúdo foi removido",
        suspended: "Sua conta foi suspensa temporariamente",
        banned: "Sua conta foi banida",
        unsuspended: "Sua suspensão foi removida",
        unbanned: "Seu banimento foi removido",
      };
      await supabaseAdmin.from("notifications").insert({
        user_id: targetUser,
        type: "moderation",
        title: titles[data.action] ?? "Ação de moderação",
        body: data.reason ?? "Consulte as Diretrizes da Comunidade.",
        data: { action: data.action, severity: data.severity, expires_at: expiresAt },
      });
    }

    return { ok: true };
  });

export const getUserModerationHistory = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { user_id: string }) => z.object({ user_id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    await assertModerator(supabase, userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const [actions, reports] = await Promise.all([
      supabaseAdmin
        .from("moderation_actions")
        .select("*")
        .eq("target_user_id", data.user_id)
        .order("created_at", { ascending: false })
        .limit(50),
      supabaseAdmin
        .from("content_reports")
        .select("*")
        .eq("reported_user_id", data.user_id)
        .order("created_at", { ascending: false })
        .limit(50),
    ]);
    return { actions: actions.data ?? [], reports: reports.data ?? [] };
  });

// ============================================================================
// SuperAdmin: pesos de moderação e modo aprendizado
// ============================================================================

async function assertSuperAdmin(supabase: any, userId: string) {
  const { data: isSuper } = await supabase.rpc("has_role", { _user_id: userId, _role: "superadmin" });
  const { data: isAdmin } = await supabase.rpc("has_role", { _user_id: userId, _role: "admin" });
  if (!isSuper && !isAdmin) throw new Error("Forbidden");
}

export const getModerationWeights = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertModerator(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const [{ data: weights }, { data: setting }] = await Promise.all([
      supabaseAdmin.from("moderation_weights").select("*").eq("id", 1).single(),
      supabaseAdmin.from("app_settings").select("value").eq("key", "moderation_learning_mode").maybeSingle(),
    ]);
    return {
      weights: weights ?? null,
      learning_mode: setting?.value === true || (setting?.value as any) === "true",
    };
  });

const weightsSchema = z.object({
  weight_report: z.number().int().min(0).max(100).optional(),
  weight_spam: z.number().int().min(0).max(100).optional(),
  weight_links: z.number().int().min(0).max(100).optional(),
  weight_blocks: z.number().int().min(0).max(100).optional(),
  weight_behavior: z.number().int().min(0).max(100).optional(),
  threshold_warning: z.number().int().min(0).max(1000).optional(),
  threshold_restriction: z.number().int().min(0).max(1000).optional(),
  threshold_suspension: z.number().int().min(0).max(1000).optional(),
  threshold_ban: z.number().int().min(0).max(1000).optional(),
});

export const updateModerationWeights = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => weightsSchema.parse(d))
  .handler(async ({ data, context }) => {
    await assertSuperAdmin(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin
      .from("moderation_weights")
      .update({ ...data, updated_at: new Date().toISOString(), updated_by: context.userId })
      .eq("id", 1);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const setLearningMode = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ enabled: z.boolean() }).parse(d))
  .handler(async ({ data, context }) => {
    await assertSuperAdmin(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin
      .from("app_settings")
      .upsert(
        {
          key: "moderation_learning_mode",
          value: data.enabled as any,
          updated_at: new Date().toISOString(),
          updated_by: context.userId,
        },
        { onConflict: "key" },
      );
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const assignReport = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({
      report_id: z.string().uuid(),
      status: z.enum(["pending", "in_review", "resolved", "rejected"]).optional(),
      take: z.boolean().optional(),
    }).parse(d),
  )
  .handler(async ({ data, context }) => {
    await assertModerator(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const update: any = {};
    if (data.take) {
      update.assigned_to = context.userId;
      update.status = "in_review";
    } else if (data.status) {
      update.status = data.status;
    }
    const { error } = await supabaseAdmin
      .from("content_reports")
      .update(update)
      .eq("id", data.report_id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const getUserTrustScore = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { user_id: string }) => z.object({ user_id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    await assertModerator(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    // Recompute on demand to get fresh score.
    const { data: score } = await supabaseAdmin.rpc("recompute_trust_score", { _user_id: data.user_id });
    const { data: row } = await supabaseAdmin
      .from("user_trust_scores")
      .select("*")
      .eq("user_id", data.user_id)
      .maybeSingle();
    return { score: (score as number) ?? row?.score ?? 50, components: row?.components ?? {} };
  });

