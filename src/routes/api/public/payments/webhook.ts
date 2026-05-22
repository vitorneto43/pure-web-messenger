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

async function activateBoost(sessionOrTx: any, _env: StripeEnv) {
  const meta = sessionOrTx.metadata ?? {};
  const boostId: string | undefined = meta.boostId;
  if (!boostId) {
    console.log("[webhook] no boostId in metadata, skipping");
    return;
  }
  const sb = getSupabase();
  const { error } = await sb
    .from("status_boosts")
    .update({
      status: "active",
      activated_at: new Date().toISOString(),
      transaction_id: sessionOrTx.payment_intent ?? sessionOrTx.id ?? null,
    })
    .eq("id", boostId)
    .eq("status", "pending");
  if (error) console.error("[webhook] activate boost failed", error);
  else console.log("[webhook] boost activated", boostId);
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

async function handleWebhook(req: Request, env: StripeEnv) {
  const event = await verifyWebhook(req, env);
  switch (event.type) {
    case "checkout.session.completed":
    case "transaction.completed":
      await activateBoost(event.data.object, env);
      break;
    case "transaction.payment_failed":
    case "checkout.session.async_payment_failed":
    case "checkout.session.expired":
      await failBoost(event.data.object);
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
