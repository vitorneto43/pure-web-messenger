import { createServerFn } from "@tanstack/react-start";
import { getRequestIP, getRequestHeader } from "@tanstack/react-start/server";
import { z } from "zod";
import { createHash } from "crypto";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const inputSchema = z.object({
  message_id: z.string().uuid().optional(),
  conversation_id: z.string().uuid().optional(),
  content: z.string().max(8000).optional(),
});

// PRIVACIDADE
// ---------------------------------------------------------------------------
// Este aplicativo é um mensageiro: o conteúdo das mensagens é privado.
// Por isso a detecção de spam:
//  - NUNCA persiste o conteúdo (nem trecho/excerpt).
//  - Persiste apenas hashes anonimizados (SHA-256 com pepper) do conteúdo
//    e do IP, junto com a *categoria* de risco detectada e uma pontuação.
//  - Análise acontece em memória durante o request e é descartada.
//  - Apenas moderadores/admins veem os sinais — e só veem hash, categorias
//    e pontuação, jamais o texto da mensagem.
// ---------------------------------------------------------------------------

const PEPPER = process.env.SPAM_HASH_PEPPER || "wavechat-default-pepper";

function sha(value: string) {
  return createHash("sha256").update(`${PEPPER}:${value}`).digest("hex");
}

const PATTERNS: Array<{ re: RegExp; reason: string; score: number }> = [
  { re: /(https?:\/\/\S+){3,}/i, reason: "many_links", score: 3 },
  { re: /\b(bit\.ly|tinyurl\.com|t\.co|goo\.gl|cutt\.ly|rebrand\.ly|is\.gd|ow\.ly)\b/i, reason: "shortener_link", score: 2 },
  { re: /\b(bitcoin|btc|usdt|cripto|investimento garantido|lucro garantido|double your money|invest now)\b/i, reason: "crypto_scam", score: 3 },
  { re: /\b(cart[aã]o de cr[eé]dito|cvv|senha do banco|pix urgente|c[oó]digo de verifica[cç][aã]o|verification code)\b/i, reason: "credential_phishing", score: 4 },
  { re: /\b(nudes?|pack\s*\$?\d|onlyfans|porn|xxx|hot\s*girls?|garotas?\s*de\s*programa|acompanhante\s*sexual)\b/i, reason: "adult_content", score: 3 },
  { re: /\b(ganhe\s*r\$|pr[eê]mio|sorteio|free money|click here to win|voc[eê] ganhou)\b/i, reason: "fake_prize", score: 2 },
  { re: /\b(aposta(s|r)?|cassino|bet365|blaze|tigrinho|jogo do (bicho|aviator))\b/i, reason: "gambling_promo", score: 2 },
  { re: /[A-ZÁÉÍÓÚÂÊÔÃÕÇ]{20,}/, reason: "shouting", score: 1 },
  { re: /\b(wa\.me\/|chat\.whatsapp\.com\/|t\.me\/)\S{6,}/i, reason: "external_chat_invite", score: 2 },
  { re: /\b(menor de idade|child|cp\b|loli|incest)\b/i, reason: "illegal_minor", score: 6 },
];

function analyzeContent(content: string) {
  const reasons: string[] = [];
  let score = 0;
  for (const p of PATTERNS) {
    if (p.re.test(content)) {
      reasons.push(p.reason);
      score += p.score;
    }
  }
  if (/(.{4,})\1{4,}/i.test(content)) {
    reasons.push("repeated_pattern");
    score += 2;
  }
  return { score, reasons };
}

function readClientIp(): string | null {
  try {
    return (
      getRequestHeader("cf-connecting-ip") ||
      getRequestHeader("x-forwarded-for")?.split(",")[0]?.trim() ||
      getRequestIP({ xForwardedFor: true }) ||
      null
    );
  } catch {
    return null;
  }
}

