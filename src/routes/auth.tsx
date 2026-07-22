import { createFileRoute, Link, redirect, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import "@/i18n";
import { useTranslation } from "react-i18next";
import { Eye, EyeOff, Loader2, Mail, MessageCircle, Users, Camera, MessageSquare, UserPlus, Globe2, Phone, Languages, Sparkles, Smartphone } from "lucide-react";
import wavechatLogo from "@/assets/wavechat-logo.png.asset.json";
import { z } from "zod";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable";
import { signInWithGoogleNative } from "@/lib/native-google-auth";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PublicFooter } from "@/components/public/PublicLayout";
import { getSignupAttributionForSignup, snapshotAttributionForOAuth, readAttribution } from "@/lib/utm-capture";
import { track } from "@/lib/track";
import { recordAppSignup } from "@/lib/app-events";


type Mode = "login" | "signup" | "forgot";

const normalizeUsername = (value: string) => value.trim().replace(/\s+/g, "_").replace(/_+/g, "_");

export const Route = createFileRoute("/auth")({
  component: AuthPage,
  validateSearch: (search: Record<string, unknown>) => ({
    redirect: typeof search.redirect === "string" ? search.redirect : undefined,
    invite: typeof search.invite === "string" ? search.invite : undefined,
    mode:
      search.mode === "signup" || search.mode === "login" || search.mode === "forgot"
        ? (search.mode as Mode)
        : undefined,
  }),
  beforeLoad: ({ search }) => {
    if (!search.mode && !search.redirect && !search.invite) {
      throw redirect({ to: "/", replace: true });
    }
  },
});

const signupSchema = z.object({
  username: z
    .string()
    .trim()
    .min(3, "Mínimo 3 caracteres")
    .max(24, "Máximo 24 caracteres")
    .regex(/^[a-zA-Z0-9_]+$/, "Use apenas letras, números e _"),
  displayName: z.string().trim().min(1, "Obrigatório").max(60),
  email: z.string().trim().email("Email inválido").max(255),
  password: z.string().min(8, "Mínimo 8 caracteres").max(72),
  birthDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Informe sua data de nascimento"),
});

function computeAge(birth: string): number | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(birth)) return null;
  const d = new Date(birth + "T00:00:00");
  if (Number.isNaN(d.getTime())) return null;
  const now = new Date();
  let age = now.getFullYear() - d.getFullYear();
  const m = now.getMonth() - d.getMonth();
  if (m < 0 || (m === 0 && now.getDate() < d.getDate())) age--;
  return age;
}
const loginSchema = z.object({
  email: z.string().trim().email("Email inválido"),
  password: z.string().min(1, "Obrigatório"),
});

