import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import "@/i18n";
import { useTranslation } from "react-i18next";
import { Eye, EyeOff, Loader2, Mail } from "lucide-react";
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
    mode:
      search.mode === "signup" || search.mode === "login" || search.mode === "forgot"
        ? (search.mode as Mode)
        : undefined,
  }),
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
});
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
      navigate({ to: "/chat" });
    }
  };
  const [mode, setMode] = useState<Mode>(search.mode ?? "login");
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);
  const [inviteUsername, setInviteUsername] = useState<string | null>(null);
  const [showConfirmEmail, setShowConfirmEmail] = useState(false);
  const [isHuman, setIsHuman] = useState(false);
  const [honeypot, setHoneypot] = useState(""); // anti-bot: deve ficar vazio
  const [formStartedAt] = useState(() => Date.now());
  const [form, setForm] = useState({
    username: "",
    displayName: "",
    email: "",
    password: "",
  });

  useEffect(() => {
    if (typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    const inv = params.get("invite");
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
  }, []);

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
        const parsed = signupSchema.safeParse({
          ...form,
          username: normalizeUsername(form.username),
        });
        if (!parsed.success) {
          const issue = parsed.error.issues[0];
          toast.error(
            `${issue.path[0] === "username" ? "Nome de usuário" : "Cadastro"}: ${issue.message}`,
          );
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
            emailRedirectTo: `${window.location.origin}/chat`,
            data: {
              username: parsed.data.username,
              display_name: parsed.data.displayName,
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

  return (
    <div className="min-h-screen flex flex-col">
      <div className="flex-1 flex items-center justify-center px-4 py-10">
      <div className="w-full max-w-md">
        <div className="flex items-center justify-center gap-2 mb-8">
          <img src={wavechatLogo.url} alt="WaveChat" className="size-10 rounded-xl shadow-lg object-cover" />
          <span className="text-xl font-bold tracking-tight">Wavechat</span>
        </div>


        <div className="glass rounded-2xl border border-border p-6 sm:p-8 shadow-xl">
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
              </>
            )}

            <div className="space-y-1.5">
              <Label htmlFor="email">{t("auth.field.email")}</Label>
              <Input
                id="email"
                type="email"
                value={form.email}
                onChange={(e) => update("email", e.target.value)}
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

            <Button type="submit" className="w-full" disabled={busy}>
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
                      redirect_uri: `${window.location.origin}/chat`,
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
                  <path fill="#EA4335" d="M12 10.2v3.9h5.5c-.24 1.4-1.66 4.1-5.5 4.1-3.32 0-6.02-2.74-6.02-6.12S8.68 5.96 12 5.96c1.88 0 3.14.8 3.86 1.48l2.64-2.54C16.86 3.36 14.66 2.4 12 2.4 6.76 2.4 2.52 6.64 2.52 11.88S6.76 21.36 12 21.36c6.92 0 11.5-4.86 11.5-11.7 0-.78-.08-1.38-.2-1.96H12z"/>
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
              to="/descobrir"
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
      <PublicFooter />
    </div>
  );
}
