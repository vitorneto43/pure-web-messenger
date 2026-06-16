import { useEffect, useMemo, useState } from "react";
import QRCode from "qrcode";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { HandCoins, Copy, AlertTriangle } from "lucide-react";
import { toast } from "sonner";
import { buildPixPayload } from "@/lib/pix";

interface PixInfo {
  pix_key: string;
  pix_key_type: string | null;
  recipient_name: string;
  city: string;
}

const SUGGESTED = [5, 10, 20, 50];

export function LivePixSheet({ liveId }: { liveId: string }) {
  const [open, setOpen] = useState(false);
  const [info, setInfo] = useState<PixInfo | null>(null);
  const [loading, setLoading] = useState(false);
  const [amount, setAmount] = useState<number | null>(null);
  const [customAmount, setCustomAmount] = useState("");
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);

  useEffect(() => {
    if (!open || info) return;
    setLoading(true);
    supabase
      .rpc("get_live_pix_info", { p_live_id: liveId })
      .then(({ data, error }) => {
        if (error) toast.error(error.message);
        else if (data && data.length) setInfo(data[0] as PixInfo);
      })
      .then(() => setLoading(false));
  }, [open, info, liveId]);

  const finalAmount = useMemo(() => {
    if (amount) return amount;
    const n = parseFloat(customAmount.replace(",", "."));
    return isFinite(n) && n > 0 ? n : undefined;
  }, [amount, customAmount]);

  const payload = useMemo(() => {
    if (!info) return null;
    return buildPixPayload({
      key: info.pix_key,
      name: info.recipient_name,
      city: info.city,
      amount: finalAmount,
      description: "Apoio live WaveChat",
    });
  }, [info, finalAmount]);

  useEffect(() => {
    if (!payload) {
      setQrDataUrl(null);
      return;
    }
    QRCode.toDataURL(payload, { width: 280, margin: 1 }).then(setQrDataUrl).catch(() => setQrDataUrl(null));
  }, [payload]);

  async function copy() {
    if (!payload) return;
    try {
      await navigator.clipboard.writeText(payload);
      toast.success("Código Pix copiado!");
    } catch {
      toast.error("Não foi possível copiar");
    }
  }

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button
          size="icon"
          className="bg-gradient-to-br from-emerald-500 to-teal-600 text-white rounded-full shadow-lg"
          aria-label="Apoiar com Pix"
        >
          <HandCoins className="w-5 h-5" />
        </Button>
      </SheetTrigger>
      <SheetContent side="bottom" className="h-[85vh] overflow-y-auto">
        <SheetHeader>
          <SheetTitle>Apoiar o criador com Pix</SheetTitle>
        </SheetHeader>

        {loading ? (
          <p className="text-center text-muted-foreground mt-10">Carregando…</p>
        ) : !info ? (
          <div className="text-center mt-10 px-4">
            <p className="text-muted-foreground">
              Este criador ainda não cadastrou uma chave Pix para receber apoios.
            </p>
          </div>
        ) : (
          <div className="mt-4 space-y-4">
            <div className="text-center">
              <p className="text-sm text-muted-foreground">Recebedor</p>
              <p className="font-semibold">{info.recipient_name}</p>
            </div>

            <div>
              <p className="text-sm font-medium mb-2">Valor sugerido</p>
              <div className="grid grid-cols-5 gap-2">
                {SUGGESTED.map((v) => (
                  <Button
                    key={v}
                    type="button"
                    size="sm"
                    variant={amount === v ? "default" : "outline"}
                    onClick={() => {
                      setAmount(v);
                      setCustomAmount("");
                    }}
                  >
                    R${v}
                  </Button>
                ))}
                <Button
                  type="button"
                  size="sm"
                  variant={amount === null && customAmount ? "default" : "outline"}
                  onClick={() => setAmount(null)}
                >
                  Outro
                </Button>
              </div>
              {amount === null && (
                <Input
                  type="number"
                  inputMode="decimal"
                  min={0}
                  max={9999}
                  placeholder="Valor livre (opcional)"
                  className="mt-2"
                  value={customAmount}
                  onChange={(e) => setCustomAmount(e.target.value.slice(0, 7))}
                />
              )}
            </div>

            <div className="flex justify-center">
              {qrDataUrl ? (
                <img
                  src={qrDataUrl}
                  alt="QR Code Pix"
                  className="w-64 h-64 rounded-xl border bg-white p-2"
                />
              ) : (
                <div className="w-64 h-64 rounded-xl border bg-muted animate-pulse" />
              )}
            </div>

            <Button onClick={copy} className="w-full" variant="outline">
              <Copy className="w-4 h-4 mr-2" />
              Copiar código Pix (copia e cola)
            </Button>

            <div className="flex items-start gap-2 rounded-lg bg-amber-50 dark:bg-amber-950/30 p-3 text-xs text-amber-900 dark:text-amber-200">
              <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
              <p>
                Pagamento direto ao criador. A WaveChat não processa, intermedia nem garante valores. Em caso
                de problema, contate o recebedor.
              </p>
            </div>
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}
