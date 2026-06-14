
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
  _owner_public BOOLEAN;
  _is_contact BOOLEAN;
  _existing RECORD;
  _boost RECORD;
  _from_boost BOOLEAN := false;
  _v_state text; _v_country text; _v_age text; _v_gender text;
  _boost_id uuid;
BEGIN
  IF _viewer IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  SELECT s.user_id, s.expires_at, s.is_official, COALESCE(p.visibility,'public')='public'
    INTO _owner, _expires, _official, _owner_public
  FROM public.statuses s
  LEFT JOIN public.profiles p ON p.id = s.user_id
  WHERE s.id = _status_id;
  IF _owner IS NULL THEN RAISE EXCEPTION 'Status not found'; END IF;
  IF _expires <= now() THEN RAISE EXCEPTION 'Status expired'; END IF;

  SELECT pp.region, pp.country, pp.gender INTO _v_state, _v_country, _v_gender
    FROM public.profiles_private pp WHERE pp.user_id = _viewer;
  SELECT age_range INTO _v_age FROM public.user_onboarding_survey WHERE user_id = _viewer;

  IF _owner = _viewer THEN
    INSERT INTO public.status_views(status_id, viewer_id, from_boost, viewer_state, viewer_country, viewer_age_range, viewer_gender)
    VALUES (_status_id, _viewer, false, _v_state, _v_country, _v_age, _v_gender)
    ON CONFLICT (status_id, viewer_id) DO NOTHING;
    RETURN jsonb_build_object('ok', true, 'reason', 'self');
  END IF;

  SELECT * INTO _existing FROM public.status_views WHERE status_id = _status_id AND viewer_id = _viewer;
  IF FOUND THEN RETURN jsonb_build_object('ok', true, 'reason', 'already'); END IF;

  IF _official OR _owner_public THEN
    INSERT INTO public.status_views(status_id, viewer_id, from_boost, viewer_state, viewer_country, viewer_age_range, viewer_gender)
    VALUES (_status_id, _viewer, false, _v_state, _v_country, _v_age, _v_gender)
    ON CONFLICT (status_id, viewer_id) DO NOTHING;
    RETURN jsonb_build_object('ok', true, 'reason', CASE WHEN _official THEN 'official' ELSE 'public' END);
  END IF;

  _is_contact := public.users_share_conversation(_viewer, _owner);
  IF NOT _is_contact THEN
    SELECT * INTO _boost FROM public.status_boosts sb
      WHERE sb.status_id = _status_id AND sb.status='active' AND sb.views_remaining > 0
        AND (sb.ends_at IS NULL OR sb.ends_at > now())
        AND (cardinality(sb.target_states) = 0 OR _v_state = ANY(sb.target_states))
        AND (sb.target_gender = 'all' OR sb.target_gender = _v_gender)
      ORDER BY sb.created_at ASC LIMIT 1 FOR UPDATE;
    IF NOT FOUND THEN RAISE EXCEPTION 'Not authorized to view this status'; END IF;
    UPDATE public.status_boosts
      SET views_remaining = views_remaining - 1,
          status = CASE WHEN views_remaining - 1 <= 0 THEN 'completed' ELSE status END
      WHERE id = _boost.id;
    _from_boost := true; _boost_id := _boost.id;
  END IF;

  INSERT INTO public.status_views(status_id, viewer_id, from_boost, boost_id, viewer_state, viewer_country, viewer_age_range, viewer_gender)
  VALUES (_status_id, _viewer, _from_boost, _boost_id, _v_state, _v_country, _v_age, _v_gender);
  RETURN jsonb_build_object('ok', true, 'from_boost', _from_boost);
END;
$function$;

CREATE INDEX IF NOT EXISTS idx_statuses_expires_created
  ON public.statuses (expires_at, created_at DESC);

