import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Mail, X, Send, MessageSquare, Sparkles, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useAuth } from "@/hooks/use-auth";
import { subscribeNewsletter, submitNewsletterFeedback } from "@/lib/newsletter.functions";

const DISMISS_KEY = "wc_newsletter_dismissed_v1";
const SUB_KEY = "wc_newsletter_subscribed";

// Hide on routes where the widget would obscure UI.
const HIDDEN_PATH_PREFIXES = ["/admin", "/chat", "/auth", "/reset-password"];

function shouldHideOnPath(path: string) {
  return HIDDEN_PATH_PREFIXES.some((p) => path === p || path.startsWith(p + "/"));
}

export function NewsletterWidget() {
  const { user } = useAuth();
  const [path, setPath] = useState(() =>
    typeof window === "undefined" ? "/" : window.location.pathname,
  );
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState<"subscribe" | "feedback">("subscribe");
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [subscribed, setSubscribed] = useState(false);

  const subscribeFn = useServerFn(subscribeNewsletter);
  const feedbackFn = useServerFn(submitNewsletterFeedback);

  useEffect(() => {
    if (typeof window === "undefined") return;
    setSubscribed(localStorage.getItem(SUB_KEY) === "1");
    const onPop = () => setPath(window.location.pathname);
    window.addEventListener("popstate", onPop);
    const id = setInterval(() => setPath(window.location.pathname), 800);
    return () => {
      window.removeEventListener("popstate", onPop);
      clearInterval(id);
    };
  }, []);

  useEffect(() => {
    if (user?.email) setEmail((e) => e || user.email!);
  }, [user]);

  if (shouldHideOnPath(path)) return null;

  async function handleSubscribe(e: React.FormEvent) {
    e.preventDefault();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      toast.error("Informe um e-mail válido");
      return;
    }
    setBusy(true);
    try {
      await subscribeFn({
        data: { email, userId: user?.id ?? null, source: "floating_widget" },
      });
      localStorage.setItem(SUB_KEY, "1");
      setSubscribed(true);
      toast.success("Inscrição confirmada! Você receberá nossas novidades.");
      setTab("feedback");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Falha ao inscrever");
    } finally {
      setBusy(false);
    }
  }

  async function handleFeedback(e: React.FormEvent) {
    e.preventDefault();
    if (message.trim().length < 2) {
      toast.error("Digite uma mensagem");
      return;
    }
    setBusy(true);
    try {
      await feedbackFn({
        data: {
          message: message.trim(),
          email: email || null,
          userId: user?.id ?? null,
        },
      });
      toast.success("Mensagem enviada! Obrigado pelo retorno.");
      setMessage("");
      setOpen(false);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Falha ao enviar");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="fixed bottom-5 right-5 z-[60] flex flex-col items-end gap-3 print:hidden">
      {open && (
        <div className="w-[min(92vw,360px)] rounded-2xl border border-border bg-card/95 backdrop-blur-md shadow-2xl overflow-hidden animate-in fade-in slide-in-from-bottom-2 duration-200">
          <div className="relative bg-gradient-to-br from-primary to-primary/70 px-5 py-4 text-primary-foreground">
            <button
              onClick={() => setOpen(false)}
              className="absolute right-3 top-3 rounded-full p-1 hover:bg-white/15 transition"
              aria-label="Fechar"
            >
              <X className="size-4" />
            </button>
            <div className="flex items-center gap-2">
              <div className="size-9 rounded-xl bg-white/20 grid place-items-center">
                <Sparkles className="size-5" />
              </div>
              <div>
                <h3 className="font-semibold text-base leading-tight">WaveChat News</h3>
                <p className="text-xs text-white/85">
                  Novidades, atualizações e dicas direto pra você.
                </p>
              </div>
            </div>
          </div>

          <div className="flex border-b border-border">
            <button
              onClick={() => setTab("subscribe")}
              className={`flex-1 px-3 py-2 text-xs font-medium transition ${
                tab === "subscribe"
                  ? "text-primary border-b-2 border-primary -mb-px"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <Mail className="size-3.5 inline mr-1" /> Inscrever
            </button>
            <button
              onClick={() => setTab("feedback")}
              className={`flex-1 px-3 py-2 text-xs font-medium transition ${
                tab === "feedback"
                  ? "text-primary border-b-2 border-primary -mb-px"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <MessageSquare className="size-3.5 inline mr-1" /> Fale com a gente
            </button>
          </div>

          <div className="p-4">
            {tab === "subscribe" ? (
              <form onSubmit={handleSubscribe} className="space-y-3">
                {subscribed ? (
                  <div className="text-sm text-muted-foreground">
                    <p className="font-medium text-foreground mb-1">
                      Você já está inscrito 🎉
                    </p>
                    Quando publicarmos novidades, você verá aqui no app e no seu e-mail.
                  </div>
                ) : (
                  <>
                    <p className="text-sm text-muted-foreground">
                      Receba novidades, vídeos e atualizações. Sem spam.
                    </p>
                    <Input
                      type="email"
                      required
                      placeholder="seu@email.com"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      maxLength={255}
                    />
                  </>
                )}
                {!subscribed && (
                  <Button type="submit" className="w-full" disabled={busy}>
                    {busy ? (
                      <Loader2 className="size-4 animate-spin mr-2" />
                    ) : (
                      <Send className="size-4 mr-2" />
                    )}
                    Quero receber
                  </Button>
                )}
                <p className="text-[11px] text-muted-foreground text-center">
                  Convide amigos: quanto mais gente, melhor a comunidade 💙
                </p>
              </form>
            ) : (
              <form onSubmit={handleFeedback} className="space-y-3">
                <p className="text-sm text-muted-foreground">
                  Sugestão, elogio ou bug? Conta pra gente.
                </p>
                <Textarea
                  required
                  rows={4}
                  placeholder="Sua mensagem..."
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  maxLength={2000}
                />
                {!user && (
                  <Input
                    type="email"
                    placeholder="seu@email.com (opcional)"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    maxLength={255}
                  />
                )}
                <Button type="submit" className="w-full" disabled={busy}>
                  {busy ? (
                    <Loader2 className="size-4 animate-spin mr-2" />
                  ) : (
                    <Send className="size-4 mr-2" />
                  )}
                  Enviar mensagem
                </Button>
              </form>
            )}
          </div>
        </div>
      )}

      <button
        onClick={() => setOpen((v) => !v)}
        className="relative size-14 rounded-full bg-gradient-to-br from-primary to-primary/70 text-primary-foreground shadow-xl hover:shadow-2xl active:scale-95 transition grid place-items-center"
        aria-label="Newsletter WaveChat"
      >
        {open ? <X className="size-6" /> : <Mail className="size-6" />}
        {!open && !subscribed && (
          <span className="absolute -top-1 -right-1 size-3 rounded-full bg-red-500 ring-2 ring-background animate-pulse" />
        )}
      </button>
    </div>
  );
}
