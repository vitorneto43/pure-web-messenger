ALTER TABLE public.live_sessions
  ADD COLUMN IF NOT EXISTS host_last_seen timestamptz NOT NULL DEFAULT now();

CREATE INDEX IF NOT EXISTS live_sessions_live_host_last_seen_idx
  ON public.live_sessions (host_last_seen)
  WHERE status = 'live';

CREATE OR REPLACE FUNCTION public.host_live_heartbeat(p_live_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.live_sessions
     SET host_last_seen = now()
   WHERE id = p_live_id
     AND host_id = auth.uid()
     AND status = 'live';
END $$;
GRANT EXECUTE ON FUNCTION public.host_live_heartbeat(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.cleanup_stale_lives(p_minutes integer DEFAULT 2)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE v_count integer;
BEGIN
  WITH upd AS (
    UPDATE public.live_sessions
       SET status = 'ended', ended_at = now()
     WHERE status = 'live'
       AND host_last_seen < now() - make_interval(mins => GREATEST(p_minutes, 1))
    RETURNING 1
  )
  SELECT count(*) INTO v_count FROM upd;
  RETURN COALESCE(v_count, 0);
END $$;
GRANT EXECUTE ON FUNCTION public.cleanup_stale_lives(integer) TO anon, authenticated, service_role;

-- One-shot: end the currently-orphaned lives from before this migration.
SELECT public.cleanup_stale_lives(2);