CREATE OR REPLACE FUNCTION public.discover_public_statuses(_limit int DEFAULT 20, _offset int DEFAULT 0)
RETURNS TABLE (
  status_id uuid, user_id uuid, username text, display_name text, avatar_url text, city text,
  kind text, content text, media_url text, caption text, background text,
  cta_url text, cta_label text, created_at timestamptz, expires_at timestamptz, is_official boolean,
  reactions_count int, comments_count int, views_count int, is_boosted boolean,
  viewer_already_liked boolean, viewer_already_follows boolean, score numeric
)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  _viewer uuid := auth.uid();
  _viewer_city text;
BEGIN
  IF _viewer IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  SELECT pp.city INTO _viewer_city FROM public.profiles_private pp WHERE pp.user_id = _viewer;

  RETURN QUERY
  WITH base AS (
    SELECT s.id, s.user_id, s.kind, s.content, s.media_url, s.caption, s.background,
           s.cta_url, s.cta_label, s.created_at, s.expires_at, s.is_official,
           p.username, p.display_name, p.avatar_url,
           CASE WHEN p.show_city THEN pp.city ELSE NULL END AS city,
           pp.city AS raw_city
    FROM public.statuses s
    JOIN public.profiles p ON p.id = s.user_id
    LEFT JOIN public.profiles_private pp ON pp.user_id = s.user_id
    WHERE s.expires_at > now()
      AND s.user_id <> _viewer
      AND COALESCE(p.visibility,'public') = 'public'
      AND p.banned_at IS NULL
      AND NOT EXISTS (
        SELECT 1 FROM public.user_blocks ub
        WHERE (ub.blocker_id = _viewer AND ub.blocked_id = s.user_id)
           OR (ub.blocker_id = s.user_id AND ub.blocked_id = _viewer)
      )
  ),
  agg AS (
    SELECT b.*,
      (SELECT COUNT(*)::int FROM public.status_reactions r WHERE r.status_id = b.id) AS reactions_count,
      (SELECT COUNT(*)::int FROM public.status_comments c WHERE c.status_id = b.id) AS comments_count,
      (SELECT COUNT(*)::int FROM public.status_views v WHERE v.status_id = b.id) AS views_count,
      EXISTS (SELECT 1 FROM public.status_boosts sb WHERE sb.status_id = b.id AND sb.status='active' AND sb.views_remaining > 0) AS is_boosted,
      EXISTS (SELECT 1 FROM public.status_reactions r WHERE r.status_id = b.id AND r.user_id = _viewer) AS viewer_already_liked,
      EXISTS (SELECT 1 FROM public.profile_follows pf WHERE pf.follower_id = _viewer AND pf.following_id = b.user_id) AS viewer_already_follows,
      EXISTS (SELECT 1 FROM public.status_views v WHERE v.status_id = b.id AND v.viewer_id = _viewer) AS already_viewed
    FROM base b
  ),
  scored AS (
    SELECT a.*,
      (
        (CASE WHEN a.created_at > now() - interval '24 hours' THEN 40 ELSE 0 END)
        + (CASE WHEN _viewer_city IS NOT NULL AND a.raw_city = _viewer_city THEN 30 ELSE 0 END)
        + LEAST(20, (a.reactions_count + a.comments_count * 2))
        + (CASE WHEN a.is_boosted THEN 10 ELSE 0 END)
        + (CASE WHEN a.is_official THEN 15 ELSE 0 END)
        - (CASE WHEN a.already_viewed THEN 50 ELSE 0 END)
        - (CASE WHEN a.viewer_already_follows THEN 10 ELSE 0 END)
        + (random() * 5)
      )::numeric AS score
    FROM agg a
  )
  SELECT s.id, s.user_id, s.username, s.display_name, s.avatar_url, s.city,
         s.kind, s.content, s.media_url, s.caption, s.background,
         s.cta_url, s.cta_label, s.created_at, s.expires_at, s.is_official,
         s.reactions_count, s.comments_count, s.views_count,
         s.is_boosted, s.viewer_already_liked, s.viewer_already_follows, s.score
  FROM scored s
  ORDER BY s.score DESC, s.created_at DESC
  OFFSET GREATEST(_offset, 0)
  LIMIT LEAST(GREATEST(_limit, 1), 50);
END;
$$;

GRANT EXECUTE ON FUNCTION public.discover_public_statuses(int, int) TO authenticated;
