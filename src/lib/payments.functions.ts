import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { type StripeEnv, createStripeClient } from "@/lib/stripe.server";

const PACKAGES = {
  boost_100: { views: 100, amount_cents: 500 },
  boost_500: { views: 500, amount_cents: 1500 },
  boost_2000: { views: 2000, amount_cents: 5000 },
} as const;

type BoostPackage = keyof typeof PACKAGES;

const inputSchema = z.object({
  statusId: z.string().uuid(),
  package: z.enum(["boost_100", "boost_500", "boost_2000"]),
  returnUrl: z.string().url(),
  environment: z.enum(["sandbox", "live"]),
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

    // verify the user owns the status
    const { data: status, error: statusErr } = await supabase
      .from("statuses")
      .select("id, user_id, expires_at")
      .eq("id", data.statusId)
      .maybeSingle();
    if (statusErr || !status) throw new Error("Status não encontrado");
    if (status.user_id !== userId) throw new Error("Você não é dono deste status");
    if (new Date(status.expires_at) <= new Date()) throw new Error("Status já expirou");

    const pack = PACKAGES[data.package as BoostPackage];

    // Dedupe: reuse a recent pending boost (same status+package, last 10 min)
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

    let boostId: string;
    if (existing) {
      boostId = existing.id;
    } else {
      const { data: boost, error: boostErr } = await supabase
        .from("status_boosts")
        .insert({
          status_id: data.statusId,
          user_id: userId,
          package: data.package,
          views_total: pack.views,
          views_remaining: pack.views,
          amount_cents: pack.amount_cents,
          currency: "brl",
          status: "pending",
          environment: data.environment,
        })
        .select("id")
        .single();
      if (boostErr || !boost) throw new Error("Falha ao registrar impulso");
      boostId = boost.id;
    }

    const stripe = createStripeClient(data.environment as StripeEnv);
    const prices = await stripe.prices.list({ lookup_keys: [data.package] });
    if (!prices.data.length) throw new Error("Preço não encontrado");
    const stripePrice = prices.data[0];

    // resolve / create customer with userId metadata
    const safeUserId = userId.replace(/[^a-zA-Z0-9_-]/g, "");
    let customerId: string | undefined;
    const found = await stripe.customers.search({
      query: `metadata['userId']:'${safeUserId}'`,
      limit: 1,
    });
    if (found.data.length) {
      customerId = found.data[0].id;
    } else if (claims.email) {
      const existing = await stripe.customers.list({ email: claims.email, limit: 1 });
      if (existing.data.length) {
        customerId = existing.data[0].id;
        await stripe.customers.update(customerId, {
          metadata: { ...existing.data[0].metadata, userId },
        });
      }
    }
    if (!customerId) {
      const created = await stripe.customers.create({
        ...(claims.email && { email: claims.email }),
        metadata: { userId },
      });
      customerId = created.id;
    }

    const productId =
      typeof stripePrice.product === "string"
        ? stripePrice.product
        : stripePrice.product.id;
    const product = await stripe.products.retrieve(productId);

    const session = await stripe.checkout.sessions.create({
      line_items: [{ price: stripePrice.id, quantity: 1 }],
      mode: "payment",
      ui_mode: "embedded_page",
      return_url: data.returnUrl,
      customer: customerId,
      customer_update: { address: "auto", name: "auto" },
      automatic_tax: { enabled: true },
      payment_intent_data: { description: product.name },
      metadata: {
        userId,
        boostId,
        statusId: data.statusId,
        package: data.package,
      },
    });

    await supabase
      .from("status_boosts")
      .update({ checkout_session_id: session.id })
      .eq("id", boostId);

    return { clientSecret: session.client_secret, boostId };
  });
