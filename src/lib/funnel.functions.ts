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
  dropPct: number; // perda vs etapa anterior, em %
  convPct: number; // conversão vs etapa 1, em %
};

export type FunnelAbandonment = {
  key: string;
  label: string;
  count: number;
  pct: number;
};

export type FunnelVisitor = {
  visitors: number;
  publicProfileViews: number;
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

// Conta distinct session_id em analytics_events para um nome de evento.
async function countDistinctSessions(eventName: string, since: string): Promise<number> {
  const { data, error } = await supabaseAdmin
    .from("analytics_events")
    .select("session_id")
    .eq("event_name", eventName)
    .gte("created_at", since)
    .not("session_id", "is", null)
    .limit(50000);
  if (error) return 0;
  const set = new Set<string>();
  for (const row of data ?? []) {
    if (row.session_id) set.add(row.session_id);
  }
  return set.size;
}

async function countDistinctUsers(eventName: string, since: string): Promise<number> {
  const { data, error } = await supabaseAdmin
    .from("analytics_events")
    .select("user_id")
    .eq("event_name", eventName)
    .gte("created_at", since)
    .not("user_id", "is", null)
    .limit(50000);
  if (error) return 0;
  const set = new Set<string>();
  for (const row of data ?? []) {
    if (row.user_id) set.add(row.user_id);
  }
  return set.size;
}

export const getConversionFunnel = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => periodSchema.parse(input ?? {}))
  .handler(async ({ data, context }): Promise<FunnelResult> => {
    await assertAdmin(context.userId);
    const since = periodStart(data.period).toISOString();

    // ====== Etapas 1-8: rastreamento por session_id ======
    const [
      visits,
      signupCta,
      signupView,
      fieldFocus,
      emailFilled,
      usernameFilled,
      passwordFilled,
      submitClick,
    ] = await Promise.all([
      countDistinctSessions("page_view", since),
      countDistinctSessions("signup_click", since),
      countDistinctSessions("auth_signup_view", since),
      countDistinctSessions("signup_field_focus", since),
      countDistinctSessions("signup_email_filled", since),
      countDistinctSessions("signup_username_filled", since),
      countDistinctSessions("signup_password_filled", since),
      countDistinctSessions("signup_submit_click", since),
    ]);

    // ====== Etapa 9: cadastros concluídos (profiles criados no período) ======
    const { count: signupSuccessCount } = await supabaseAdmin
      .from("profiles")
      .select("id", { count: "exact", head: true })
      .gte("created_at", since);
    const signupSuccess = signupSuccessCount ?? 0;

    // ====== Etapa 10: primeiro login — usuários autenticados ativos no período ======
    const firstLogin = await countDistinctUsers("page_view", since);

    // ====== Etapa 11: primeira conversa — senders distintos no período ======
    const { data: msgRows } = await supabaseAdmin
      .from("messages")
      .select("sender_id")
      .gte("created_at", since)
      .limit(50000);
    const firstConvSet = new Set<string>();
    for (const r of msgRows ?? []) if (r.sender_id) firstConvSet.add(r.sender_id);
    const firstConv = firstConvSet.size;

    // ====== Etapa 12: primeiro status ======
    const { data: stRows } = await supabaseAdmin
      .from("statuses")
      .select("user_id")
      .gte("created_at", since)
      .limit(50000);
    const firstStatusSet = new Set<string>();
    for (const r of stRows ?? []) if (r.user_id) firstStatusSet.add(r.user_id);
    const firstStatus = firstStatusSet.size;

    const rawSteps: Array<{ key: string; label: string; count: number }> = [
      { key: "visits", label: "Visitas únicas", count: visits },
      { key: "signup_cta", label: "Clique em Cadastrar", count: signupCta },
      { key: "signup_view", label: "Tela de cadastro aberta", count: signupView },
      { key: "field_focus", label: "Início do preenchimento", count: fieldFocus },
      { key: "email", label: "E-mail preenchido", count: emailFilled },
      { key: "username", label: "Usuário/Nome preenchido", count: usernameFilled },
      { key: "password", label: "Senha preenchida", count: passwordFilled },
      { key: "submit", label: "Botão Criar conta clicado", count: submitClick },
      { key: "success", label: "Cadastro concluído", count: signupSuccess },
      { key: "first_login", label: "Primeiro login", count: firstLogin },
      { key: "first_conv", label: "Primeira conversa", count: firstConv },
      { key: "first_status", label: "Primeiro status", count: firstStatus },
    ];

    const top = rawSteps[0].count || 1;
    const steps: FunnelStep[] = rawSteps.map((s, i) => {
      const prev = i === 0 ? s.count : rawSteps[i - 1].count;
      const dropPct = prev > 0 ? Math.max(0, Math.min(100, ((prev - s.count) / prev) * 100)) : 0;
      const convPct = (s.count / top) * 100;
      return { ...s, dropPct, convPct };
    });

    // ====== Abandono ======
    const ab = (label: string, from: number, to: number, key: string): FunnelAbandonment => ({
      key,
      label,
      count: Math.max(0, from - to),
      pct: from > 0 ? ((from - to) / from) * 100 : 0,
    });
    const abandonment: FunnelAbandonment[] = [
      ab("Abandonaram após clicar em cadastrar", signupCta, signupView, "ab_cta"),
      ab("Abandonaram na tela de cadastro", signupView, fieldFocus, "ab_view"),
      ab("Abandonaram após preencher e-mail", emailFilled, usernameFilled, "ab_email"),
      ab("Abandonaram após preencher nome", usernameFilled, passwordFilled, "ab_name"),
      ab("Abandonaram após preencher senha", passwordFilled, submitClick, "ab_password"),
      ab("Abandonaram após enviar cadastro", submitClick, signupSuccess, "ab_submit"),
      ab("Abandonaram após criar conta", signupSuccess, firstLogin, "ab_success"),
      ab("Abandonaram sem fazer login", signupSuccess, firstLogin, "ab_no_login"),
    ];

    // ====== Modo visitante ======
    const [visitorsCount, discoverViews, publicProfileViews, returnedAndSignedUp] =
      await Promise.all([
        countDistinctSessions("page_view", since),
        countDistinctSessions("discover_list_view", since),
        countDistinctSessions("public_profile_view", since),
        // Aproximação: sessões que tiveram discover_list_view E depois signup_completed.
        (async () => {
          const { data: a } = await supabaseAdmin
            .from("analytics_events")
            .select("session_id")
            .eq("event_name", "discover_list_view")
            .gte("created_at", since)
            .not("session_id", "is", null)
            .limit(50000);
          const visitorSessions = new Set<string>();
          for (const r of a ?? []) if (r.session_id) visitorSessions.add(r.session_id);
          if (visitorSessions.size === 0) return 0;
          const { data: b } = await supabaseAdmin
            .from("analytics_events")
            .select("session_id")
            .eq("event_name", "signup_completed")
            .gte("created_at", since)
            .not("session_id", "is", null)
            .limit(50000);
          let n = 0;
          const seen = new Set<string>();
          for (const r of b ?? []) {
            if (r.session_id && visitorSessions.has(r.session_id) && !seen.has(r.session_id)) {
              seen.add(r.session_id);
              n += 1;
            }
          }
          return n;
        })(),
      ]);

    const visitor: FunnelVisitor = {
      visitors: visitorsCount,
      publicProfileViews,
      discoverViews,
      returnedAndSignedUp,
      visitorToSignupPct:
        visitorsCount > 0 ? (returnedAndSignedUp / visitorsCount) * 100 : 0,
    };

    // ====== Alertas ======
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
    if (signupSuccess > 0) {
      const noLoginPct = ((signupSuccess - firstLogin) / signupSuccess) * 100;
      if (noLoginPct >= 15) {
        alerts.push({
          level: "warning",
          message: `${Math.max(0, noLoginPct).toFixed(0)}% dos usuários criam conta mas nunca fazem login.`,
        });
      }
    }
    if (visitor.visitors > 0 && visitor.visitorToSignupPct < 2 && visitor.discoverViews > 10) {
      alerts.push({
        level: "info",
        message: `${(100 - visitor.visitorToSignupPct).toFixed(0)}% dos visitantes utilizam o modo explorar sem cadastro.`,
      });
    }

    return {
      period: data.period,
      steps,
      abandonment,
      visitor,
      alerts,
    };
  });
