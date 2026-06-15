import { createFileRoute, Link } from "@tanstack/react-router";
import "@/i18n";
import { useTranslation } from "react-i18next";
import { PublicLayout } from "@/components/public/PublicLayout";
import {
  UserPlus,
  LogIn,
  MessageCircle,
  Users,
  Phone,
  Video,
  Sparkles,
  TrendingUp,
  Banknote,
  Bot,
  Bell,
  Share2,
  Download,
  Smartphone,
  ShieldCheck,
  HelpCircle,
  Lock,
  EyeOff,
  AlertTriangle,
  KeyRound,
  UserX,
  Flag,
  Fingerprint,
  WifiOff,
  Zap,
} from "lucide-react";
import type { ReactNode } from "react";

export const Route = createFileRoute("/guide")({
  head: () => ({
    meta: [
      { title: "How WaveChat works — Quick & friendly guide" },
      {
        name: "description",
        content:
          "Learn step by step how to use WaveChat: create an account, invite friends, chat, create groups, make audio/video calls, post status, boost status, use AI and send payments.",
      },
      { property: "og:title", content: "How WaveChat works" },
      {
        property: "og:description",
        content:
          "Complete and intuitive WaveChat guide: login, chats, groups, calls, status, boost, AI and payments.",
      },
      { property: "og:url", content: "https://webconnectchat.com/guide" },
    ],
    links: [{ rel: "canonical", href: "https://webconnectchat.com/guide" }],
  }),
  component: GuidePage,
});

