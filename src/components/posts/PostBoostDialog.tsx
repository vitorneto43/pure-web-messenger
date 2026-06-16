import { useState } from "react";
import { Loader2, Rocket } from "lucide-react";
import { useServerFn } from "@tanstack/react-start";
import { EmbeddedCheckoutProvider, EmbeddedCheckout } from "@stripe/react-stripe-js";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { getStripe, getStripeEnvironment } from "@/lib/stripe";
import { createPostBoostCheckout } from "@/lib/post-payments.functions";
import { PaymentTestModeBanner } from "@/components/PaymentTestModeBanner";
import { currentLocale } from "@/i18n";
import { convertFromBRL, currencyForLocale, formatMoney } from "@/lib/currency";

type PackKey = "boost_100" | "boost_500" | "boost_2000";
const PACKAGES: { key: PackKey; views: number; priceBRL: number; popular?: boolean }[] = [
  { key: "boost_100", views: 100, priceBRL: 5 },
  { key: "boost_500", views: 500, priceBRL: 15, popular: true },
  { key: "boost_2000", views: 2000, priceBRL: 50 },
];

export function PostBoostDialog({ open, onOpenChange, postId }: { open: boolean; onOpenChange: (v: boolean) => void; postId: string }) {
  const locale = currentLocale();
  const currency = currencyForLocale(locale);
  const [loading, setLoading] = useState<string | null>(null);
  const [clientSecret, setClientSecret] = useState<string | null>(null);
  const startCheckout = useServerFn(createPostBoostCheckout);

  async function pickPackage(key: PackKey) {
    setLoading(key);
    try {
      const result = await startCheckout({ data: {
        postId, package: key,
        returnUrl: `${window.location.origin}/posts?boost=success&session_id={CHECKOUT_SESSION_ID}`,
        environment: getStripeEnvironment(), currency,
      } });
      if (!result.clientSecret) throw new Error("Missing clientSecret");
      setClientSecret(result.clientSecret);
    } catch (e: any) {
      toast.error("Falha no checkout", { description: e.message });
    } finally { setLoading(null); }
  }

  function close(v: boolean) { if (!v) { setClientSecret(null); setLoading(null); } onOpenChange(v); }

  return (
    <Dialog open={open} onOpenChange={close}>
      <DialogContent className="max-w-md p-0 overflow-hidden max-h-[92vh] flex flex-col">
        <PaymentTestModeBanner />
        <div className="p-6 overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><Rocket className="size-5 text-pink-500" />Impulsionar Post</DialogTitle>
            <DialogDescription>Entregue seu post para mais pessoas. Cobrança única.</DialogDescription>
          </DialogHeader>

          {!clientSecret ? (
            <div className="mt-4 space-y-2.5">
              {PACKAGES.map((p) => {
                const converted = convertFromBRL(p.priceBRL, currency);
                return (
                  <button key={p.key} disabled={!!loading} onClick={() => pickPackage(p.key)}
                    className={`w-full rounded-xl border p-4 text-left transition hover:border-primary hover:bg-accent/30 ${p.popular ? "border-primary/60 bg-primary/5" : "border-border"}`}>
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="font-semibold">{p.views.toLocaleString(locale)} views {p.popular && <span className="ml-1 text-[10px] bg-primary text-primary-foreground px-1.5 py-0.5 rounded-full">popular</span>}</div>
                        <div className="text-xs text-muted-foreground mt-0.5">Entrega estimada</div>
                      </div>
                      <div className="text-right">
                        <div className="text-lg font-bold">{formatMoney(converted, currency, locale)}</div>
                        {loading === p.key && <Loader2 className="size-4 animate-spin ml-auto mt-1" />}
                      </div>
                    </div>
                  </button>
                );
              })}
              <p className="text-[11px] text-muted-foreground mt-3">Valores estimados, podem variar conforme demanda.</p>
            </div>
          ) : (
            <div className="mt-4 -mx-2">
              <Button variant="ghost" size="sm" onClick={() => setClientSecret(null)} className="mb-2">← Voltar</Button>
              <EmbeddedCheckoutProvider stripe={getStripe()} options={{ fetchClientSecret: async () => clientSecret }}>
                <EmbeddedCheckout />
              </EmbeddedCheckoutProvider>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
