import { useEffect, useMemo, useState } from "react";
import { Loader2, Check, Rocket, Gift, Sparkles, Globe2, Search, ShieldCheck } from "lucide-react";
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
import { scanContent } from "@/lib/content-moderation.functions";
import { PaymentTestModeBanner } from "@/components/PaymentTestModeBanner";
import { supabase } from "@/integrations/supabase/client";
import { currentLocale } from "@/i18n";
import { convertFromBRL, currencyForLocale, formatMoney } from "@/lib/currency";
import { FeatureTip } from "@/components/FeatureTip";
import {
  OBJECTIVES,
  calculateCpm,
  estimateViews,
  type BoostObjective,
  type BoostGender,
} from "@/lib/boost-pricing";
import {
  ALL_COUNTRIES,
  SUBDIVISIONS,
  getCountryName,
  flagEmoji,
} from "@/lib/world-regions";
import { INTERESTS } from "@/lib/interests";

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

  // Custom boost state — budget kept internally in BRL; displayed in user currency.
  const [budget, setBudget] = useState<number>(20);
  const [days, setDays] = useState<number>(7);
  const [countries, setCountries] = useState<string[]>([]); // [] = worldwide
  const [countrySearch, setCountrySearch] = useState("");
  const [states, setStates] = useState<string[]>([]);
  const [ageMin, setAgeMin] = useState<number>(18);
  const [ageMax, setAgeMax] = useState<number>(55);
  const [gender, setGender] = useState<BoostGender>("all");
  const [objective, setObjective] = useState<BoostObjective>("views");
  const [interests, setInterests] = useState<string[]>([]);
  const [reviewing, setReviewing] = useState(false);

  const startCheckout = useServerFn(createBoostCheckout);
  const moderate = useServerFn(scanContent);

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

  // If a single country is chosen and has subdivisions, allow state selection.
  const stateCountry = countries.length === 1 ? countries[0] : null;
  const availableStates = stateCountry ? SUBDIVISIONS[stateCountry] ?? [] : [];

  // Reset states when country selection changes such that they no longer apply.
  useEffect(() => {
    if (states.length > 0 && availableStates.length === 0) setStates([]);
    if (states.length > 0 && availableStates.length > 0) {
      const valid = new Set(availableStates.map((s) => s.code));
      const filtered = states.filter((s) => valid.has(s));
      if (filtered.length !== states.length) setStates(filtered);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stateCountry]);

  const customInput = useMemo(() => ({
    budgetCents: Math.round(budget * 100),
    durationDays: days,
    countries,
    states,
    ageMin,
    ageMax,
    gender,
    objective,
    interests,
  }), [budget, days, countries, states, ageMin, ageMax, gender, objective, interests]);

  const estimatedViews = useMemo(() => estimateViews(customInput), [customInput]);
  const cpmCents = useMemo(() => calculateCpm(customInput), [customInput]);

  // Sorted country list (localized) with optional search filter.
  const countryList = useMemo(() => {
    const items = ALL_COUNTRIES.map((c) => ({
      code: c,
      name: getCountryName(c, locale),
      flag: flagEmoji(c),
    }));
    items.sort((a, b) => a.name.localeCompare(b.name, locale));
    const q = countrySearch.trim().toLowerCase();
    if (!q) return items;
    return items.filter(
      (c) => c.name.toLowerCase().includes(q) || c.code.toLowerCase().includes(q),
    );
  }, [locale, countrySearch]);

  const dailyUserCcy = convertFromBRL(budget, currency);
  const totalUserCcy = convertFromBRL(budget * days, currency);
  const budgetUserCcy = dailyUserCcy;
  const cpmUserCcy = convertFromBRL(cpmCents / 100, currency);


  async function saveCta(): Promise<boolean> {
    const trimmed = ctaUrl.trim();
    let url: string | null = null;
    if (trimmed) {
      try {
        const u = new URL(trimmed.startsWith("http") ? trimmed : `https://${trimmed}`);
        if (!/^https?:$/.test(u.protocol)) throw new Error();
        url = u.toString();
      } catch {
        toast.error(t("boost.cta.invalidLink"));
        return false;
      }
    }
    const label = ctaLabel.trim().slice(0, 30) || (url ? t("boost.cta.learnMore") : null);
    const { error } = await (supabase as any)
      .from("statuses")
      .update({ cta_url: url, cta_label: label })
      .eq("id", statusId);
    if (error) {
      toast.error(t("boost.cta.saveFail"), { description: error.message });
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
          currency,
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
      toast.error(t("boost.custom.ageInvalid"));
      return;
    }
    if (estimatedViews < 1) {
      toast.error(t("boost.custom.budgetTooLow"));
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
          currency,
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

  function toggleCountry(code: string) {
    setCountries((cur) =>
      cur.includes(code) ? cur.filter((c) => c !== code) : [...cur, code],
    );
  }
  function toggleState(code: string) {
    setStates((cur) => (cur.includes(code) ? cur.filter((c) => c !== code) : [...cur, code]));
  }

  function close(v: boolean) {
    if (!v) {
      setClientSecret(null);
      setLoading(null);
    }
    onOpenChange(v);
  }

  const dayUnit = days === 1 ? t("boost.custom.day_one") : t("boost.custom.day_other");

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

          <FeatureTip id="boost-status" title="Como funciona o Impulso" className="mt-3">
            O impulso entrega seu Stories para mais pessoas fora do seu círculo. O valor
            é cobrado <b>uma única vez</b> e o alcance é estimado — não há cobrança recorrente.
          </FeatureTip>



          {!clientSecret ? (
            <div className="mt-4 space-y-3">
              {(statusKind === "image" || statusKind === "video") && (
                <div className="rounded-xl border border-border bg-muted/30 p-3 space-y-2">
                  <div className="flex items-center justify-between">
                    <p className="text-xs font-semibold">{t("boost.cta.heading")}</p>
                    <span className="text-[10px] text-muted-foreground">{t("boost.cta.aside")}</span>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <select
                      value={ctaLabel}
                      onChange={(e) => setCtaLabel(e.target.value)}
                      className="h-9 rounded-md border border-input bg-background px-2 text-sm"
                    >
                      <option value="">{t("boost.cta.learnMore")}</option>
                      <option value={t("boost.cta.signUp")}>{t("boost.cta.signUp")}</option>
                      <option value={t("boost.cta.buyNow")}>{t("boost.cta.buyNow")}</option>
                      <option value={t("boost.cta.download")}>{t("boost.cta.download")}</option>
                      <option value={t("boost.cta.watch")}>{t("boost.cta.watch")}</option>
                      <option value={t("boost.cta.book")}>{t("boost.cta.book")}</option>
                      <option value={t("boost.cta.contact")}>{t("boost.cta.contact")}</option>
                    </select>
                    <input
                      value={ctaUrl}
                      onChange={(e) => setCtaUrl(e.target.value)}
                      placeholder={t("boost.cta.placeholderSite")}
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
                  <TabsTrigger value="packages">{t("boost.tabs.packages")}</TabsTrigger>
                  <TabsTrigger value="custom"><Sparkles className="size-3.5 mr-1" />{t("boost.tabs.custom")}</TabsTrigger>
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
                        <p className="text-[10px] uppercase tracking-wider text-muted-foreground">{t("boost.custom.estimate")}</p>
                        <p className="text-2xl font-bold">
                          {estimatedViews.toLocaleString(locale)}{" "}
                          <span className="text-xs font-normal text-muted-foreground">{t("boost.custom.views")}</span>
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="text-[10px] uppercase tracking-wider text-muted-foreground">{t("boost.custom.total")}</p>
                        <p className="text-2xl font-bold">{formatMoney(totalUserCcy, currency, locale)}</p>
                        <p className="text-[10px] text-muted-foreground">
                          {t("boost.custom.cpm", { price: formatMoney(cpmUserCcy, currency, locale) })}
                        </p>
                      </div>
                    </div>
                  </div>

                  <Field label={t("boost.custom.budget", { price: formatMoney(budgetUserCcy, currency, locale) })}>
                    <Slider min={10} max={500} step={5} value={[budget]} onValueChange={(v) => setBudget(v[0])} />
                    <div className="flex justify-between text-[10px] text-muted-foreground mt-1">
                      <span>{formatMoney(convertFromBRL(10, currency), currency, locale)}</span>
                      <span>{formatMoney(convertFromBRL(500, currency), currency, locale)}</span>
                    </div>
                  </Field>

                  <Field label={t("boost.custom.duration", { count: days, unit: dayUnit })}>
                    <Slider min={1} max={30} step={1} value={[days]} onValueChange={(v) => setDays(v[0])} />
                    <div className="flex justify-between text-[10px] text-muted-foreground mt-1">
                      <span>1 {t("boost.custom.day_one")}</span>
                      <span>30 {t("boost.custom.day_other")}</span>
                    </div>
                  </Field>

                  <Field
                    label={
                      countries.length === 0
                        ? `${t("boost.custom.countries")} · ${t("boost.custom.worldwide")}`
                        : `${t("boost.custom.countries")} · ${t("boost.custom.countriesSelected", { count: countries.length })}`
                    }
                  >
                    <div className="flex items-center gap-2 mb-2">
                      <button
                        type="button"
                        onClick={() => {
                          setCountries([]);
                          setStates([]);
                        }}
                        className={`text-[10px] px-2 py-1 rounded-full border transition flex items-center gap-1 ${countries.length === 0 ? "bg-primary text-primary-foreground border-primary" : "border-border hover:bg-accent"}`}
                      >
                        <Globe2 className="size-3" /> {t("boost.custom.worldwide")}
                      </button>
                      <div className="flex-1 relative">
                        <Search className="size-3 absolute left-2 top-1/2 -translate-y-1/2 text-muted-foreground" />
                        <input
                          value={countrySearch}
                          onChange={(e) => setCountrySearch(e.target.value)}
                          placeholder={t("boost.custom.searchCountry")}
                          className="w-full h-7 pl-6 pr-2 text-[11px] rounded-md border border-input bg-background"
                        />
                      </div>
                    </div>
                    <div className="max-h-40 overflow-y-auto rounded-md border border-border bg-background/50 p-1.5">
                      <div className="flex flex-wrap gap-1">
                        {countryList.map((c) => {
                          const active = countries.includes(c.code);
                          return (
                            <button
                              key={c.code}
                              type="button"
                              onClick={() => toggleCountry(c.code)}
                              className={`text-[10px] px-2 py-1 rounded-full border transition inline-flex items-center gap-1 max-w-full ${active ? "bg-primary text-primary-foreground border-primary" : "border-border hover:bg-accent"}`}
                              title={c.name}
                            >
                              <span aria-hidden>{c.flag}</span>
                              <span className="truncate max-w-[120px]">{c.name}</span>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  </Field>

                  {stateCountry && (
                    <Field
                      label={
                        availableStates.length === 0
                          ? `${t("boost.custom.states")} · ${t("boost.custom.statesNoData")}`
                          : states.length === 0
                            ? `${t("boost.custom.states")} · ${t("boost.custom.statesAll")}`
                            : `${t("boost.custom.states")} · ${t("boost.custom.statesSelected", { count: states.length })}`
                      }
                    >
                      {availableStates.length > 0 && (
                        <div className="flex flex-wrap gap-1.5 max-h-32 overflow-y-auto">
                          <button
                            type="button"
                            onClick={() => setStates([])}
                            className={`text-[10px] px-2 py-1 rounded-full border transition ${states.length === 0 ? "bg-primary text-primary-foreground border-primary" : "border-border hover:bg-accent"}`}
                          >
                            {t("boost.custom.statesAll")}
                          </button>
                          {availableStates.map((s) => (
                            <button
                              key={s.code}
                              type="button"
                              onClick={() => toggleState(s.code)}
                              className={`text-[10px] px-2 py-1 rounded-full border transition ${states.includes(s.code) ? "bg-primary text-primary-foreground border-primary" : "border-border hover:bg-accent"}`}
                              title={s.name}
                            >
                              {s.code}
                            </button>
                          ))}
                        </div>
                      )}
                    </Field>
                  )}

                  <Field label={t("boost.custom.age", { min: ageMin, max: ageMax })}>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <p className="text-[10px] text-muted-foreground mb-1">{t("boost.custom.ageMin")}</p>
                        <Slider min={13} max={80} step={1} value={[ageMin]} onValueChange={(v) => setAgeMin(v[0])} />
                      </div>
                      <div>
                        <p className="text-[10px] text-muted-foreground mb-1">{t("boost.custom.ageMax")}</p>
                        <Slider min={13} max={80} step={1} value={[ageMax]} onValueChange={(v) => setAgeMax(v[0])} />
                      </div>
                    </div>
                  </Field>

                  <Field label={t("boost.custom.gender")}>
                    <div className="grid grid-cols-3 gap-2">
                      {([
                        { v: "all", l: t("boost.custom.genderAll") },
                        { v: "male", l: t("boost.custom.genderMale") },
                        { v: "female", l: t("boost.custom.genderFemale") },
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

                  <Field label={t("boost.custom.objective")}>
                    <div className="grid grid-cols-1 gap-1.5">
                      {OBJECTIVES.map((o) => (
                        <button
                          key={o.key}
                          type="button"
                          onClick={() => setObjective(o.key)}
                          className={`flex items-center gap-2 px-3 py-2 rounded-md border text-xs text-left transition ${objective === o.key ? "bg-primary/10 border-primary" : "border-border hover:bg-accent"}`}
                        >
                          <span className="text-base">{o.emoji}</span>
                          <span className="flex-1">{t(o.i18nKey)}</span>
                          {o.premium && (
                            <span className="text-[9px] bg-amber-500/20 text-amber-700 dark:text-amber-400 px-1.5 py-0.5 rounded-full">
                              {t("boost.obj.premium")}
                            </span>
                          )}
                        </button>
                      ))}
                    </div>
                  </Field>

                  <Button
                    className="w-full bg-gradient-to-r from-pink-500 to-amber-500 text-white hover:opacity-90"
                    onClick={pickCustom}
                    disabled={!!loading || estimatedViews < 1}
                  >
                    {loading === "custom" ? (
                      <Loader2 className="size-4 animate-spin" />
                    ) : (
                      <>
                        <Rocket className="size-4 mr-2" />
                        {t("boost.custom.go", { price: formatMoney(totalUserCcy, currency, locale) })}
                      </>
                    )}
                  </Button>
                  <p className="text-[10px] text-muted-foreground leading-relaxed">
                    {t("boost.custom.pricingFootnote")}
                  </p>
                  {currency !== "BRL" && (
                    <p className="text-[10px] text-muted-foreground/70 leading-relaxed">
                      {t("boost.fxNotice")}
                    </p>
                  )}
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
