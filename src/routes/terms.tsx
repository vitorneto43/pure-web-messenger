import { createFileRoute } from "@tanstack/react-router";
import { PublicLayout } from "@/components/public/PublicLayout";

export const Route = createFileRoute("/terms")({
  head: () => ({
    meta: [
      { title: "Termos de Uso — WaveChat" },
      {
        name: "description",
        content:
          "Regras de uso do WaveChat: comportamento esperado, proibições, suspensão e responsabilidades.",
      },
      { property: "og:title", content: "Termos de Uso — WaveChat" },
      {
        property: "og:description",
        content: "Leia as regras de uso da plataforma WaveChat.",
      },
      { property: "og:url", content: "https://webconnectchat.com/terms" },
    ],
    links: [{ rel: "canonical", href: "https://webconnectchat.com/terms" }],
  }),
  component: TermsPage,
});

function TermsPage() {
  return (
    <PublicLayout>
      <article className="max-w-3xl mx-auto px-4 py-12">
        <h1 className="text-4xl font-bold tracking-tight">Termos de Uso</h1>
        <p className="text-sm text-muted-foreground mt-2">
          Ao usar o WaveChat você concorda integralmente com os termos abaixo.
        </p>

        <div className="mt-8 space-y-8 text-[15px] leading-relaxed text-foreground/90">
          <Section title="1. Regras da plataforma">
            O WaveChat é uma plataforma de comunicação para conversas pessoais e em grupo. Você é
            responsável por todo conteúdo que envia, compartilha ou publica em status.
          </Section>

          <Section title="2. Proibição de spam">
            É proibido enviar mensagens em massa, propagandas não solicitadas, correntes ou
            qualquer tipo de comunicação automatizada não autorizada.
          </Section>

          <Destruct title="3. Proibição de golpes e abusos">
            É expressamente proibido aplicar golpes (incluindo golpes via Pix), enganar usuários,
            se passar por terceiros, distribuir malware, conteúdo ilegal, pornografia infantil,
            discurso de ódio, ameaças ou qualquer atividade criminosa.
          </Destruct>

          <Section title="4. Uso responsável">
            Use o WaveChat de forma respeitosa. Não publique conteúdo que viole direitos autorais,
            privacidade de terceiros ou a legislação brasileira.
          </Section>

          <Section title="5. Suspensão de contas">
            Contas que violem estes termos podem ser <strong>suspensas ou excluídas
            permanentemente</strong> sem aviso prévio. Em casos graves, denúncias serão encaminhadas
            às autoridades competentes.
          </Section>

          <Section title="6. Direitos e responsabilidades do usuário">
            Você tem direito a privacidade, exclusão da sua conta a qualquer momento e suporte. Em
            contrapartida, é responsável por manter suas credenciais seguras e por todo o conteúdo
            transmitido pela sua conta.
          </Section>

          <Section title="7. Limitação de responsabilidade">
            O WaveChat é fornecido “como está”. Fazemos nosso melhor para manter o serviço
            disponível e seguro, mas não nos responsabilizamos por perdas decorrentes de uso
            indevido, falhas de terceiros ou eventos fora do nosso controle.
          </Section>

          <Section title="8. Alterações">
            Podemos atualizar estes termos a qualquer momento. O uso continuado do serviço após
            mudanças significa aceite da nova versão.
          </Section>
        </div>
      </article>
    </PublicLayout>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section>
      <h2 className="text-xl font-semibold mb-2">{title}</h2>
      <p>{children}</p>
    </section>
  );
}

function Destruct({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-xl border border-destructive/30 bg-destructive/5 p-4">
      <h2 className="text-xl font-semibold mb-2 text-destructive">{title}</h2>
      <p>{children}</p>
    </section>
  );
}
