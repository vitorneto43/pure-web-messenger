
-- Track which Stripe environment each boost was paid in
ALTER TABLE public.status_boosts
  ADD COLUMN IF NOT EXISTS environment TEXT NOT NULL DEFAULT 'sandbox';

CREATE INDEX IF NOT EXISTS idx_status_boosts_session
  ON public.status_boosts(checkout_session_id);

CREATE INDEX IF NOT EXISTS idx_status_boosts_pending_recent
  ON public.status_boosts(status_id, user_id, status, created_at);

CREATE INDEX IF NOT EXISTS idx_status_boosts_transaction
  ON public.status_boosts(transaction_id);
