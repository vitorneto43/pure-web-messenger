import { createFileRoute } from "@tanstack/react-router";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import { type StripeEnv, createStripeClient } from "@/lib/stripe.server";

// Refunds unused portion of active boosts whose status expired with views left.
// Also cleans up stale pending boosts (>1h old). Auth via x-cron-secret header.
export const Route = createFileRoute("/api/public/payments/refund-sweeper")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const provided = request.headers.get("x-cron-secret");
        const expected = process.env.CRON_SECRET;
        if (!expected || provided !== expected) {
          return new Response("Unauthorized", { status: 401 });
        }

        const sb = createClient<Database>(
          process.env.SUPABASE_URL!,
          process.env.SUPABASE_SERVICE_ROLE_KEY!,
        );

        // 1. Cleanup stale pending boosts (>1h old, never paid)
        const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
        const { count: cleaned } = await sb
          .from("status_boosts")
          .delete({ count: "exact" })
          .eq("status", "pending")
          .lt("created_at", oneHourAgo);

        // 2. Find active boosts on expired statuses with leftover views
        const { data: stale, error } = await sb
          .from("status_boosts")
          .select(
            "id, user_id, transaction_id, amount_cents, views_total, views_remaining, environment, statuses!inner(expires_at)",
          )
          .eq("status", "active")
          .gt("views_remaining", 0)
          .lt("statuses.expires_at", new Date().toISOString())
          .limit(50);

        if (error) {
          return new Response(JSON.stringify({ error: error.message }), { status: 500 });
        }
        if (!stale?.length) {
          return Response.json({ refunded: 0, cleaned: cleaned ?? 0 });
        }

        // Cache stripe clients per env to avoid recreating
        const clients = new Map<StripeEnv, ReturnType<typeof createStripeClient>>();
        const getStripe = (env: StripeEnv) => {
          let c = clients.get(env);
          if (!c) {
            c = createStripeClient(env);
            clients.set(env, c);
          }
          return c;
        };

        let refundedCount = 0;
        const errors: string[] = [];

        for (const b of stale) {
          const refundCents = Math.floor((b.amount_cents * b.views_remaining) / b.views_total);
          if (refundCents <= 0 || !b.transaction_id) {
            await sb
              .from("status_boosts")
              .update({ status: "completed" })
              .eq("id", b.id)
              .eq("status", "active");
            continue;
          }
          const env = (b.environment === "live" ? "live" : "sandbox") as StripeEnv;
          try {
            await getStripe(env).refunds.create({
              payment_intent: b.transaction_id,
              amount: refundCents,
              reason: "requested_by_customer",
              metadata: { boostId: b.id, reason: "status_expired_with_remaining_views" },
            });
            await sb
              .from("status_boosts")
              .update({
                status: "refunded",
                refunded_amount_cents: refundCents,
                refunded_at: new Date().toISOString(),
                refund_reason: "status_expired",
              })
              .eq("id", b.id)
              .eq("status", "active");
            await sb.from("notifications").insert({
              user_id: b.user_id,
              type: "boost",
              title: "Reembolso automático",
              body: `Seu status expirou com views sobrando. Reembolsamos R$ ${(refundCents / 100).toFixed(2).replace(".", ",")}.`,
              data: { boostId: b.id, amount_cents: refundCents, reason: "status_expired" } as any,
            });
            refundedCount++;
          } catch (e: any) {
            console.error("[refund-sweeper] failed", b.id, e.message);
            errors.push(`${b.id}: ${e.message}`);
          }
        }

        return Response.json({ refunded: refundedCount, cleaned: cleaned ?? 0, errors });
      },
    },
  },
});
