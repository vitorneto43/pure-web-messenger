import { createFileRoute } from "@tanstack/react-router";
import { PublicLayout } from "@/components/public/PublicLayout";

export const Route = createFileRoute("/privacy")({
  head: () => ({
    meta: [
      { title: "Política de Privacidade — WaveChat" },
      {
        name: "description",
        content:
          "Como o WaveChat coleta, usa e protege seus dados: mensagens, chamadas, mídia, pagamentos e cookies.",
      },
      { property: "og:title", content: "Política de Privacidade — WaveChat" },
      {
        property: "og:description",
        content: "Saiba como protegemos seus dados no WaveChat.",
      },
      { property: "og:url", content: "https://webconnectchat.com/privacy" },
    ],
    links: [{ rel: "canonical", href: "https://webconnectchat.com/privacy" }],
  }),
  component: PrivacyPage,
});

function PrivacyPage() {
  return (
    <PublicLayout>
      <article className="max-w-3xl mx-auto px-4 py-12 prose-invert">
        <h1 className="text-4xl font-bold tracking-tight">Política de Privacidade</h1>
        <p className="text-sm text-muted-foreground mt-2">
          Última atualização: {new Date().toLocaleDateString("pt-BR")}
        </p>

        <div className="mt-8 space-y-8 text-[15px] leading-relaxed text-foreground/90">
          <Section title="1. Coleta de dados">
            Coletamos apenas o necessário para o funcionamento do WaveChat: nome de usuário, nome de
            exibição, e-mail, foto de perfil e dados gerados durante o uso (mensagens, chamadas,
            status e mídias enviadas). Nunca vendemos seus dados.
          </Section>

          <Section title="2. Login e cadastro">
            O cadastro exige e-mail e senha. Não pedimos número de celular nem SMS. Suas credenciais
            são armazenadas de forma criptografada por nosso provedor de autenticação.
          </Section>

          <Section title="3. Upload de imagens e vídeos">
            Imagens e vídeos enviados em conversas, grupos e status são armazenados em nossa
            infraestrutura segura. Apenas usuários autorizados (participantes da conversa) têm
            acesso, conforme regras de acesso aplicadas no servidor.
          </Section>

          <Section title="4. Mensagens e chamadas">
            Mensagens são salvas para entrega e histórico. Chamadas de áudio e vídeo são
            transmitidas via WebRTC com sinalização criptografada (HTTPS/WSS). Não gravamos
            chamadas.
          </Section>

          <Section title="5. Cookies">
            Usamos cookies e armazenamento local apenas para manter sua sessão ativa, lembrar
            preferências e melhorar o desempenho. Não usamos cookies de rastreamento publicitário de
            terceiros.
          </Section>

          <Section title="6. Pagamentos e Pix">
            Quando você utiliza recursos pagos (como impulsionamento de status), os pagamentos são
            processados por parceiros certificados (ex.: Stripe). Não armazenamos números completos
            de cartão. Chaves Pix compartilhadas em conversas só ficam visíveis aos participantes
            daquela conversa.
          </Section>

          <Section title="7. Segurança das informações">
            Aplicamos HTTPS obrigatório, autenticação JWT, regras de acesso por linha (RLS) no banco
            de dados e monitoramento contínuo. Mesmo assim, nenhum sistema é 100% imune — ajude-nos
            mantendo sua senha forte e única.
          </Section>

          <Section title="8. Proteção de dados dos usuários (LGPD)">
            Você pode, a qualquer momento, solicitar acesso, correção ou exclusão dos seus dados —
            inclusive excluindo sua conta diretamente pelo aplicativo, em <em>Perfil → Excluir
            conta</em>. Para outras solicitações relacionadas à LGPD, escreva para{" "}
            <a className="text-primary hover:underline" href="mailto:veiganeto46@gmail.com">
              veiganeto46@gmail.com
            </a>
            .
          </Section>

          <Section title="9. Alterações nesta política">
            Podemos atualizar esta política para refletir mudanças no serviço ou na legislação.
            Mudanças relevantes serão comunicadas dentro do aplicativo.
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
