import { createFileRoute } from "@tanstack/react-router";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import { createStripeClient } from "@/lib/stripe.server";

// Refunds the unused portion of active boosts whose status has expired
// with views_remaining > 0. Designed to be called by pg_cron every 15 min.
//
// Auth: header `x-cron-secret` must match CRON_SECRET env var.
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

        // Find active boosts on expired statuses with leftover views
        const { data: stale, error } = await sb
          .from("status_boosts")
          .select(
            "id, user_id, transaction_id, amount_cents, views_total, views_remaining, statuses!inner(expires_at)",
          )
          .eq("status", "active")
          .gt("views_remaining", 0)
          .lt("statuses.expires_at", new Date().toISOString())
          .limit(50);

        if (error) {
          console.error("[refund-sweeper] query error", error);
          return new Response(JSON.stringify({ error: error.message }), { status: 500 });
        }
        if (!stale?.length) {
          return Response.json({ refunded: 0 });
        }

        const stripe = createStripeClient("sandbox");
        let refundedCount = 0;
        const errors: string[] = [];

        for (const b of stale) {
          // Proportional refund: amount * (remaining / total)
          const refundCents = Math.floor(
            (b.amount_cents * b.views_remaining) / b.views_total,
          );
          if (refundCents <= 0 || !b.transaction_id) {
            // Nothing to refund — just mark completed
            await sb
              .from("status_boosts")
              .update({ status: "completed" })
              .eq("id", b.id)
              .eq("status", "active");
            continue;
          }
          try {
            await stripe.refunds.create({
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
            refundedCount++;
          } catch (e: any) {
            console.error("[refund-sweeper] refund failed", b.id, e.message);
            errors.push(`${b.id}: ${e.message}`);
          }
        }

        return Response.json({ refunded: refundedCount, errors });
      },
    },
  },
});
