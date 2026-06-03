import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Eye, EyeOff, Loader2, Mail } from "lucide-react";
import wavechatLogo from "@/assets/wavechat-logo.png.asset.json";
import { z } from "zod";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PublicFooter } from "@/components/public/PublicLayout";
import { getSignupAttributionForSignup } from "@/lib/utm-capture";


type Mode = "login" | "signup" | "forgot";

const normalizeUsername = (value: string) => value.trim().replace(/\s+/g, "_").replace(/_+/g, "_");

export const Route = createFileRoute("/auth")({
  component: AuthPage,
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
  const { session, loading } = useAuth();
  const navigate = useNavigate();
  const [mode, setMode] = useState<Mode>("login");
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);
  const [inviteUsername, setInviteUsername] = useState<string | null>(null);
  const [showConfirmEmail, setShowConfirmEmail] = useState(false);
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
    if (inv) {
      setInviteUsername(inv);
      setMode("signup");
    }
  }, []);

  useEffect(() => {
    if (!loading && session) navigate({ to: "/chat" });
  }, [loading, session, navigate]);

  const update = (k: string, v: string) => setForm((f) => ({ ...f, [k]: v }));

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      if (mode === "signup") {
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
        const { error } = await supabase.auth.signUp({
          email: parsed.data.email,
          password: parsed.data.password,
          options: {
            emailRedirectTo: `${window.location.origin}/chat`,
            data: {
              username: parsed.data.username,
              display_name: parsed.data.displayName,
              ...(inviteUsername ? { invite: inviteUsername } : {}),
            },
          },
        });
        if (error) throw error;
        toast.success("Conta criada! Verifique seu email para confirmar.");
        setShowConfirmEmail(true);
        setMode("login");
      } else if (mode === "login") {
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
        toast.success("Bem-vindo de volta!");
      } else {
        const email = form.email.trim();
        if (!email) {
          toast.error("Informe seu email");
          return;
        }
        const { error } = await supabase.auth.resetPasswordForEmail(email, {
          redirectTo: `${window.location.origin}/reset-password`,
        });
        if (error) throw error;
        toast.success("Enviamos um link de recuperação para seu email.");
        setMode("login");
      }
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Erro inesperado");
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
            {mode === "login" && "Entrar na sua conta"}
            {mode === "signup" && "Criar conta"}
            {mode === "forgot" && "Recuperar senha"}
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            {mode === "login" && "Acesse suas conversas em tempo real."}
            {mode === "signup" && "Sem celular, sem SMS. Só seu email."}
            {mode === "forgot" && "Enviaremos um link para redefinir sua senha."}
          </p>

          {mode === "login" && showConfirmEmail && (
            <div className="mt-4 rounded-xl border-2 border-yellow-500/50 bg-yellow-500/10 px-4 py-4 text-center">
              <div className="flex items-center justify-center gap-2 mb-1">
                <Mail className="size-5 text-yellow-600" />
                <span className="font-bold text-yellow-600 text-lg tracking-wide">CONFIRME SEU E-MAIL</span>
              </div>
              <p className="text-sm text-yellow-700 dark:text-yellow-400">
                Enviamos um link de confirmação para o seu e-mail. Acesse sua caixa de entrada e clique no link para ativar sua conta.
              </p>
              <button
                type="button"
                onClick={() => setShowConfirmEmail(false)}
                className="mt-3 text-xs font-medium text-yellow-700 dark:text-yellow-300 hover:underline"
              >
                Entendi
              </button>
            </div>
          )}

          {mode === "signup" && inviteUsername && (
            <div className="mt-4 rounded-lg border border-primary/40 bg-primary/10 px-3 py-2 text-xs text-primary">
              Você foi convidado por <b>@{inviteUsername}</b> — crie sua conta para começar a conversar.
            </div>
          )}


          <form onSubmit={handleSubmit} className="mt-6 space-y-4">
            {mode === "signup" && (
              <>
                <div className="space-y-1.5">
                  <Label htmlFor="username">Nome de usuário</Label>
                  <Input
                    id="username"
                    value={form.username}
                    onChange={(e) => update("username", normalizeUsername(e.target.value))}
                    placeholder="joao_silva"
                    autoComplete="username"
                    autoCapitalize="none"
                    spellCheck={false}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="displayName">Nome de exibição</Label>
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
              <Label htmlFor="email">Email</Label>
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
                  <Label htmlFor="password">Senha</Label>
                  {mode === "login" && (
                    <button
                      type="button"
                      onClick={() => setMode("forgot")}
                      className="text-xs text-primary hover:underline"
                    >
                      Esqueci a senha
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
                    aria-label={show ? "Ocultar senha" : "Mostrar senha"}
                  >
                    {show ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                  </button>
                </div>
              </div>
            )}

            <Button type="submit" className="w-full" disabled={busy}>
              {busy && <Loader2 className="size-4 animate-spin mr-2" />}
              {mode === "login" && "Entrar"}
              {mode === "signup" && "Criar conta"}
              {mode === "forgot" && "Enviar link"}
            </Button>
          </form>

          {mode !== "forgot" && (
            <>
              <div className="my-4 flex items-center gap-3">
                <div className="h-px flex-1 bg-border" />
                <span className="text-xs text-muted-foreground">ou</span>
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
                    const result = await lovable.auth.signInWithOAuth("google", {
                      redirect_uri: `${window.location.origin}/chat`,
                    });
                    if (result.error) throw result.error;
                  } catch (err) {
                    toast.error(err instanceof Error ? err.message : "Falha no login com Google");
                    setBusy(false);
                  }
                }}
              >
                <svg className="size-4 mr-2" viewBox="0 0 24 24" aria-hidden>
                  <path fill="#EA4335" d="M12 10.2v3.9h5.5c-.24 1.4-1.66 4.1-5.5 4.1-3.32 0-6.02-2.74-6.02-6.12S8.68 5.96 12 5.96c1.88 0 3.14.8 3.86 1.48l2.64-2.54C16.86 3.36 14.66 2.4 12 2.4 6.76 2.4 2.52 6.64 2.52 11.88S6.76 21.36 12 21.36c6.92 0 11.5-4.86 11.5-11.7 0-.78-.08-1.38-.2-1.96H12z"/>
                </svg>
                Continuar com Google
              </Button>
            </>
          )}

          <div className="mt-6 text-center text-sm text-muted-foreground">
            {mode === "login" ? (
              <>
                Não tem conta?{" "}
                <button onClick={() => setMode("signup")} className="text-primary hover:underline">
                  Criar agora
                </button>
              </>
            ) : (
              <>
                Já tem conta?{" "}
                <button onClick={() => setMode("login")} className="text-primary hover:underline">
                  Entrar
                </button>
              </>
            )}
          </div>
        </div>

        <p className="mt-6 text-center text-xs text-muted-foreground">
          <Link to="/" className="hover:text-foreground">
            ← Voltar
          </Link>
        </p>
      </div>
      </div>
      <PublicFooter />
    </div>
  );
}
