import { useEffect, useState } from "react";
import { Loader2, Check, Rocket, Gift } from "lucide-react";
import { useServerFn } from "@tanstack/react-start";
import { EmbeddedCheckoutProvider, EmbeddedCheckout } from "@stripe/react-stripe-js";
import { toast } from "sonner";
import { useTranslation } from "react-i18next";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { getStripe, getStripeEnvironment } from "@/lib/stripe";
import { createBoostCheckout } from "@/lib/payments.functions";
import { PaymentTestModeBanner } from "@/components/PaymentTestModeBanner";
import { supabase } from "@/integrations/supabase/client";
import { currentLocale } from "@/i18n";
import { convertFromBRL, currencyForLocale, formatMoney } from "@/lib/currency";

type PackKey = "boost_100" | "boost_500" | "boost_2000";

// Base price in BRL. Display is converted to the user's locale currency.
// Stripe still charges in BRL — Stripe handles FX at the card level.
const PACKAGES: { key: PackKey; views: number; priceBRL: number; popular?: boolean }[] = [
  { key: "boost_100", views: 100, priceBRL: 5 },
  { key: "boost_500", views: 500, priceBRL: 15, popular: true },
  { key: "boost_2000", views: 2000, priceBRL: 50 },
];

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  statusId: string;
}

export function BoostDialog({ open, onOpenChange, statusId }: Props) {
  const { t, i18n } = useTranslation();
  void i18n.language;
  const locale = currentLocale();
  const currency = currencyForLocale(locale);
  const [loading, setLoading] = useState<PackKey | null>(null);
  const [clientSecret, setClientSecret] = useState<string | null>(null);
  const [freeViews, setFreeViews] = useState<number>(0);
  const [redeemingFree, setRedeemingFree] = useState(false);
  const startCheckout = useServerFn(createBoostCheckout);

  useEffect(() => {
    if (!open) return;
    (async () => {
      const { data } = await (supabase as any).rpc("get_invite_stats");
      setFreeViews((data as any)?.pending_views ?? 0);
    })();
  }, [open]);

  async function redeemFree() {
    setRedeemingFree(true);
    try {
      const { data, error } = await (supabase as any).rpc("redeem_free_boost", {
        _status_id: statusId,
      });
      if (error) throw error;
      toast.success(t("boost.freeRedeemed", { count: (data as any)?.views ?? 100 }));
      onOpenChange(false);
    } catch (e: any) {
      toast.error(e.message ?? t("boost.redeemFailed"));
    } finally {
      setRedeemingFree(false);
    }
  }

  async function pick(key: PackKey) {
    setLoading(key);
    try {
      const result = await startCheckout({
        data: {
          statusId,
          package: key,
          returnUrl: `${window.location.origin}/?boost=success&session_id={CHECKOUT_SESSION_ID}`,
          environment: getStripeEnvironment(),
        },
      });
      if (!result.clientSecret) throw new Error("Missing clientSecret");
      setClientSecret(result.clientSecret);
    } catch (e: any) {
      toast.error(t("boost.checkoutFailed"), { description: e.message });
    } finally {
      setLoading(null);
    }
  }

  function close(v: boolean) {
    if (!v) {
      setClientSecret(null);
      setLoading(null);
    }
    onOpenChange(v);
  }

  return (
    <Dialog open={open} onOpenChange={close}>
      <DialogContent className="max-w-md p-0 overflow-hidden">
        <PaymentTestModeBanner />
        <div className="p-6">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Rocket className="size-5 text-pink-500" /> {t("boost.title")}
            </DialogTitle>
            <DialogDescription>{t("boost.description")}</DialogDescription>
          </DialogHeader>

          {!clientSecret ? (
            <div className="space-y-2.5 mt-4">
              {freeViews >= 100 && (
                <div className="rounded-xl border border-pink-500/40 bg-gradient-to-br from-pink-500/10 to-purple-500/10 p-4">
                  <div className="flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <div className="font-semibold flex items-center gap-2">
                        <Gift className="size-4 text-pink-500" />
                        {t("boost.freeTitle", { count: 100 })}
                      </div>
                      <div className="text-xs text-muted-foreground mt-0.5">
                        {t("boost.freeSubtitle", { count: freeViews })}
                      </div>
                    </div>
                    <Button
                      size="sm"
                      onClick={redeemFree}
                      disabled={redeemingFree}
                      className="bg-pink-500 hover:bg-pink-600 text-white shrink-0"
                    >
                      {redeemingFree ? <Loader2 className="size-4 animate-spin" /> : t("boost.useFree")}
                    </Button>
                  </div>
                </div>
              )}
              {PACKAGES.map((p) => {
                const converted = convertFromBRL(p.priceBRL, currency);
                const perView = convertFromBRL(p.priceBRL / p.views, currency);
                return (
                  <button
                    key={p.key}
                    disabled={!!loading}
                    onClick={() => pick(p.key)}
                    className={`w-full rounded-xl border p-4 text-left transition hover:border-primary hover:bg-accent/30 ${
                      p.popular ? "border-primary/60 bg-primary/5" : "border-border"
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="font-semibold flex items-center gap-2">
                          {t("boost.views", { count: p.views })}
                          {p.popular && (
                            <span className="text-[10px] bg-primary text-primary-foreground px-1.5 py-0.5 rounded-full">
                              {t("boost.popular")}
                            </span>
                          )}
                        </div>
                        <div className="text-xs text-muted-foreground mt-0.5">
                          {t("boost.perView", { price: formatMoney(perView, currency, locale) })}
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="text-lg font-bold">{formatMoney(converted, currency, locale)}</div>
                        {loading === p.key ? (
                          <Loader2 className="size-4 animate-spin ml-auto mt-1" />
                        ) : (
                          <Check className="size-4 text-muted-foreground ml-auto mt-1 opacity-0 group-hover:opacity-100" />
                        )}
                      </div>
                    </div>
                  </button>
                );
              })}
              <p className="text-[11px] text-muted-foreground mt-3 leading-relaxed">
                {t("boost.footnote")}
              </p>
              {currency !== "BRL" && (
                <p className="text-[10px] text-muted-foreground/70 leading-relaxed">
                  {t("boost.fxNotice")}
                </p>
              )}
            </div>
          ) : (
            <div className="mt-4 -mx-2">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setClientSecret(null)}
                className="mb-2"
              >
                ← {t("common.back")}
              </Button>
              <EmbeddedCheckoutProvider
                stripe={getStripe()}
                options={{ fetchClientSecret: async () => clientSecret }}
              >
                <EmbeddedCheckout />
              </EmbeddedCheckoutProvider>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
