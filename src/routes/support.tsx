import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { z } from "zod";
import { toast } from "sonner";
import { Mail, Phone, Loader2, Send } from "lucide-react";
import { PublicLayout } from "@/components/public/PublicLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

export const Route = createFileRoute("/support")({
  head: () => ({
    meta: [
      { title: "Suporte — WaveChat" },
      {
        name: "description",
        content:
          "Precisa de ajuda? Fale com o suporte do WaveChat por formulário, e-mail ou telefone.",
      },
      { property: "og:title", content: "Suporte — WaveChat" },
      { property: "og:description", content: "Atendimento e suporte do WaveChat." },
      { property: "og:url", content: "https://webconnectchat.com/support" },
    ],
    links: [{ rel: "canonical", href: "https://webconnectchat.com/support" }],
  }),
  component: SupportPage,
});

const schema = z.object({
  name: z.string().trim().min(2, "Informe seu nome").max(100),
  email: z.string().trim().email("E-mail inválido").max(255),
  message: z.string().trim().min(10, "Mensagem muito curta").max(2000),
});

function SupportPage() {
  const [form, setForm] = useState({ name: "", email: "", message: "" });
  const [busy, setBusy] = useState(false);

  function update(k: keyof typeof form, v: string) {
    setForm((f) => ({ ...f, [k]: v }));
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const parsed = schema.safeParse(form);
    if (!parsed.success) {
      toast.error(parsed.error.issues[0].message);
      return;
    }
    setBusy(true);
    const subject = `[Suporte WaveChat] ${parsed.data.name}`;
    const body = `Nome: ${parsed.data.name}\nE-mail: ${parsed.data.email}\n\n${parsed.data.message}`;
    const mailto = `mailto:veiganeto46@gmail.com?subject=${encodeURIComponent(
      subject,
    )}&body=${encodeURIComponent(body)}`;
    window.location.href = mailto;
    setTimeout(() => {
      setBusy(false);
      toast.success("Abrimos seu cliente de e-mail para concluir o envio.");
    }, 800);
  }

  return (
    <PublicLayout>
      <div className="max-w-5xl mx-auto px-4 py-12">
        <div className="text-center max-w-2xl mx-auto">
          <h1 className="text-4xl sm:text-5xl font-bold tracking-tight">Como podemos ajudar?</h1>
          <p className="mt-3 text-muted-foreground">
            Nossa equipe responde de segunda a sexta, das 9h às 18h.
          </p>
        </div>

        <div className="mt-10 grid gap-6 md:grid-cols-[1.2fr_1fr]">
          <form
            onSubmit={handleSubmit}
            className="rounded-2xl border border-border bg-card/60 p-6 sm:p-8 shadow-xl space-y-4"
          >
            <div className="space-y-1.5">
              <Label htmlFor="name">Nome</Label>
              <Input
                id="name"
                value={form.name}
                onChange={(e) => update("name", e.target.value)}
                placeholder="Seu nome"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="email">E-mail</Label>
              <Input
                id="email"
                type="email"
                value={form.email}
                onChange={(e) => update("email", e.target.value)}
                placeholder="voce@email.com"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="message">Mensagem</Label>
              <Textarea
                id="message"
                rows={6}
                value={form.message}
                onChange={(e) => update("message", e.target.value)}
                placeholder="Descreva como podemos ajudar..."
              />
            </div>
            <Button type="submit" className="w-full" disabled={busy}>
              {busy ? (
                <Loader2 className="size-4 animate-spin mr-2" />
              ) : (
                <Send className="size-4 mr-2" />
              )}
              Enviar mensagem
            </Button>
          </form>

          <aside className="space-y-4">
            <ContactCard
              icon={<Mail className="size-5" />}
              title="E-mail"
              value="veiganeto46@gmail.com"
              href="mailto:veiganeto46@gmail.com"
            />
            <ContactCard
              icon={<Phone className="size-5" />}
              title="Telefone / WhatsApp"
              value="(81) 92001-6070"
              href="tel:+5581920016070"
            />
            <div className="rounded-2xl border border-border bg-card/60 p-5">
              <h3 className="font-semibold">Antes de abrir um chamado</h3>
              <ul className="mt-2 text-sm text-muted-foreground space-y-1 list-disc pl-5">
                <li>Atualize o navegador para a versão mais recente</li>
                <li>Confira sua conexão com a internet</li>
                <li>Tente sair e entrar de novo na conta</li>
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
