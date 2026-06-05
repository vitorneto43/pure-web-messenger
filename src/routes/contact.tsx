import "@/i18n";
import { createFileRoute } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { Mail, Phone } from "lucide-react";
import { PublicLayout } from "@/components/public/PublicLayout";
import { Button } from "@/components/ui/button";
import wavechatLogo from "@/assets/wavechat-logo.png.asset.json";

export const Route = createFileRoute("/contact")({
  head: () => ({
    meta: [
      { title: "Contato — WaveChat" },
      {
        name: "description",
        content: "Fale com a equipe do WaveChat por e-mail, telefone ou WhatsApp.",
      },
      { property: "og:title", content: "Contato — WaveChat" },
      { property: "og:description", content: "Canais oficiais de contato do WaveChat." },
      { property: "og:url", content: "https://webconnectchat.com/contact" },
    ],
    links: [{ rel: "canonical", href: "https://webconnectchat.com/contact" }],
  }),
  component: ContactPage,
});

function ContactPage() {
  const { t } = useTranslation();
  return (
    <PublicLayout>
      <div className="max-w-4xl mx-auto px-4 py-16">
        <div className="text-center">
          <h1 className="text-4xl sm:text-5xl font-bold tracking-tight">{t("contact.title")}</h1>
          <p className="mt-3 text-muted-foreground max-w-xl mx-auto">
            {t("contact.subtitle")}
          </p>
        </div>

        <div className="mt-10 grid gap-6 sm:grid-cols-2">
          <Card
            icon={<Mail className="size-6" />}
            title={t("contact.email.title")}
            description={t("contact.email.desc")}
            value="veiganeto46@gmail.com"
            href="mailto:veiganeto46@gmail.com"
            cta={t("contact.email.cta")}
          />
          <Card
            icon={<Phone className="size-6" />}
            title={t("contact.phone.title")}
            description={t("contact.phone.desc")}
            value="(81) 92001-3218"
            href="tel:+5581920013218"
            cta={t("contact.phone.cta")}
          />
        </div>

        <div className="mt-8 rounded-2xl border border-border bg-gradient-to-br from-primary/15 to-accent/10 p-6 sm:p-8 flex flex-col sm:flex-row items-center gap-6">
          <img src={wavechatLogo.url} alt="WaveChat" className="size-14 rounded-2xl shadow-lg object-cover" />
          <div className="flex-1 text-center sm:text-left">
            <h3 className="text-xl font-semibold">{t("contact.whatsapp.title")}</h3>
            <p className="text-sm text-muted-foreground mt-1">
              {t("contact.whatsapp.desc")}
            </p>
          </div>
          <Button asChild size="lg">
            <a
              href="https://wa.me/5581920013218"
              target="_blank"
              rel="noopener noreferrer"
            >
              {t("contact.whatsapp.cta")}
            </a>
          </Button>
        </div>
      </div>
    </PublicLayout>
  );
}

function Card({
  icon,
  title,
  description,
  value,
  href,
  cta,
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
  value: string;
  href: string;
  cta: string;
}) {
  return (
    <div className="rounded-2xl border border-border bg-card/60 p-6 shadow-md flex flex-col">
      <div className="size-12 rounded-xl bg-primary/15 text-primary grid place-items-center">
        {icon}
      </div>
      <h3 className="mt-4 text-lg font-semibold">{title}</h3>
      <p className="text-sm text-muted-foreground">{description}</p>
      <div className="mt-3 font-medium">{value}</div>
      <Button asChild className="mt-5 w-full">
        <a href={href}>{cta}</a>
      </Button>
    </div>
  );
}
