import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

const periodSchema = z.object({
  period: z.enum(["today", "7d", "30d", "90d"]).default("7d"),
});

export type FunnelStep = {
  key: string;
  label: string;
  count: number;
  dropPct: number;
  convPct: number;
};

export type FunnelAbandonment = {
  key: string;
  label: string;
  count: number;
  pct: number;
};

export type FunnelVisitor = {
  visitors: number;
  discoverViews: number;
  returnedAndSignedUp: number;
  visitorToSignupPct: number;
};

export type FunnelAlert = {
  level: "info" | "warning" | "danger";
  message: string;
};

export type FunnelResult = {
  period: "today" | "7d" | "30d" | "90d";
  steps: FunnelStep[];
  abandonment: FunnelAbandonment[];
  visitor: FunnelVisitor;
  alerts: FunnelAlert[];
  totals: {
    newProfiles: number;
    profilesWithUsername: number;
    profilesWhoMessaged: number;
    profilesWhoPostedStatus: number;
  };
};

function periodStart(p: "today" | "7d" | "30d" | "90d"): Date {
  const now = new Date();
  if (p === "today") {
    const d = new Date(now);
    d.setUTCHours(0, 0, 0, 0);
    return d;
  }
  const days = p === "7d" ? 7 : p === "30d" ? 30 : 90;
  return new Date(now.getTime() - days * 24 * 60 * 60 * 1000);
}

async function assertAdmin(userId: string) {
  const { data, error } = await supabaseAdmin
    .from("user_roles")
    .select("role")
    .eq("user_id", userId);
  if (error) throw new Error("Falha ao verificar permissão");
  const roles = (data ?? []).map((r) => r.role as string);
  if (!roles.some((r) => r === "admin" || r === "superadmin" || r === "moderator")) {
    throw new Error("Acesso negado");
  }
}

async function distinctField(
  field: "session_id" | "user_id",
  eventName: string,
  since: string,
): Promise<number> {
  const set = new Set<string>();
  const pageSize = 1000;
  let from = 0;
  // page through to avoid 1k row cap missing distincts
  for (let i = 0; i < 50; i++) {
    const { data, error } = await supabaseAdmin
      .from("analytics_events")
      .select(field)
      .eq("event_name", eventName)
      .gte("created_at", since)
      .not(field, "is", null)
      .range(from, from + pageSize - 1);
    if (error || !data || data.length === 0) break;
    for (const row of data) {
      const v = (row as Record<string, string | null>)[field];
      if (v) set.add(v);
    }
    if (data.length < pageSize) break;
    from += pageSize;
  }
  return set.size;
}

