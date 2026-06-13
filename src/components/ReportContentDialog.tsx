import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { submitReport } from "@/lib/moderation.functions";
import { toast } from "sonner";
import { Flag, Loader2 } from "lucide-react";

const REASONS = [
  { value: "nudity", label: "Nudez explícita" },
  { value: "sexual", label: "Conteúdo sexual / prostituição" },
  { value: "violence", label: "Violência gráfica ou gore" },
  { value: "threat", label: "Ameaça ou assédio" },
  { value: "hate", label: "Discurso de ódio" },
  { value: "spam", label: "Spam ou propaganda enganosa" },
  { value: "scam", label: "Golpe, fraude ou link suspeito" },
  { value: "illegal", label: "Conteúdo ilegal" },
  { value: "minor", label: "Exploração de menor" },
  { value: "other", label: "Outro" },
];

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  targetType: "profile" | "status" | "message" | "group" | "conversation";
  targetId: string;
  reportedUserId?: string | null;
}

export function ReportContentDialog({ open, onOpenChange, targetType, targetId, reportedUserId }: Props) {
  const [reason, setReason] = useState<string>("");
  const [details, setDetails] = useState<string>("");
  const submit = useServerFn(submitReport);
  const mutation = useMutation({
    mutationFn: () =>
      submit({
        data: {
          target_type: targetType,
          target_id: targetId,
          reported_user_id: reportedUserId ?? undefined,
          reason,
          details: details.trim() || undefined,
        },
      }),
    onSuccess: () => {
      toast.success("Denúncia enviada. Nossa equipe vai analisar.");
      setReason("");
      setDetails("");
      onOpenChange(false);
    },
    onError: (e: any) => toast.error(e?.message ?? "Falha ao enviar denúncia"),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Flag className="size-4" /> Denunciar conteúdo
          </DialogTitle>
          <DialogDescription>
            Denúncias são anônimas. Use somente para conteúdo que viola as{" "}
            <a href="/diretrizes" target="_blank" className="underline">
              Diretrizes da Comunidade
            </a>
            .
          </DialogDescription>
        </DialogHeader>
        <RadioGroup value={reason} onValueChange={setReason} className="space-y-1.5 max-h-72 overflow-y-auto">
          {REASONS.map((r) => (
            <div key={r.value} className="flex items-center gap-2 rounded-md px-2 py-1.5 hover:bg-accent/30">
              <RadioGroupItem value={r.value} id={`r-${r.value}`} />
              <Label htmlFor={`r-${r.value}`} className="flex-1 cursor-pointer text-sm">
                {r.label}
              </Label>
            </div>
          ))}
        </RadioGroup>
        <Textarea
          placeholder="Detalhes (opcional)"
          value={details}
          onChange={(e) => setDetails(e.target.value)}
          maxLength={1000}
          rows={3}
        />
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button onClick={() => mutation.mutate()} disabled={!reason || mutation.isPending}>
            {mutation.isPending ? <Loader2 className="size-4 animate-spin" /> : "Enviar denúncia"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
