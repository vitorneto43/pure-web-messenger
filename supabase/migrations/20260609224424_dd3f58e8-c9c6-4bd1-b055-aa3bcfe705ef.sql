
-- 1. Extend status_boosts
ALTER TABLE public.status_boosts
  ADD COLUMN IF NOT EXISTS boost_type text NOT NULL DEFAULT 'package',
  ADD COLUMN IF NOT EXISTS duration_days integer,
  ADD COLUMN IF NOT EXISTS target_states text[] NOT NULL DEFAULT ARRAY[]::text[],
  ADD COLUMN IF NOT EXISTS target_age_min integer,
  ADD COLUMN IF NOT EXISTS target_age_max integer,
  ADD COLUMN IF NOT EXISTS target_gender text NOT NULL DEFAULT 'all',
  ADD COLUMN IF NOT EXISTS objective text NOT NULL DEFAULT 'views',
  ADD COLUMN IF NOT EXISTS cpm_cents integer,
  ADD COLUMN IF NOT EXISTS ends_at timestamptz;

-- Relax package CHECK to allow 'custom'
ALTER TABLE public.status_boosts DROP CONSTRAINT IF EXISTS status_boosts_package_check;
ALTER TABLE public.status_boosts ADD CONSTRAINT status_boosts_package_check
  CHECK (package IN ('boost_100','boost_500','boost_2000','custom'));

ALTER TABLE public.status_boosts ADD CONSTRAINT status_boosts_boost_type_check
  CHECK (boost_type IN ('package','custom'));
ALTER TABLE public.status_boosts ADD CONSTRAINT status_boosts_gender_check
  CHECK (target_gender IN ('male','female','all'));
ALTER TABLE public.status_boosts ADD CONSTRAINT status_boosts_objective_check
  CHECK (objective IN ('views','comments','profile_visits','chat','network','website','cross_platform'));

-- 2. Extend status_views with demographics
ALTER TABLE public.status_views
  ADD COLUMN IF NOT EXISTS viewer_state text,
  ADD COLUMN IF NOT EXISTS viewer_age_range text,
  ADD COLUMN IF NOT EXISTS viewer_gender text,
  ADD COLUMN IF NOT EXISTS viewer_country text,
  ADD COLUMN IF NOT EXISTS boost_id uuid;

-- 3. Add gender to profiles_private
ALTER TABLE public.profiles_private
  ADD COLUMN IF NOT EXISTS gender text;
ALTER TABLE public.profiles_private DROP CONSTRAINT IF EXISTS profiles_private_gender_check;
ALTER TABLE public.profiles_private ADD CONSTRAINT profiles_private_gender_check
  CHECK (gender IS NULL OR gender IN ('male','female','other'));

-- 4. Clicks table
CREATE TABLE IF NOT EXISTS public.status_boost_clicks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  boost_id uuid NOT NULL REFERENCES public.status_boosts(id) ON DELETE CASCADE,
  status_id uuid NOT NULL REFERENCES public.statuses(id) ON DELETE CASCADE,
  clicker_id uuid,
  viewer_state text,
  viewer_age_range text,
  viewer_gender text,
  viewer_country text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_status_boost_clicks_boost ON public.status_boost_clicks(boost_id);
CREATE INDEX IF NOT EXISTS idx_status_boost_clicks_created ON public.status_boost_clicks(created_at DESC);

GRANT SELECT, INSERT ON public.status_boost_clicks TO authenticated;
GRANT ALL ON public.status_boost_clicks TO service_role;

ALTER TABLE public.status_boost_clicks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone authed can insert click"
  ON public.status_boost_clicks FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Boost owner reads clicks"
  ON public.status_boost_clicks FOR SELECT
  TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.status_boosts sb
    WHERE sb.id = status_boost_clicks.boost_id AND sb.user_id = auth.uid()
  ));

-- 5. Update register_status_view to capture demographics + match boost segmentation
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
  _v_state text;
  _v_country text;
  _v_age text;
  _v_gender text;
  _boost_id uuid;
