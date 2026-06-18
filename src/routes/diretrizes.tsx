import { createFileRoute, Link } from "@tanstack/react-router";
import "@/i18n";
import { Trans, useTranslation } from "react-i18next";
import { PublicLayout } from "@/components/public/PublicLayout";
import { CheckCircle2, XCircle, Shield, AlertTriangle, Flag, FileText, Camera, Radio, Rocket } from "lucide-react";
import i18n from "@/i18n";

export const Route = createFileRoute("/diretrizes")({
  component: GuidelinesPage,
  head: () => {
    const t = i18n.getFixedT(i18n.language || "en");
    return {
      meta: [
        { title: t("guidelines.metaTitle") },
        { name: "description", content: t("guidelines.metaDesc") },
      ],
    };
  },
});

const ALLOWED_KEYS = [
  "guidelines.allowed.1",
  "guidelines.allowed.2",
  "guidelines.allowed.3",
  "guidelines.allowed.4",
  "guidelines.allowed.5",
  "guidelines.allowed.6",
] as const;

const FORBIDDEN_KEYS = [
  "guidelines.forbidden.1",
  "guidelines.forbidden.2",
  "guidelines.forbidden.3",
  "guidelines.forbidden.4",
  "guidelines.forbidden.5",
  "guidelines.forbidden.6",
  "guidelines.forbidden.7",
  "guidelines.forbidden.8",
  "guidelines.forbidden.9",
] as const;

function GuidelinesPage() {
  const { t } = useTranslation();
  return (
    <PublicLayout>
      <article className="max-w-3xl mx-auto px-4 py-12">
        <div className="flex items-center gap-3 mb-3">
          <div className="size-10 rounded-xl bg-primary/15 text-primary grid place-items-center">
            <Shield className="size-5" />
          </div>
          <h1 className="text-4xl font-bold tracking-tight">{t("guidelines.title")}</h1>
        </div>
        <p className="text-muted-foreground text-lg">{t("guidelines.subtitle")}</p>

        <section className="mt-10">
          <h2 className="text-2xl font-semibold mb-3 flex items-center gap-2 text-emerald-500">
            <CheckCircle2 className="size-5" /> {t("guidelines.allowedTitle")}
          </h2>
          <ul className="space-y-2">
            {ALLOWED_KEYS.map((k) => (
              <li key={k} className="flex gap-3 items-start">
                <CheckCircle2 className="size-4 mt-1 text-emerald-500 shrink-0" />
                <span>{t(k)}</span>
              </li>
            ))}
          </ul>
        </section>

        <section className="mt-10">
          <h2 className="text-2xl font-semibold mb-3 flex items-center gap-2 text-destructive">
            <XCircle className="size-5" /> {t("guidelines.forbiddenTitle")}
          </h2>
          <ul className="space-y-2">
            {FORBIDDEN_KEYS.map((k) => (
              <li key={k} className="flex gap-3 items-start">
                <XCircle className="size-4 mt-1 text-destructive shrink-0" />
                <span>{t(k)}</span>
              </li>
            ))}
          </ul>
        </section>

        <FormatSection
          id="posts"
          icon={<FileText className="size-5" />}
          color="text-sky-500"
          title="Posts"
          intro="Suas publicações do feed. Pense em algo público — qualquer pessoa pode ver, reagir e denunciar."
          allowed={[
            "Opiniões, divulgação pessoal, anúncios de trabalho legítimos.",
            "Conteúdo informativo, humor, fotos suas e da sua rotina.",
            "Links para sites próprios, lojas, portfólios.",
          ]}
          forbidden={[
            "Spam, repetição em massa, correntes ou bots.",
            "Pirataria: IPTV, listas M3U, filmes/séries piratas, transmissão de jogos.",
            "Golpes financeiros: 'lucro garantido', 'robô da Blaze', esquemas.",
            "Phishing: pedir senha do banco, código de SMS, dados de cartão.",
            "Conteúdo envolvendo menores ou sexualizado sem rótulo +18.",
            "Apologia a violência, drogas ilegais ou venda de armas.",
          ]}
        />

        <FormatSection
          id="stories"
          icon={<Camera className="size-5" />}
          color="text-pink-500"
          title="Stories"
          intro="Conteúdo efêmero (24h). Mesmas regras dos Posts, com atenção redobrada por aparecer no topo do feed."
          allowed={[
            "Momentos do dia, fotos, vídeos curtos, música.",
            "Promoções da sua loja/negócio com link CTA.",
            "Conteúdo sensível (+18 leve) desde que claramente rotulado.",
          ]}
          forbidden={[
            "Nudez explícita, pornografia, gore.",
            "Automutilação, incentivo ao suicídio.",
            "Apologia a uso de drogas ou venda de medicamentos controlados.",
            "Mesmas proibições dos Posts (pirataria, golpes, phishing, menores).",
          ]}
        />

        <FormatSection
          id="lives"
          icon={<Radio className="size-5" />}
          color="text-red-500"
          title="Lives"
          intro="Transmissões ao vivo. Você é responsável por tudo que aparecer na tela e no chat enquanto estiver transmitindo."
          allowed={[
            "Conversa, música autoral, gameplay próprio, eventos.",
            "Vendas legítimas, lives institucionais, aulas, workshops.",
            "Receber doações (PIX/presentes) seguindo as regras de pagamento.",
          ]}
          forbidden={[
            "Transmissão de TV, futebol, filmes, séries — direitos autorais.",
            "Conteúdo adulto/pornográfico (use plataformas próprias).",
            "Jogos de azar, cassinos, apostas esportivas, 'tigrinho'.",
            "Venda de medicamentos controlados, armas, drogas.",
            "Moderação obrigatória: use mute/kick/ban contra spam e ofensas no chat.",
            "Mesmas proibições dos Posts (golpes, phishing, menores, violência).",
          ]}
        />

        <FormatSection
          id="impulsionamentos"
          icon={<Rocket className="size-5" />}
          color="text-amber-500"
          title="Impulsionamentos"
          intro="Quando você paga para alcançar mais pessoas, sua publicação passa por uma análise automática (regras + IA) em segundos antes do pagamento ser cobrado."
          allowed={[
            "Divulgação de produtos, serviços, marca pessoal, eventos.",
            "Lives, Stories e Posts dentro das regras acima.",
            "Segmentação por idade, sexo, país, estado e interesses.",
          ]}
          forbidden={[
            "Tudo que é proibido em Posts/Stories/Lives.",
            "Jogos de azar e apostas (regras do Google Ads).",
            "Conteúdo adulto (+18) em qualquer formato.",
            "Pirataria, IPTV ou qualquer infração de direitos autorais — causa de banimento imediato e bloqueio do Google Ads na plataforma.",
          ]}
          footer="Se reprovado, o pagamento não é cobrado e você recebe o motivo. Pode editar o conteúdo e tentar de novo."
        />

          <h2 className="text-xl font-semibold mb-3 flex items-center gap-2">
            <AlertTriangle className="size-5 text-amber-500" /> {t("guidelines.penaltiesTitle")}
          </h2>
          <p className="text-sm text-muted-foreground mb-4">{t("guidelines.penaltiesIntro")}</p>
          <div className="grid gap-3 sm:grid-cols-3 text-sm">
            <div className="rounded-lg border border-border p-3">
              <p className="font-semibold text-emerald-500">{t("guidelines.penalty.light")}</p>
              <p className="text-muted-foreground mt-1">{t("guidelines.penalty.lightDesc")}</p>
            </div>
            <div className="rounded-lg border border-border p-3">
              <p className="font-semibold text-amber-500">{t("guidelines.penalty.grave")}</p>
              <p className="text-muted-foreground mt-1">{t("guidelines.penalty.graveDesc")}</p>
            </div>
            <div className="rounded-lg border border-border p-3">
              <p className="font-semibold text-destructive">{t("guidelines.penalty.severe")}</p>
              <p className="text-muted-foreground mt-1">{t("guidelines.penalty.severeDesc")}</p>
            </div>
          </div>
        </section>

        <section className="mt-10">
          <h2 className="text-2xl font-semibold mb-3 flex items-center gap-2">
            <Flag className="size-5 text-primary" /> {t("guidelines.howReportTitle")}
          </h2>
          <p>
            <Trans
              i18nKey="guidelines.howReportBody"
              values={{
                report: t("guidelines.reportWord"),
                block: t("guidelines.blockWord"),
              }}
              components={{ 1: <strong />, 2: <strong /> }}
            />
          </p>
        </section>

        <section className="mt-10 text-sm text-muted-foreground">
          <p>
            <Trans
              i18nKey="guidelines.footer"
              values={{ terms: t("guidelines.terms"), privacy: t("guidelines.privacy") }}
            />{" "}
            <Link to="/terms" className="underline">
              {t("guidelines.terms")}
            </Link>{" "}
            ·{" "}
            <Link to="/privacy" className="underline">
              {t("guidelines.privacy")}
            </Link>
          </p>
        </section>
      </article>
    </PublicLayout>
  );
}

