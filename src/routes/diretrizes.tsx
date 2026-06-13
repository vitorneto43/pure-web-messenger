import { createFileRoute, Link } from "@tanstack/react-router";
import "@/i18n";
import { Trans, useTranslation } from "react-i18next";
import { PublicLayout } from "@/components/public/PublicLayout";
import { CheckCircle2, XCircle, Shield, AlertTriangle, Flag } from "lucide-react";
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

        <section className="mt-10 rounded-xl border border-border bg-card p-5">
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
