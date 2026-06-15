
-- 1) Colunas
ALTER TABLE public.statuses
  ADD COLUMN IF NOT EXISTS description text,
  ADD COLUMN IF NOT EXISTS hashtags text[] NOT NULL DEFAULT '{}';

CREATE INDEX IF NOT EXISTS idx_statuses_hashtags_gin ON public.statuses USING gin (hashtags);
CREATE INDEX IF NOT EXISTS idx_statuses_created ON public.statuses (created_at DESC);

-- 2) Função de extração
CREATE OR REPLACE FUNCTION public.extract_status_hashtags()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  _text text;
  _tags text[];
BEGIN
  _text := lower(coalesce(NEW.content,'') || ' ' || coalesce(NEW.caption,'') || ' ' || coalesce(NEW.description,''));
  SELECT COALESCE(array_agg(DISTINCT m[1]), '{}')
    INTO _tags
  FROM regexp_matches(_text, '#([a-z0-9_\u00C0-\u017F]{2,40})', 'g') AS m;
  NEW.hashtags := _tags;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_extract_status_hashtags ON public.statuses;
CREATE TRIGGER trg_extract_status_hashtags
BEFORE INSERT OR UPDATE OF content, caption, description ON public.statuses
FOR EACH ROW EXECUTE FUNCTION public.extract_status_hashtags();

-- 3) Trending hashtags (últimos 7 dias)
CREATE OR REPLACE FUNCTION public.get_trending_hashtags(_limit int DEFAULT 30)
RETURNS TABLE (
  tag text,
  uses_count int,
  authors_count int,
  last_used_at timestamptz
)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT
    h.tag,
    COUNT(*)::int AS uses_count,
    COUNT(DISTINCT s.user_id)::int AS authors_count,
    MAX(s.created_at) AS last_used_at
  FROM public.statuses s
  CROSS JOIN LATERAL unnest(s.hashtags) AS h(tag)
  WHERE s.created_at > now() - interval '7 days'
    AND s.expires_at > now() - interval '7 days'
  GROUP BY h.tag
  ORDER BY uses_count DESC, authors_count DESC
  LIMIT GREATEST(1, LEAST(_limit, 100));
$$;

GRANT EXECUTE ON FUNCTION public.get_trending_hashtags(int) TO authenticated, anon;

-- 4) Pessoas que usaram uma hashtag específica
CREATE OR REPLACE FUNCTION public.get_hashtag_people(_tag text, _limit int DEFAULT 30)
RETURNS TABLE (
  user_id uuid,
  username text,
  display_name text,
  avatar_url text,
  city text,
  uses_count int,
  last_used_at timestamptz,
  last_status_id uuid,
  last_caption text,
  viewer_follows boolean,
  shares_conversation boolean
)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  _viewer uuid := auth.uid();
  _t text := lower(trim(both '#' from coalesce(_tag,'')));
BEGIN
  IF _viewer IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  IF length(_t) < 2 THEN RAISE EXCEPTION 'Invalid tag'; END IF;

  RETURN QUERY
  WITH agg AS (
    SELECT
      s.user_id,
      COUNT(*)::int AS uses,
      MAX(s.created_at) AS last_at,
      (ARRAY_AGG(s.id ORDER BY s.created_at DESC))[1] AS last_status_id,
      (ARRAY_AGG(COALESCE(s.caption, s.content, s.description) ORDER BY s.created_at DESC))[1] AS last_cap
    FROM public.statuses s
    WHERE _t = ANY(s.hashtags)
      AND s.created_at > now() - interval '30 days'
    GROUP BY s.user_id
  )
  SELECT
    a.user_id,
    p.username,
    p.display_name,
    p.avatar_url,
    pp.city,
    a.uses AS uses_count,
    a.last_at AS last_used_at,
    a.last_status_id,
    a.last_cap AS last_caption,
    EXISTS (SELECT 1 FROM public.profile_follows pf WHERE pf.follower_id = _viewer AND pf.following_id = a.user_id) AS viewer_follows,
    public.users_share_conversation(_viewer, a.user_id) AS shares_conversation
  FROM agg a
  JOIN public.profiles p ON p.id = a.user_id
  LEFT JOIN public.profiles_private pp ON pp.user_id = a.user_id
  WHERE COALESCE(p.visibility,'public') = 'public'
  ORDER BY a.uses DESC, a.last_at DESC
  LIMIT GREATEST(1, LEAST(_limit, 100));
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_hashtag_people(text, int) TO authenticated;

-- 5) Re-popular hashtags dos statuses existentes (últimos 30 dias)
UPDATE public.statuses
SET content = content
WHERE created_at > now() - interval '30 days'
  AND (
    coalesce(content,'') ~ '#[a-z0-9_]' OR
    coalesce(caption,'') ~ '#[a-z0-9_]' OR
    coalesce(description,'') ~ '#[a-z0-9_]'
  );
