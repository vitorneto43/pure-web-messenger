import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Loader2, Mail, MessageSquare, CheckCircle2, X } from "lucide-react";
import { toast } from "sonner";
import {
  listSupportTickets,
  replySupportTicket,
  setSupportTicketStatus,
} from "@/lib/support.functions";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";

type Ticket = {
  id: string;
  user_id: string | null;
  name: string;
  email: string;
  message: string;
  status: string;
  admin_reply: string | null;
  replied_at: string | null;
  created_at: string;
};

export function SupportTab() {
  const [status, setStatus] = useState<string>("open");
  const [active, setActive] = useState<Ticket | null>(null);
  const [reply, setReply] = useState("");

  const listFn = useServerFn(listSupportTickets);
  const replyFn = useServerFn(replySupportTicket);
  const statusFn = useServerFn(setSupportTicketStatus);

  const q = useQuery({
    queryKey: ["admin", "support", status],
    queryFn: () => listFn({ data: { status } }),
  });

  const replyMut = useMutation({
    mutationFn: (vars: { ticketId: string; reply: string }) =>
      replyFn({ data: vars }),
    onSuccess: () => {
      toast.success("Resposta enviada por e-mail.");
      setActive(null);
      setReply("");
      q.refetch();
    },
    onError: (e: any) => toast.error(e?.message || "Erro ao enviar resposta."),
  });

  const closeMut = useMutation({
    mutationFn: (id: string) =>
      statusFn({ data: { ticketId: id, status: "closed" } }),
    onSuccess: () => {
      toast.success("Ticket encerrado.");
      q.refetch();
    },
  });

  const reopenMut = useMutation({
    mutationFn: (id: string) =>
      statusFn({ data: { ticketId: id, status: "open" } }),
    onSuccess: () => q.refetch(),
  });

  const tickets: Ticket[] = q.data?.tickets ?? [];

  const counts = {
    open: tickets.filter((t) => t.status === "open").length,
    replied: tickets.filter((t) => t.status === "replied").length,
    closed: tickets.filter((t) => t.status === "closed").length,
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2">
            <MessageSquare className="size-5" />
            Mensagens de suporte
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Tabs value={status} onValueChange={setStatus} className="mb-4">
            <TabsList>
              <TabsTrigger value="open">Abertos</TabsTrigger>
              <TabsTrigger value="replied">Respondidos</TabsTrigger>
              <TabsTrigger value="closed">Fechados</TabsTrigger>
              <TabsTrigger value="all">Todos</TabsTrigger>
            </TabsList>
          </Tabs>

          {q.isLoading ? (
            <div className="flex justify-center py-10">
              <Loader2 className="size-6 animate-spin text-muted-foreground" />
            </div>
          ) : tickets.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">
              Nenhuma mensagem por aqui.
            </p>
          ) : (
            <div className="space-y-2">
              {tickets.map((t) => (
                <div
                  key={t.id}
                  className="border border-border rounded-lg p-3 hover:bg-accent/40 cursor-pointer"
                  onClick={() => {
                    setActive(t);
                    setReply(t.admin_reply ?? "");
                  }}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-medium">{t.name}</span>
                        <span className="text-xs text-muted-foreground">{t.email}</span>
                        <StatusBadge status={t.status} />
                      </div>
                      <p className="text-sm text-muted-foreground mt-1 line-clamp-2">
                        {t.message}
                      </p>
                      <p className="text-[11px] text-muted-foreground mt-1">
                        {new Date(t.created_at).toLocaleString("pt-BR")}
                      </p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog
        open={!!active}
        onOpenChange={(o) => {
          if (!o) {
            setActive(null);
            setReply("");
          }
        }}
      >
        <DialogContent className="max-w-2xl">
          {active && (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2 flex-wrap">
                  <span>{active.name}</span>
                  <StatusBadge status={active.status} />
                </DialogTitle>
                <p className="text-xs text-muted-foreground">{active.email}</p>
              </DialogHeader>

              <div className="space-y-4">
                <div className="rounded-lg border border-border bg-muted/40 p-3">
                  <p className="text-xs uppercase text-muted-foreground mb-1">
                    Mensagem
                  </p>
                  <p className="text-sm whitespace-pre-wrap">{active.message}</p>
                  <p className="text-[11px] text-muted-foreground mt-2">
                    {new Date(active.created_at).toLocaleString("pt-BR")}
                  </p>
                </div>

                {active.admin_reply && (
                  <div className="rounded-lg border border-primary/30 bg-primary/5 p-3">
                    <p className="text-xs uppercase text-muted-foreground mb-1">
                      Resposta anterior
                    </p>
                    <p className="text-sm whitespace-pre-wrap">{active.admin_reply}</p>
                    {active.replied_at && (
                      <p className="text-[11px] text-muted-foreground mt-2">
                        Enviada em {new Date(active.replied_at).toLocaleString("pt-BR")}
                      </p>
                    )}
                  </div>
                )}

                <div>
                  <label className="text-sm font-medium">
                    {active.admin_reply ? "Nova resposta" : "Responder"}
                  </label>
                  <Textarea
                    rows={6}
                    value={reply}
                    onChange={(e) => setReply(e.target.value)}
                    placeholder="Escreva sua resposta. Será enviada por e-mail."
                    className="mt-1"
                  />
                </div>
              </div>

              <DialogFooter className="flex-col sm:flex-row gap-2">
                {active.status !== "closed" ? (
                  <Button
                    variant="outline"
                    onClick={() => closeMut.mutate(active.id)}
                    disabled={closeMut.isPending}
                  >
                    <X className="size-4 mr-1.5" /> Encerrar
                  </Button>
                ) : (
                  <Button
                    variant="outline"
                    onClick={() => reopenMut.mutate(active.id)}
                    disabled={reopenMut.isPending}
                  >
                    Reabrir
                  </Button>
                )}
                <Button
                  onClick={() =>
                    replyMut.mutate({ ticketId: active.id, reply: reply.trim() })
                  }
                  disabled={replyMut.isPending || reply.trim().length < 1}
                >
                  {replyMut.isPending ? (
                    <Loader2 className="size-4 animate-spin mr-1.5" />
                  ) : (
                    <Mail className="size-4 mr-1.5" />
                  )}
                  Enviar resposta
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  if (status === "open")
    return <Badge variant="destructive">Aberto</Badge>;
  if (status === "replied")
    return (
      <Badge className="bg-green-600 hover:bg-green-700">
        <CheckCircle2 className="size-3 mr-1" />
        Respondido
      </Badge>
    );
  return <Badge variant="secondary">Fechado</Badge>;
}
