CREATE OR REPLACE FUNCTION public.discover_public_statuses(_limit integer DEFAULT 20, _offset integer DEFAULT 0)
 RETURNS TABLE(status_id uuid, user_id uuid, username text, display_name text, avatar_url text, city text, kind text, content text, media_url text, caption text, background text, cta_url text, cta_label text, created_at timestamp with time zone, expires_at timestamp with time zone, is_official boolean, reactions_count integer, comments_count integer, views_count integer, is_boosted boolean, viewer_already_liked boolean, viewer_already_follows boolean, score numeric, description text, hashtags text[])
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  _viewer uuid := auth.uid();
  _viewer_city text;
  _affinity text[] := '{}';
  _trending text[] := '{}';
BEGIN
  IF _viewer IS NOT NULL THEN
    SELECT pp.city INTO _viewer_city FROM public.profiles_private pp WHERE pp.user_id = _viewer;

    SELECT COALESCE(array_agg(DISTINCT h), '{}') INTO _affinity
    FROM (
      SELECT unnest(s.hashtags) AS h
      FROM public.status_reactions r
      JOIN public.statuses s ON s.id = r.status_id
      WHERE r.user_id = _viewer AND r.created_at > now() - interval '30 days'
      UNION ALL
      SELECT unnest(s.hashtags) AS h
      FROM public.status_views v
      JOIN public.statuses s ON s.id = v.status_id
      WHERE v.viewer_id = _viewer AND v.viewed_at > now() - interval '14 days'
    ) t;
  END IF;

  SELECT COALESCE(array_agg(tag), '{}') INTO _trending
  FROM (SELECT tag FROM public.get_trending_hashtags(30)) tt;

  RETURN QUERY
  WITH base AS (
    SELECT s.id, s.user_id, s.kind, s.content, s.media_url, s.caption, s.background,
           s.cta_url, s.cta_label, s.created_at, s.expires_at, s.is_official,
           s.description, s.hashtags,
           p.username, p.display_name, p.avatar_url,
           CASE WHEN p.show_city THEN pp.city ELSE NULL END AS city,
           pp.city AS raw_city
    FROM public.statuses s
    JOIN public.profiles p ON p.id = s.user_id
    LEFT JOIN public.profiles_private pp ON pp.user_id = s.user_id
    WHERE s.expires_at > now()
      AND (_viewer IS NULL OR s.user_id <> _viewer)
      AND p.banned_at IS NULL
      AND (
        _viewer IS NULL
        OR NOT EXISTS (
          SELECT 1 FROM public.user_blocks ub
          WHERE (ub.blocker_id = _viewer AND ub.blocked_id = s.user_id)
             OR (ub.blocker_id = s.user_id AND ub.blocked_id = _viewer)
        )
      )
  ),
  agg AS (
    SELECT b.*,
      (SELECT COUNT(*)::int FROM public.status_reactions r WHERE r.status_id = b.id) AS reactions_count,
      (SELECT COUNT(*)::int FROM public.status_comments c WHERE c.status_id = b.id) AS comments_count,
      (SELECT COUNT(*)::int FROM public.status_views v WHERE v.status_id = b.id) AS views_count,
      EXISTS (SELECT 1 FROM public.status_boosts sb WHERE sb.status_id = b.id AND sb.status='active' AND sb.views_remaining > 0) AS is_boosted,
      (_viewer IS NOT NULL AND EXISTS (SELECT 1 FROM public.status_reactions r WHERE r.status_id = b.id AND r.user_id = _viewer)) AS viewer_already_liked,
      (_viewer IS NOT NULL AND EXISTS (SELECT 1 FROM public.profile_follows pf WHERE pf.follower_id = _viewer AND pf.following_id = b.user_id)) AS viewer_already_follows,
      (_viewer IS NOT NULL AND EXISTS (SELECT 1 FROM public.status_views v WHERE v.status_id = b.id AND v.viewer_id = _viewer)) AS already_viewed,
      (_viewer IS NOT NULL AND public.users_share_conversation(_viewer, b.user_id)) AS is_contact,
      (SELECT COUNT(*)::int FROM unnest(COALESCE(b.hashtags, '{}')) h WHERE h = ANY(_affinity)) AS aff_hits,
      (SELECT COUNT(*)::int FROM unnest(COALESCE(b.hashtags, '{}')) h WHERE h = ANY(_trending)) AS trend_hits
    FROM base b
  ),
  scored AS (
    SELECT a.*,
      (
        (CASE WHEN a.is_boosted THEN 1000 ELSE 0 END)
        + (CASE WHEN a.is_contact THEN 50 ELSE 0 END)
        + (CASE WHEN _viewer_city IS NOT NULL AND a.raw_city = _viewer_city THEN 30 ELSE 0 END)
        + (a.aff_hits * 8)
        + (a.trend_hits * 4)
        + (a.reactions_count * 0.5)
        + (a.comments_count * 0.8)
        + (a.views_count * 0.05)
        - (CASE WHEN a.already_viewed THEN 25 ELSE 0 END)
        - EXTRACT(EPOCH FROM (now() - a.created_at)) / 3600.0
      )::numeric AS score
    FROM agg a
  )
  SELECT s.id, s.user_id, s.username, s.display_name, s.avatar_url, s.city,
         s.kind, s.content, s.media_url, s.caption, s.background, s.cta_url, s.cta_label,
         s.created_at, s.expires_at, s.is_official,
         s.reactions_count, s.comments_count, s.views_count,
         s.is_boosted, s.viewer_already_liked, s.viewer_already_follows,
         s.score, s.description, s.hashtags
  FROM scored s
  ORDER BY s.score DESC, s.created_at DESC
  LIMIT _limit OFFSET _offset;
END;
$function$;

GRANT EXECUTE ON FUNCTION public.discover_public_statuses(integer, integer) TO anon, authenticated, service_role;

CREATE OR REPLACE FUNCTION public.register_status_view(_status_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  _viewer uuid := auth.uid();
  _owner uuid;
  _expires timestamptz;
BEGIN
  IF _viewer IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  SELECT user_id, expires_at INTO _owner, _expires
  FROM public.statuses
  WHERE id = _status_id;

  IF _owner IS NULL THEN
    RAISE EXCEPTION 'Status not found';
  END IF;

  IF _expires <= now() THEN
    RAISE EXCEPTION 'Status expired';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.user_blocks ub
    WHERE (ub.blocker_id = _viewer AND ub.blocked_id = _owner)
       OR (ub.blocker_id = _owner AND ub.blocked_id = _viewer)
  ) THEN
    RAISE EXCEPTION 'Not authorized to view this status';
  END IF;

  INSERT INTO public.status_views(status_id, viewer_id, from_boost)
  VALUES (_status_id, _viewer, false)
  ON CONFLICT (status_id, viewer_id) DO NOTHING;

  RETURN jsonb_build_object('ok', true, 'reason', 'public');
END;
$function$;

GRANT EXECUTE ON FUNCTION public.register_status_view(uuid) TO authenticated;

DROP POLICY IF EXISTS "users read reactions on visible statuses" ON public.status_reactions;
DROP POLICY IF EXISTS "Anyone can read reactions on active statuses" ON public.status_reactions;
CREATE POLICY "Anyone can read reactions on active statuses"
ON public.status_reactions
FOR SELECT
TO anon, authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.statuses s
    WHERE s.id = status_reactions.status_id
      AND s.expires_at > now()
  )
);

GRANT SELECT ON public.status_reactions TO anon, authenticated;