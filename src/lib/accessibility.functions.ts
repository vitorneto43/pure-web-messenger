import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const schema = z.object({
  imageUrl: z.string().url(),
  language: z.string().min(2).max(40).optional(),
});

export const describeImage = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => schema.parse(d))
  .handler(async ({ data }) => {
    const apiKey = process.env.LOVABLE_API_KEY;
    if (!apiKey) return { ok: false as const, error: "IA não configurada" };

    const lang = data.language || "português do Brasil";
    const system = `Você descreve imagens para pessoas com deficiência visual. Seja objetivo, em ${lang}, em 2 a 4 frases. Descreva pessoas, ambiente, ações, cores e texto visível na imagem. Não use "a imagem mostra" — vá direto ao ponto. Sem markdown, sem aspas.`;

    const resp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: system },
          {
            role: "user",
            content: [
              { type: "text", text: "Descreva esta imagem para acessibilidade." },
              { type: "image_url", image_url: { url: data.imageUrl } },
            ],
          },
        ],
      }),
    });

    if (resp.status === 429) return { ok: false as const, error: "Muitas requisições. Tente em instantes." };
    if (resp.status === 402) return { ok: false as const, error: "Créditos de IA esgotados." };
    if (!resp.ok) {
      const t = await resp.text().catch(() => "");
      console.error("describeImage error", resp.status, t);
      return { ok: false as const, error: "Falha ao descrever a imagem." };
    }
    const json: any = await resp.json();
    const content: string = json?.choices?.[0]?.message?.content?.trim() ?? "";
    return { ok: true as const, content };
  });
