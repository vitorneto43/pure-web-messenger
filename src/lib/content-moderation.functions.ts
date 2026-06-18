// Camada 2 da moderação — análise por IA via Lovable AI Gateway.
// Só chamada quando a camada 1 (regras locais) passa, para economizar.
// Também expõe `moderateBoost` usado pelos dialogs antes do checkout
// (gera as linhas em `boost_review_results`).

import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { scanLocally, type PolicyKind } from "@/lib/content-policy";

const KINDS = ["post", "status", "live", "boost"] as const;

const scanSchema = z.object({
  text: z.string().max(4000),
  kind: z.enum(KINDS),
});

const boostSchema = z.object({
  text: z.string().max(4000),
  boostId: z.string().uuid(),
  boostKind: z.enum(["status", "post"]),
});

interface AiVerdict {
  verdict: "approved" | "rejected" | "needs_review";
  category: string;
  confidence: number;
  reason: string;
}

async function callAi(text: string, kind: PolicyKind): Promise<AiVerdict | null> {
  const apiKey = process.env.LOVABLE_API_KEY;
  if (!apiKey) return null;
  const system = `Você é um moderador de conteúdo da rede social WaveChat. Analise o texto abaixo (de um ${kind === "boost" ? "anúncio impulsionado" : kind}) e decida se ele viola as Diretrizes da Comunidade.

Reprove (rejected) se contiver:
- Pirataria (IPTV, filmes, transmissão pirata de esportes)
- Phishing ou coleta de credenciais
- Golpes financeiros (lucro garantido, robôs de aposta, esquemas)
- Conteúdo envolvendo menores
- Venda de drogas/armas ilegais
- Apologia a violência grave ou automutilação
- Spam óbvio repetitivo

Aceite (approved) conteúdo cotidiano: opiniões, vida pessoal, divulgação legítima, humor, notícias, perguntas, conversas.

Envie para revisão humana (needs_review) apenas em casos genuinamente ambíguos.

Responda APENAS em JSON puro (sem markdown, sem comentários) seguindo este formato exato:
{"verdict":"approved|rejected|needs_review","category":"...","confidence":0.0-1.0,"reason":"..."}`;

  try {
    const resp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Lovable-API-Key": apiKey,
        "X-Lovable-AIG-SDK": "vercel-ai-sdk",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          { role: "system", content: system },
          { role: "user", content: text },
        ],
        response_format: { type: "json_object" },
        temperature: 0,
      }),
    });
    if (!resp.ok) return null;
    const body: any = await resp.json();
    const raw = body?.choices?.[0]?.message?.content;
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    const verdict = parsed.verdict as AiVerdict["verdict"];
    if (!["approved", "rejected", "needs_review"].includes(verdict)) return null;
    return {
      verdict,
      category: String(parsed.category ?? "other"),
      confidence: Number(parsed.confidence ?? 0.5),
      reason: String(parsed.reason ?? ""),
    };
  } catch {
    return null;
  }
}

// Scan público (post/status/live/boost) usado pré-publicação.
export const scanContent = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: z.infer<typeof scanSchema>) => scanSchema.parse(d))
  .handler(async ({ data }) => {
    const local = scanLocally(data.text, data.kind);
    if (local.verdict === "block") {
      return {
        verdict: "rejected" as const,
        category: local.category ?? "policy",
        reason: local.reasons[0] ?? "Conteúdo bloqueado pelas regras locais",
        layer: "auto_local" as const,
        confidence: 1,
      };
    }
    // Para textos muito curtos, não vale o custo da IA
    if ((data.text ?? "").trim().length < 12) {
      return {
        verdict: "approved" as const,
        category: "ok",
        reason: "",
        layer: "auto_local" as const,
        confidence: 1,
      };
    }
    const ai = await callAi(data.text, data.kind);
    if (!ai) {
      // IA indisponível — aprovamos por padrão, sem bloquear o usuário
      return {
        verdict: "approved" as const,
        category: "ai_unavailable",
        reason: "",
        layer: "auto_local" as const,
        confidence: 0.5,
      };
    }
    return {
      verdict: ai.verdict === "rejected" ? ("rejected" as const) :
              ai.verdict === "needs_review" ? ("needs_review" as const) :
              ("approved" as const),
      category: ai.category,
      reason: ai.reason,
      layer: "auto_ai" as const,
      confidence: ai.confidence,
    };
  });

// Moderação síncrona de boost (pré-checkout). Persiste em boost_review_results
// e atualiza o boost (quando já existir). Retorna verdict para a UI.
export const moderateBoost = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: z.infer<typeof boostSchema>) => boostSchema.parse(d))
  .handler(async ({ data, context }) => {
    const { supabase } = context as { supabase: any };

    const local = scanLocally(data.text, "boost");
    let verdict: "approved" | "rejected" | "needs_review" = "approved";
    let category = "ok";
    let reason = "";
    let layer: "auto_local" | "auto_ai" = "auto_local";
    let confidence = 1;

    if (local.verdict === "block") {
      verdict = "rejected";
      category = local.category ?? "policy";
      reason = local.reasons[0] ?? "Bloqueado pelas regras locais";
    } else {
      const ai = await callAi(data.text, "boost");
      if (ai) {
        layer = "auto_ai";
        confidence = ai.confidence;
        category = ai.category;
        reason = ai.reason;
        verdict = ai.verdict;
      }
    }

    // Persiste o resultado (não bloqueia caso falhe — não queremos derrubar o fluxo)
    try {
      await supabase.from("boost_review_results").insert({
        boost_id: data.boostId,
        boost_kind: data.boostKind,
        verdict,
        reviewer: layer,
        category,
        reason,
        confidence,
        payload: { matched: local.matched },
      });

      const table = data.boostKind === "status" ? "status_boosts" : "post_boosts";
      await supabase
        .from(table)
        .update({
          review_status:
            verdict === "approved" ? "approved" :
            verdict === "rejected" ? "rejected" : "under_review",
          review_reason: verdict === "rejected" ? reason : null,
          reviewed_at: new Date().toISOString(),
        })
        .eq("id", data.boostId);
    } catch {
      // não vamos reverter UX por erro de persistência
    }

    return { verdict, category, reason, confidence, layer };
  });