function AuthPage() {
  const { t } = useTranslation();
  const { session, loading } = useAuth();
  const navigate = useNavigate();
  const search = Route.useSearch();
  const redirectTo = search.redirect && search.redirect.startsWith("/") ? search.redirect : null;
  const goAfterAuth = () => {
    if (redirectTo) {
      // Use full assign for arbitrary paths to bypass typed router constraints.
      window.location.assign(redirectTo);
    } else {
      navigate({ to: "/" });
    }
  };
  const [mode, setMode] = useState<Mode>(search.mode ?? "login");
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);
  const [inviteUsername, setInviteUsername] = useState<string | null>(null);
  const [showConfirmEmail, setShowConfirmEmail] = useState(false);
  const [isHuman, setIsHuman] = useState(false);
  const [acceptedTerms, setAcceptedTerms] = useState(false);
  const [honeypot, setHoneypot] = useState(""); // anti-bot: deve ficar vazio
  const [formStartedAt] = useState(() => Date.now());
  const [focusedOnce, setFocusedOnce] = useState(false);
  const [filledOnce, setFilledOnce] = useState<{ email: boolean; username: boolean; password: boolean }>({
    email: false,
    username: false,
    password: false,
  });
  const [form, setForm] = useState({
    username: "",
    displayName: "",
    email: "",
    password: "",
    birthDate: "",
  });
  const [isAndroidWeb, setIsAndroidWeb] = useState(false);

  useEffect(() => {
    setIsAndroidWeb(
      /Android/i.test(navigator.userAgent) &&
        !(window as any).Capacitor?.isNativePlatform?.(),
    );
  }, []);

  // Etapa 3 do funil: tela de cadastro realmente aberta
  useEffect(() => {
    if (mode === "signup") void track("auth_signup_view");
  }, [mode]);

  const onFieldFocus = () => {
    if (mode !== "signup" || focusedOnce) return;
    setFocusedOnce(true);
    void track("signup_field_focus");
  };
  const onFieldBlurFilled = (field: "email" | "username" | "password", value: string) => {
    if (mode !== "signup") return;
    const v = value.trim();
    if (!v) return;
    if (field === "email" && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v)) return;
    if (field === "password" && v.length < 8) return;
    if (field === "username" && v.length < 3) return;
    if (filledOnce[field]) return;
    setFilledOnce((s) => ({ ...s, [field]: true }));
    void track(`signup_${field}_filled`);
  };

  useEffect(() => {
    if (typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    const inv = search.invite ?? params.get("invite");
    const KEY = "wavechat:pending_invite";
    if (inv) {
      try {
        localStorage.setItem(
          KEY,
          JSON.stringify({ username: inv, ts: Date.now() }),
        );
      } catch {}
      setInviteUsername(inv);
      setMode("signup");
      return;
    }
    // Recupera convite persistido (válido por 30 dias)
    try {
      const raw = localStorage.getItem(KEY);
      if (!raw) return;
      const parsed = JSON.parse(raw) as { username?: string; ts?: number };
      const age = Date.now() - (parsed.ts ?? 0);
      if (parsed.username && age < 30 * 24 * 60 * 60 * 1000) {
        setInviteUsername(parsed.username);
      } else {
        localStorage.removeItem(KEY);
      }
    } catch {}
  }, [search.invite]);

  useEffect(() => {
    if (!loading && session) goAfterAuth();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading, session]);

  const update = (k: string, v: string) => setForm((f) => ({ ...f, [k]: v }));

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      if (mode === "signup") {
        void track("signup_click", { email: form.email });
        void track("signup_submit_click");
        // Anti-bot: honeypot deve estar vazio + checkbox humano + tempo mínimo no formulário
        if (honeypot.trim() !== "") {
          toast.error("Erro de validação. Tente novamente.");
          return;
        }
        if (!isHuman) {
          toast.error("Confirme que você não é um robô antes de continuar.");
          return;
        }
        if (!acceptedTerms) {
          toast.error("Você precisa aceitar os Termos de Uso e a Política de Privacidade.");
          return;
        }
        if (Date.now() - formStartedAt < 2000) {
          toast.error("Aguarde um instante antes de enviar o cadastro.");
          return;
        }
        const parsed = signupSchema.safeParse({
          ...form,
          username: normalizeUsername(form.username),
        });
        if (!parsed.success) {
          const issue = parsed.error.issues[0];
          toast.error(
            `${issue.path[0] === "username" ? "Nome de usuário" : issue.path[0] === "birthDate" ? "Data de nascimento" : "Cadastro"}: ${issue.message}`,
          );
          return;
        }
        const age = computeAge(parsed.data.birthDate);
        if (age === null || age < 15) {
          toast.error("Você precisa ter pelo menos 15 anos para utilizar a Wavechat.", {
            duration: 8000,
          });
          return;
        }
        // Bloqueio de cadastro a partir de IPs previamente banidos por abuso.
        // Privacidade: o servidor compara apenas o *hash* anonimizado do IP;
        // o IP em si nunca é retornado nem armazenado em claro.
        try {
          const res = await fetch("/api/public/auth/check-signup-ip", { method: "GET" });
          if (res.ok) {
            const j = (await res.json()) as { allowed?: boolean };
            if (j.allowed === false) {
              toast.error(
                t("auth.toast.ipBanned", {
                  defaultValue:
                    "Não é possível criar uma conta a partir desta rede. Se você acha que é um engano, fale com o suporte.",
                }),
              );
              return;
            }
          }
        } catch {}
        const attribution = getSignupAttributionForSignup();
        const { data: signUpData, error } = await supabase.auth.signUp({
          email: parsed.data.email,
          password: parsed.data.password,
          options: {
            emailRedirectTo: `${window.location.origin}/`,
            data: {
              username: parsed.data.username,
              display_name: parsed.data.displayName,
              birth_date: parsed.data.birthDate,
              ...(inviteUsername ? { invite: inviteUsername } : {}),
              ...attribution,
            },
          },
        });
        if (error) throw error;
        void track("signup_completed", { email: parsed.data.email, user_id: signUpData.user?.id });
        recordAppSignup(signUpData.user?.id);
        try { localStorage.removeItem("wavechat:pending_invite"); } catch {}
        toast.success(t("auth.toast.signupOk"));
        setShowConfirmEmail(true);
        setMode("login");
      } else if (mode === "login") {
        void track("login_click");
        const parsed = loginSchema.safeParse(form);
        if (!parsed.success) {
          toast.error(parsed.error.issues[0].message);
          return;
        }
        const { error } = await supabase.auth.signInWithPassword({
          email: parsed.data.email,
          password: parsed.data.password,
        });
        if (error) throw error;
        toast.success(t("auth.toast.welcome"));
      } else {
        const email = form.email.trim();
        if (!email) {
          toast.error(t("auth.toast.emailRequired"));
          return;
        }
        const { error } = await supabase.auth.resetPasswordForEmail(email, {
          redirectTo: `${window.location.origin}/reset-password`,
        });
        if (error) throw error;
        toast.success(t("auth.toast.resetSent"));
        setMode("login");
      }
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : t("auth.toast.unexpected"));
    } finally {
      setBusy(false);
    }
  }

  const features = [
    { icon: MessageCircle, label: "Chat privado" },
    { icon: Users, label: "Grupos" },
    { icon: Camera, label: "Stories" },
    { icon: MessageSquare, label: "Comentários" },
    { icon: UserPlus, label: "Seguidores" },
    { icon: Globe2, label: "Pessoas para conhecer" },
    { icon: Phone, label: "Voz e vídeo" },
    { icon: Languages, label: "Tradução automática" },
  ];

  return (
    <div className="min-h-screen flex flex-col relative overflow-hidden">
      <div aria-hidden className="pointer-events-none absolute inset-0 -z-10">
        <div className="absolute -top-32 -left-24 size-[28rem] rounded-full bg-primary/20 blur-3xl" />
        <div className="absolute bottom-0 right-0 size-[22rem] rounded-full bg-accent/20 blur-3xl" />
      </div>

      <div className="flex-1 flex items-center justify-center px-4 py-8">
        <div className="w-full max-w-md mx-auto">
          <div className="flex items-center justify-center gap-2 mb-6">
            <Link to="/" className="flex items-center gap-2">
              <img src={wavechatLogo.url} alt="WaveChat" className="size-10 rounded-2xl shadow-lg object-cover" />
              <span className="text-xl font-bold tracking-tight">Wavechat</span>
            </Link>
          </div>

          <div className="w-full">



        <div className="glass rounded-2xl border border-border p-6 sm:p-8 shadow-xl">
          <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-emerald-500/40 bg-emerald-500/15 px-3.5 py-1.5 text-xs font-semibold text-emerald-400">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
              <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
            </span>
            100% Grátis · Sem assinatura · Sem cartão
          </div>
          <h1 className="text-2xl font-semibold tracking-tight">
            {mode === "login" && t("auth.login.title")}
            {mode === "signup" && t("auth.signup.title")}
            {mode === "forgot" && t("auth.forgot.title")}
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            {mode === "login" && t("auth.login.subtitle")}
            {mode === "signup" && t("auth.signup.subtitle")}
            {mode === "forgot" && t("auth.forgot.subtitle")}
          </p>

          {mode === "login" && showConfirmEmail && (
            <div className="mt-4 rounded-xl border-2 border-yellow-500/50 bg-yellow-500/10 px-4 py-4 text-center">
              <div className="flex items-center justify-center gap-2 mb-1">
                <Mail className="size-5 text-yellow-600" />
                <span className="font-bold text-yellow-600 text-lg tracking-wide">{t("auth.confirmEmail.title")}</span>
              </div>
              <p className="text-sm text-yellow-700 dark:text-yellow-400">
                {t("auth.confirmEmail.body")}
              </p>
              <button
                type="button"
                onClick={() => setShowConfirmEmail(false)}
                className="mt-3 text-xs font-medium text-yellow-700 dark:text-yellow-300 hover:underline"
              >
                {t("auth.confirmEmail.ok")}
              </button>
            </div>
          )}

          {mode === "signup" && inviteUsername && (
            <div className="mt-4 rounded-lg border border-primary/40 bg-primary/10 px-3 py-2 text-xs text-primary">
              {t("auth.invite", { username: inviteUsername })}
            </div>
          )}


          <form onSubmit={handleSubmit} className="mt-6 space-y-4">
            {mode === "signup" && (
              <>
                <div className="space-y-1.5">
                  <Label htmlFor="username">{t("auth.field.username")}</Label>
                  <Input
                    id="username"
                    value={form.username}
                    onChange={(e) => update("username", normalizeUsername(e.target.value))}
                    onFocus={onFieldFocus}
                    onBlur={(e) => onFieldBlurFilled("username", e.target.value)}
                    placeholder="joao_silva"
                    autoComplete="username"
                    autoCapitalize="none"
                    spellCheck={false}
                  />
                  <p className="text-sm font-semibold text-primary mt-1">
                    {t("auth.field.usernameHint")}
                  </p>
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="displayName">{t("auth.field.displayName")}</Label>
                  <Input
                    id="displayName"
                    value={form.displayName}
                    onChange={(e) => update("displayName", e.target.value)}
                    placeholder="João Silva"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="birthDate">Data de nascimento</Label>
                  <Input
                    id="birthDate"
                    type="date"
                    value={form.birthDate}
                    max={new Date().toISOString().slice(0, 10)}
                    onChange={(e) => update("birthDate", e.target.value)}
                    required
                  />
                  <p className="text-xs text-muted-foreground mt-1">
                    É necessário ter pelo menos 15 anos para usar a Wavechat.
                  </p>
                </div>
              </>
            )}

            <div className="space-y-1.5">
              <Label htmlFor="email">{t("auth.field.email")}</Label>
              <Input
                id="email"
                type="email"
                value={form.email}
                onChange={(e) => update("email", e.target.value)}
                onFocus={onFieldFocus}
                onBlur={(e) => onFieldBlurFilled("email", e.target.value)}
                placeholder="voce@email.com"
                autoComplete="email"
              />
            </div>

            {mode !== "forgot" && (
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <Label htmlFor="password">{t("auth.field.password")}</Label>
                  {mode === "login" && (
                    <button
                      type="button"
                      onClick={() => setMode("forgot")}
                      className="text-xs text-primary hover:underline"
                    >
                      {t("auth.field.forgotPassword")}
                    </button>
                  )}
                </div>
                <div className="relative">
                  <Input
                    id="password"
                    type={show ? "text" : "password"}
                    value={form.password}
                    onChange={(e) => update("password", e.target.value)}
                    onFocus={onFieldFocus}
                    onBlur={(e) => onFieldBlurFilled("password", e.target.value)}
                    placeholder="••••••••"
                    autoComplete={mode === "signup" ? "new-password" : "current-password"}
                    className="pr-10"
                  />
                  <button
                    type="button"
                    onClick={() => setShow((s) => !s)}
                    className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 text-muted-foreground hover:text-foreground"
                    aria-label={show ? t("auth.field.hidePassword") : t("auth.field.showPassword")}
                  >
                    {show ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                  </button>
                </div>
              </div>
            )}

            {mode === "signup" && (
              <>
                {/* Honeypot: invisível para humanos, bots tendem a preencher */}
                <div
                  aria-hidden="true"
                  style={{
                    position: "absolute",
                    left: "-10000px",
                    top: "auto",
                    width: "1px",
                    height: "1px",
                    overflow: "hidden",
                  }}
                >
                  <label htmlFor="website-url">Website (não preencher)</label>
                  <input
                    id="website-url"
                    type="text"
                    tabIndex={-1}
                    autoComplete="off"
                    value={honeypot}
                    onChange={(e) => setHoneypot(e.target.value)}
                  />
                </div>

                <label className="flex items-start gap-3 rounded-lg border border-border bg-card/40 p-3 cursor-pointer hover:bg-accent/30 transition">
                  <input
                    type="checkbox"
                    checked={isHuman}
                    onChange={(e) => setIsHuman(e.target.checked)}
                    className="mt-0.5 size-5 accent-primary cursor-pointer"
                  />
                  <span className="text-sm text-foreground">
                    Eu confirmo que sou uma pessoa real e li as{" "}
                    <Link to="/diretrizes" className="text-primary hover:underline font-medium">
                      diretrizes da comunidade
                    </Link>
                    .
                  </span>
                </label>
              </>
            )}

            <Button type="submit" className="w-full" disabled={busy || (mode === "signup" && !isHuman)}>
              {busy && <Loader2 className="size-4 animate-spin mr-2" />}
              {mode === "login" && t("auth.submit.login")}
              {mode === "signup" && t("auth.submit.signup")}
              {mode === "forgot" && t("auth.submit.forgot")}
            </Button>
          </form>

          {mode !== "forgot" && (
            <>
              <div className="my-4 flex items-center gap-3">
                <div className="h-px flex-1 bg-border" />
                <span className="text-xs text-muted-foreground">{t("auth.or")}</span>
                <div className="h-px flex-1 bg-border" />
              </div>
              <Button
                type="button"
                variant="outline"
                className="w-full"
                disabled={busy}
                onClick={async () => {
                  setBusy(true);
                  try {
                    snapshotAttributionForOAuth("google");
                    const attr = readAttribution();
                    void track("google_signin_click", {
                      source: attr?.source ?? "direto",
                      medium: attr?.medium,
                      campaign: attr?.campaign,
                    });
                    const launchedNative = await signInWithGoogleNative();
                    if (launchedNative) {
                      // Native flow continues in Chrome Custom Tab; the session
                      // is applied via the appUrlOpen listener in AuthProvider.
                      return;
                    }
                    const result = await lovable.auth.signInWithOAuth("google", {
                      redirect_uri: `${window.location.origin}/`,
                    });
                    if (result.error) throw result.error;
                  } catch (err) {
                    const raw =
                      err instanceof Error
                        ? err.message
                        : typeof err === "string"
                          ? err
                          : (() => {
                              try { return JSON.stringify(err); } catch { return String(err); }
                            })();
                    console.error("[google-signin] error", err);
                    toast.error(`Google: ${raw || t("auth.toast.googleFail")}`, { duration: 10000 });
                    setBusy(false);
                  }
                }}
              >
                <svg className="size-4 mr-2" viewBox="0 0 24 24" aria-hidden>
                  <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                  <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                  <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
                  <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
                </svg>
                {t("auth.google")}
              </Button>

              <a
                href="https://play.google.com/store/apps/details?id=com.wavechat.app"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center justify-center w-full gap-2 rounded-md border border-border bg-card px-4 py-2.5 text-sm font-medium text-foreground hover:bg-accent/40 transition"
                onClick={() => void track("playstore_click", { from: "auth" })}
              >
                <svg className="size-5" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
                  <path d="M3 20.5V3.5c0-.59.34-1.11.84-1.35L13.69 12 3.84 21.85A1.5 1.5 0 0 1 3 20.5Zm13.81-5.38L6.05 21.34 14.54 12.85l2.27 2.27Zm3.35-4.31a1.495 1.495 0 0 1 0 2.38l-2.27 1.31L15.39 12l2.27-2.5 2.27 1.31ZM6.05 2.66l10.76 6.22-2.27 2.27L6.05 2.66Z" />
                </svg>
                Baixe o app na Play Store
              </a>
            </>
          )}

          <div className="mt-6 text-center text-sm text-muted-foreground">
            {mode === "login" ? (
              <>
                {t("auth.noAccount")}{" "}
                <button
                  onClick={() => {
                    void track("signup_click", { from: "auth_toggle" });
                    setMode("signup");
                  }}
                  className="text-primary hover:underline"
                >
                  {t("auth.createNow")}
                </button>
              </>
            ) : (
              <>
                {t("auth.haveAccount")}{" "}
                <button onClick={() => setMode("login")} className="text-primary hover:underline">
                  {t("auth.signIn")}
                </button>
              </>
            )}
          </div>

          <div className="mt-4 rounded-xl border border-primary/30 bg-primary/5 px-4 py-3 text-center">
            <p className="text-xs text-muted-foreground mb-2">
              Quer dar uma olhada antes de criar conta?
            </p>
            <Link
              to="/"
              className="inline-flex items-center justify-center text-sm font-semibold text-primary hover:underline"
            >
              Explorar sem cadastro →
            </Link>
          </div>

          <p className="mt-4 text-center text-xs text-muted-foreground">
            {t("auth.guidelinesNotice")}{" "}
            <Link to="/diretrizes" className="text-primary hover:underline font-medium">
              {t("auth.guidelinesLink")}
            </Link>
          </p>
        </div>

        <p className="mt-6 text-center text-xs text-muted-foreground">
          <Link to="/" className="hover:text-foreground">
            ← {t("common.back")}
          </Link>
        </p>
          </div>
        </div>
      </div>
      <PublicFooter />
    </div>
  );
}
