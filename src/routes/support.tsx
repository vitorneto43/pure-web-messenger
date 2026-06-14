import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import "@/i18n";
import { useTranslation } from "react-i18next";
import { useServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { toast } from "sonner";
import { Mail, Phone, Loader2, Send } from "lucide-react";
import { PublicLayout } from "@/components/public/PublicLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { submitSupportTicket } from "@/lib/support.functions";

export const Route = createFileRoute("/support")({
  head: () => ({
    meta: [
      { title: "Support — WaveChat" },
      {
        name: "description",
        content:
          "Need help? Contact WaveChat support via form, email or phone.",
      },
      { property: "og:title", content: "Support — WaveChat" },
      { property: "og:description", content: "WaveChat support and assistance." },
      { property: "og:url", content: "https://webconnectchat.com/support" },
    ],
    links: [{ rel: "canonical", href: "https://webconnectchat.com/support" }],
  }),
  component: SupportPage,
});

function SupportPage() {
  const { t } = useTranslation();
  const [form, setForm] = useState({ name: "", email: "", message: "" });
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);
  const submit = useServerFn(submitSupportTicket);

  const schema = z.object({
    name: z.string().trim().min(2, t("support.form.errName")).max(100),
    email: z.string().trim().email(t("support.form.errEmail")).max(255),
    message: z.string().trim().min(10, t("support.form.errMsg")).max(2000),
  });

  function update(k: keyof typeof form, v: string) {
    setForm((f) => ({ ...f, [k]: v }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const parsed = schema.safeParse(form);
    if (!parsed.success) {
      toast.error(parsed.error.issues[0].message);
      return;
    }
    setBusy(true);
    try {
      // Primary path: public REST endpoint (works in WebView, no auth needed)
      const res = await fetch("/api/public/support", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(parsed.data),
      });
      if (!res.ok) {
        // Fallback to server function in case of edge issue
        await submit({ data: parsed.data });
      }
      setSent(true);
      setForm({ name: "", email: "", message: "" });
      toast.success("Mensagem enviada! Nossa equipe vai responder em breve.");
    } catch (err: any) {
      console.error("[support] submit failed", err);
      try {
        await submit({ data: parsed.data });
        setSent(true);
        setForm({ name: "", email: "", message: "" });
        toast.success("Mensagem enviada! Nossa equipe vai responder em breve.");
      } catch (err2: any) {
        toast.error(err2?.message || err?.message || "Erro ao enviar. Tente novamente.");
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <PublicLayout>
      <div className="max-w-5xl mx-auto px-4 py-12">
        <div className="text-center max-w-2xl mx-auto">
          <h1 className="text-4xl sm:text-5xl font-bold tracking-tight">{t("support.title")}</h1>
          <p className="mt-3 text-muted-foreground">{t("support.subtitle")}</p>
        </div>

        <div className="mt-10 grid gap-6 md:grid-cols-[1.2fr_1fr]">
          <form
            onSubmit={handleSubmit}
            className="rounded-2xl border border-border bg-card/60 p-6 sm:p-8 shadow-xl space-y-4"
          >
            {sent && (
              <div className="rounded-lg border border-green-500/30 bg-green-500/10 p-3 text-sm text-green-700 dark:text-green-300">
                Recebemos sua mensagem. Vamos responder no e-mail informado.
              </div>
            )}
            <div className="space-y-1.5">
              <Label htmlFor="name">{t("support.form.name")}</Label>
              <Input
                id="name"
                value={form.name}
                onChange={(e) => update("name", e.target.value)}
                placeholder={t("support.form.namePh")}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="email">{t("support.form.email")}</Label>
              <Input
                id="email"
                type="email"
                value={form.email}
                onChange={(e) => update("email", e.target.value)}
                placeholder={t("support.form.emailPh")}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="message">{t("support.form.message")}</Label>
              <Textarea
                id="message"
                rows={6}
                value={form.message}
                onChange={(e) => update("message", e.target.value)}
                placeholder={t("support.form.messagePh")}
              />
            </div>
            <Button type="submit" className="w-full" disabled={busy}>
              {busy ? (
                <Loader2 className="size-4 animate-spin mr-2" />
              ) : (
                <Send className="size-4 mr-2" />
              )}
              {t("support.form.submit")}
            </Button>
          </form>

          <aside className="space-y-4">
            <ContactCard
              icon={<Mail className="size-5" />}
              title={t("support.card.email")}
              value="veiganeto46@gmail.com"
              href="mailto:veiganeto46@gmail.com"
            />
            <ContactCard
              icon={<Phone className="size-5" />}
              title={t("support.card.phone")}
              value="(81) 92001-3218"
              href="tel:+5581920013218"
            />
            <div className="rounded-2xl border border-border bg-card/60 p-5">
              <h3 className="font-semibold">{t("support.before.title")}</h3>
              <ul className="mt-2 text-sm text-muted-foreground space-y-1 list-disc pl-5">
                <li>{t("support.before.li1")}</li>
                <li>{t("support.before.li2")}</li>
                <li>{t("support.before.li3")}</li>
              </ul>
            </div>
          </aside>
        </div>
      </div>
    </PublicLayout>
  );
}

function ContactCard({
  icon,
  title,
  value,
  href,
}: {
  icon: React.ReactNode;
  title: string;
  value: string;
  href: string;
}) {
  return (
    <a
      href={href}
      className="block rounded-2xl border border-border bg-card/60 p-5 hover:bg-card transition"
    >
      <div className="flex items-center gap-3">
        <div className="size-10 rounded-xl bg-primary/15 text-primary grid place-items-center">
          {icon}
        </div>
        <div>
          <div className="text-xs text-muted-foreground uppercase tracking-wider">{title}</div>
          <div className="font-medium">{value}</div>
        </div>
      </div>
    </a>
  );
}
