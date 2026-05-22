
-- 1. Add refund tracking columns
ALTER TABLE public.status_boosts
  ADD COLUMN IF NOT EXISTS refunded_amount_cents INTEGER,
  ADD COLUMN IF NOT EXISTS refunded_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS refund_reason TEXT;

-- 2. Allow 'refunded' as a valid status value
ALTER TABLE public.status_boosts DROP CONSTRAINT IF EXISTS status_boosts_status_check;
ALTER TABLE public.status_boosts ADD CONSTRAINT status_boosts_status_check
  CHECK (status IN ('pending','active','completed','failed','refunded'));

-- 3. Schedule the refund sweeper to run every 15 minutes
CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

-- Unschedule existing job if it exists (safe re-run)
DO $$
BEGIN
  PERFORM cron.unschedule('boost-refund-sweeper');
EXCEPTION WHEN OTHERS THEN NULL;
END $$;
