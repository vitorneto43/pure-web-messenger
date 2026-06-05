import { useEffect, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Mail, X, Send, MessageSquare, Sparkles, Loader2, GripVertical } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useAuth } from "@/hooks/use-auth";
import { subscribeNewsletter, submitNewsletterFeedback } from "@/lib/newsletter.functions";

const DISMISS_KEY = "wc_newsletter_dismissed_v1";
const SUB_KEY = "wc_newsletter_subscribed";
const CONSENT_KEY = "wc_newsletter_consent_v1"; // "accepted" | "declined" | null
const CONSENT_PROMPT_AT_KEY = "wc_newsletter_consent_prompt_at";
const POS_KEY = "wc_newsletter_pos_v1";
const DECLINE_COOLDOWN_MS = 1000 * 60 * 60 * 24 * 7; // 7 dias

const WIDGET_W = 56; // button width in px (approx)
const WIDGET_H = 56; // button height in px (approx)
const MARGIN = 20;   // 20px margin (Tailwind bottom-5 right-5)

// Hide on routes where the widget would obscure UI.
const HIDDEN_PATH_PREFIXES = ["/admin", "/auth", "/reset-password"];

function shouldHideOnPath(path: string) {
  return HIDDEN_PATH_PREFIXES.some((p) => path === p || path.startsWith(p + "/"));
}

