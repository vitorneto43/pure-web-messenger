import { createFileRoute, Link } from "@tanstack/react-router";
import {
  MessageCircle,
  PhoneCall,
  Sparkles,
  Link as LinkIcon,
  Download,
  Banknote,
  TrendingUp,
  Smartphone,
  Apple,
} from "lucide-react";
import { PublicLayout } from "@/components/public/PublicLayout";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/about")({
  head: () => ({
    meta: [
      { title: "Sobre o WaveChat — chat, chamadas e Pix no navegador" },
      {
        name: "description",
        content:
          "WaveChat é um app de mensagens, chamadas, status e Pix que funciona direto no navegador e pode ser instalado como aplicativo (PWA).",
      },
      { property: "og:title", content: "Sobre o WaveChat" },
      {
        property: "og:description",
        content: "Conheça o WaveChat: mensagens, chamadas, status, Pix e impulsionamento.",
      },
      { property: "og:url", content: "https://webconnectchat.com/about" },
    ],
    links: [{ rel: "canonical", href: "https://webconnectchat.com/about" }],
  }),
  component: AboutPage,
});

const features = [
  { icon: MessageCircle, title: "Mensagens", desc: "Conversas individuais e em grupo, em tempo real." },
  { icon: PhoneCall, title: "Chamadas", desc: "Áudio e vídeo com toque mesmo com o app fechado." },
  { icon: Sparkles, title: "Status", desc: "Compartilhe momentos que somem em 24h." },
  { icon: LinkIcon, title: "Links clicáveis", desc: "Previews e links seguros direto no chat." },
  { icon: Download, title: "Download de mídia", desc: "Baixe fotos, vídeos e áudios das conversas." },
  { icon: Banknote, title: "Pix semi-automático", desc: "Envie e cobre Pix sem sair da conversa." },
  { icon: TrendingUp, title: "Impulsionamento de status", desc: "Aumente o alcance do seu status." },
];

function AboutPage() {
  return (
    <PublicLayout>
      <section className="max-w-5xl mx-auto px-4 pt-14 pb-10 text-center">
        <span className="inline-block text-xs font-semibold tracking-widest uppercase text-primary">
          Sobre nós
        </span>
        <h1 className="mt-3 text-4xl sm:text-5xl font-bold tracking-tight">
          O WaveChat é o seu app de conversas no navegador
        </h1>
        <p className="mt-4 text-muted-foreground max-w-2xl mx-auto text-lg">
          Mensagens, chamadas, status e Pix em um só lugar — sem precisar instalar nada da loja de
          aplicativos. Funciona em qualquer celular ou computador.
        </p>
        <div className="mt-6 flex justify-center gap-3">
          <Button asChild size="lg">
            <Link to="/auth">Criar conta grátis</Link>
          </Button>
          <Button asChild size="lg" variant="outline">
            <Link to="/contact">Falar com a gente</Link>
          </Button>
        </div>
      </section>

      <section className="max-w-5xl mx-auto px-4 py-10">
        <h2 className="text-2xl font-bold tracking-tight text-center">Tudo que você precisa</h2>
        <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {features.map((f) => (
            <div
              key={f.title}
              className="rounded-2xl border border-border bg-card/60 p-5 hover:bg-card transition"
            >
              <div className="size-11 rounded-xl bg-primary/15 text-primary grid place-items-center">
                <f.icon className="size-5" />
              </div>
              <h3 className="mt-4 font-semibold">{f.title}</h3>
              <p className="text-sm text-muted-foreground mt-1">{f.desc}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="max-w-5xl mx-auto px-4 py-10">
        <div className="rounded-3xl border border-border bg-gradient-to-br from-primary/15 to-accent/10 p-6 sm:p-10">
          <h2 className="text-2xl font-bold tracking-tight text-center">
            Instale o WaveChat como aplicativo
          </h2>
          <p className="text-center text-muted-foreground mt-2 max-w-xl mx-auto">
            Funciona como um app de verdade: ícone na tela inicial, notificações e tela cheia.
          </p>

          <div className="mt-8 grid gap-6 md:grid-cols-2">
            <InstallCard
              icon={<Smartphone className="size-6" />}
              title="No Android"
              steps={[
                "Abra o WaveChat no Chrome",
                "Toque em “Instalar aplicativo” quando aparecer o aviso",
                "Pronto! O ícone aparece na sua tela inicial",
              ]}
            />
            <InstallCard
              icon={<Apple className="size-6" />}
              title="No iPhone (iOS)"
              steps={[
                "Abra o WaveChat no Safari",
                "Toque no botão Compartilhar",
                "Selecione “Adicionar à Tela de Início”",
              ]}
            />
          </div>
        </div>
      </section>

      <section className="max-w-3xl mx-auto px-4 py-10 text-center">
        <h2 className="text-2xl font-bold tracking-tight">Nossa missão</h2>
        <p className="mt-3 text-muted-foreground">
          Tornar a comunicação digital mais simples, segura e acessível para todos os brasileiros —
          sem depender de lojas de aplicativos, sem SMS e com privacidade em primeiro lugar.
        </p>
      </section>
    </PublicLayout>
  );
}

function InstallCard({
  icon,
  title,
  steps,
}: {
  icon: React.ReactNode;
  title: string;
  steps: string[];
}) {
  return (
    <div className="rounded-2xl border border-border bg-card/70 p-6">
      <div className="flex items-center gap-3">
        <div className="size-11 rounded-xl bg-primary text-primary-foreground grid place-items-center">
          {icon}
        </div>
        <h3 className="text-lg font-semibold">{title}</h3>
      </div>
      <ol className="mt-4 space-y-2 text-sm">
        {steps.map((s, i) => (
          <li key={i} className="flex gap-3">
            <span className="size-6 rounded-full bg-primary/15 text-primary text-xs font-semibold grid place-items-center shrink-0">
              {i + 1}
            </span>
            <span className="text-foreground/90">{s}</span>
          </li>
        ))}
      </ol>
    </div>
  );
}
