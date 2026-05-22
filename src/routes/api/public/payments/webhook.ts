import { createFileRoute } from "@tanstack/react-router";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import { type StripeEnv, verifyWebhook } from "@/lib/stripe.server";

let _supabase: ReturnType<typeof createClient<Database>> | null = null;
function getSupabase() {
  if (!_supabase) {
    _supabase = createClient<Database>(
      process.env.SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
    );
  }
  return _supabase;
}

async function notify(userId: string, title: string, body: string, data: Record<string, unknown>) {
  await getSupabase().from("notifications").insert({
    user_id: userId,
    type: "boost",
    title,
    body,
    data: data as any,
  });
}

async function activateBoost(sessionOrTx: any, env: StripeEnv) {
  const meta = sessionOrTx.metadata ?? {};
  const boostId: string | undefined = meta.boostId;
  if (!boostId) return;
  const sb = getSupabase();
  const { data: updated, error } = await sb
    .from("status_boosts")
    .update({
      status: "active",
      activated_at: new Date().toISOString(),
      transaction_id: sessionOrTx.payment_intent ?? sessionOrTx.id ?? null,
      environment: env,
    })
    .eq("id", boostId)
    .eq("status", "pending")
    .select("user_id, views_total, package")
    .maybeSingle();
  if (error) {
    console.error("[webhook] activate failed", error);
    return;
  }
  if (updated) {
    await notify(
      updated.user_id,
      "Impulso ativado!",
      `Seu status agora aparece para mais ${updated.views_total} pessoas.`,
      { boostId, package: updated.package },
    );
  }
}

async function failBoost(sessionOrTx: any) {
  const meta = sessionOrTx.metadata ?? {};
  const boostId: string | undefined = meta.boostId;
  if (!boostId) return;
  await getSupabase()
    .from("status_boosts")
    .update({ status: "failed" })
    .eq("id", boostId)
    .eq("status", "pending");
}

async function handleChargeRefunded(charge: any) {
  const paymentIntentId = charge.payment_intent;
  if (!paymentIntentId) return;
  const sb = getSupabase();
  const { data: boost } = await sb
    .from("status_boosts")
    .select("id, user_id, status, amount_cents, refunded_amount_cents")
    .eq("transaction_id", paymentIntentId)
    .maybeSingle();
  if (!boost) return;
  if (boost.status === "refunded") return;

  const refundedTotal: number = charge.amount_refunded ?? boost.amount_cents;
  await sb
    .from("status_boosts")
    .update({
      status: "refunded",
      views_remaining: 0,
      refunded_amount_cents: refundedTotal,
      refunded_at: new Date().toISOString(),
      refund_reason: "manual",
    })
    .eq("id", boost.id);

  await notify(
    boost.user_id,
    "Reembolso processado",
    `Você recebeu R$ ${(refundedTotal / 100).toFixed(2).replace(".", ",")} de volta no impulso.`,
    { boostId: boost.id, amount_cents: refundedTotal, reason: "manual" },
  );
}

async function handleWebhook(req: Request, env: StripeEnv) {
  const event = await verifyWebhook(req, env);
  switch (event.type) {
    case "checkout.session.completed":
      await activateBoost(event.data.object, env);
      break;
    case "checkout.session.async_payment_failed":
    case "checkout.session.expired":
      await failBoost(event.data.object);
      break;
    case "charge.refunded":
      await handleChargeRefunded(event.data.object);
      break;
    default:
      console.log("[webhook] unhandled:", event.type);
  }
}

export const Route = createFileRoute("/api/public/payments/webhook")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const rawEnv = new URL(request.url).searchParams.get("env");
        if (rawEnv !== "sandbox" && rawEnv !== "live") {
          return Response.json({ received: true, ignored: "invalid env" });
        }
        try {
          await handleWebhook(request, rawEnv);
          return Response.json({ received: true });
        } catch (e) {
          console.error("[webhook] error", e);
          return new Response("Webhook error", { status: 400 });
        }
      },
    },
  },
});
