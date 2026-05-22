import { useEffect, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Loader2 } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { supabase } from "@/integrations/supabase/client";
import { encodePixMessage } from "@/lib/pix";
import { toast } from "sonner";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onSend: (content: string) => void;
}

const KEY_TYPES = [
  { value: "CPF/CNPJ", label: "CPF/CNPJ" },
  { value: "E-mail", label: "E-mail" },
  { value: "Telefone", label: "Telefone" },
  { value: "Aleatória", label: "Chave aleatória" },
];

export function SendPixDialog({ open, onOpenChange, onSend }: Props) {
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [name, setName] = useState("");
  const [key, setKey] = useState("");
  const [keyType, setKeyType] = useState<string>("CPF/CNPJ");
  const [amount, setAmount] = useState("");
  const [description, setDescription] = useState("");

  // Reset form each time the dialog opens so the user always
  // chooses the recipient key and value explicitly.
  useEffect(() => {
    if (!open) return;
    setName("");
    setKey("");
    setKeyType("CPF/CNPJ");
    setAmount("");
    setDescription("");
  }, [open]);

  function send() {
    if (!key.trim()) return toast.error("Informe a chave Pix");
    if (!name.trim()) return toast.error("Informe o nome do recebedor");
    const amt = amount ? Number(amount.replace(",", ".")) : undefined;
    if (amount && (!amt || amt <= 0)) return toast.error("Valor inválido");
    const marker = encodePixMessage({
      key: key.trim(),
      keyType,
      name: name.trim(),
      amount: amt,
      description: description.trim() || undefined,
    });
    onSend(marker);
    onOpenChange(false);
    setAmount("");
    setDescription("");
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Enviar Pix</DialogTitle>
          <DialogDescription>
            Informe a chave de destino e o valor. A pessoa pode pagar copiando o código ou lendo o QR.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <div>
            <Label>Nome do recebedor</Label>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Quem vai receber"
              maxLength={25}
            />
          </div>
          <div className="grid grid-cols-3 gap-2">
            <div className="col-span-1">
              <Label>Tipo</Label>
              <Select value={keyType} onValueChange={setKeyType}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {KEY_TYPES.map((k) => (
                    <SelectItem key={k.value} value={k.value}>
                      {k.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="col-span-2">
              <Label>Chave Pix de destino</Label>
              <Input
                value={key}
                onChange={(e) => setKey(e.target.value)}
                placeholder="Cole a chave de quem recebe"
                maxLength={120}
              />
            </div>
          </div>
          <div>
            <Label>Valor (opcional)</Label>
            <Input
              inputMode="decimal"
              placeholder="0,00"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
            />
          </div>
          <div>
            <Label>Descrição (opcional)</Label>
            <Input
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              maxLength={72}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="secondary" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button onClick={send} disabled={loading}>
            {loading && <Loader2 className="size-4 animate-spin mr-2" />} Enviar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
