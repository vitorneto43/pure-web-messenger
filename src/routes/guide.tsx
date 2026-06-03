import { createFileRoute, Link } from "@tanstack/react-router";
import { PublicLayout } from "@/components/public/PublicLayout";
import {
  UserPlus,
  LogIn,
  MessageCircle,
  Users,
  Phone,
  Video,
  Sparkles,
  Image as ImageIcon,
  TrendingUp,
  Banknote,
  Bot,
  Bell,
  Share2,
  Download,
  Smartphone,
  ShieldCheck,
  HelpCircle,
} from "lucide-react";
import type { ReactNode } from "react";

export const Route = createFileRoute("/guide")({
  head: () => ({
    meta: [
      { title: "Como funciona o WaveChat — Guia rápido e didático" },
      {
        name: "description",
        content:
          "Aprenda passo a passo como usar o WaveChat: criar conta, convidar amigos, conversar, criar grupos, fazer chamadas de áudio e vídeo, postar status, impulsionar status, usar a IA e enviar Pix.",
      },
      { property: "og:title", content: "Como funciona o WaveChat" },
      {
        property: "og:description",
        content:
          "Guia completo e intuitivo do WaveChat: login, conversas, grupos, chamadas, status, impulsionamento, IA e Pix.",
      },
      { property: "og:url", content: "https://webconnectchat.com/guide" },
    ],
    links: [{ rel: "canonical", href: "https://webconnectchat.com/guide" }],
  }),
  component: GuidePage,
});