export const getConversionFunnel = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => periodSchema.parse(input ?? {}))
  .handler(async ({ data, context }): Promise<FunnelResult> => {
    await assertAdmin(context.userId);
    const since = periodStart(data.period).toISOString();

    // ===== Eventos reais do front =====
    const [visits, signupCtaClicks, googleClicks, signupCompleted, appLogins, discoverViews] =
      await Promise.all([
        distinctField("session_id", "page_view", since),
        distinctField("session_id", "signup_click", since),
        distinctField("session_id", "google_signin_click", since),
        distinctField("session_id", "signup_completed", since),
        distinctField("user_id", "app_login", since),
        distinctField("session_id", "discover_list_view", since),
      ]);

    // ===== Dados consolidados nas tabelas (fonte da verdade) =====
    const { count: newProfilesCount } = await supabaseAdmin
      .from("profiles")
      .select("id", { count: "exact", head: true })
      .gte("created_at", since);
    const newProfiles = newProfilesCount ?? 0;

    // Cadastros que completaram nome/username
    const { count: withUsernameCount } = await supabaseAdmin
      .from("profiles")
      .select("id", { count: "exact", head: true })
      .gte("created_at", since)
      .not("username", "is", null);
    const profilesWithUsername = withUsernameCount ?? 0;

    // Quem mandou ao menos 1 mensagem (registrados no período)
    const { data: newProfRows } = await supabaseAdmin
      .from("profiles")
      .select("id")
      .gte("created_at", since)
      .limit(50000);
    const newProfileIds = new Set((newProfRows ?? []).map((r) => r.id as string));

    let profilesWhoMessaged = 0;
    let profilesWhoPostedStatus = 0;
    if (newProfileIds.size > 0) {
      const ids = Array.from(newProfileIds);
      const { data: msgRows } = await supabaseAdmin
        .from("messages")
        .select("sender_id")
        .in("sender_id", ids)
        .gte("created_at", since)
        .limit(50000);
      const msgSet = new Set<string>();
      for (const r of msgRows ?? []) if (r.sender_id) msgSet.add(r.sender_id as string);
      profilesWhoMessaged = msgSet.size;

      const { data: stRows } = await supabaseAdmin
        .from("statuses")
        .select("user_id")
        .in("user_id", ids)
        .gte("created_at", since)
        .limit(50000);
      const stSet = new Set<string>();
      for (const r of stRows ?? []) if (r.user_id) stSet.add(r.user_id as string);
      profilesWhoPostedStatus = stSet.size;
    }

    // ===== Funil =====
    const rawSteps: Array<{ key: string; label: string; count: number }> = [
      { key: "visits", label: "Visitas únicas", count: visits },
      {
        key: "auth_cta",
        label: "Cliques em Cadastrar / Entrar com Google",
        count: Math.max(signupCtaClicks, googleClicks, signupCtaClicks + googleClicks),
      },
      { key: "signup_completed", label: "Cadastro concluído (evento)", count: signupCompleted },
      { key: "new_profile", label: "Conta criada (perfil no banco)", count: newProfiles },
      { key: "username", label: "Perfil com nome/usuário", count: profilesWithUsername },
      { key: "logged_in", label: "Logou no app", count: appLogins },
      { key: "messaged", label: "Enviou 1ª mensagem", count: profilesWhoMessaged },
      { key: "status", label: "Postou 1º status", count: profilesWhoPostedStatus },
    ];

    const top = rawSteps[0].count || 1;
    const steps: FunnelStep[] = rawSteps.map((s, i) => {
      const prev = i === 0 ? s.count : rawSteps[i - 1].count;
      const dropPct =
        prev > 0 ? Math.max(0, Math.min(100, ((prev - s.count) / prev) * 100)) : 0;
      const convPct = (s.count / top) * 100;
      return { ...s, dropPct, convPct };
    });

    // ===== Abandono =====
    const ab = (label: string, from: number, to: number, key: string): FunnelAbandonment => ({
      key,
      label,
      count: Math.max(0, from - to),
      pct: from > 0 ? ((from - to) / from) * 100 : 0,
    });
    const ctaClicks = rawSteps[1].count;
    const abandonment: FunnelAbandonment[] = [
      ab("Visitaram mas não clicaram em cadastrar", visits, ctaClicks, "ab_visit"),
      ab("Clicaram em cadastrar mas não concluíram", ctaClicks, newProfiles, "ab_cta"),
      ab("Criaram conta mas não preencheram nome", newProfiles, profilesWithUsername, "ab_name"),
      ab("Criaram conta mas nunca logaram no app", newProfiles, appLogins, "ab_login"),
      ab("Logaram mas nunca conversaram", appLogins, profilesWhoMessaged, "ab_msg"),
      ab("Logaram mas nunca postaram status", appLogins, profilesWhoPostedStatus, "ab_status"),
    ];

    // ===== Visitante =====
    // Sessões que visualizaram /descobrir e depois converteram (mesmo session_id em signup_completed)
    let returnedAndSignedUp = 0;
    if (discoverViews > 0) {
      const { data: a } = await supabaseAdmin
        .from("analytics_events")
        .select("session_id")
        .eq("event_name", "discover_list_view")
        .gte("created_at", since)
        .not("session_id", "is", null)
        .limit(50000);
      const visitorSessions = new Set<string>();
      for (const r of a ?? []) if (r.session_id) visitorSessions.add(r.session_id as string);
      if (visitorSessions.size > 0) {
        const { data: b } = await supabaseAdmin
          .from("analytics_events")
          .select("session_id")
          .eq("event_name", "signup_completed")
          .gte("created_at", since)
          .not("session_id", "is", null)
          .limit(50000);
        const seen = new Set<string>();
        for (const r of b ?? []) {
          const sid = r.session_id as string | null;
          if (sid && visitorSessions.has(sid) && !seen.has(sid)) {
            seen.add(sid);
            returnedAndSignedUp += 1;
          }
        }
      }
    }

    const visitor: FunnelVisitor = {
      visitors: visits,
      discoverViews,
      returnedAndSignedUp,
      visitorToSignupPct: visits > 0 ? (newProfiles / visits) * 100 : 0,
    };

    // ===== Alertas =====
    const alerts: FunnelAlert[] = [];
    for (let i = 1; i < steps.length; i++) {
      const s = steps[i];
      if (s.dropPct >= 70) {
        alerts.push({
          level: "danger",
          message: `${s.dropPct.toFixed(0)}% dos usuários abandonam antes de "${s.label}".`,
        });
      } else if (s.dropPct >= 40) {
        alerts.push({
          level: "warning",
          message: `${s.dropPct.toFixed(0)}% dos usuários abandonam antes de "${s.label}".`,
        });
      }
    }
    if (newProfiles > 0) {
      const noLoginPct = ((newProfiles - appLogins) / newProfiles) * 100;
      if (noLoginPct >= 15) {
        alerts.push({
          level: "warning",
          message: `${Math.max(0, noLoginPct).toFixed(0)}% criam conta mas nunca abrem o app.`,
        });
      }
    }
    if (visits > 0 && visitor.visitorToSignupPct < 2 && visits > 100) {
      alerts.push({
        level: "info",
        message: `Apenas ${visitor.visitorToSignupPct.toFixed(2)}% dos visitantes criam conta.`,
      });
    }

    return {
      period: data.period,
      steps,
      abandonment,
      visitor,
      alerts,
      totals: {
        newProfiles,
        profilesWithUsername,
        profilesWhoMessaged,
        profilesWhoPostedStatus,
      },
    };
  });
