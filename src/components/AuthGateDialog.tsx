import { useNavigate } from "@tanstack/react-router";
import { Lock } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

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

const COPY: Record<AuthGateAction, { title: string; description: string }> = {
  message: { title: "Crie sua conta para enviar mensagens", description: "É gratuito e leva menos de 30 segundos." },
  follow: { title: "Crie sua conta para seguir pessoas", description: "Acompanhe atualizações de quem você gosta." },
  comment: { title: "Crie sua conta para comentar", description: "Participe das conversas no WaveChat." },
  react: { title: "Crie sua conta para reagir", description: "Curta status e mostre seu apoio." },
  create_status: { title: "Crie sua conta para publicar status", description: "Compartilhe o que você está fazendo agora." },
  call: { title: "Crie sua conta para fazer chamadas", description: "Voz e vídeo gratuitos pela internet." },
  join_group: { title: "Crie sua conta para entrar em grupos", description: "Converse com várias pessoas ao mesmo tempo." },
  boost: { title: "Crie sua conta para impulsionar conteúdo", description: "Alcance mais pessoas no WaveChat." },
  default: { title: "Crie sua conta", description: "Faça login ou cadastre-se para continuar." },
};

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  action?: AuthGateAction;
}

export function AuthGateDialog({ open, onOpenChange, action = "default" }: Props) {
  const navigate = useNavigate();
  const copy = COPY[action];

  const go = (mode: "signup" | "login") => {
    const redirect = typeof window !== "undefined" ? window.location.pathname + window.location.search : "/";
    onOpenChange(false);
    navigate({ to: "/auth", search: { redirect, mode } });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <div className="mx-auto mb-2 grid place-items-center size-12 rounded-full bg-primary/10 text-primary">
            <Lock className="size-5" />
          </div>
          <DialogTitle className="text-center">{copy.title}</DialogTitle>
          <DialogDescription className="text-center">{copy.description}</DialogDescription>
        </DialogHeader>
        <DialogFooter className="flex-col gap-2 sm:flex-col">
          <Button className="w-full" onClick={() => go("signup")}>Criar conta grátis</Button>
          <Button variant="outline" className="w-full" onClick={() => go("login")}>Já tenho conta</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
