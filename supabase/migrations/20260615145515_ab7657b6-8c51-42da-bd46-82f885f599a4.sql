
DROP FUNCTION IF EXISTS public.discover_public_statuses(int, int);

CREATE OR REPLACE FUNCTION public.discover_public_statuses(_limit int DEFAULT 20, _offset int DEFAULT 0)
RETURNS TABLE (
  status_id uuid, user_id uuid, username text, display_name text, avatar_url text, city text,
  kind text, content text, media_url text, caption text, background text,
  cta_url text, cta_label text, created_at timestamptz, expires_at timestamptz, is_official boolean,
  reactions_count int, comments_count int, views_count int, is_boosted boolean,
  viewer_already_liked boolean, viewer_already_follows boolean, score numeric,
  description text, hashtags text[]
)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  _viewer uuid := auth.uid();
  _viewer_city text;
  _affinity text[];
  _trending text[];
BEGIN
  IF _viewer IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
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
    WHERE v.viewer_id = _viewer AND v.created_at > now() - interval '14 days'
  ) t;

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
      EXISTS (SELECT 1 FROM public.status_views v WHERE v.status_id = b.id AND v.viewer_id = _viewer) AS already_viewed,
      public.users_share_conversation(_viewer, b.user_id) AS is_contact,
      (SELECT COUNT(*)::int FROM unnest(b.hashtags) h WHERE h = ANY(_affinity)) AS aff_hits,
      (SELECT COUNT(*)::int FROM unnest(b.hashtags) h WHERE h = ANY(_trending)) AS trend_hits
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
        - (CASE WHEN a.viewer_already_follows THEN 20 ELSE 0 END)
        - (CASE WHEN a.is_contact THEN 15 ELSE 0 END)
        + LEAST(35, a.aff_hits * 12)
        + LEAST(25, a.trend_hits * 8)
        + (CASE WHEN cardinality(a.hashtags) > 0 THEN 5 ELSE 0 END)
        + (random() * 5)
      )::numeric AS score
    FROM agg a
  )
  SELECT s.id, s.user_id, s.username, s.display_name, s.avatar_url, s.city,
         s.kind, s.content, s.media_url, s.caption, s.background,
         s.cta_url, s.cta_label, s.created_at, s.expires_at, s.is_official,
         s.reactions_count, s.comments_count, s.views_count,
         s.is_boosted, s.viewer_already_liked, s.viewer_already_follows, s.score,
         s.description, s.hashtags
  FROM scored s
  ORDER BY s.score DESC, s.created_at DESC
  OFFSET GREATEST(_offset, 0)
  LIMIT LEAST(GREATEST(_limit, 1), 50);
END;
$$;

GRANT EXECUTE ON FUNCTION public.discover_public_statuses(int, int) TO authenticated;