function GuidePage() {
  const { t } = useTranslation();
  const toc: Array<[string, string]> = [
    [t("guide.toc.1"), "s1"],
    [t("guide.toc.2"), "s2"],
    [t("guide.toc.3"), "s3"],
    [t("guide.toc.4"), "s4"],
    [t("guide.toc.5"), "s5"],
    [t("guide.toc.6"), "s6"],
    [t("guide.toc.7"), "s7"],
    [t("guide.toc.8"), "s8"],
    [t("guide.toc.9"), "s9"],
    [t("guide.toc.10"), "s10"],
    [t("guide.toc.11"), "s11"],
    [t("guide.toc.12"), "s12"],
  ];

  return (
    <PublicLayout>
      <article className="max-w-3xl mx-auto px-4 py-12">
        <header className="text-center">
          <span className="inline-block text-xs font-semibold tracking-widest uppercase text-primary">
            {t("guide.kicker")}
          </span>
          <h1 className="mt-3 text-4xl sm:text-5xl font-bold tracking-tight">
            {t("guide.title")}
          </h1>
          <p className="mt-4 text-muted-foreground text-lg max-w-2xl mx-auto">
            {t("guide.subtitle")}
          </p>
        </header>

        <nav className="mt-10 grid sm:grid-cols-2 gap-2 text-sm">
          {toc.map(([label, id]) => (
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
          <Step id="s1" icon={<UserPlus className="size-5" />} title={t("guide.s1.title")}>
            <p>{t("guide.s1.body")}</p>
            <ul className="list-disc pl-5 mt-2 space-y-1">
              <li>{t("guide.s1.li1")}</li>
              <li>{t("guide.s1.li2")}</li>
              <li>{t("guide.s1.li3")}</li>
            </ul>
            <Tip icon={<LogIn className="size-4" />}>{t("guide.s1.tip")}</Tip>
          </Step>

          <Step id="s2" icon={<Share2 className="size-5" />} title={t("guide.s2.title")}>
            <p>{t("guide.s2.body")}</p>
            <ol className="list-decimal pl-5 mt-2 space-y-2">
              <li>{t("guide.s2.li1")}</li>
              <li>{t("guide.s2.li2")}</li>
              <li>{t("guide.s2.li3")}</li>
            </ol>
            <Tip>{t("guide.s2.tip")}</Tip>
          </Step>

          <Step id="s3" icon={<MessageCircle className="size-5" />} title={t("guide.s3.title")}>
            <p>{t("guide.s3.body")}</p>
            <ul className="list-disc pl-5 mt-2 space-y-1">
              <li>{t("guide.s3.li1")}</li>
              <li>{t("guide.s3.li2")}</li>
              <li>{t("guide.s3.li3")}</li>
              <li>{t("guide.s3.li4")}</li>
            </ul>
            <p className="mt-2 inline-flex items-center gap-1">
              <Download className="size-3.5 inline" /> {t("guide.s3.foot")}
            </p>
          </Step>

          <Step id="s4" icon={<Users className="size-5" />} title={t("guide.s4.title")}>
            <p>{t("guide.s4.body")}</p>
            <ol className="list-decimal pl-5 mt-2 space-y-1">
              <li>{t("guide.s4.li1")}</li>
              <li>{t("guide.s4.li2")}</li>
              <li>{t("guide.s4.li3")}</li>
              <li>{t("guide.s4.li4")}</li>
            </ol>
            <p className="mt-2">{t("guide.s4.foot")}</p>
          </Step>

          <Step id="s5" icon={<Phone className="size-5" />} title={t("guide.s5.title")}>
            <p className="inline-flex items-center gap-1">
              <Phone className="size-3.5 inline" /> <Video className="size-3.5 inline" />{" "}
              {t("guide.s5.body")}
            </p>
            <ul className="list-disc pl-5 mt-2 space-y-1">
              <li>{t("guide.s5.li1")}</li>
              <li>{t("guide.s5.li2")}</li>
              <li>{t("guide.s5.li3")}</li>
            </ul>
            <Tip>{t("guide.s5.tip")}</Tip>
          </Step>

          <Step id="s6" icon={<Sparkles className="size-5" />} title={t("guide.s6.title")}>
            <p>{t("guide.s6.body")}</p>
            <ol className="list-decimal pl-5 mt-2 space-y-1">
              <li>{t("guide.s6.li1")}</li>
              <li>{t("guide.s6.li2")}</li>
              <li>{t("guide.s6.li3")}</li>
            </ol>
            <p className="mt-2">{t("guide.s6.foot")}</p>
          </Step>

          <Step id="s7" icon={<TrendingUp className="size-5" />} title={t("guide.s7.title")}>
            <p>{t("guide.s7.body")}</p>
            <ol className="list-decimal pl-5 mt-2 space-y-1">
              <li>{t("guide.s7.li1")}</li>
              <li>{t("guide.s7.li2")}</li>
              <li>{t("guide.s7.li3")}</li>
              <li>{t("guide.s7.li4")}</li>
            </ol>
            <p className="mt-2">{t("guide.s7.foot")}</p>
          </Step>

          <Step id="s8" icon={<Bot className="size-5" />} title={t("guide.s8.title")}>
            <p>{t("guide.s8.body")}</p>
            <ul className="list-disc pl-5 mt-2 space-y-1">
              <li>{t("guide.s8.li1")}</li>
              <li>{t("guide.s8.li2")}</li>
              <li>{t("guide.s8.li3")}</li>
              <li>{t("guide.s8.li4")}</li>
            </ul>
            <Tip>{t("guide.s8.tip")}</Tip>
          </Step>

          <Step id="s9" icon={<Banknote className="size-5" />} title={t("guide.s9.title")}>
            <p>{t("guide.s9.body")}</p>
            <ul className="list-disc pl-5 mt-2 space-y-1">
              <li>{t("guide.s9.li1")}</li>
              <li>{t("guide.s9.li2")}</li>
              <li>{t("guide.s9.li3")}</li>
            </ul>
          </Step>

          <Step id="s10" icon={<Bell className="size-5" />} title={t("guide.s10.title")}>
            <p>{t("guide.s10.body")}</p>
            <ul className="list-disc pl-5 mt-2 space-y-1">
              <li>{t("guide.s10.li1")}</li>
              <li>{t("guide.s10.li2")}</li>
            </ul>
          </Step>

          <Step id="s11" icon={<Smartphone className="size-5" />} title={t("guide.s11.title")}>
            <p>{t("guide.s11.body")}</p>
            <ul className="list-disc pl-5 mt-2 space-y-1">
              <li>{t("guide.s11.li1")}</li>
              <li>{t("guide.s11.li2")}</li>
            </ul>
          </Step>

          <Step id="s12" icon={<ShieldCheck className="size-5" />} title={t("guide.s12.title")}>
            <p>
              {t("guide.s12.body")}{" "}
              <Link to="/privacy" className="text-primary underline">
                {t("guide.s12.privacy")}
              </Link>
              {" · "}
              <Link to="/terms" className="text-primary underline">
                {t("guide.s12.terms")}
              </Link>
              .
            </p>
          </Step>
        </div>

        <section className="mt-14 rounded-2xl border border-border bg-gradient-to-br from-primary/15 to-accent/10 p-6 text-center">
          <HelpCircle className="size-6 mx-auto text-primary" />
          <h2 className="mt-2 text-xl font-semibold">{t("guide.help.title")}</h2>
          <p className="text-sm text-muted-foreground mt-1">{t("guide.help.body")}</p>
          <div className="mt-4 flex justify-center gap-3">
            <Link
              to="/support"
              className="px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:opacity-90 transition"
            >
              {t("guide.help.support")}
            </Link>
            <Link
              to="/contact"
              className="px-4 py-2 rounded-lg border border-border text-sm font-medium hover:bg-accent/30 transition"
            >
              {t("guide.help.contact")}
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
