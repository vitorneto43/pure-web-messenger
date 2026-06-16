import { useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { Check, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { lovable } from "@/integrations/lovable";
import { track } from "@/lib/track";

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

const HIGHLIGHTS = [
  "100% grátis",
  "Sem assinatura",
  "Sem cartão de crédito",
  "Conversas em tempo real",
  "Stories e comentários",
  "Chamadas de voz e vídeo",
];

export function AuthGateDialog({ open, onOpenChange, action = "default" }: Props) {
  const navigate = useNavigate();
  const [googleBusy, setGoogleBusy] = useState(false);

  // Track that the visitor saw the conversion modal
  if (open && typeof window !== "undefined") {
    void track("guest_signup_modal_open", { action });
  }

  const go = (mode: "signup" | "login") => {
    const redirect = typeof window !== "undefined" ? window.location.pathname + window.location.search : "/";
    void track(mode === "signup" ? "guest_signup_click" : "guest_login_click", { action });
    onOpenChange(false);
    navigate({ to: "/auth", search: { redirect, mode } as any });
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
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="text-center text-xl">Crie sua conta gratuita</DialogTitle>
          <DialogDescription className="text-center">
            Você está a um passo de participar da comunidade WaveChat. Crie sua conta gratuitamente para conversar, comentar, seguir pessoas e compartilhar momentos.
          </DialogDescription>
        </DialogHeader>

        <ul className="grid grid-cols-1 sm:grid-cols-2 gap-x-3 gap-y-1.5 my-2 text-sm">
          {HIGHLIGHTS.map((h) => (
            <li key={h} className="flex items-center gap-2">
              <Check className="size-4 text-emerald-500 shrink-0" />
              <span>{h}</span>
            </li>
          ))}
        </ul>

        <div className="flex flex-col gap-2 mt-2">
          <Button variant="outline" className="w-full" onClick={handleGoogle} disabled={googleBusy}>
            {googleBusy ? <Loader2 className="size-4 animate-spin mr-2" /> : (
              <svg viewBox="0 0 24 24" className="size-4 mr-2" aria-hidden="true">
                <path fill="#EA4335" d="M12 10.2v3.9h5.5c-.2 1.4-1.7 4-5.5 4-3.3 0-6-2.7-6-6s2.7-6 6-6c1.9 0 3.1.8 3.8 1.5l2.6-2.5C16.8 3.7 14.6 2.8 12 2.8 6.9 2.8 2.8 6.9 2.8 12s4.1 9.2 9.2 9.2c5.3 0 8.8-3.7 8.8-8.9 0-.6-.1-1-.2-1.5H12z" />
              </svg>
            )}
            Continuar com Google
          </Button>
          <Button className="w-full" onClick={() => go("signup")}>Criar Conta</Button>
          <Button variant="ghost" className="w-full" onClick={() => go("login")}>Já tenho conta</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
