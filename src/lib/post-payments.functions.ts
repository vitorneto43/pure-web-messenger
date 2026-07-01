import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { type StripeEnv, createStripeClient } from "@/lib/stripe.server";
import { calculateCpm, estimateViews } from "@/lib/boost-pricing";
import { convertFromBRL, type Currency } from "@/lib/currency";

const SUPPORTED_CURRENCIES = ["BRL","USD","EUR","GBP","MXN","INR","JPY","CNY","SAR"] as const;
function toStripeMinorUnits(amount: number, currency: Currency): number {
  if (currency === "JPY") return Math.round(amount);
  return Math.round(amount * 100);
}
const PACKAGES = {
  boost_100: { views: 100, amount_cents: 500 },
  boost_500: { views: 500, amount_cents: 1500 },
  boost_2000: { views: 2000, amount_cents: 5000 },
} as const;
type BoostPackage = keyof typeof PACKAGES;

const customSchema = z.object({
  budgetCents: z.number().int().min(1000).max(50000),
  durationDays: z.number().int().min(1).max(30),
  countries: z.array(z.string().regex(/^[A-Z]{2}$/)).max(250),
  states: z.array(z.string().min(1).max(8).regex(/^[A-Z0-9]+$/)).max(60),
  ageMin: z.number().int().min(13).max(80),
  ageMax: z.number().int().min(13).max(80),
  gender: z.enum(["male", "female", "all"]),
  objective: z.enum(["views","comments","profile_visits","chat","network","website","cross_platform"]),
  interests: z.array(z.string().min(1).max(40)).max(20).optional(),
});
const inputSchema = z.object({
  postId: z.string().uuid(),
  package: z.enum(["boost_100","boost_500","boost_2000","custom"]),
  returnUrl: z.string().url(),
  environment: z.enum(["sandbox","live"]),
  currency: z.enum(SUPPORTED_CURRENCIES).optional(),
  custom: customSchema.optional(),
});

export const createPostBoostCheckout = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: z.infer<typeof inputSchema>) => inputSchema.parse(data))
  .handler(async ({ data, context }) => {
    const { supabase, userId, claims } = context as { supabase: any; userId: string; claims: { email?: string } };

    const { data: post, error: postErr } = await supabase
      .from("posts").select("id, user_id").eq("id", data.postId).maybeSingle();
    if (postErr || !post) throw new Error("Post não encontrado");
    if (post.user_id !== userId) throw new Error("Você não é dono deste post");

    const isCustom = data.package === "custom";
    if (isCustom && !data.custom) throw new Error("Parâmetros do impulso ausentes");
    if (data.custom && data.custom.ageMin > data.custom.ageMax) throw new Error("Faixa etária inválida");

    let views: number; let amountCents: number; let cpmCents: number | null = null;
    if (isCustom) {
      const c = data.custom!;
      cpmCents = calculateCpm({ countries: c.countries, states: c.states, ageMin: c.ageMin, ageMax: c.ageMax, gender: c.gender, objective: c.objective, interests: c.interests });
      views = estimateViews({ ...c, interests: c.interests });
      if (views < 1) throw new Error("Orçamento muito baixo");
      amountCents = c.budgetCents * c.durationDays;
    } else {
      const pack = PACKAGES[data.package as BoostPackage];
      views = pack.views; amountCents = pack.amount_cents;
    }

    const targetCurrency: Currency = (data.currency ?? "BRL") as Currency;
    const amountInTarget = convertFromBRL(amountCents / 100, targetCurrency);
    const stripeAmount = toStripeMinorUnits(amountInTarget, targetCurrency);
    const stripeCurrency = targetCurrency.toLowerCase();

    const boostRow: Record<string, unknown> = {
      post_id: data.postId,
      user_id: userId,
      package: data.package,
      views_total: views,
      views_remaining: views,
      amount_cents: stripeAmount,
      currency: stripeCurrency,
      status: "pending",
      environment: data.environment,
      boost_type: isCustom ? "custom" : "package",
    };
    if (isCustom && data.custom) {
      const c = data.custom;
      boostRow.duration_days = c.durationDays;
      boostRow.target_countries = c.countries;
      boostRow.target_states = c.states;
      boostRow.target_age_min = c.ageMin;
      boostRow.target_age_max = c.ageMax;
      boostRow.target_gender = c.gender;
      boostRow.objective = c.objective;
      boostRow.cpm_cents = cpmCents;
      boostRow.ends_at = new Date(Date.now() + c.durationDays * 24 * 3600 * 1000).toISOString();
    }

    const { data: boost, error: boostErr } = await supabase
      .from("post_boosts").insert(boostRow).select("id").single();
    if (boostErr || !boost) throw new Error("Falha ao registrar impulso");
    const boostId = boost.id;

    const stripe = createStripeClient(data.environment as StripeEnv);
    const safeUserId = userId.replace(/[^a-zA-Z0-9_-]/g, "");
    let customerId: string | undefined;
    try {
      const found = await stripe.customers.search({ query: `metadata['userId']:'${safeUserId}'`, limit: 1 });
      if (found?.data?.length) customerId = found.data[0].id;
    } catch {}
    if (!customerId && claims.email) {
      const ex = await stripe.customers.list({ email: claims.email, limit: 1 });
      if (ex?.data?.length) customerId = ex.data[0].id;
    }
    if (!customerId) {
      const created = await stripe.customers.create({ ...(claims.email && { email: claims.email }), metadata: { userId } });
      customerId = created.id;
    }

    const productName = isCustom
      ? `WaveChat Post Boost · ${views.toLocaleString("pt-BR")} views / ${data.custom!.durationDays}d`
      : `WaveChat Post Boost · ${views.toLocaleString("pt-BR")} views`;

    const session = await stripe.checkout.sessions.create({
      line_items: [{
        price_data: { currency: stripeCurrency, unit_amount: stripeAmount, product_data: { name: productName } },
        quantity: 1,
      }],
      mode: "payment",
      ui_mode: "embedded_page",
      return_url: data.returnUrl,
      customer: customerId,
      payment_intent_data: { description: productName },
      metadata: {
        userId,
        boostId,
        postId: data.postId,
        targetKind: "post",
        package: data.package,
        currency: stripeCurrency,
      },
    });

    await supabase.from("post_boosts").update({ checkout_session_id: session.id }).eq("id", boostId);
    return { clientSecret: session.client_secret, boostId };
  });