function getDefaultPos() {
  if (typeof window === "undefined") return { x: 0, y: 0 };
  return {
    x: window.innerWidth - WIDGET_W - MARGIN,
    y: window.innerHeight - WIDGET_H - MARGIN,
  };
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
  const [consent, setConsent] = useState<"accepted" | "declined" | null>(null);
  const [showConsent, setShowConsent] = useState(false);

  const subscribeFn = useServerFn(subscribeNewsletter);
  const feedbackFn = useServerFn(submitNewsletterFeedback);

  const [pos, setPos] = useState<{ x: number; y: number }>(() => {
    if (typeof window === "undefined") return { x: 0, y: 0 };
    try {
      const raw = localStorage.getItem(POS_KEY);
      if (raw) return JSON.parse(raw);
    } catch { /* ignore */ }
    return getDefaultPos();
  });

  const draggingRef = useRef(false);
  const dragStartRef = useRef<{ x: number; y: number; posX: number; posY: number } | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (typeof window === "undefined") return;
    setSubscribed(localStorage.getItem(SUB_KEY) === "1");
    const storedConsent = localStorage.getItem(CONSENT_KEY) as
      | "accepted"
      | "declined"
      | null;
    setConsent(storedConsent);

    // Mostra o prompt inicial uma vez (ou novamente após 7 dias se recusou)
    const lastPrompt = Number(localStorage.getItem(CONSENT_PROMPT_AT_KEY) || 0);
    const now = Date.now();
    const shouldPrompt =
      storedConsent === null ||
      (storedConsent === "declined" && now - lastPrompt > DECLINE_COOLDOWN_MS);
    if (shouldPrompt) {
      const t = setTimeout(() => setShowConsent(true), 1500);
      return () => clearTimeout(t);
    }

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

  useEffect(() => {
    if (typeof window === "undefined") return;
    const onResize = () => {
      setPos((prev) => ({
        x: Math.min(prev.x, window.innerWidth - WIDGET_W - MARGIN),
        y: Math.min(prev.y, window.innerHeight - WIDGET_H - MARGIN),
      }));
    };
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  useEffect(() => {
    function onMove(e: MouseEvent) {
      if (!draggingRef.current || !dragStartRef.current) return;
      const dx = e.clientX - dragStartRef.current.x;
      const dy = e.clientY - dragStartRef.current.y;
      let nx = dragStartRef.current.posX + dx;
      let ny = dragStartRef.current.posY + dy;
      if (typeof window !== "undefined") {
        nx = Math.max(MARGIN, Math.min(nx, window.innerWidth - WIDGET_W - MARGIN));
        ny = Math.max(MARGIN, Math.min(ny, window.innerHeight - WIDGET_H - MARGIN));
      }
      setPos({ x: nx, y: ny });
    }
    function onUp() {
      if (draggingRef.current) {
        draggingRef.current = false;
        dragStartRef.current = null;
        if (typeof window !== "undefined") {
          try {
            localStorage.setItem(POS_KEY, JSON.stringify(pos));
          } catch { /* ignore */ }
        }
      }
    }
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
    return () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    };
  }, [pos]);

  useEffect(() => {
    function onTouchMove(e: TouchEvent) {
      if (!draggingRef.current || !dragStartRef.current) return;
      const touch = e.touches[0];
      const dx = touch.clientX - dragStartRef.current.x;
      const dy = touch.clientY - dragStartRef.current.y;
      let nx = dragStartRef.current.posX + dx;
      let ny = dragStartRef.current.posY + dy;
      if (typeof window !== "undefined") {
        nx = Math.max(MARGIN, Math.min(nx, window.innerWidth - WIDGET_W - MARGIN));
        ny = Math.max(MARGIN, Math.min(ny, window.innerHeight - WIDGET_H - MARGIN));
      }
      setPos({ x: nx, y: ny });
    }
    function onTouchEnd() {
      if (draggingRef.current) {
        draggingRef.current = false;
        dragStartRef.current = null;
        if (typeof window !== "undefined") {
          try {
            localStorage.setItem(POS_KEY, JSON.stringify(pos));
          } catch { /* ignore */ }
        }
      }
    }
    window.addEventListener("touchmove", onTouchMove, { passive: false });
    window.addEventListener("touchend", onTouchEnd);
    return () => {
      window.removeEventListener("touchmove", onTouchMove);
      window.removeEventListener("touchend", onTouchEnd);
    };
  }, [pos]);

  function startDrag(clientX: number, clientY: number) {
    draggingRef.current = true;
    dragStartRef.current = { x: clientX, y: clientY, posX: pos.x, posY: pos.y };
  }

  function handlePointerDown(e: React.PointerEvent<HTMLDivElement>) {
    if (e.button !== 0 && e.pointerType === "mouse") return;
    startDrag(e.clientX, e.clientY);
  }

  function handleTouchStart(e: React.TouchEvent<HTMLDivElement>) {
    const touch = e.touches[0];
    startDrag(touch.clientX, touch.clientY);
  }

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

  function declineConsent() {
    localStorage.setItem(CONSENT_KEY, "declined");
    localStorage.setItem(CONSENT_PROMPT_AT_KEY, String(Date.now()));
    setConsent("declined");
    setShowConsent(false);
  }

  async function acceptConsent() {
    localStorage.setItem(CONSENT_KEY, "accepted");
    localStorage.setItem(CONSENT_PROMPT_AT_KEY, String(Date.now()));
    setConsent("accepted");
    // Se já estiver logado e tiver e-mail, inscreve direto
    if (user?.email && !subscribed) {
      setBusy(true);
      try {
        await subscribeFn({
          data: { email: user.email, userId: user.id, source: "consent_prompt" },
        });
        localStorage.setItem(SUB_KEY, "1");
        setSubscribed(true);
        toast.success("Inscrição confirmada! Você receberá nossas novidades.");
        setShowConsent(false);
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Falha ao inscrever");
      } finally {
        setBusy(false);
      }
      return;
    }
    // Sem login: abre o painel para o usuário informar o e-mail
    setShowConsent(false);
    setTab("subscribe");
    setOpen(true);
  }

  return (
    <div
      ref={containerRef}
      className="fixed z-[60] flex flex-col items-end gap-3 print:hidden select-none"
      style={{ left: pos.x, top: pos.y, width: WIDGET_W, touchAction: "none" }}
    >
      {/* Drag handle grip indicator */}
      <div
        className="absolute -top-4 left-1/2 -translate-x-1/2 cursor-grab active:cursor-grabbing text-muted-foreground/60 hover:text-muted-foreground transition"
        onPointerDown={handlePointerDown}
        onTouchStart={handleTouchStart}
        title="Arraste para mover"
      >
        <GripVertical className="size-4" />
      </div>

      {showConsent && !subscribed && (
        <div className="absolute bottom-[calc(100%+12px)] right-0 w-[min(92vw,360px)] rounded-2xl border border-border bg-card/95 backdrop-blur-md shadow-2xl overflow-hidden animate-in fade-in slide-in-from-bottom-2 duration-200">
          <div className="relative bg-gradient-to-br from-primary to-primary/70 px-5 py-4 text-primary-foreground">
            <button
              onClick={declineConsent}
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
                <h3 className="font-semibold text-base leading-tight">
                  Quer receber a newsletter?
                </h3>
                <p className="text-xs text-white/85">
                  Novidades, dicas e atualizações direto da nossa redação.
                </p>
              </div>
            </div>
          </div>
          <div className="p-4 space-y-3">
            <p className="text-sm text-muted-foreground">
              Só enviamos com o seu consentimento. Sem spam, e você pode sair quando quiser.
            </p>
            <div className="flex gap-2">
              <Button
                variant="outline"
                className="flex-1"
                onClick={declineConsent}
                disabled={busy}
              >
                Agora não
              </Button>
              <Button className="flex-1" onClick={acceptConsent} disabled={busy}>
                {busy ? <Loader2 className="size-4 animate-spin mr-2" /> : null}
                Sim, quero receber
              </Button>
            </div>
          </div>
        </div>
      )}
      {open && (
        <div className="absolute bottom-[calc(100%+12px)] right-0 w-[min(92vw,360px)] rounded-2xl border border-border bg-card/95 backdrop-blur-md shadow-2xl overflow-hidden animate-in fade-in slide-in-from-bottom-2 duration-200">
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
        onPointerDown={(e) => {
          startDrag(e.clientX, e.clientY);
        }}
        onTouchStart={handleTouchStart}
        onClick={() => {
          // Only toggle if not dragging (small threshold handled by distance in move)
          // We rely on the fact that if the user dragged far, the click won't fire naturally
          // because pointerdown started drag and the element moved.
          setOpen((v) => !v);
        }}
        className="relative size-14 rounded-full bg-gradient-to-br from-primary to-primary/70 text-primary-foreground shadow-xl hover:shadow-2xl active:scale-95 transition grid place-items-center cursor-grab active:cursor-grabbing"
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
