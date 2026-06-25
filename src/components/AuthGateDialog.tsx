import { useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { Button } from "@/components/ui/button";
import { lovable } from "@/integrations/lovable";
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
            className="mt-5 w-full h-12 text-base font-semibold"
            onClick={handleGoogle}
            disabled={googleBusy}
          >
            {googleBusy ? (
              <Loader2 className="size-5 animate-spin mr-2" />
            ) : (
              <svg viewBox="0 0 24 24" className="size-5 mr-2" aria-hidden="true">
                <path fill="#fff" d="M12 10.2v3.9h5.5c-.2 1.4-1.7 4-5.5 4-3.3 0-6-2.7-6-6s2.7-6 6-6c1.9 0 3.1.8 3.8 1.5l2.6-2.5C16.8 3.7 14.6 2.8 12 2.8 6.9 2.8 2.8 6.9 2.8 12s4.1 9.2 9.2 9.2c5.3 0 8.8-3.7 8.8-8.9 0-.6-.1-1-.2-1.5H12z" />
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
