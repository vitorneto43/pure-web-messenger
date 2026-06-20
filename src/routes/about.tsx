import "@/i18n";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
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

function AboutPage() {
  const { t } = useTranslation();
  const features = [
    { icon: MessageCircle, title: t("about.f.messages.title"), desc: t("about.f.messages.desc") },
    { icon: PhoneCall, title: t("about.f.calls.title"), desc: t("about.f.calls.desc") },
    { icon: Sparkles, title: t("about.f.status.title"), desc: t("about.f.status.desc") },
    { icon: LinkIcon, title: t("about.f.links.title"), desc: t("about.f.links.desc") },
    { icon: Download, title: t("about.f.download.title"), desc: t("about.f.download.desc") },
    { icon: Banknote, title: t("about.f.pix.title"), desc: t("about.f.pix.desc") },
    { icon: TrendingUp, title: t("about.f.boost.title"), desc: t("about.f.boost.desc") },
  ];
  return (
    <PublicLayout>
      <section className="max-w-5xl mx-auto px-4 pt-14 pb-10 text-center">
        <span className="inline-block text-xs font-semibold tracking-widest uppercase text-primary">
          {t("about.kicker")}
        </span>
        <h1 className="mt-3 text-4xl sm:text-5xl font-bold tracking-tight">
          {t("about.title")}
        </h1>
        <p className="mt-4 text-muted-foreground max-w-2xl mx-auto text-lg">
          {t("about.subtitle")}
        </p>
        <div className="mt-6 flex justify-center gap-3">
          <Button asChild size="lg">
            <Link to="/auth" search={{ mode: "signup" }}>{t("about.ctaSignup")}</Link>
          </Button>
          <Button asChild size="lg" variant="outline">
            <Link to="/contact">{t("about.ctaContact")}</Link>
          </Button>
        </div>
      </section>

      <section className="max-w-5xl mx-auto px-4 py-10">
        <h2 className="text-2xl font-bold tracking-tight text-center">{t("about.featuresTitle")}</h2>
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
            {t("about.install.title")}
          </h2>
          <p className="text-center text-muted-foreground mt-2 max-w-xl mx-auto">
            {t("about.install.subtitle")}
          </p>

          <div className="mt-8 grid gap-6 md:grid-cols-2">
            <InstallCard
              icon={<Smartphone className="size-6" />}
              title={t("about.install.android")}
              steps={t("about.install.androidSteps").split("|")}
            />
            <InstallCard
              icon={<Apple className="size-6" />}
              title={t("about.install.ios")}
              steps={t("about.install.iosSteps").split("|")}
            />
          </div>
        </div>
      </section>

      <section className="max-w-3xl mx-auto px-4 py-10 text-center">
        <h2 className="text-2xl font-bold tracking-tight">{t("about.mission.title")}</h2>
        <p className="mt-3 text-muted-foreground">
          {t("about.mission.body")}
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
