
CREATE TABLE IF NOT EXISTS public.user_activity_streaks (
  user_id uuid PRIMARY KEY REFERENCES public.profiles(id) ON DELETE CASCADE,
  current_streak int NOT NULL DEFAULT 0,
  longest_streak int NOT NULL DEFAULT 0,
  last_publish_date date,
  organic_boost boolean NOT NULL DEFAULT false,
  content_creator_since timestamptz,
  verified_since timestamptz,
  organic_boost_since timestamptz,
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.user_activity_streaks TO anon, authenticated;
GRANT ALL ON public.user_activity_streaks TO service_role;

ALTER TABLE public.user_activity_streaks ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Streaks are public read" ON public.user_activity_streaks;
CREATE POLICY "Streaks are public read"
  ON public.user_activity_streaks FOR SELECT USING (true);

CREATE INDEX IF NOT EXISTS idx_activity_streaks_current
  ON public.user_activity_streaks(current_streak DESC);
CREATE INDEX IF NOT EXISTS idx_activity_streaks_organic
  ON public.user_activity_streaks(organic_boost) WHERE organic_boost = true;

ALTER TABLE public.user_badges
  ADD COLUMN IF NOT EXISTS activity_awarded boolean NOT NULL DEFAULT false;

CREATE OR REPLACE FUNCTION public.sync_activity_rewards(_user_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  _streak int;
  _cc_id uuid;
  _ver_id uuid;
  _has_manual_verified boolean;
BEGIN
  IF _user_id IS NULL THEN RETURN; END IF;
  SELECT current_streak INTO _streak FROM public.user_activity_streaks WHERE user_id = _user_id;
  _streak := COALESCE(_streak, 0);
  SELECT id INTO _cc_id FROM public.badges WHERE code = 'content_creator';
  SELECT id INTO _ver_id FROM public.badges WHERE code = 'verified';

  IF _streak >= 15 THEN
    INSERT INTO public.user_badges(user_id, badge_id, activity_awarded)
    VALUES (_user_id, _cc_id, true)
    ON CONFLICT (user_id, badge_id) DO UPDATE SET activity_awarded = true;
    UPDATE public.user_activity_streaks
       SET content_creator_since = COALESCE(content_creator_since, now())
     WHERE user_id = _user_id;
  ELSE
    DELETE FROM public.user_badges
     WHERE user_id = _user_id AND badge_id = _cc_id AND activity_awarded = true;
    UPDATE public.user_activity_streaks SET content_creator_since = NULL WHERE user_id = _user_id;
  END IF;

  SELECT EXISTS(
    SELECT 1 FROM public.user_badges
     WHERE user_id = _user_id AND badge_id = _ver_id AND activity_awarded = false
  ) INTO _has_manual_verified;

  IF _streak >= 30 THEN
    INSERT INTO public.user_badges(user_id, badge_id, activity_awarded)
    VALUES (_user_id, _ver_id, true)
    ON CONFLICT (user_id, badge_id) DO NOTHING;
    UPDATE public.user_activity_streaks
       SET verified_since = COALESCE(verified_since, now())
     WHERE user_id = _user_id;
  ELSE
    IF NOT _has_manual_verified THEN
      DELETE FROM public.user_badges
       WHERE user_id = _user_id AND badge_id = _ver_id AND activity_awarded = true;
    END IF;
    UPDATE public.user_activity_streaks SET verified_since = NULL WHERE user_id = _user_id;
  END IF;

  IF _streak >= 60 THEN
    UPDATE public.user_activity_streaks
       SET organic_boost = true, organic_boost_since = COALESCE(organic_boost_since, now())
     WHERE user_id = _user_id;
  ELSE
    UPDATE public.user_activity_streaks
       SET organic_boost = false, organic_boost_since = NULL
     WHERE user_id = _user_id;
  END IF;
END; $$;

CREATE OR REPLACE FUNCTION public.bump_activity_streak(_user_id uuid, _pub_date date)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _prev_date date;
BEGIN
  IF _user_id IS NULL OR _pub_date IS NULL THEN RETURN; END IF;
  INSERT INTO public.user_activity_streaks(user_id, current_streak, longest_streak, last_publish_date, updated_at)
  VALUES (_user_id, 1, 1, _pub_date, now())
  ON CONFLICT (user_id) DO NOTHING;

  SELECT last_publish_date INTO _prev_date FROM public.user_activity_streaks WHERE user_id = _user_id;

  IF _prev_date = _pub_date THEN
    NULL;
  ELSIF _prev_date = _pub_date - INTERVAL '1 day' THEN
    UPDATE public.user_activity_streaks
       SET current_streak = current_streak + 1,
           longest_streak = GREATEST(longest_streak, current_streak + 1),
           last_publish_date = _pub_date,
           updated_at = now()
     WHERE user_id = _user_id;
  ELSIF _prev_date IS NULL OR _prev_date < _pub_date - INTERVAL '1 day' THEN
    UPDATE public.user_activity_streaks
       SET current_streak = 1,
           longest_streak = GREATEST(longest_streak, 1),
           last_publish_date = _pub_date,
           updated_at = now()
     WHERE user_id = _user_id;
  END IF;

  PERFORM public.sync_activity_rewards(_user_id);
END; $$;

CREATE OR REPLACE FUNCTION public.recompute_activity_streak(_user_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  _cur_streak int := 0;
  _longest int := 0;
  _last date;
  _prev date;
  _d date;
  _today date := (now() AT TIME ZONE 'UTC')::date;
BEGIN
  IF _user_id IS NULL THEN RETURN; END IF;
  FOR _d IN
    SELECT DISTINCT dt FROM (
      SELECT (created_at AT TIME ZONE 'UTC')::date AS dt FROM public.posts WHERE user_id = _user_id
      UNION
      SELECT (created_at AT TIME ZONE 'UTC')::date AS dt FROM public.statuses WHERE user_id = _user_id
    ) s ORDER BY dt ASC
  LOOP
    IF _prev IS NULL OR _d = _prev + INTERVAL '1 day' THEN
      _cur_streak := COALESCE(_cur_streak, 0) + 1;
    ELSIF _d = _prev THEN
      NULL;
    ELSE
      _cur_streak := 1;
    END IF;
    IF _cur_streak > _longest THEN _longest := _cur_streak; END IF;
    _prev := _d;
    _last := _d;
  END LOOP;

  IF _last IS NULL OR _last < _today - INTERVAL '1 day' THEN
    _cur_streak := 0;
  END IF;

  INSERT INTO public.user_activity_streaks(user_id, current_streak, longest_streak, last_publish_date, updated_at)
  VALUES (_user_id, _cur_streak, _longest, _last, now())
  ON CONFLICT (user_id) DO UPDATE
    SET current_streak = EXCLUDED.current_streak,
        longest_streak = GREATEST(public.user_activity_streaks.longest_streak, EXCLUDED.longest_streak),
        last_publish_date = EXCLUDED.last_publish_date,
        updated_at = now();

  PERFORM public.sync_activity_rewards(_user_id);
END; $$;

CREATE OR REPLACE FUNCTION public.tg_activity_streak_insert()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  PERFORM public.bump_activity_streak(NEW.user_id, (NEW.created_at AT TIME ZONE 'UTC')::date);
  RETURN NEW;
END; $$;

CREATE OR REPLACE FUNCTION public.tg_activity_streak_delete()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  PERFORM public.recompute_activity_streak(OLD.user_id);
  RETURN OLD;
END; $$;

DROP TRIGGER IF EXISTS trg_activity_streak_posts_ins ON public.posts;
CREATE TRIGGER trg_activity_streak_posts_ins AFTER INSERT ON public.posts
  FOR EACH ROW EXECUTE FUNCTION public.tg_activity_streak_insert();
DROP TRIGGER IF EXISTS trg_activity_streak_posts_del ON public.posts;
CREATE TRIGGER trg_activity_streak_posts_del AFTER DELETE ON public.posts
  FOR EACH ROW EXECUTE FUNCTION public.tg_activity_streak_delete();
DROP TRIGGER IF EXISTS trg_activity_streak_statuses_ins ON public.statuses;
CREATE TRIGGER trg_activity_streak_statuses_ins AFTER INSERT ON public.statuses
  FOR EACH ROW EXECUTE FUNCTION public.tg_activity_streak_insert();
DROP TRIGGER IF EXISTS trg_activity_streak_statuses_del ON public.statuses;
CREATE TRIGGER trg_activity_streak_statuses_del AFTER DELETE ON public.statuses
  FOR EACH ROW EXECUTE FUNCTION public.tg_activity_streak_delete();

CREATE OR REPLACE FUNCTION public.sweep_activity_streaks()
RETURNS int LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  _today date := (now() AT TIME ZONE 'UTC')::date;
  _rec record;
  _count int := 0;
BEGIN
  FOR _rec IN
    SELECT user_id FROM public.user_activity_streaks
     WHERE current_streak > 0
       AND (last_publish_date IS NULL OR last_publish_date < _today - INTERVAL '1 day')
  LOOP
    UPDATE public.user_activity_streaks
       SET current_streak = 0, organic_boost = false, organic_boost_since = NULL, updated_at = now()
     WHERE user_id = _rec.user_id;
    PERFORM public.sync_activity_rewards(_rec.user_id);
    _count := _count + 1;
  END LOOP;
  RETURN _count;
END; $$;

INSERT INTO public.user_activity_streaks(user_id, current_streak, longest_streak, last_publish_date)
SELECT DISTINCT user_id, 0, 0, NULL::date FROM (
  SELECT user_id FROM public.posts
  UNION
  SELECT user_id FROM public.statuses
) s
ON CONFLICT (user_id) DO NOTHING;

DO $$
DECLARE _u uuid;
BEGIN
  FOR _u IN SELECT user_id FROM public.user_activity_streaks LOOP
    PERFORM public.recompute_activity_streak(_u);
  END LOOP;
END $$;

CREATE OR REPLACE FUNCTION public.discover_public_posts(_limit integer DEFAULT 20, _offset integer DEFAULT 0)
 RETURNS TABLE(post_id uuid, user_id uuid, username text, display_name text, avatar_url text, kind text, content text, media_url text, thumbnail_url text, caption text, background text, hashtags text[], music_track_id uuid, created_at timestamp with time zone, is_official boolean, pinned boolean, cta_label text, cta_url text, reactions_count bigint, comments_count bigint, views_count bigint, is_boosted boolean, viewer_already_liked boolean)
 LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
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
  ORDER BY
    (EXISTS (SELECT 1 FROM public.post_boosts b WHERE b.post_id = p.id AND b.status='active' AND (b.ends_at IS NULL OR b.ends_at > now()))) DESC,
    (p.created_at + CASE WHEN COALESCE(uas.organic_boost, false) THEN INTERVAL '4 hours' ELSE INTERVAL '0' END) DESC,
    p.created_at DESC
  LIMIT _limit OFFSET _offset;
$function$;

CREATE OR REPLACE FUNCTION public.admin_activity_rewards(
  _sort text DEFAULT 'streak_desc',
  _filter text DEFAULT 'all',
  _search text DEFAULT NULL,
  _limit int DEFAULT 100,
  _offset int DEFAULT 0
)
RETURNS TABLE(
  user_id uuid, username text, display_name text, avatar_url text,
  current_streak int, longest_streak int, last_publish_date date,
  organic_boost boolean, is_content_creator boolean, is_activity_verified boolean,
  content_creator_since timestamptz, verified_since timestamptz, organic_boost_since timestamptz
)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;
  RETURN QUERY
  SELECT
    p.id, p.username, p.display_name, p.avatar_url,
    COALESCE(uas.current_streak, 0),
    COALESCE(uas.longest_streak, 0),
    uas.last_publish_date,
    COALESCE(uas.organic_boost, false),
    EXISTS(SELECT 1 FROM public.user_badges ub JOIN public.badges b ON b.id=ub.badge_id
           WHERE ub.user_id=p.id AND b.code='content_creator' AND ub.activity_awarded=true),
    EXISTS(SELECT 1 FROM public.user_badges ub JOIN public.badges b ON b.id=ub.badge_id
           WHERE ub.user_id=p.id AND b.code='verified' AND ub.activity_awarded=true),
    uas.content_creator_since, uas.verified_since, uas.organic_boost_since
  FROM public.user_activity_streaks uas
  JOIN public.profiles p ON p.id = uas.user_id
  WHERE (_search IS NULL OR _search = '' OR
         p.username ILIKE '%' || _search || '%' OR
         p.display_name ILIKE '%' || _search || '%')
    AND (
      _filter = 'all'
      OR (_filter = 'creator' AND EXISTS(
            SELECT 1 FROM public.user_badges ub JOIN public.badges b ON b.id=ub.badge_id
            WHERE ub.user_id=p.id AND b.code='content_creator' AND ub.activity_awarded=true))
      OR (_filter = 'verified' AND EXISTS(
            SELECT 1 FROM public.user_badges ub JOIN public.badges b ON b.id=ub.badge_id
            WHERE ub.user_id=p.id AND b.code='verified' AND ub.activity_awarded=true))
      OR (_filter = 'organic' AND COALESCE(uas.organic_boost, false) = true)
    )
  ORDER BY
    CASE WHEN _sort='streak_desc' THEN uas.current_streak END DESC NULLS LAST,
    CASE WHEN _sort='streak_asc'  THEN uas.current_streak END ASC NULLS LAST,
    CASE WHEN _sort='name'        THEN lower(p.display_name) END ASC NULLS LAST,
    CASE WHEN _sort='last_publish' THEN uas.last_publish_date END DESC NULLS LAST,
    uas.current_streak DESC
  LIMIT _limit OFFSET _offset;
END; $$;

GRANT EXECUTE ON FUNCTION public.sync_activity_rewards(uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.bump_activity_streak(uuid, date) TO service_role;
GRANT EXECUTE ON FUNCTION public.recompute_activity_streak(uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.sweep_activity_streaks() TO service_role;
GRANT EXECUTE ON FUNCTION public.admin_activity_rewards(text, text, text, int, int) TO authenticated;

CREATE EXTENSION IF NOT EXISTS pg_cron;
DO $$
BEGIN
  PERFORM cron.unschedule('sweep-activity-streaks');
EXCEPTION WHEN OTHERS THEN NULL;
END $$;
SELECT cron.schedule('sweep-activity-streaks', '5 0 * * *',
  $cron$ SELECT public.sweep_activity_streaks(); $cron$);
