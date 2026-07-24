
-- 1) Filter ecosystem content out of public discovery feeds
CREATE OR REPLACE FUNCTION public.discover_public_posts(_limit integer DEFAULT 20, _offset integer DEFAULT 0)
 RETURNS TABLE(post_id uuid, user_id uuid, username text, display_name text, avatar_url text, kind text, content text, media_url text, thumbnail_url text, caption text, background text, hashtags text[], music_track_id uuid, created_at timestamp with time zone, is_official boolean, pinned boolean, cta_label text, cta_url text, reactions_count bigint, comments_count bigint, views_count bigint, is_boosted boolean, viewer_already_liked boolean)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT p.id, p.user_id, pr.username, pr.display_name, pr.avatar_url,
    p.kind, p.content, p.media_url, p.thumbnail_url, p.caption, p.background, p.hashtags,
    p.music_track_id, p.created_at, p.is_official, p.pinned, p.cta_label, p.cta_url,
    (SELECT count(*) FROM public.post_reactions WHERE post_id = p.id),
    (SELECT count(*) FROM public.post_comments WHERE post_id = p.id),
    (SELECT count(*) FROM public.post_views WHERE post_id = p.id),
    EXISTS (SELECT 1 FROM public.post_boosts b WHERE b.post_id = p.id AND b.status='active' AND (b.ends_at IS NULL OR b.ends_at > now())),
    CASE WHEN auth.uid() IS NULL THEN false ELSE EXISTS (
      SELECT 1 FROM public.post_reactions r WHERE r.post_id = p.id AND r.user_id = auth.uid()
    ) END
  FROM public.posts p
  JOIN public.profiles pr ON pr.id = p.user_id
  LEFT JOIN public.user_activity_streaks uas ON uas.user_id = p.user_id
  WHERE p.visibility = 'public'
    AND p.ecosystem_id IS NULL
  ORDER BY
    (EXISTS (SELECT 1 FROM public.post_boosts b WHERE b.post_id = p.id AND b.status='active' AND (b.ends_at IS NULL OR b.ends_at > now()))) DESC,
    (p.created_at + CASE WHEN COALESCE(uas.organic_boost, false) THEN INTERVAL '4 hours' ELSE INTERVAL '0' END) DESC,
    p.created_at DESC
  LIMIT _limit OFFSET _offset;
$function$;

-- discover_public_statuses: add ecosystem filter in the base CTE
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
      AND s.ecosystem_id IS NULL
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

-- WaveShorts: exclude ecosystem
CREATE OR REPLACE FUNCTION public.discover_waveshorts(_cursor timestamp with time zone DEFAULT NULL::timestamp with time zone, _limit integer DEFAULT 12)
 RETURNS TABLE(id uuid, owner_id uuid, title text, description text, category text, file_url text, thumbnail_url text, duration_sec integer, views_count integer, likes_count integer, comments_count integer, saves_count integer, cta_label text, cta_url text, allow_pix boolean, pix_key text, published_at timestamp with time zone, owner_username text, owner_display_name text, owner_avatar_url text)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT v.id, v.owner_id, v.title, v.description, v.category, v.file_url, v.thumbnail_url,
         v.duration_sec, v.views_count, v.likes_count, v.comments_count, v.saves_count,
         v.cta_label, v.cta_url, v.allow_pix, v.pix_key, v.published_at,
         p.username, p.display_name, p.avatar_url
  FROM public.videos v
  LEFT JOIN public.profiles p ON p.id = v.owner_id
  WHERE v.is_short = true
    AND v.status = 'ready'
    AND v.visibility = 'public'
    AND v.ecosystem_id IS NULL
    AND (_cursor IS NULL OR v.published_at < _cursor)
  ORDER BY v.published_at DESC NULLS LAST
  LIMIT LEAST(GREATEST(_limit, 1), 50);
$function$;

-- WaveTube: exclude ecosystem
CREATE OR REPLACE FUNCTION public.discover_wavetube_videos(_sort text DEFAULT 'recent'::text, _category text DEFAULT NULL::text, _search text DEFAULT NULL::text, _limit integer DEFAULT 24, _offset integer DEFAULT 0)
 RETURNS TABLE(id uuid, owner_id uuid, title text, description text, category text, thumbnail_url text, duration_sec integer, views_count integer, likes_count integer, published_at timestamp with time zone, owner_username text, owner_display_name text, owner_avatar_url text)
 LANGUAGE sql
 STABLE
 SET search_path TO 'public'
AS $function$
  SELECT v.id, v.owner_id, v.title, v.description, v.category,
         v.thumbnail_url, v.duration_sec, v.views_count, v.likes_count,
         v.published_at, p.username, p.display_name, p.avatar_url
  FROM public.videos v
  LEFT JOIN public.profiles p ON p.id = v.owner_id
  WHERE v.visibility='public' AND v.status='ready'
    AND v.ecosystem_id IS NULL
    AND (_category IS NULL OR v.category = _category)
    AND (_search IS NULL OR v.title ILIKE '%'||_search||'%' OR v.description ILIKE '%'||_search||'%')
  ORDER BY
    CASE WHEN _sort='trending' THEN v.views_count END DESC NULLS LAST,
    v.published_at DESC NULLS LAST
  LIMIT _limit OFFSET _offset;
$function$;

-- 2) Ensure ecosystem members can read their ecosystem's posts/statuses/videos even when marked private
-- (idempotent: drop-if-exists then create)
DROP POLICY IF EXISTS "eco members read posts" ON public.posts;
CREATE POLICY "eco members read posts" ON public.posts
  FOR SELECT TO authenticated
  USING (
    ecosystem_id IS NOT NULL
    AND public.is_ecosystem_member(ecosystem_id, auth.uid())
  );

DROP POLICY IF EXISTS "eco members read statuses" ON public.statuses;
CREATE POLICY "eco members read statuses" ON public.statuses
  FOR SELECT TO authenticated
  USING (
    ecosystem_id IS NOT NULL
    AND public.is_ecosystem_member(ecosystem_id, auth.uid())
  );

DROP POLICY IF EXISTS "eco members read videos" ON public.videos;
CREATE POLICY "eco members read videos" ON public.videos
  FOR SELECT TO authenticated
  USING (
    ecosystem_id IS NOT NULL
    AND public.is_ecosystem_member(ecosystem_id, auth.uid())
  );