function GuidePage() {
  return (
    <PublicLayout>
      <article className="max-w-3xl mx-auto px-4 py-12">
        <header className="text-center">
          <span className="inline-block text-xs font-semibold tracking-widest uppercase text-primary">
            Guia rápido
          </span>
          <h1 className="mt-3 text-4xl sm:text-5xl font-bold tracking-tight">
            Como funciona o WaveChat
          </h1>
          <p className="mt-4 text-muted-foreground text-lg max-w-2xl mx-auto">
            Em poucos minutos você vai dominar o WaveChat: criar sua conta, chamar seus amigos,
            conversar, fazer chamadas, postar status e até mandar Pix. Tudo de forma simples e
            direta.
          </p>
        </header>

        <nav className="mt-10 grid sm:grid-cols-2 gap-2 text-sm">
          {[
            ["1. Criar conta e entrar", "criar-conta"],
            ["2. Convidar amigos", "convidar-amigos"],
            ["3. Conversas individuais", "conversas"],
            ["4. Grupos", "grupos"],
            ["5. Chamadas de áudio e vídeo", "chamadas"],
            ["6. Status (24h)", "status"],
            ["7. Impulsionar status", "impulsionar"],
            ["8. Assistente de IA", "ia"],
            ["9. Pix no chat", "pix"],
            ["10. Notificações", "notificacoes"],
            ["11. Instalar como app", "instalar"],
            ["12. Privacidade e segurança", "privacidade"],
          ].map(([label, id]) => (
            <a
              key={id}
              href={`#${id}`}
              className="px-3 py-2 rounded-lg border border-border bg-card/50 hover:bg-accent/30 transition"
            >
              {label}
            </a>
          ))}
        </nav>

        <div className="mt-12 space-y-10 text-[15px] leading-relaxed text-foreground/90">
          <Step
            id="criar-conta"
            icon={<UserPlus className="size-5" />}
            title="1. Criar sua conta e entrar"
          >
            <p>
              Clique em <strong>Entrar</strong> no topo da página ou acesse a tela de{" "}
              <Link to="/auth" className="text-primary underline">
                cadastro
              </Link>
              . Você pode criar conta com <strong>e-mail e senha</strong> ou com{" "}
              <strong>Google</strong> (mais rápido — 1 toque).
            </p>
            <ul className="list-disc pl-5 mt-2 space-y-1">
              <li>Escolha um <strong>@usuário</strong> único — é assim que seus amigos vão te achar.</li>
              <li>Defina um nome de exibição e uma foto de perfil bonita.</li>
              <li>Pronto! Você já entra direto nas suas conversas.</li>
            </ul>
            <Tip icon={<LogIn className="size-4" />}>
              Esqueceu a senha? Use o link <em>“Esqueci minha senha”</em> na tela de login.
            </Tip>
          </Step>

          <Step
            id="convidar-amigos"
            icon={<Share2 className="size-5" />}
            title="2. Convidar amigos para o WaveChat"
          >
            <p>
              O WaveChat fica muito melhor com seus amigos dentro. Existem 3 formas fáceis de
              convidar:
            </p>
            <ol className="list-decimal pl-5 mt-2 space-y-2">
              <li>
                <strong>Compartilhar seu @usuário:</strong> mande seu @ pelo WhatsApp,
                Instagram ou SMS. Seu amigo abre o WaveChat, busca pelo @ e começa a conversar.
              </li>
              <li>
                <strong>Compartilhar o link do site:</strong> envie{" "}
                <code className="px-1.5 py-0.5 rounded bg-muted text-xs">webconnectchat.com</code>{" "}
                — qualquer pessoa cria a conta em segundos.
              </li>
              <li>
                <strong>Nova conversa:</strong> dentro do app, toque no botão de{" "}
                <strong>nova conversa</strong> e busque por @ ou nome.
              </li>
            </ol>
            <Tip>
              Dica: convide pelo menos 3 amigos próximos logo no primeiro dia. Assim você sempre
              encontra alguém online quando abrir o app.
            </Tip>
          </Step>

          <Step
            id="conversas"
            icon={<MessageCircle className="size-5" />}
            title="3. Conversas individuais"
          >
            <p>
              Toque no ícone de <strong>nova conversa</strong>, busque o amigo pelo @ ou nome, e
              comece a digitar. Você pode enviar:
            </p>
            <ul className="list-disc pl-5 mt-2 space-y-1">
              <li>Textos com emoji e links clicáveis (aparece preview).</li>
              <li>Fotos, vídeos, áudios e documentos.</li>
              <li>Mensagens de voz (segure o botão do microfone).</li>
              <li>Encaminhamento e resposta a mensagens específicas.</li>
            </ul>
            <p className="mt-2">
              Quer baixar uma mídia? Toque na foto ou vídeo e use o botão de{" "}
              <Download className="size-3.5 inline" /> <strong>download</strong>.
            </p>
          </Step>

          <Step id="grupos" icon={<Users className="size-5" />} title="4. Criando grupos">
            <p>
              Grupos são ótimos para família, trabalho, turma da faculdade ou amigos do futebol.
            </p>
            <ol className="list-decimal pl-5 mt-2 space-y-1">
              <li>Toque em <strong>Novo grupo</strong>.</li>
              <li>Escolha um nome e uma foto.</li>
              <li>Selecione os participantes (busque por @ ou nome).</li>
              <li>Pronto! Todos recebem a conversa imediatamente.</li>
            </ol>
            <p className="mt-2">
              Como administrador você pode <strong>adicionar/remover membros</strong>, mudar nome,
              foto e configurações nas opções do grupo.
            </p>
          </Step>

          <Step
            id="chamadas"
            icon={<Phone className="size-5" />}
            title="5. Chamadas de áudio e vídeo"
          >
            <p>
              Dentro de qualquer conversa, toque no ícone de <Phone className="size-3.5 inline" />{" "}
              <strong>telefone</strong> para chamada de áudio ou no ícone de{" "}
              <Video className="size-3.5 inline" /> <strong>câmera</strong> para chamada de vídeo.
            </p>
            <ul className="list-disc pl-5 mt-2 space-y-1">
              <li>O celular toca mesmo com o app fechado.</li>
              <li>Durante a chamada: mudo, viva-voz, trocar câmera e encerrar.</li>
              <li>Funciona em Wi-Fi e em 4G/5G.</li>
            </ul>
            <Tip>
              Na primeira chamada o navegador/sistema pede permissão de microfone e câmera —
              autorize para tudo funcionar.
            </Tip>
          </Step>

          <Step id="status" icon={<Sparkles className="size-5" />} title="6. Status que somem em 24h">
            <p>
              Status é como um “momento do dia” que aparece para seus contatos por{" "}
              <strong>24 horas</strong> e depois desaparece.
            </p>
            <ol className="list-decimal pl-5 mt-2 space-y-1">
              <li>Na tela principal, toque em <strong>Adicionar status</strong>.</li>
              <li>Escolha foto, vídeo ou texto com fundo colorido.</li>
              <li>Publique. Pronto, está no ar.</li>
            </ol>
            <p className="mt-2">
              Você vê quem visualizou seu status na própria tela de status.
            </p>
          </Step>

          <Step
            id="impulsionar"
            icon={<TrendingUp className="size-5" />}
            title="7. Impulsionar seu status"
          >
            <p>
              Quer que <strong>mais gente além dos seus contatos</strong> veja seu status? Use o
              <strong> impulsionamento</strong>.
            </p>
            <ol className="list-decimal pl-5 mt-2 space-y-1">
              <li>Publique seu status normalmente.</li>
              <li>Toque em <strong>Impulsionar</strong> nas opções do status.</li>
              <li>Escolha o tamanho do impulso (alcance maior = mais visualizações).</li>
              <li>Pague via Pix de forma segura e o impulso começa em segundos.</li>
            </ol>
            <p className="mt-2">
              Ideal para divulgar negócio, evento, vaga, venda ou conteúdo pessoal. Você acompanha o
              desempenho em <strong>Histórico de impulsos</strong> no seu perfil.
            </p>
          </Step>

          <Step id="ia" icon={<Bot className="size-5" />} title="8. Assistente de IA dentro do chat">
            <p>
              Dentro de qualquer conversa, toque no ícone da <strong>IA</strong> ✨ para que ela te
              ajude em tempo real:
            </p>
            <ul className="list-disc pl-5 mt-2 space-y-1">
              <li><strong>Traduzir</strong> uma mensagem em qualquer idioma.</li>
              <li><strong>Sugerir resposta</strong> quando bater o branco.</li>
              <li><strong>Melhorar o texto</strong> que você escreveu (formal, amigável, curto, divertido).</li>
              <li><strong>Resumir</strong> uma conversa longa em poucos pontos.</li>
            </ul>
            <Tip>A IA não envia nada sozinha — você revisa antes e decide se manda.</Tip>
          </Step>

          <Step id="pix" icon={<Banknote className="size-5" />} title="9. Enviar e cobrar Pix no chat">
            <p>
              Dentro de uma conversa, toque em <strong>Enviar Pix</strong>. Informe o valor, escolha
              seu banco e finalize pelo seu app bancário — tudo de forma{" "}
              <strong>semi-automática e segura</strong>.
            </p>
            <ul className="list-disc pl-5 mt-2 space-y-1">
              <li>Bom para dividir conta, pagar amigo, receber por venda rápida.</li>
              <li>O comprovante fica salvo na conversa.</li>
              <li>O WaveChat <strong>nunca</strong> guarda sua senha bancária.</li>
            </ul>
          </Step>

          <Step id="notificacoes" icon={<Bell className="size-5" />} title="10. Notificações">
            <p>
              Para não perder mensagens e chamadas, autorize as notificações na primeira vez que o
              app pedir. Você pode ajustar tudo em <strong>Perfil → Notificações</strong>:
            </p>
            <ul className="list-disc pl-5 mt-2 space-y-1">
              <li>Som de mensagem e som de chamada (toque personalizado).</li>
              <li>Vibração, badge no ícone e silenciar conversa específica.</li>
            </ul>
          </Step>

          <Step id="instalar" icon={<Smartphone className="size-5" />} title="11. Instalar como aplicativo">
            <p>
              O WaveChat funciona como app de verdade, com ícone na tela inicial:
            </p>
            <ul className="list-disc pl-5 mt-2 space-y-1">
              <li>
                <strong>Android (Chrome):</strong> toque em “Instalar aplicativo” quando aparecer o
                aviso, ou no menu ⋮ → <em>Instalar app</em>.
              </li>
              <li>
                <strong>iPhone (Safari):</strong> toque em compartilhar →{" "}
                <em>Adicionar à Tela de Início</em>.
              </li>
            </ul>
          </Step>

          <Step
            id="privacidade"
            icon={<ShieldCheck className="size-5" />}
            title="12. Privacidade e segurança"
          >
            <p>
              Suas conversas são protegidas e nunca vendemos seus dados. Você pode excluir sua conta
              quando quiser em <strong>Perfil → Conta</strong>. Leia mais na{" "}
              <Link to="/privacy" className="text-primary underline">
                Política de Privacidade
              </Link>{" "}
              e nos{" "}
              <Link to="/terms" className="text-primary underline">
                Termos de Uso
              </Link>
              .
            </p>
          </Step>
        </div>

        <section className="mt-14 rounded-2xl border border-border bg-gradient-to-br from-primary/15 to-accent/10 p-6 text-center">
          <HelpCircle className="size-6 mx-auto text-primary" />
          <h2 className="mt-2 text-xl font-semibold">Ainda com dúvida?</h2>
          <p className="text-sm text-muted-foreground mt-1">
            Nossa equipe responde rapidinho.
          </p>
          <div className="mt-4 flex justify-center gap-3">
            <Link
              to="/support"
              className="px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:opacity-90 transition"
            >
              Ir para o Suporte
            </Link>
            <Link
              to="/contact"
              className="px-4 py-2 rounded-lg border border-border text-sm font-medium hover:bg-accent/30 transition"
            >
              Falar conosco
            </Link>
          </div>
        </section>
      </article>
    </PublicLayout>
  );
}

function Step({
  id,
  icon,
  title,
  children,
}: {
  id: string;
  icon: ReactNode;
  title: string;
  children: ReactNode;
}) {
  return (
    <section id={id} className="scroll-mt-20">
      <div className="flex items-center gap-3">
        <div className="size-10 rounded-xl bg-primary/15 text-primary grid place-items-center">
          {icon}
        </div>
        <h2 className="text-xl sm:text-2xl font-semibold tracking-tight">{title}</h2>
      </div>
      <div className="mt-3 pl-1">{children}</div>
    </section>
  );
}

function Tip({ icon, children }: { icon?: ReactNode; children: ReactNode }) {
  return (
    <div className="mt-3 flex gap-2 items-start rounded-lg border border-primary/30 bg-primary/5 p-3 text-sm">
      <span className="text-primary mt-0.5">{icon ?? <Sparkles className="size-4" />}</span>
      <span>{children}</span>
    </div>
  );
}
