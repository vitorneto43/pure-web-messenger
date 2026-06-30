import { useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { Button } from "@/components/ui/button";
import { lovable } from "@/integrations/lovable";
import { signInWithGoogleNative, isNativePlatform } from "@/lib/native-google-auth";
import { track } from "@/lib/track";
import { cn } from "@/lib/utils";

export type AuthGateAction =
  | "message"
  | "follow"
  | "comment"
  | "react"
  | "create_status"
  | "call"
  | "join_group"
  | "boost"
  | "default";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  action?: AuthGateAction;
}

export function AuthGateDialog({ open, onOpenChange, action = "default" }: Props) {
  const navigate = useNavigate();
  const [googleBusy, setGoogleBusy] = useState(false);

  if (open && typeof window !== "undefined") {
    void track("guest_signup_modal_open", { action });
  }

  const goEmail = () => {
    const redirect = typeof window !== "undefined" ? window.location.pathname + window.location.search : "/";
    void track("guest_login_click", { action });
    onOpenChange(false);
    navigate({ to: "/auth", search: { redirect, mode: "login" } as any });
  };

  const handleGoogle = async () => {
    setGoogleBusy(true);
    try {
      void track("guest_google_signin_click", { action });
      // No app Android nativo, usa o plugin de Google Sign-In (abre o seletor
      // de conta dentro do app). Sem isso, o fluxo OAuth web abre a versão
      // desktop do site dentro do WebView.
      if (await isNativePlatform()) {
        const ok = await signInWithGoogleNative();
        if (ok) {
          onOpenChange(false);
          return;
        }
      }
      const result = await lovable.auth.signInWithOAuth("google", {
        redirect_uri: typeof window !== "undefined" ? window.location.origin : undefined,
      });
      if (result.error) throw new Error(result.error.message ?? "Falha no Google");
      if (result.redirected) return;
      onOpenChange(false);
    } catch (e: any) {
      toast.error(e?.message ?? "Não foi possível continuar com o Google");
    } finally {
      setGoogleBusy(false);
    }
  };

  return (
    <DialogPrimitive.Root open={open} onOpenChange={onOpenChange}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay
          className={cn(
            "fixed inset-0 z-50 bg-background/40 backdrop-blur-sm",
            "data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0",
          )}
        />
        <DialogPrimitive.Content
          className={cn(
            "fixed left-1/2 top-1/2 z-50 w-[92vw] max-w-sm -translate-x-1/2 -translate-y-1/2",
            "rounded-2xl border bg-background/95 backdrop-blur-md p-6 shadow-2xl",
            "data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95",
          )}
        >
          <DialogPrimitive.Title className="text-center text-2xl sm:text-3xl font-extrabold tracking-tight">
            Entre em segundos
          </DialogPrimitive.Title>
          <DialogPrimitive.Description className="mt-2 text-center text-sm text-muted-foreground">
            Faça login com sua conta Google para participar da WaveChat.
          </DialogPrimitive.Description>
          <p className="mt-1 text-center text-xs text-muted-foreground/80">
            Posts • Stories • Lives • Grupos • Meet
          </p>

          <Button
            size="lg"
            variant="outline"
            className="mt-5 w-full h-12 text-base font-semibold bg-white hover:bg-gray-50 text-gray-700 border-gray-300 dark:bg-white dark:hover:bg-gray-100 dark:text-gray-700"
            onClick={handleGoogle}
            disabled={googleBusy}
          >
            {googleBusy ? (
              <Loader2 className="size-5 animate-spin mr-2" />
            ) : (
              <svg viewBox="0 0 24 24" className="size-5 mr-2" aria-hidden="true">
                <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
                <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
              </svg>
            )}
            Continuar com Google
          </Button>

          <button
            type="button"
            onClick={goEmail}
            className="mt-3 w-full text-center text-xs text-muted-foreground hover:text-foreground underline-offset-4 hover:underline"
          >
            ou entrar com e-mail
          </button>
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}
