
CREATE TABLE public.user_onboarding_survey (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL UNIQUE,
  reason_joined text NOT NULL,
  source_channel text NOT NULL,
  favorite_feature text NOT NULL,
  main_goal text NOT NULL,
  age_range text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT ON public.user_onboarding_survey TO authenticated;
GRANT ALL ON public.user_onboarding_survey TO service_role;

ALTER TABLE public.user_onboarding_survey ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users insert own survey" ON public.user_onboarding_survey
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users view own survey" ON public.user_onboarding_survey
  FOR SELECT TO authenticated
  USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin'::public.app_role));

CREATE INDEX idx_user_onboarding_survey_created_at ON public.user_onboarding_survey(created_at DESC);

-- Aggregated stats function for the admin panel
CREATE OR REPLACE FUNCTION public.admin_onboarding_survey_stats(_days integer DEFAULT 365)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _since timestamptz := now() - (_days || ' days')::interval;
  _total int; _today int; _week int; _month int;
  _by_reason jsonb; _by_source jsonb; _by_feature jsonb; _by_goal jsonb; _by_age jsonb;
  _by_country jsonb; _by_city jsonb;
  _recent jsonb;
BEGIN
  IF NOT has_role(auth.uid(), 'admin'::app_role) THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;

  SELECT COUNT(*) INTO _total FROM public.user_onboarding_survey WHERE created_at >= _since;
  SELECT COUNT(*) INTO _today FROM public.user_onboarding_survey WHERE created_at >= now() - interval '1 day';
  SELECT COUNT(*) INTO _week FROM public.user_onboarding_survey WHERE created_at >= now() - interval '7 days';
  SELECT COUNT(*) INTO _month FROM public.user_onboarding_survey WHERE created_at >= now() - interval '30 days';

  SELECT COALESCE(jsonb_agg(row_to_json(t) ORDER BY (row_to_json(t)->>'count')::int DESC), '[]'::jsonb)
  INTO _by_reason FROM (
    SELECT reason_joined AS name, COUNT(*)::int AS count
    FROM public.user_onboarding_survey
    WHERE created_at >= _since
    GROUP BY reason_joined
  ) t;

  SELECT COALESCE(jsonb_agg(row_to_json(t) ORDER BY (row_to_json(t)->>'count')::int DESC), '[]'::jsonb)
  INTO _by_source FROM (
    SELECT source_channel AS name, COUNT(*)::int AS count
    FROM public.user_onboarding_survey
    WHERE created_at >= _since
    GROUP BY source_channel
  ) t;

  SELECT COALESCE(jsonb_agg(row_to_json(t) ORDER BY (row_to_json(t)->>'count')::int DESC), '[]'::jsonb)
  INTO _by_feature FROM (
    SELECT favorite_feature AS name, COUNT(*)::int AS count
    FROM public.user_onboarding_survey
    WHERE created_at >= _since
    GROUP BY favorite_feature
  ) t;

  SELECT COALESCE(jsonb_agg(row_to_json(t) ORDER BY (row_to_json(t)->>'count')::int DESC), '[]'::jsonb)
  INTO _by_goal FROM (
    SELECT main_goal AS name, COUNT(*)::int AS count
    FROM public.user_onboarding_survey
    WHERE created_at >= _since
    GROUP BY main_goal
  ) t;

  SELECT COALESCE(jsonb_agg(row_to_json(t) ORDER BY (row_to_json(t)->>'count')::int DESC), '[]'::jsonb)
  INTO _by_age FROM (
    SELECT age_range AS name, COUNT(*)::int AS count
    FROM public.user_onboarding_survey
    WHERE created_at >= _since
    GROUP BY age_range
  ) t;

  SELECT COALESCE(jsonb_agg(row_to_json(t) ORDER BY (row_to_json(t)->>'count')::int DESC), '[]'::jsonb)
  INTO _by_country FROM (
    SELECT COALESCE(NULLIF(p.country,''),'desconhecido') AS name, COUNT(*)::int AS count
    FROM public.user_onboarding_survey s
    LEFT JOIN public.profiles p ON p.id = s.user_id
    WHERE s.created_at >= _since
    GROUP BY 1
    LIMIT 20
  ) t;

  SELECT COALESCE(jsonb_agg(row_to_json(t) ORDER BY (row_to_json(t)->>'count')::int DESC), '[]'::jsonb)
  INTO _by_city FROM (
    SELECT COALESCE(NULLIF(p.city,''),'desconhecido') AS name, COUNT(*)::int AS count
    FROM public.user_onboarding_survey s
    LEFT JOIN public.profiles p ON p.id = s.user_id
    WHERE s.created_at >= _since
    GROUP BY 1
    LIMIT 20
  ) t;

  SELECT COALESCE(jsonb_agg(row_to_json(t)), '[]'::jsonb) INTO _recent FROM (
    SELECT s.id, s.user_id, s.reason_joined, s.source_channel, s.favorite_feature,
           s.main_goal, s.age_range, s.created_at,
           p.username, p.display_name, p.country, p.city
    FROM public.user_onboarding_survey s
    LEFT JOIN public.profiles p ON p.id = s.user_id
    ORDER BY s.created_at DESC
    LIMIT 500
  ) t;

  RETURN jsonb_build_object(
    'total', _total,
    'today', _today,
    'week', _week,
    'month', _month,
    'byReason', _by_reason,
    'bySource', _by_source,
    'byFeature', _by_feature,
    'byGoal', _by_goal,
    'byAge', _by_age,
    'byCountry', _by_country,
    'byCity', _by_city,
    'recent', _recent,
    'days', _days
  );
END;
$$;
