import { useEffect, useMemo, useState } from "react";
import { Loader2, Check, Rocket, Gift, Sparkles } from "lucide-react";
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
import { Slider } from "@/components/ui/slider";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { getStripe, getStripeEnvironment } from "@/lib/stripe";
import { createBoostCheckout } from "@/lib/payments.functions";
import { PaymentTestModeBanner } from "@/components/PaymentTestModeBanner";
import { supabase } from "@/integrations/supabase/client";
import { currentLocale } from "@/i18n";
import { convertFromBRL, currencyForLocale, formatMoney } from "@/lib/currency";
import {
  BR_STATES,
  OBJECTIVES,
  calculateCpm,
  estimateViews,
  type BoostObjective,
  type BoostGender,
} from "@/lib/boost-pricing";

type PackKey = "boost_100" | "boost_500" | "boost_2000";

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
  const [loading, setLoading] = useState<string | null>(null);
  const [clientSecret, setClientSecret] = useState<string | null>(null);
  const [freeViews, setFreeViews] = useState<number>(0);
  const [redeemingFree, setRedeemingFree] = useState(false);
  const [ctaLabel, setCtaLabel] = useState("");
  const [ctaUrl, setCtaUrl] = useState("");
  const [statusKind, setStatusKind] = useState<string>("");

  // Custom boost state
  const [budget, setBudget] = useState<number>(20); // BRL
  const [days, setDays] = useState<number>(7);
  const [states, setStates] = useState<string[]>([]);
  const [ageMin, setAgeMin] = useState<number>(18);
  const [ageMax, setAgeMax] = useState<number>(55);
  const [gender, setGender] = useState<BoostGender>("all");
  const [objective, setObjective] = useState<BoostObjective>("views");

  const startCheckout = useServerFn(createBoostCheckout);

  useEffect(() => {
    if (!open) return;
    (async () => {
      const { data } = await (supabase as any).rpc("get_invite_stats");
      setFreeViews((data as any)?.pending_views ?? 0);
      const { data: s } = await supabase
        .from("statuses")
        .select("kind, cta_url, cta_label")
        .eq("id", statusId)
        .maybeSingle();
      if (s) {
        setStatusKind((s as any).kind ?? "");
        setCtaUrl((s as any).cta_url ?? "");
        setCtaLabel((s as any).cta_label ?? "");
      }
    })();
  }, [open, statusId]);

  const customInput = useMemo(() => ({
    budgetCents: Math.round(budget * 100),
    durationDays: days,
    states,
    ageMin,
    ageMax,
    gender,
    objective,
  }), [budget, days, states, ageMin, ageMax, gender, objective]);

  const estimatedViews = useMemo(() => estimateViews(customInput), [customInput]);
  const cpmCents = useMemo(() => calculateCpm(customInput), [customInput]);

  async function saveCta(): Promise<boolean> {
    const trimmed = ctaUrl.trim();
    let url: string | null = null;
    if (trimmed) {
      try {
        const u = new URL(trimmed.startsWith("http") ? trimmed : `https://${trimmed}`);
        if (!/^https?:$/.test(u.protocol)) throw new Error();
        url = u.toString();
      } catch {
        toast.error("Link inválido");
        return false;
      }
    }
    const label = ctaLabel.trim().slice(0, 30) || (url ? "Saiba mais" : null);
    const { error } = await (supabase as any)
      .from("statuses")
      .update({ cta_url: url, cta_label: label })
      .eq("id", statusId);
    if (error) {
      toast.error("Falha ao salvar link", { description: error.message });
      return false;
    }
    return true;
  }

  async function redeemFree() {
    setRedeemingFree(true);
    try {
      const ok = await saveCta();
      if (!ok) { setRedeemingFree(false); return; }
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

  async function pickPackage(key: PackKey) {
    setLoading(key);
    try {
      const ok = await saveCta();
      if (!ok) { setLoading(null); return; }
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

  async function pickCustom() {
    if (ageMin > ageMax) {
      toast.error("Faixa etária inválida");
      return;
    }
    if (estimatedViews < 1) {
      toast.error("Orçamento muito baixo para a segmentação escolhida");
      return;
    }
    setLoading("custom");
    try {
      const ok = await saveCta();
      if (!ok) { setLoading(null); return; }
      const result = await startCheckout({
        data: {
          statusId,
          package: "custom",
          returnUrl: `${window.location.origin}/?boost=success&session_id={CHECKOUT_SESSION_ID}`,
          environment: getStripeEnvironment(),
          custom: customInput,
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

  function toggleState(code: string) {
    setStates((cur) => cur.includes(code) ? cur.filter((c) => c !== code) : [...cur, code]);
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
      <DialogContent className="max-w-md p-0 overflow-hidden max-h-[92vh] flex flex-col">
        <PaymentTestModeBanner />
        <div className="p-6 overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Rocket className="size-5 text-pink-500" /> {t("boost.title")}
            </DialogTitle>
            <DialogDescription>{t("boost.description")}</DialogDescription>
          </DialogHeader>

          {!clientSecret ? (
            <div className="mt-4 space-y-3">
              {(statusKind === "image" || statusKind === "video") && (
                <div className="rounded-xl border border-border bg-muted/30 p-3 space-y-2">
                  <div className="flex items-center justify-between">
                    <p className="text-xs font-semibold">Botão de ação no anúncio</p>
                    <span className="text-[10px] text-muted-foreground">aparece sobre a mídia</span>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <select
                      value={ctaLabel}
                      onChange={(e) => setCtaLabel(e.target.value)}
                      className="h-9 rounded-md border border-input bg-background px-2 text-sm"
                    >
                      <option value="">Saiba mais</option>
                      <option value="Cadastre-se">Cadastre-se</option>
                      <option value="Compre agora">Compre agora</option>
                      <option value="Baixar agora">Baixar agora</option>
                      <option value="Assista">Assista</option>
                      <option value="Reserve agora">Reserve agora</option>
                      <option value="Contate-nos">Contate-nos</option>
                    </select>
                    <input
                      value={ctaUrl}
                      onChange={(e) => setCtaUrl(e.target.value)}
                      placeholder="https://seusite.com"
                      inputMode="url"
                      maxLength={500}
                      className="h-9 rounded-md border border-input bg-background px-2 text-sm"
                    />
                  </div>
                </div>
              )}

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

              <Tabs defaultValue="packages" className="w-full">
                <TabsList className="grid grid-cols-2 w-full">
                  <TabsTrigger value="packages">Pacotes</TabsTrigger>
                  <TabsTrigger value="custom"><Sparkles className="size-3.5 mr-1" />Personalizado</TabsTrigger>
                </TabsList>

                <TabsContent value="packages" className="space-y-2.5 mt-3">
                  {PACKAGES.map((p) => {
                    const converted = convertFromBRL(p.priceBRL, currency);
                    const perView = convertFromBRL(p.priceBRL / p.views, currency);
                    return (
                      <button
                        key={p.key}
                        disabled={!!loading}
                        onClick={() => pickPackage(p.key)}
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
                </TabsContent>

                <TabsContent value="custom" className="space-y-4 mt-3">
                  <div className="rounded-xl border border-pink-500/30 bg-gradient-to-br from-pink-500/5 to-amber-500/5 p-3">
                    <div className="flex items-baseline justify-between">
                      <div>
                        <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Estimativa</p>
                        <p className="text-2xl font-bold">{estimatedViews.toLocaleString("pt-BR")} <span className="text-xs font-normal text-muted-foreground">views</span></p>
                      </div>
                      <div className="text-right">
                        <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Total</p>
                        <p className="text-2xl font-bold">R$ {budget.toFixed(2).replace(".", ",")}</p>
                        <p className="text-[10px] text-muted-foreground">CPM R$ {(cpmCents/100).toFixed(2).replace(".", ",")}</p>
                      </div>
                    </div>
                  </div>

                  <Field label={`Orçamento: R$ ${budget.toFixed(2).replace(".", ",")}`}>
                    <Slider min={10} max={500} step={5} value={[budget]} onValueChange={(v) => setBudget(v[0])} />
                    <div className="flex justify-between text-[10px] text-muted-foreground mt-1"><span>R$ 10</span><span>R$ 500</span></div>
                  </Field>

                  <Field label={`Duração: ${days} ${days === 1 ? "dia" : "dias"}`}>
                    <Slider min={1} max={30} step={1} value={[days]} onValueChange={(v) => setDays(v[0])} />
                    <div className="flex justify-between text-[10px] text-muted-foreground mt-1"><span>1 dia</span><span>30 dias</span></div>
                  </Field>

                  <Field label={`Estados (${states.length === 0 ? "Brasil todo" : `${states.length} selecionados`})`}>
                    <div className="flex flex-wrap gap-1.5 max-h-32 overflow-y-auto">
                      <button
                        type="button"
                        onClick={() => setStates([])}
                        className={`text-[10px] px-2 py-1 rounded-full border transition ${states.length === 0 ? "bg-primary text-primary-foreground border-primary" : "border-border hover:bg-accent"}`}
                      >Brasil todo</button>
                      {BR_STATES.map((s) => (
                        <button
                          key={s.code}
                          type="button"
                          onClick={() => toggleState(s.code)}
                          className={`text-[10px] px-2 py-1 rounded-full border transition ${states.includes(s.code) ? "bg-primary text-primary-foreground border-primary" : "border-border hover:bg-accent"}`}
                        >{s.code}</button>
                      ))}
                    </div>
                  </Field>

                  <Field label={`Idade: ${ageMin} – ${ageMax} anos`}>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <p className="text-[10px] text-muted-foreground mb-1">Mínima</p>
                        <Slider min={13} max={80} step={1} value={[ageMin]} onValueChange={(v) => setAgeMin(v[0])} />
                      </div>
                      <div>
                        <p className="text-[10px] text-muted-foreground mb-1">Máxima</p>
                        <Slider min={13} max={80} step={1} value={[ageMax]} onValueChange={(v) => setAgeMax(v[0])} />
                      </div>
                    </div>
                  </Field>

                  <Field label="Gênero">
                    <div className="grid grid-cols-3 gap-2">
                      {([
                        { v: "all", l: "Ambos" },
                        { v: "male", l: "Masculino" },
                        { v: "female", l: "Feminino" },
                      ] as { v: BoostGender; l: string }[]).map((g) => (
                        <button
                          key={g.v}
                          type="button"
                          onClick={() => setGender(g.v)}
                          className={`h-9 rounded-md border text-xs font-medium transition ${gender === g.v ? "bg-primary text-primary-foreground border-primary" : "border-border hover:bg-accent"}`}
                        >{g.l}</button>
                      ))}
                    </div>
                  </Field>

                  <Field label="Objetivo">
                    <div className="grid grid-cols-1 gap-1.5">
                      {OBJECTIVES.map((o) => (
                        <button
                          key={o.key}
                          type="button"
                          onClick={() => setObjective(o.key)}
                          className={`flex items-center gap-2 px-3 py-2 rounded-md border text-xs text-left transition ${objective === o.key ? "bg-primary/10 border-primary" : "border-border hover:bg-accent"}`}
                        >
                          <span className="text-base">{o.emoji}</span>
                          <span className="flex-1">{o.label}</span>
                          {o.premium && <span className="text-[9px] bg-amber-500/20 text-amber-700 dark:text-amber-400 px-1.5 py-0.5 rounded-full">+30%</span>}
                        </button>
                      ))}
                    </div>
                  </Field>

                  <Button
                    className="w-full bg-gradient-to-r from-pink-500 to-amber-500 text-white hover:opacity-90"
                    onClick={pickCustom}
                    disabled={!!loading || estimatedViews < 1}
                  >
                    {loading === "custom" ? <Loader2 className="size-4 animate-spin" /> : <><Rocket className="size-4 mr-2" />Impulsionar por R$ {budget.toFixed(2).replace(".", ",")}</>}
                  </Button>
                  <p className="text-[10px] text-muted-foreground leading-relaxed">
                    CPM base R$ 50/1k views. Estados, gênero, idade e objetivo premium ajustam o preço.
                  </p>
                </TabsContent>
              </Tabs>
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

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="text-xs font-medium mb-2">{label}</p>
      {children}
    </div>
  );
}
