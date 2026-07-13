import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { submitReport } from "@/lib/moderation.functions";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, AlertTriangle } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/hooks/use-auth";

const REASONS = [
  "Golpe / fraude",
  "Discurso de ódio",
  "Assédio / bullying",
  "Conteúdo sexual / nudez",
  "Violência",
  "Spam",
  "Perfil falso / impersonação",
  "Conteúdo ilegal",
  "Outro",
];

export function ReportAbuseDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (v: boolean) => void }) {
  const { user } = useAuth();
  const [reason, setReason] = useState(REASONS[0]);
  const [targetHint, setTargetHint] = useState("");
  const [details, setDetails] = useState("");
  const submitFn = useServerFn(submitReport);

  const mutation = useMutation({
    mutationFn: async () => {
      const composedDetails = [targetHint && `Alvo/URL: ${targetHint}`, details].filter(Boolean).join("\n\n");
      return submitFn({
        data: {
          target_type: "platform",
          target_id: targetHint?.trim() || "general",
          reason,
          details: composedDetails || undefined,
        },
      });
    },
    onSuccess: () => {
      toast.success("Denúncia enviada — nossa equipe de moderação vai analisar.");
      setTargetHint("");
      setDetails("");
      setReason(REASONS[0]);
      onOpenChange(false);
    },
    onError: (e: any) => toast.error(e?.message ?? "Erro ao enviar denúncia"),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <AlertTriangle className="size-5 text-destructive" /> Denunciar abuso
          </DialogTitle>
          <DialogDescription>
            Sua denúncia vai direto para o painel de moderação da WaveChat.
            {!user && " Faça login para acompanhar o status da denúncia."}
          </DialogDescription>
        </DialogHeader>

        {!user ? (
          <div className="space-y-3 text-sm">
            <p className="text-muted-foreground">
              Para registrar uma denúncia no painel de moderação, entre na sua conta primeiro.
            </p>
            <p className="text-muted-foreground">
              Se preferir, escreva para{" "}
              <a className="text-primary underline" href="mailto:contato@webconnectchat.com?subject=Denúncia%20de%20abuso">
                contato@webconnectchat.com
              </a>
              .
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            <div>
              <label className="text-xs uppercase tracking-wider text-muted-foreground">Motivo</label>
              <Select value={reason} onValueChange={setReason}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {REASONS.map((r) => (
                    <SelectItem key={r} value={r}>{r}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-xs uppercase tracking-wider text-muted-foreground">
                Perfil, link ou identificador (opcional)
              </label>
              <Input
                placeholder="@usuario, link do post/status, etc."
                value={targetHint}
                onChange={(e) => setTargetHint(e.target.value)}
                maxLength={255}
              />
            </div>
            <div>
              <label className="text-xs uppercase tracking-wider text-muted-foreground">Descreva o ocorrido</label>
              <Textarea
                rows={4}
                maxLength={1000}
                value={details}
                onChange={(e) => setDetails(e.target.value)}
                placeholder="Conte com o máximo de detalhes o que aconteceu."
              />
            </div>
          </div>
        )}

        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>Cancelar</Button>
          {user && (
            <Button
              onClick={() => mutation.mutate()}
              disabled={mutation.isPending || (!details.trim() && !targetHint.trim())}
            >
              {mutation.isPending ? <Loader2 className="size-4 animate-spin" /> : "Enviar denúncia"}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