BEGIN
  IF _viewer IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  SELECT user_id, expires_at, is_official INTO _owner, _expires, _official
  FROM public.statuses WHERE id = _status_id;
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

  SELECT * INTO _existing FROM public.status_views
   WHERE status_id = _status_id AND viewer_id = _viewer;
  IF FOUND THEN RETURN jsonb_build_object('ok', true, 'reason', 'already'); END IF;

  IF _official THEN
    INSERT INTO public.status_views(status_id, viewer_id, from_boost, viewer_state, viewer_country, viewer_age_range, viewer_gender)
    VALUES (_status_id, _viewer, false, _v_state, _v_country, _v_age, _v_gender)
    ON CONFLICT (status_id, viewer_id) DO NOTHING;
    RETURN jsonb_build_object('ok', true, 'reason', 'official');
  END IF;

  _is_contact := public.users_share_conversation(_viewer, _owner);

  IF NOT _is_contact THEN
    -- find an active boost that matches viewer demographics (and remaining views)
    SELECT * INTO _boost FROM public.status_boosts sb
      WHERE sb.status_id = _status_id
        AND sb.status = 'active'
        AND sb.views_remaining > 0
        AND (sb.ends_at IS NULL OR sb.ends_at > now())
        AND (cardinality(sb.target_states) = 0 OR _v_state = ANY(sb.target_states))
        AND (sb.target_gender = 'all' OR sb.target_gender = _v_gender)
        -- age_range can't be easily compared to min/max numerically; skip age filter at view time
      ORDER BY sb.created_at ASC
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
    _boost_id := _boost.id;
  END IF;

  INSERT INTO public.status_views(status_id, viewer_id, from_boost, boost_id, viewer_state, viewer_country, viewer_age_range, viewer_gender)
  VALUES (_status_id, _viewer, _from_boost, _boost_id, _v_state, _v_country, _v_age, _v_gender);

  RETURN jsonb_build_object('ok', true, 'from_boost', _from_boost);
END;
$function$;

