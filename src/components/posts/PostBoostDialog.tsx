import { useEffect, useMemo, useState } from "react";
import { Loader2, Check, Rocket, Sparkles, Globe2, Search, ShieldCheck } from "lucide-react";
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
import { createPostBoostCheckout } from "@/lib/post-payments.functions";
import { scanContent } from "@/lib/content-moderation.functions";
import { PaymentTestModeBanner } from "@/components/PaymentTestModeBanner";
import { supabase } from "@/integrations/supabase/client";
import { currentLocale } from "@/i18n";
import { convertFromBRL, currencyForLocale, formatMoney } from "@/lib/currency";
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

export function PostBoostDialog({ open, onOpenChange, postId }: { open: boolean; onOpenChange: (v: boolean) => void; postId: string }) {
  const { t } = useTranslation();
  const locale = currentLocale();
  const currency = currencyForLocale(locale);
  const [loading, setLoading] = useState<string | null>(null);
  const [clientSecret, setClientSecret] = useState<string | null>(null);
  const [postText, setPostText] = useState<string>("");

  const [budget, setBudget] = useState<number>(20);
  const [days, setDays] = useState<number>(7);
  const [countries, setCountries] = useState<string[]>([]);
  const [countrySearch, setCountrySearch] = useState("");
  const [states, setStates] = useState<string[]>([]);
  const [ageMin, setAgeMin] = useState<number>(18);
  const [ageMax, setAgeMax] = useState<number>(55);
  const [gender, setGender] = useState<BoostGender>("all");
  const [objective, setObjective] = useState<BoostObjective>("views");
  const [interests, setInterests] = useState<string[]>([]);
  const [ctaLabel, setCtaLabel] = useState<string>("");
  const [ctaUrl, setCtaUrl] = useState<string>("");
  const [reviewing, setReviewing] = useState(false);

  const startCheckout = useServerFn(createPostBoostCheckout);
  const moderate = useServerFn(scanContent);

  useEffect(() => {
    if (!open || !postId) return;
    (async () => {
      const { data } = await (supabase as any)
        .from("posts")
        .select("content, caption, hashtags, cta_label, cta_url")
        .eq("id", postId)
        .maybeSingle();
      if (data) {
        const tags = Array.isArray((data as any).hashtags)
          ? (data as any).hashtags.map((h: string) => "#" + h).join(" ")
          : "";
        setPostText([(data as any).content, (data as any).caption, tags].filter(Boolean).join(" · "));
        setCtaLabel((data as any).cta_label ?? "");
        setCtaUrl((data as any).cta_url ?? "");
      }
    })();
  }, [open, postId]);

  const stateCountry = countries.length === 1 ? countries[0] : null;
  const availableStates = stateCountry ? SUBDIVISIONS[stateCountry] ?? [] : [];

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
    countries, states, ageMin, ageMax, gender, objective, interests,
  }), [budget, days, countries, states, ageMin, ageMax, gender, objective, interests]);

  const estimatedViews = useMemo(() => estimateViews(customInput), [customInput]);
  const cpmCents = useMemo(() => calculateCpm(customInput), [customInput]);

  const countryList = useMemo(() => {
    const items = ALL_COUNTRIES.map((c) => ({ code: c, name: getCountryName(c, locale), flag: flagEmoji(c) }));
    items.sort((a, b) => a.name.localeCompare(b.name, locale));
    const q = countrySearch.trim().toLowerCase();
    if (!q) return items;
    return items.filter((c) => c.name.toLowerCase().includes(q) || c.code.toLowerCase().includes(q));
  }, [locale, countrySearch]);

  const dailyUserCcy = convertFromBRL(budget, currency);
  const totalUserCcy = convertFromBRL(budget * days, currency);
  const cpmUserCcy = convertFromBRL(cpmCents / 100, currency);

  async function saveCta(): Promise<boolean> {
    const trimmed = ctaUrl.trim();
    let url: string | null = null;
    if (trimmed) {
      try {
        const u = new URL(trimmed.startsWith("http") ? trimmed : `https://${trimmed}`);
        if (u.protocol !== "https:" && u.protocol !== "http:") throw new Error("bad protocol");
        url = u.toString();
      } catch {
        toast.error("Link do botão inválido");
        return false;
      }
    }
    const label = ctaLabel.trim().slice(0, 30) || (url ? "Saiba mais" : null);
    const { error } = await (supabase as any)
      .from("posts")
      .update({ cta_url: url, cta_label: label })
      .eq("id", postId);
    if (error) {
      toast.error("Falha ao salvar CTA", { description: error.message });
      return false;
    }
    return true;
  }

  async function runReview(): Promise<boolean> {
    setReviewing(true);
    try {
      const text = [postText, ctaLabel, ctaUrl].filter(Boolean).join(" · ");
      if (!text.trim()) return true;
      const verdict = await moderate({ data: { text, kind: "boost" } });
      if (verdict.verdict === "rejected") {
        toast.error("Impulso reprovado na análise", {
          description: `${verdict.reason || "Conteúdo contra as Diretrizes."} Consulte /diretrizes.`,
        });
        return false;
      }
      return true;
    } catch { return true; }
    finally { setReviewing(false); }
  }

  async function pickPackage(key: PackKey) {
    setLoading(key);
    try {
      const approved = await runReview();
      if (!approved) { setLoading(null); return; }
      const result = await startCheckout({ data: {
        postId, package: key,
        returnUrl: `${window.location.origin}/posts?boost=success&session_id={CHECKOUT_SESSION_ID}`,
        environment: getStripeEnvironment(), currency,
      } });
      if (!result.clientSecret) throw new Error("Missing clientSecret");
      setClientSecret(result.clientSecret);
    } catch (e: any) {
      toast.error(t("boost.checkoutFailed"), { description: e.message });
    } finally { setLoading(null); }
  }

  async function pickCustom() {
    if (ageMin > ageMax) { toast.error(t("boost.custom.ageInvalid")); return; }
    if (estimatedViews < 1) { toast.error(t("boost.custom.budgetTooLow")); return; }
    setLoading("custom");
    try {
      const approved = await runReview();
      if (!approved) { setLoading(null); return; }
      const result = await startCheckout({ data: {
        postId, package: "custom",
        returnUrl: `${window.location.origin}/posts?boost=success&session_id={CHECKOUT_SESSION_ID}`,
        environment: getStripeEnvironment(), currency,
        custom: customInput,
      } });
      if (!result.clientSecret) throw new Error("Missing clientSecret");
      setClientSecret(result.clientSecret);
    } catch (e: any) {
      toast.error(t("boost.checkoutFailed"), { description: e.message });
    } finally { setLoading(null); }
  }

  function toggleCountry(code: string) {
    setCountries((cur) => cur.includes(code) ? cur.filter((c) => c !== code) : [...cur, code]);
  }
  function toggleState(code: string) {
    setStates((cur) => cur.includes(code) ? cur.filter((c) => c !== code) : [...cur, code]);
  }

  function close(v: boolean) {
    if (!v) { setClientSecret(null); setLoading(null); }
    onOpenChange(v);
  }

  const dayUnit = days === 1 ? t("boost.custom.day_one") : t("boost.custom.day_other");

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
            <div className="mt-4">
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
                      <button key={p.key} disabled={!!loading} onClick={() => pickPackage(p.key)}
                        className={`w-full rounded-xl border p-4 text-left transition hover:border-primary hover:bg-accent/30 ${p.popular ? "border-primary/60 bg-primary/5" : "border-border"}`}>
                        <div className="flex items-center justify-between">
                          <div>
                            <div className="font-semibold flex items-center gap-2">
                              {t("boost.views", { count: p.views })}
                              {p.popular && (<span className="text-[10px] bg-primary text-primary-foreground px-1.5 py-0.5 rounded-full">{t("boost.popular")}</span>)}
                            </div>
                            <div className="text-xs text-muted-foreground mt-0.5">
                              {t("boost.perView", { price: formatMoney(perView, currency, locale) })}
                            </div>
                          </div>
                          <div className="text-right">
                            <div className="text-lg font-bold">{formatMoney(converted, currency, locale)}</div>
                            {loading === p.key ? <Loader2 className="size-4 animate-spin ml-auto mt-1" /> : <Check className="size-4 text-muted-foreground ml-auto mt-1 opacity-0" />}
                          </div>
                        </div>
                      </button>
                    );
                  })}
                  <p className="text-[11px] text-muted-foreground mt-3 leading-relaxed">{t("boost.footnote")}</p>
                  {currency !== "BRL" && (<p className="text-[10px] text-muted-foreground/70 leading-relaxed">{t("boost.fxNotice")}</p>)}
                </TabsContent>

                <TabsContent value="custom" className="space-y-4 mt-3">
                  <div className="rounded-xl border border-pink-500/30 bg-gradient-to-br from-pink-500/5 to-amber-500/5 p-3">
                    <div className="flex items-baseline justify-between">
                      <div>
                        <p className="text-[10px] uppercase tracking-wider text-muted-foreground">{t("boost.custom.estimate")}</p>
                        <p className="text-2xl font-bold">{estimatedViews.toLocaleString(locale)} <span className="text-xs font-normal text-muted-foreground">{t("boost.custom.views")}</span></p>
                      </div>
                      <div className="text-right">
                        <p className="text-[10px] uppercase tracking-wider text-muted-foreground">{t("boost.custom.total")}</p>
                        <p className="text-2xl font-bold">{formatMoney(totalUserCcy, currency, locale)}</p>
                        <p className="text-[10px] text-muted-foreground">{t("boost.custom.cpm", { price: formatMoney(cpmUserCcy, currency, locale) })}</p>
                      </div>
                    </div>
                  </div>

                  <Field label={t("boost.custom.budget", { price: formatMoney(dailyUserCcy, currency, locale) })}>
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

                  <Field label={countries.length === 0 ? `${t("boost.custom.countries")} · ${t("boost.custom.worldwide")}` : `${t("boost.custom.countries")} · ${t("boost.custom.countriesSelected", { count: countries.length })}`}>
                    <div className="flex items-center gap-2 mb-2">
                      <button type="button" onClick={() => { setCountries([]); setStates([]); }}
                        className={`text-[10px] px-2 py-1 rounded-full border transition flex items-center gap-1 ${countries.length === 0 ? "bg-primary text-primary-foreground border-primary" : "border-border hover:bg-accent"}`}>
                        <Globe2 className="size-3" /> {t("boost.custom.worldwide")}
                      </button>
                      <div className="flex-1 relative">
                        <Search className="size-3 absolute left-2 top-1/2 -translate-y-1/2 text-muted-foreground" />
                        <input value={countrySearch} onChange={(e) => setCountrySearch(e.target.value)} placeholder={t("boost.custom.searchCountry")} className="w-full h-7 pl-6 pr-2 text-[11px] rounded-md border border-input bg-background" />
                      </div>
                    </div>
                    <div className="max-h-40 overflow-y-auto rounded-md border border-border bg-background/50 p-1.5">
                      <div className="flex flex-wrap gap-1">
                        {countryList.map((c) => {
                          const active = countries.includes(c.code);
                          return (
                            <button key={c.code} type="button" onClick={() => toggleCountry(c.code)}
                              className={`text-[10px] px-2 py-1 rounded-full border transition inline-flex items-center gap-1 max-w-full ${active ? "bg-primary text-primary-foreground border-primary" : "border-border hover:bg-accent"}`}
                              title={c.name}>
                              <span aria-hidden>{c.flag}</span>
                              <span className="truncate max-w-[120px]">{c.name}</span>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  </Field>

                  {stateCountry && (
                    <Field label={availableStates.length === 0 ? `${t("boost.custom.states")} · ${t("boost.custom.statesNoData")}` : states.length === 0 ? `${t("boost.custom.states")} · ${t("boost.custom.statesAll")}` : `${t("boost.custom.states")} · ${t("boost.custom.statesSelected", { count: states.length })}`}>
                      {availableStates.length > 0 && (
                        <div className="flex flex-wrap gap-1.5 max-h-32 overflow-y-auto">
                          <button type="button" onClick={() => setStates([])} className={`text-[10px] px-2 py-1 rounded-full border transition ${states.length === 0 ? "bg-primary text-primary-foreground border-primary" : "border-border hover:bg-accent"}`}>{t("boost.custom.statesAll")}</button>
                          {availableStates.map((s) => (
                            <button key={s.code} type="button" onClick={() => toggleState(s.code)} className={`text-[10px] px-2 py-1 rounded-full border transition ${states.includes(s.code) ? "bg-primary text-primary-foreground border-primary" : "border-border hover:bg-accent"}`} title={s.name}>{s.code}</button>
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
                        <button key={g.v} type="button" onClick={() => setGender(g.v)}
                          className={`h-9 rounded-md border text-xs font-medium transition ${gender === g.v ? "bg-primary text-primary-foreground border-primary" : "border-border hover:bg-accent"}`}>{g.l}</button>
                      ))}
                    </div>
                  </Field>

                  <Field label={`Interesses · ${interests.length === 0 ? "todos" : `${interests.length} selecionado(s)`}`}>
                    <p className="text-[10px] text-muted-foreground mb-2">Mostre seu impulso para pessoas com esses interesses. Quanto mais focado, mais relevante (e +15–25% no CPM).</p>
                    <div className="flex flex-wrap gap-1.5 max-h-40 overflow-y-auto">
                      {INTERESTS.map((i) => {
                        const active = interests.includes(i.key);
                        return (
                          <button key={i.key} type="button"
                            onClick={() => setInterests((cur) => cur.includes(i.key) ? cur.filter((k) => k !== i.key) : [...cur, i.key])}
                            className={`text-[11px] px-2 py-1 rounded-full border transition inline-flex items-center gap-1 ${active ? "bg-primary text-primary-foreground border-primary" : "border-border hover:bg-accent"}`}>
                            <span aria-hidden>{i.emoji}</span>
                            <span>{i.label}</span>
                          </button>
                        );
                      })}
                    </div>
                  </Field>

                  <Field label={t("boost.custom.objective")}>
                    <div className="grid grid-cols-1 gap-1.5">
                      {OBJECTIVES.map((o) => (
                        <button key={o.key} type="button" onClick={() => setObjective(o.key)}
                          className={`flex items-center gap-2 px-3 py-2 rounded-md border text-xs text-left transition ${objective === o.key ? "bg-primary/10 border-primary" : "border-border hover:bg-accent"}`}>
                          <span className="text-base">{o.emoji}</span>
                          <span className="flex-1">{t(o.i18nKey)}</span>
                          {o.premium && (<span className="text-[9px] bg-amber-500/20 text-amber-700 dark:text-amber-400 px-1.5 py-0.5 rounded-full">{t("boost.obj.premium")}</span>)}
                        </button>
                      ))}
                    </div>
                  </Field>

                  {reviewing && (
                    <div className="rounded-lg border border-amber-500/40 bg-amber-500/10 p-3 flex items-start gap-2 text-xs">
                      <ShieldCheck className="size-4 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
                      <div>
                        <p className="font-semibold">Em análise…</p>
                        <p className="text-muted-foreground">Verificando se seu impulso segue as Diretrizes da Comunidade.</p>
                      </div>
                    </div>
                  )}

                  <Button className="w-full bg-gradient-to-r from-pink-500 to-amber-500 text-white hover:opacity-90"
                    onClick={pickCustom} disabled={!!loading || reviewing || estimatedViews < 1}>
                    {loading === "custom" ? <Loader2 className="size-4 animate-spin" /> : (<><Rocket className="size-4 mr-2" />{t("boost.custom.go", { price: formatMoney(totalUserCcy, currency, locale) })}</>)}
                  </Button>
                  <p className="text-[10px] text-muted-foreground leading-relaxed">{t("boost.custom.pricingFootnote")}</p>
                  {currency !== "BRL" && (<p className="text-[10px] text-muted-foreground/70 leading-relaxed">{t("boost.fxNotice")}</p>)}
                </TabsContent>
              </Tabs>
            </div>
          ) : (
            <div className="mt-4 -mx-2">
              <Button variant="ghost" size="sm" onClick={() => setClientSecret(null)} className="mb-2">← {t("common.back")}</Button>
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

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="text-xs font-medium mb-2">{label}</p>
      {children}
    </div>
  );
}