export const analyzeMessageForSpam = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => inputSchema.parse(d))
  .handler(async ({ data, context }) => {
    const { userId } = context;
    const content = (data.content ?? "").trim();
    if (!content) return { ok: true, score: 0, reasons: [] as string[] };

    // Analyze in-memory — nothing about the actual text is persisted.
    const { score, reasons } = analyzeContent(content);
    if (score < 2) return { ok: true, score, reasons };

    const rawIp = readClientIp();
    const ipHash = rawIp ? sha(`ip:${rawIp}`) : null;
    const contentHash = sha(`msg:${content}`);
    let ua: string | null = null;
    try {
      ua = getRequestHeader("user-agent") ?? null;
    } catch {}

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    await supabaseAdmin.from("spam_signals").insert({
      sender_id: userId,
      message_id: data.message_id ?? null,
      conversation_id: data.conversation_id ?? null,
      content_hash: contentHash,
      ip_hash: ipHash,
      ip: null, // privacidade: não armazenamos IP em claro
      user_agent: ua,
      score,
      reasons,
      auto_action: null,
    } as any);

    let autoAction: string | null = null;

    if (reasons.includes("illegal_minor") || score >= 8) {
      autoAction = "auto_removed_and_suspended";
      if (data.message_id) {
        await supabaseAdmin
          .from("messages")
          .update({
            deleted_for_everyone_at: new Date().toISOString(),
            content: null,
            attachment_url: null,
            attachment_name: null,
            attachment_type: null,
          })
          .eq("id", data.message_id);
      }
      const until = new Date(Date.now() + 7 * 86400_000).toISOString();
      await supabaseAdmin.from("profiles").update({ suspended_until: until }).eq("id", userId);
      const { data: p } = await supabaseAdmin.from("profiles").select("strike_count").eq("id", userId).single();
      await supabaseAdmin.from("profiles").update({ strike_count: (p?.strike_count ?? 0) + 1 }).eq("id", userId);

      // Hard violation: também bane o IP (apenas o hash) para impedir novas contas.
      if (ipHash) {
        await supabaseAdmin
          .from("banned_ips")
          .upsert(
            {
              ip_hash: ipHash,
              reason: `auto: ${reasons.join(",")}`,
              related_user_id: userId,
            } as any,
            { onConflict: "ip_hash" },
          );
      }

      await supabaseAdmin.from("notifications").insert({
        user_id: userId,
        type: "moderation",
        title: "Conteúdo bloqueado automaticamente",
        body: "Sua mensagem violou as Diretrizes da Comunidade e sua conta foi suspensa temporariamente.",
        data: { reasons, score },
      });
    } else if (score >= 5) {
      autoAction = "auto_flagged";
      await supabaseAdmin.from("content_reports").insert({
        reporter_id: userId,
        reported_user_id: userId,
        target_type: "message",
        target_id: data.message_id ?? "",
        reason: "spam_auto",
        // detalhes ficam com a categoria — sem texto da mensagem
        details: `Auto-detect: ${reasons.join(", ")} (score=${score})`,
      });
      await supabaseAdmin.from("notifications").insert({
        user_id: userId,
        type: "moderation",
        title: "Aviso: possível spam detectado",
        body: "Sua mensagem foi sinalizada para revisão. Consulte as Diretrizes da Comunidade.",
        data: { reasons, score },
      });
    }

    if (ipHash) {
      const since = new Date(Date.now() - 24 * 3600_000).toISOString();
      const { count } = await supabaseAdmin
        .from("spam_signals")
        .select("id", { count: "exact", head: true })
        .eq("ip_hash", ipHash)
        .gte("created_at", since);
      if ((count ?? 0) >= 5) {
        autoAction = autoAction ?? "ip_flagged";
      }
    }

    if (autoAction) {
      await supabaseAdmin
        .from("spam_signals")
        .update({ auto_action: autoAction })
        .eq("sender_id", userId)
        .is("auto_action", null)
        .order("created_at", { ascending: false })
        .limit(1);
    }

    return { ok: true, score, reasons, auto_action: autoAction };
  });

async function assertModerator(supabase: any, userId: string) {
  const [a, m, s] = await Promise.all([
    supabase.rpc("has_role", { _user_id: userId, _role: "admin" }),
    supabase.rpc("has_role", { _user_id: userId, _role: "moderator" }),
    supabase.rpc("has_role", { _user_id: userId, _role: "superadmin" }),
  ]);
  if (!a.data && !m.data && !s.data) throw new Error("Forbidden");
}

export const listSpamSignals = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    await assertModerator(supabase, userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: rows } = await supabaseAdmin
      .from("spam_signals")
      .select("id, sender_id, message_id, conversation_id, content_hash, ip_hash, score, reasons, auto_action, created_at")
      .order("created_at", { ascending: false })
      .limit(200);

    const { data: ipRows } = await supabaseAdmin
      .from("spam_signals")
      .select("ip_hash, score")
      .not("ip_hash", "is", null)
      .gte("created_at", new Date(Date.now() - 7 * 86400_000).toISOString());
    const ipMap = new Map<string, { hits: number; score: number }>();
    for (const r of ipRows ?? []) {
      const k = (r as any).ip_hash as string;
      const e = ipMap.get(k) ?? { hits: 0, score: 0 };
      e.hits++;
      e.score += (r as any).score ?? 0;
      ipMap.set(k, e);
    }
    const topIps = Array.from(ipMap.entries())
      .map(([ip_hash, v]) => ({ ip_hash, ...v }))
      .sort((a, b) => b.score - a.score)
      .slice(0, 25);

    return { signals: rows ?? [], topIps };
  });

// --- Admin: gerenciar IPs banidos (sempre via hash) ---

export const banIpHash = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        ip_hash: z.string().min(16).max(128),
        reason: z.string().max(500).optional(),
        related_user_id: z.string().uuid().optional(),
        expires_at: z.string().datetime().optional(),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    await assertModerator(supabase, userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.from("banned_ips").upsert(
      {
        ip_hash: data.ip_hash,
        reason: data.reason ?? null,
        related_user_id: data.related_user_id ?? null,
        expires_at: data.expires_at ?? null,
        banned_by: userId,
      } as any,
      { onConflict: "ip_hash" },
    );
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const unbanIpHash = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ ip_hash: z.string().min(16).max(128) }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    await assertModerator(supabase, userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.from("banned_ips").delete().eq("ip_hash", data.ip_hash);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const listBannedIps = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    await assertModerator(supabase, userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data } = await supabaseAdmin
      .from("banned_ips")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(200);
    return { banned: data ?? [] };
  });