function FormatSection({
  id,
  icon,
  color,
  title,
  intro,
  allowed,
  forbidden,
  footer,
}: {
  id: string;
  icon: React.ReactNode;
  color: string;
  title: string;
  intro: string;
  allowed: string[];
  forbidden: string[];
  footer?: string;
}) {
  return (
    <section id={id} className="mt-10 scroll-mt-20 rounded-2xl border border-border bg-card/40 p-5">
      <div className={`flex items-center gap-2 mb-2 ${color}`}>
        <span className="size-9 rounded-lg bg-current/15 grid place-items-center">{icon}</span>
        <h2 className="text-2xl font-semibold text-foreground">Regras para {title}</h2>
      </div>
      <p className="text-sm text-muted-foreground mb-4">{intro}</p>
      <div className="grid sm:grid-cols-2 gap-4">
        <div>
          <p className="text-xs font-semibold text-emerald-500 mb-2 flex items-center gap-1">
            <CheckCircle2 className="size-4" /> Permitido
          </p>
          <ul className="space-y-1.5 text-sm">
            {allowed.map((a) => (
              <li key={a} className="flex gap-2 items-start">
                <CheckCircle2 className="size-3.5 mt-1 text-emerald-500 shrink-0" />
                <span>{a}</span>
              </li>
            ))}
          </ul>
        </div>
        <div>
          <p className="text-xs font-semibold text-destructive mb-2 flex items-center gap-1">
            <XCircle className="size-4" /> Proibido
          </p>
          <ul className="space-y-1.5 text-sm">
            {forbidden.map((f) => (
              <li key={f} className="flex gap-2 items-start">
                <XCircle className="size-3.5 mt-1 text-destructive shrink-0" />
                <span>{f}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>
      {footer && (
        <p className="mt-4 text-xs text-muted-foreground border-t border-border pt-3">
          {footer}
        </p>
      )}
    </section>
  );
}
