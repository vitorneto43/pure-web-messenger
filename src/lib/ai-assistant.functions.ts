import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const ActionSchema = z.object({
  action: z.enum(["translate", "suggest_reply", "improve", "summarize"]),
  text: z.string().min(1).max(8000).optional(),
  context: z.string().max(12000).optional(),
  targetLanguage: z.string().min(2).max(40).optional(),
  tone: z.enum(["neutral", "formal", "friendly", "short", "funny"]).optional(),
});

type Input = z.infer<typeof ActionSchema>;

function buildPrompt(input: Input): { system: string; user: string } {
  const lang = input.targetLanguage || "português do Brasil";
  switch (input.action) {
    case "translate":
      return {
        system: `Você é um tradutor. Detecte o idioma de origem e traduza para ${lang}. Responda APENAS com a tradução, sem comentários, sem aspas, sem prefixos.`,
        user: input.text ?? "",
      };
    case "improve": {
      const toneMap: Record<string, string> = {
        neutral: "mantendo o tom natural",
        formal: "em tom formal e educado",
        friendly: "em tom amigável e caloroso",
        short: "de forma curta e direta",
        funny: "com leve toque de humor",
      };
      const tone = toneMap[input.tone ?? "neutral"];
      return {
        system: `Você reescreve mensagens de chat ${tone}. Mantenha o idioma original. Responda APENAS com o texto reescrito, sem aspas, sem explicação.`,
        user: input.text ?? "",
      };
    }
    case "suggest_reply":
      return {
        system: `Você sugere UMA resposta curta e natural para uma mensagem recebida em um chat. Responda no mesmo idioma da mensagem recebida. Responda APENAS com a sugestão de resposta, sem aspas, sem prefixo tipo "Resposta:".`,
        user: `Mensagem recebida:\n${input.text ?? ""}${input.context ? `\n\nContexto da conversa recente:\n${input.context}` : ""}`,
      };
    case "summarize":
      return {
        system: `Você resume conversas de chat em português do Brasil, de forma objetiva, em até 5 bullets curtos.`,
        user: input.context ?? input.text ?? "",
      };
  }
}

export const runAIAssistant = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => ActionSchema.parse(data))
  .handler(async ({ data }) => {
    const apiKey = process.env.LOVABLE_API_KEY;
    if (!apiKey) {
      return { ok: false as const, error: "AI não configurada" };
    }
    const { system, user } = buildPrompt(data);
    const resp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          { role: "system", content: system },
          { role: "user", content: user },
        ],
      }),
    });
    if (resp.status === 429) {
      return { ok: false as const, error: "Muitas requisições. Tente novamente em instantes." };
    }
    if (resp.status === 402) {
      return { ok: false as const, error: "Créditos de IA esgotados. Adicione créditos no workspace." };
    }
    if (!resp.ok) {
      const t = await resp.text().catch(() => "");
      console.error("AI gateway error", resp.status, t);
      return { ok: false as const, error: "Falha ao consultar a IA." };
    }
    const json: any = await resp.json();
    const content: string = json?.choices?.[0]?.message?.content?.trim() ?? "";
    return { ok: true as const, content };
  });
