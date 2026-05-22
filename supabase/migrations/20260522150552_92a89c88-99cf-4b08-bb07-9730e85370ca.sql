
CREATE OR REPLACE FUNCTION public.register_status_view(_status_id UUID)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _viewer UUID := auth.uid();
  _owner UUID;
  _expires TIMESTAMPTZ;
  _is_contact BOOLEAN;
  _existing RECORD;
  _boost RECORD;
  _from_boost BOOLEAN := false;
BEGIN
  IF _viewer IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  SELECT user_id, expires_at INTO _owner, _expires
  FROM public.statuses WHERE id = _status_id;
  IF _owner IS NULL THEN
    RAISE EXCEPTION 'Status not found';
  END IF;
  IF _expires <= now() THEN
    RAISE EXCEPTION 'Status expired';
  END IF;
  IF _owner = _viewer THEN
    -- self view, just upsert and return
    INSERT INTO public.status_views(status_id, viewer_id, from_boost)
    VALUES (_status_id, _viewer, false)
    ON CONFLICT (status_id, viewer_id) DO NOTHING;
    RETURN jsonb_build_object('ok', true, 'reason', 'self');
  END IF;

  -- already viewed? do nothing, do not consume again
  SELECT * INTO _existing FROM public.status_views
   WHERE status_id = _status_id AND viewer_id = _viewer;
  IF FOUND THEN
    RETURN jsonb_build_object('ok', true, 'reason', 'already');
  END IF;

  _is_contact := public.users_share_conversation(_viewer, _owner);

  IF NOT _is_contact THEN
    -- need a boost to view
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
$$;

REVOKE EXECUTE ON FUNCTION public.register_status_view(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.register_status_view(UUID) TO authenticated;
