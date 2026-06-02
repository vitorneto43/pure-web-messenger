
ALTER TABLE public.statuses ADD COLUMN IF NOT EXISTS is_official boolean NOT NULL DEFAULT false;
CREATE INDEX IF NOT EXISTS idx_statuses_official ON public.statuses(is_official) WHERE is_official = true;

DROP POLICY IF EXISTS "View own, contacts, or boosted statuses" ON public.statuses;
CREATE POLICY "View own, contacts, boosted, or official statuses"
ON public.statuses FOR SELECT TO authenticated
USING (
  expires_at > now() AND (
    user_id = auth.uid()
    OR is_official = true
    OR users_share_conversation(auth.uid(), user_id)
    OR EXISTS (
      SELECT 1 FROM status_boosts sb
      WHERE sb.status_id = statuses.id AND sb.status = 'active' AND sb.views_remaining > 0
    )
  )
);

DROP POLICY IF EXISTS "Users can insert own status" ON public.statuses;
CREATE POLICY "Users can insert own status"
ON public.statuses FOR INSERT TO authenticated
WITH CHECK (
  auth.uid() = user_id
  AND (is_official = false OR public.has_role(auth.uid(), 'admin'))
);

CREATE OR REPLACE FUNCTION public.register_status_view(_status_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  _viewer UUID := auth.uid();
  _owner UUID;
  _expires TIMESTAMPTZ;
  _official BOOLEAN;
  _is_contact BOOLEAN;
  _existing RECORD;
  _boost RECORD;
  _from_boost BOOLEAN := false;
BEGIN
  IF _viewer IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  SELECT user_id, expires_at, is_official INTO _owner, _expires, _official
  FROM public.statuses WHERE id = _status_id;
  IF _owner IS NULL THEN
    RAISE EXCEPTION 'Status not found';
  END IF;
  IF _expires <= now() THEN
    RAISE EXCEPTION 'Status expired';
  END IF;
  IF _owner = _viewer THEN
    INSERT INTO public.status_views(status_id, viewer_id, from_boost)
    VALUES (_status_id, _viewer, false)
    ON CONFLICT (status_id, viewer_id) DO NOTHING;
    RETURN jsonb_build_object('ok', true, 'reason', 'self');
  END IF;

  SELECT * INTO _existing FROM public.status_views
   WHERE status_id = _status_id AND viewer_id = _viewer;
  IF FOUND THEN
    RETURN jsonb_build_object('ok', true, 'reason', 'already');
  END IF;

  IF _official THEN
    INSERT INTO public.status_views(status_id, viewer_id, from_boost)
    VALUES (_status_id, _viewer, false)
    ON CONFLICT (status_id, viewer_id) DO NOTHING;
    RETURN jsonb_build_object('ok', true, 'reason', 'official');
  END IF;

  _is_contact := public.users_share_conversation(_viewer, _owner);

  IF NOT _is_contact THEN
    SELECT * INTO _boost FROM public.status_boosts
      WHERE status_id = _status_id
        AND status = 'active'
        AND views_remaining > 0
      ORDER BY created_at ASC
      LIMIT 1
      FOR UPDATE;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'Not authorized to view this status';
    END IF;
    UPDATE public.status_boosts
      SET views_remaining = views_remaining - 1,
          status = CASE WHEN views_remaining - 1 <= 0 THEN 'completed' ELSE status END
      WHERE id = _boost.id;
    _from_boost := true;
  END IF;

  INSERT INTO public.status_views(status_id, viewer_id, from_boost)
  VALUES (_status_id, _viewer, _from_boost);

  RETURN jsonb_build_object('ok', true, 'from_boost', _from_boost);
END;
$function$;