-- 6. Track click on CTA
CREATE OR REPLACE FUNCTION public.register_boost_click(_status_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  _uid uuid := auth.uid();
  _boost RECORD;
  _v_state text; _v_country text; _v_age text; _v_gender text;
BEGIN
  SELECT * INTO _boost FROM public.status_boosts
    WHERE status_id = _status_id AND status IN ('active','completed')
    ORDER BY created_at DESC LIMIT 1;
  IF NOT FOUND THEN RETURN jsonb_build_object('ok', false); END IF;

  IF _uid IS NOT NULL THEN
    SELECT pp.region, pp.country, pp.gender INTO _v_state, _v_country, _v_gender
      FROM public.profiles_private pp WHERE pp.user_id = _uid;
    SELECT age_range INTO _v_age FROM public.user_onboarding_survey WHERE user_id = _uid;
  END IF;

  INSERT INTO public.status_boost_clicks (boost_id, status_id, clicker_id, viewer_state, viewer_age_range, viewer_gender, viewer_country)
  VALUES (_boost.id, _status_id, _uid, _v_state, _v_age, _v_gender, _v_country);

  RETURN jsonb_build_object('ok', true, 'boost_id', _boost.id);
END;
$function$;

-- 7. Boost report
CREATE OR REPLACE FUNCTION public.get_boost_report(_boost_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  _uid uuid := auth.uid();
  _b RECORD;
  _views int; _clicks int;
  _by_state jsonb; _by_age jsonb; _by_gender jsonb; _series jsonb;
BEGIN
  SELECT * INTO _b FROM public.status_boosts WHERE id = _boost_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Boost not found'; END IF;
  IF _b.user_id <> _uid AND NOT has_role(_uid,'admin'::app_role) AND NOT has_role(_uid,'moderator'::app_role) THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;

  SELECT COUNT(*) INTO _views FROM public.status_views WHERE status_id = _b.status_id AND from_boost = true;
  SELECT COUNT(*) INTO _clicks FROM public.status_boost_clicks WHERE boost_id = _boost_id;

  SELECT COALESCE(jsonb_agg(row_to_json(t) ORDER BY (row_to_json(t)->>'count')::int DESC), '[]'::jsonb)
  INTO _by_state FROM (
    SELECT COALESCE(NULLIF(viewer_state,''),'desconhecido') AS name, COUNT(*)::int AS count
    FROM public.status_views WHERE status_id = _b.status_id AND from_boost = true
    GROUP BY 1 ORDER BY 2 DESC LIMIT 15
  ) t;

  SELECT COALESCE(jsonb_agg(row_to_json(t) ORDER BY (row_to_json(t)->>'count')::int DESC), '[]'::jsonb)
  INTO _by_age FROM (
    SELECT COALESCE(NULLIF(viewer_age_range,''),'desconhecido') AS name, COUNT(*)::int AS count
    FROM public.status_views WHERE status_id = _b.status_id AND from_boost = true
    GROUP BY 1
  ) t;

  SELECT COALESCE(jsonb_agg(row_to_json(t) ORDER BY (row_to_json(t)->>'count')::int DESC), '[]'::jsonb)
  INTO _by_gender FROM (
    SELECT COALESCE(NULLIF(viewer_gender,''),'desconhecido') AS name, COUNT(*)::int AS count
    FROM public.status_views WHERE status_id = _b.status_id AND from_boost = true
    GROUP BY 1
  ) t;

  SELECT COALESCE(jsonb_agg(row_to_json(t)), '[]'::jsonb)
  INTO _series FROM (
    SELECT to_char(date_trunc('day', viewed_at), 'YYYY-MM-DD') AS date,
      COUNT(*)::int AS views,
      0::int AS clicks
    FROM public.status_views WHERE status_id = _b.status_id AND from_boost = true
    GROUP BY 1
    UNION ALL
    SELECT to_char(date_trunc('day', created_at), 'YYYY-MM-DD') AS date,
      0::int AS views,
      COUNT(*)::int AS clicks
    FROM public.status_boost_clicks WHERE boost_id = _boost_id
    GROUP BY 1
  ) t;

  RETURN jsonb_build_object(
    'boost', row_to_json(_b),
    'views_delivered', _views,
    'clicks', _clicks,
    'ctr', CASE WHEN _views > 0 THEN round((_clicks::numeric/_views)*100, 2) ELSE 0 END,
    'real_cpm_cents', CASE WHEN _views > 0 THEN round((_b.amount_cents::numeric/_views)*1000)::int ELSE 0 END,
    'by_state', _by_state,
    'by_age', _by_age,
    'by_gender', _by_gender,
    'series', _series
  );
END;
$function$;

-- 8. Admin overview
CREATE OR REPLACE FUNCTION public.admin_boost_overview(_days integer DEFAULT 30)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  _since timestamptz := now() - (_days || ' days')::interval;
  _total int; _active int; _completed int; _refunded int;
  _revenue bigint; _avg_ticket numeric;
  _by_type jsonb; _by_objective jsonb; _by_state jsonb; _series jsonb; _recent jsonb;
BEGIN
  IF NOT (has_role(auth.uid(),'admin'::app_role) OR has_role(auth.uid(),'moderator'::app_role) OR has_role(auth.uid(),'superadmin'::app_role)) THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;

  SELECT COUNT(*) FILTER (WHERE created_at >= _since),
         COUNT(*) FILTER (WHERE status = 'active' AND created_at >= _since),
         COUNT(*) FILTER (WHERE status = 'completed' AND created_at >= _since),
         COUNT(*) FILTER (WHERE status = 'refunded' AND created_at >= _since),
         COALESCE(SUM(amount_cents) FILTER (WHERE status IN ('active','completed') AND created_at >= _since), 0)
  INTO _total, _active, _completed, _refunded, _revenue
  FROM public.status_boosts;

  _avg_ticket := CASE WHEN _total > 0 THEN round((_revenue::numeric / _total)/100, 2) ELSE 0 END;

  SELECT COALESCE(jsonb_agg(row_to_json(t)), '[]'::jsonb) INTO _by_type FROM (
    SELECT boost_type AS name, COUNT(*)::int AS count, COALESCE(SUM(amount_cents),0)::bigint AS revenue_cents
    FROM public.status_boosts WHERE created_at >= _since GROUP BY 1
  ) t;

  SELECT COALESCE(jsonb_agg(row_to_json(t) ORDER BY (row_to_json(t)->>'count')::int DESC), '[]'::jsonb)
  INTO _by_objective FROM (
    SELECT objective AS name, COUNT(*)::int AS count, COALESCE(SUM(amount_cents),0)::bigint AS revenue_cents
    FROM public.status_boosts WHERE created_at >= _since GROUP BY 1
  ) t;

  SELECT COALESCE(jsonb_agg(row_to_json(t) ORDER BY (row_to_json(t)->>'count')::int DESC), '[]'::jsonb)
  INTO _by_state FROM (
    SELECT state AS name, COUNT(*)::int AS count
    FROM public.status_boosts, unnest(CASE WHEN cardinality(target_states)=0 THEN ARRAY['todos']::text[] ELSE target_states END) AS state
    WHERE created_at >= _since GROUP BY 1 LIMIT 30
  ) t;

  SELECT COALESCE(jsonb_agg(row_to_json(t)), '[]'::jsonb)
  INTO _series FROM (
    SELECT to_char(date_trunc('day', created_at),'YYYY-MM-DD') AS date,
      COUNT(*)::int AS count,
      COALESCE(SUM(amount_cents),0)::bigint AS revenue_cents
    FROM public.status_boosts WHERE created_at >= _since GROUP BY 1 ORDER BY 1
  ) t;

  SELECT COALESCE(jsonb_agg(row_to_json(t)), '[]'::jsonb)
  INTO _recent FROM (
    SELECT b.id, b.user_id, b.boost_type, b.package, b.objective, b.amount_cents, b.currency,
           b.status, b.views_total, b.views_remaining, b.created_at, b.duration_days,
           b.target_states, b.target_gender, b.target_age_min, b.target_age_max,
           p.username, p.display_name
    FROM public.status_boosts b
    LEFT JOIN public.profiles p ON p.id = b.user_id
    WHERE b.created_at >= _since
    ORDER BY b.created_at DESC LIMIT 100
  ) t;

  RETURN jsonb_build_object(
    'total', _total, 'active', _active, 'completed', _completed, 'refunded', _refunded,
    'revenue_cents', _revenue, 'avg_ticket', _avg_ticket,
    'by_type', _by_type, 'by_objective', _by_objective, 'by_state', _by_state,
    'series', _series, 'recent', _recent, 'days', _days
  );
END;
$function$;

-- 9. Update get_my_sponsored_status_ids to respect segmentation
CREATE OR REPLACE FUNCTION public.get_my_sponsored_status_ids()
 RETURNS SETOF uuid
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  WITH me AS (
    SELECT auth.uid() AS uid,
      (SELECT region FROM public.profiles_private WHERE user_id = auth.uid()) AS my_state,
      (SELECT gender FROM public.profiles_private WHERE user_id = auth.uid()) AS my_gender
  )
  SELECT s.id
  FROM public.statuses s, me
  WHERE me.uid IS NOT NULL
    AND s.user_id <> me.uid
    AND s.expires_at > now()
    AND EXISTS (
      SELECT 1 FROM public.status_boosts sb
      WHERE sb.status_id = s.id
        AND sb.status = 'active'
        AND sb.views_remaining > 0
        AND (sb.ends_at IS NULL OR sb.ends_at > now())
        AND (cardinality(sb.target_states) = 0 OR me.my_state = ANY(sb.target_states))
        AND (sb.target_gender = 'all' OR sb.target_gender = me.my_gender)
    )
    AND NOT public.users_share_conversation(me.uid, s.user_id);
$function$;
