import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { type StripeEnv, createStripeClient } from "@/lib/stripe.server";
import { calculateCpm, estimateViews } from "@/lib/boost-pricing";
import { convertFromBRL, type Currency } from "@/lib/currency";

const SUPPORTED_CURRENCIES = [
  "BRL", "USD", "EUR", "GBP", "MXN", "INR", "JPY", "CNY", "SAR",
] as const;

// Stripe expects amounts in the currency's smallest unit. JPY is zero-decimal.
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
  objective: z.enum([
    "views",
    "comments",
    "profile_visits",
    "chat",
    "network",
    "website",
    "cross_platform",
  ]),
});


const inputSchema = z.object({
  statusId: z.string().uuid(),
  package: z.enum(["boost_100", "boost_500", "boost_2000", "custom"]),
  returnUrl: z.string().url(),
  environment: z.enum(["sandbox", "live"]),
  currency: z.enum(SUPPORTED_CURRENCIES).optional(),
  custom: customSchema.optional(),
});


export const createBoostCheckout = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: z.infer<typeof inputSchema>) => inputSchema.parse(data))
  .handler(async ({ data, context }) => {
    const { supabase, userId, claims } = context as {
      supabase: any;
      userId: string;
      claims: { email?: string };
    };

    const { data: status, error: statusErr } = await supabase
      .from("statuses")
      .select("id, user_id, expires_at")
      .eq("id", data.statusId)
      .maybeSingle();
    if (statusErr || !status) throw new Error("Status não encontrado");
    if (status.user_id !== userId) throw new Error("Você não é dono deste status");
    if (new Date(status.expires_at) <= new Date()) throw new Error("Status já expirou");

    const isCustom = data.package === "custom";
    if (isCustom && !data.custom) throw new Error("Parâmetros do impulso personalizado ausentes");
    if (data.custom && data.custom.ageMin > data.custom.ageMax) {
      throw new Error("Faixa etária inválida");
    }

    let views: number;
    let amountCents: number;
    let cpmCents: number | null = null;

    if (isCustom) {
      const c = data.custom!;
      cpmCents = calculateCpm({
        countries: c.countries,
        states: c.states,
        ageMin: c.ageMin,
        ageMax: c.ageMax,
        gender: c.gender,
        objective: c.objective,
      });
      views = estimateViews({ ...c });
      if (views < 1) throw new Error("Orçamento muito baixo para a segmentação escolhida");
      amountCents = c.budgetCents;
    } else {
      const pack = PACKAGES[data.package as BoostPackage];
      views = pack.views;
      amountCents = pack.amount_cents;
    }

    const tenMinAgo = new Date(Date.now() - 10 * 60 * 1000).toISOString();
    const { data: existing } = await supabase
      .from("status_boosts")
      .select("id")
      .eq("status_id", data.statusId)
      .eq("user_id", userId)
      .eq("status", "pending")
      .eq("package", data.package)
      .gte("created_at", tenMinAgo)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    // Convert the BRL-base price to the user's local currency. Stripe will
    // charge in this currency directly, so the embedded checkout matches
    // exactly what the user sees in the dialog.
    const targetCurrency: Currency = (data.currency ?? "BRL") as Currency;
    const amountInTarget = convertFromBRL(amountCents / 100, targetCurrency);
    const stripeAmount = toStripeMinorUnits(amountInTarget, targetCurrency);
    const stripeCurrency = targetCurrency.toLowerCase();

    const boostRow: Record<string, unknown> = {
      status_id: data.statusId,
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


    let boostId: string;
    if (existing) {
      boostId = existing.id;
      await supabase.from("status_boosts").update(boostRow).eq("id", boostId);
    } else {
      const { data: boost, error: boostErr } = await supabase
        .from("status_boosts")
        .insert(boostRow)
        .select("id")
        .single();
      if (boostErr || !boost) {
        console.error("[boost] insert failed", boostErr);
        throw new Error("Falha ao registrar impulso");
      }
      boostId = boost.id;
    }

    const stripe = createStripeClient(data.environment as StripeEnv);

    // resolve / create customer
    const safeUserId = userId.replace(/[^a-zA-Z0-9_-]/g, "");
    let customerId: string | undefined;
    try {
      const found = await stripe.customers.search({
        query: `metadata['userId']:'${safeUserId}'`,
        limit: 1,
      });
      if (found?.data?.length) customerId = found.data[0].id;
    } catch (e) {
      console.warn("[boost] customers.search failed", e);
    }
    if (!customerId && claims.email) {
      const existing = await stripe.customers.list({ email: claims.email, limit: 1 });
      if (existing?.data?.length) {
        customerId = existing.data[0].id;
        try {
          await stripe.customers.update(customerId, {
            metadata: { ...(existing.data[0].metadata ?? {}), userId },
          });
        } catch {}
      }
    }
    if (!customerId) {
      const created = await stripe.customers.create({
        ...(claims.email && { email: claims.email }),
        metadata: { userId },
      });
      customerId = created.id;
    }

    // Always use inline price_data so we can charge in the user's local
    // currency. Stripe products / lookup_keys are fixed in BRL and don't
    // support arbitrary per-checkout currencies.
    const productName = isCustom
      ? `WaveChat Boost · ${views.toLocaleString("pt-BR")} views / ${data.custom!.durationDays}d`
      : `WaveChat Boost · ${views.toLocaleString("pt-BR")} views`;
    const lineItems = [
      {
        price_data: {
          currency: stripeCurrency,
          unit_amount: stripeAmount,
          product_data: { name: productName },
        },
        quantity: 1,
      },
    ];
    const description = productName;

    const session = await stripe.checkout.sessions.create({
      line_items: lineItems,
      mode: "payment",
      ui_mode: "embedded_page",
      return_url: data.returnUrl,
      customer: customerId,
      payment_intent_data: { description },
      metadata: {
        userId,
        boostId,
        statusId: data.statusId,
        package: data.package,
        currency: stripeCurrency,
      },
    });


    await supabase
      .from("status_boosts")
      .update({ checkout_session_id: session.id })
      .eq("id", boostId);

    return { clientSecret: session.client_secret, boostId };
  });
