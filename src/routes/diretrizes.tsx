import { createFileRoute } from "@tanstack/react-router";
import { PublicLayout } from "@/components/public/PublicLayout";
import { CheckCircle2, XCircle, Shield, AlertTriangle, Flag } from "lucide-react";

export const Route = createFileRoute("/diretrizes")({
  component: GuidelinesPage,
  head: () => ({
    meta: [
      { title: "Diretrizes da Comunidade · WaveChat" },
      {
        name: "description",
        content:
          "Conheça as Diretrizes da Comunidade do WaveChat: o que é permitido, o que é proibido e como mantemos o app seguro para todos.",
      },
    ],
  }),
});

const ALLOWED = [
  "Fotos pessoais, lifestyle, viagens e bastidores",
  "Humor, memes e entretenimento respeitoso",
  "Conteúdo educacional, dicas e tutoriais",
  "Música, arte, esportes e cultura",
  "Negócios, marketing pessoal e divulgação legal de serviços",
  "Conversas e amizades respeitosas",
];

const FORBIDDEN = [
  "Nudez explícita ou conteúdo sexual",
  "Prostituição, aliciamento ou venda de conteúdo adulto",
  "Violência gráfica, gore ou tortura",
  "Ameaças, intimidação ou assédio",
  "Discurso de ódio (raça, gênero, religião, orientação sexual, etc.)",
  "Spam em massa, propaganda enganosa ou links maliciosos",
  "Golpes, fraudes ou esquemas financeiros",
  "Exploração de menores ou qualquer conteúdo ilegal",
  "Incitação à violência ou autoagressão",
];

function GuidelinesPage() {
  return (
    <PublicLayout>
      <article className="max-w-3xl mx-auto px-4 py-12">
        <div className="flex items-center gap-3 mb-3">
          <div className="size-10 rounded-xl bg-primary/15 text-primary grid place-items-center">
            <Shield className="size-5" />
          </div>
          <h1 className="text-4xl font-bold tracking-tight">Diretrizes da Comunidade</h1>
        </div>
        <p className="text-muted-foreground text-lg">
          O WaveChat é um espaço para conexão real e segura. Para que todos se sintam bem aqui, seguimos algumas regras
          simples e claras.
        </p>

        <section className="mt-10">
          <h2 className="text-2xl font-semibold mb-3 flex items-center gap-2 text-emerald-500">
            <CheckCircle2 className="size-5" /> O que é permitido
          </h2>
          <ul className="space-y-2">
            {ALLOWED.map((it) => (
              <li key={it} className="flex gap-3 items-start">
                <CheckCircle2 className="size-4 mt-1 text-emerald-500 shrink-0" />
                <span>{it}</span>
              </li>
            ))}
          </ul>
        </section>

        <section className="mt-10">
          <h2 className="text-2xl font-semibold mb-3 flex items-center gap-2 text-destructive">
            <XCircle className="size-5" /> O que NÃO é permitido
          </h2>
          <ul className="space-y-2">
            {FORBIDDEN.map((it) => (
              <li key={it} className="flex gap-3 items-start">
                <XCircle className="size-4 mt-1 text-destructive shrink-0" />
                <span>{it}</span>
              </li>
            ))}
          </ul>
        </section>

        <section className="mt-10 rounded-xl border border-border bg-card p-5">
          <h2 className="text-xl font-semibold mb-3 flex items-center gap-2">
            <AlertTriangle className="size-5 text-amber-500" /> Sistema de penalidades
          </h2>
          <p className="text-sm text-muted-foreground mb-4">
            Aplicamos penalidades progressivas. Casos graves resultam em ações imediatas.
          </p>
          <div className="grid gap-3 sm:grid-cols-3 text-sm">
            <div className="rounded-lg border border-border p-3">
              <p className="font-semibold text-emerald-500">Infração leve</p>
              <p className="text-muted-foreground mt-1">Aviso → Aviso forte → Suspensão temporária</p>
            </div>
            <div className="rounded-lg border border-border p-3">
              <p className="font-semibold text-amber-500">Infração grave</p>
              <p className="text-muted-foreground mt-1">
                Suspensão imediata (nudez, violência, golpes, ameaças, assédio)
              </p>
            </div>
            <div className="rounded-lg border border-border p-3">
              <p className="font-semibold text-destructive">Infração gravíssima</p>
              <p className="text-muted-foreground mt-1">
                Banimento imediato (conteúdo ilegal, exploração, incitação à violência)
              </p>
            </div>
          </div>
        </section>

        <section className="mt-10">
          <h2 className="text-2xl font-semibold mb-3 flex items-center gap-2">
            <Flag className="size-5 text-primary" /> Como denunciar
          </h2>
          <p>
            Em qualquer perfil, status, mensagem ou grupo, toque no menu de três pontos e selecione{" "}
            <strong>Denunciar</strong>. Sua denúncia é anônima e analisada pela nossa equipe de moderação. Você também
            pode <strong>bloquear</strong> o usuário para interromper qualquer contato.
          </p>
        </section>

        <section className="mt-10 text-sm text-muted-foreground">
          <p>
            Estas diretrizes podem ser atualizadas a qualquer momento. Ao usar o WaveChat, você concorda em segui-las
            junto com nossos <a href="/terms" className="underline">Termos</a> e{" "}
            <a href="/privacy" className="underline">Política de Privacidade</a>.
          </p>
        </section>
      </article>
    </PublicLayout>
  );
}
