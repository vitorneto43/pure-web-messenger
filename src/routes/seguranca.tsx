import { createFileRoute } from "@tanstack/react-router";
import { PublicLayout } from "@/components/public/PublicLayout";
import { ShieldCheck, Lock, KeyRound, UserX, Bell, Bug } from "lucide-react";

export const Route = createFileRoute("/seguranca")({
  head: () => ({
    meta: [
      { title: "Segurança — WaveChat" },
      {
        name: "description",
        content:
          "Como o WaveChat protege sua conta, seus dados e combate perfis maliciosos.",
      },
      { property: "og:title", content: "Segurança — WaveChat" },
      {
        property: "og:description",
        content: "Práticas de segurança do WaveChat: criptografia, RLS, denúncias e boas práticas.",
      },
      { property: "og:url", content: "https://webconnectchat.com/seguranca" },
    ],
    links: [{ rel: "canonical", href: "https://webconnectchat.com/seguranca" }],
  }),
  component: SecurityPage,
});

function SecurityPage() {
  return (
    <PublicLayout>
      <article className="max-w-3xl mx-auto px-4 py-12">
        <div className="flex items-center gap-3">
          <div className="size-12 rounded-2xl bg-primary/15 text-primary grid place-items-center">
            <ShieldCheck className="size-6" />
          </div>
          <h1 className="text-4xl font-bold tracking-tight">Segurança</h1>
        </div>
        <p className="mt-3 text-muted-foreground">
          Como o WaveChat protege suas contas, seus dados e combate perfis maliciosos.
        </p>

        <div className="mt-8 grid gap-4 sm:grid-cols-2">
          <Card icon={<Lock className="size-5" />} title="Conexões criptografadas">
            Todo o tráfego usa HTTPS/WSS. Chamadas de voz e vídeo são transmitidas via WebRTC com
            sinalização criptografada.
          </Card>
          <Card icon={<KeyRound className="size-5" />} title="Autenticação segura">
            Login por e-mail e senha com tokens JWT. Senhas nunca são armazenadas em texto puro.
            Você pode encerrar sessões e alterar sua senha a qualquer momento.
          </Card>
          <Card icon={<ShieldCheck className="size-5" />} title="Regras de acesso no banco">
            Aplicamos RLS (Row-Level Security) em todas as tabelas sensíveis, garantindo que
            somente você (e participantes autorizados) veja seus dados.
          </Card>
          <Card icon={<UserX className="size-5" />} title="Combate a perfis maliciosos">
            Detectamos spam automaticamente, limitamos criação de contas por IP/dispositivo e
            moderamos denúncias manualmente. Contas em violação são suspensas ou excluídas.
          </Card>
          <Card icon={<Bell className="size-5" />} title="Você no controle">
            Bloqueie, silencie e denuncie qualquer usuário. Exclua sua conta pelo próprio app em
            Perfil → Excluir conta — seus dados são removidos.
          </Card>
          <Card icon={<Bug className="size-5" />} title="Vulnerabilidades">
            Encontrou um problema de segurança? Escreva para{" "}
            <a className="text-primary hover:underline" href="mailto:contato@webconnectchat.com">
              contato@webconnectchat.com
            </a>{" "}
            com detalhes técnicos. Agradecemos relatos responsáveis.
          </Card>
        </div>

        <section className="mt-10 rounded-2xl border border-border bg-card/60 p-6">
          <h2 className="text-xl font-semibold">Boas práticas para sua conta</h2>
          <ul className="mt-3 space-y-2 text-[15px] text-foreground/90 list-disc pl-5">
            <li>Use uma senha única, forte e que você não use em outros sites.</li>
            <li>Nunca compartilhe códigos, senhas ou chaves Pix por mensagem com estranhos.</li>
            <li>Desconfie de pedidos urgentes de dinheiro, mesmo vindo de conhecidos.</li>
            <li>Denuncie perfis suspeitos usando o botão de denúncia no próprio app.</li>
          </ul>
        </section>

        <section className="mt-8 rounded-2xl border border-destructive/30 bg-destructive/5 p-6">
          <h2 className="text-xl font-semibold text-destructive">Denunciar abuso</h2>
          <p className="mt-2 text-[15px]">
            Encontrou conteúdo abusivo, golpe, discurso de ódio ou qualquer violação? Denuncie
            direto na conversa/perfil, ou envie um e-mail para{" "}
            <a className="text-primary hover:underline" href="mailto:contato@webconnectchat.com?subject=Denúncia%20de%20abuso">
              contato@webconnectchat.com
            </a>
            . Toda denúncia é analisada pela nossa equipe.
          </p>
        </section>
      </article>
    </PublicLayout>
  );
}

function Card({
  icon,
  title,
  children,
}: {
  icon: React.ReactNode;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-2xl border border-border bg-card/60 p-5">
      <div className="flex items-center gap-2">
        <div className="size-9 rounded-lg bg-primary/15 text-primary grid place-items-center">
          {icon}
        </div>
        <h3 className="font-semibold">{title}</h3>
      </div>
      <p className="mt-2 text-sm text-foreground/85 leading-relaxed">{children}</p>
    </div>
  );
}
