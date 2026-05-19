import { MessageCircle } from "lucide-react";

export function EmptyChat() {
  return (
    <div className="h-full grid place-items-center px-6 text-center">
      <div>
        <div className="mx-auto size-16 rounded-2xl bg-gradient-to-br from-primary to-accent grid place-items-center shadow-xl">
          <MessageCircle className="size-7 text-primary-foreground" />
        </div>
        <h2 className="mt-5 text-xl font-semibold">Suas conversas, em tempo real</h2>
        <p className="mt-2 text-sm text-muted-foreground max-w-sm">
          Selecione uma conversa à esquerda ou inicie uma nova para começar a trocar
          mensagens.
        </p>
      </div>
    </div>
  );
}
