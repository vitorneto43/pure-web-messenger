CREATE OR REPLACE FUNCTION public.admin_onboarding_survey_stats(_days integer DEFAULT 365)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  _since timestamptz := now() - (_days || ' days')::interval;
  _total int; _today int; _week int; _month int;
  _by_reason jsonb; _by_source jsonb; _by_feature jsonb; _by_goal jsonb; _by_age jsonb;
  _by_country jsonb; _by_city jsonb; _recent jsonb;
BEGIN
  IF NOT (auth.role() = 'service_role' OR has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'moderator'::app_role)) THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;

  SELECT COUNT(*) INTO _total FROM public.user_onboarding_survey WHERE created_at >= _since;
  SELECT COUNT(*) INTO _today FROM public.user_onboarding_survey WHERE created_at >= now() - interval '1 day';
  SELECT COUNT(*) INTO _week FROM public.user_onboarding_survey WHERE created_at >= now() - interval '7 days';
  SELECT COUNT(*) INTO _month FROM public.user_onboarding_survey WHERE created_at >= now() - interval '30 days';

  SELECT COALESCE(jsonb_agg(row_to_json(t) ORDER BY (row_to_json(t)->>'count')::int DESC), '[]'::jsonb) INTO _by_reason FROM (
    SELECT reason_joined AS name, COUNT(*)::int AS count FROM public.user_onboarding_survey WHERE created_at >= _since GROUP BY reason_joined
  ) t;
  SELECT COALESCE(jsonb_agg(row_to_json(t) ORDER BY (row_to_json(t)->>'count')::int DESC), '[]'::jsonb) INTO _by_source FROM (
    SELECT source_channel AS name, COUNT(*)::int AS count FROM public.user_onboarding_survey WHERE created_at >= _since GROUP BY source_channel
  ) t;
  SELECT COALESCE(jsonb_agg(row_to_json(t) ORDER BY (row_to_json(t)->>'count')::int DESC), '[]'::jsonb) INTO _by_feature FROM (
    SELECT favorite_feature AS name, COUNT(*)::int AS count FROM public.user_onboarding_survey WHERE created_at >= _since GROUP BY favorite_feature
  ) t;
  SELECT COALESCE(jsonb_agg(row_to_json(t) ORDER BY (row_to_json(t)->>'count')::int DESC), '[]'::jsonb) INTO _by_goal FROM (
    SELECT main_goal AS name, COUNT(*)::int AS count FROM public.user_onboarding_survey WHERE created_at >= _since GROUP BY main_goal
  ) t;
  SELECT COALESCE(jsonb_agg(row_to_json(t) ORDER BY (row_to_json(t)->>'count')::int DESC), '[]'::jsonb) INTO _by_age FROM (
    SELECT age_range AS name, COUNT(*)::int AS count FROM public.user_onboarding_survey WHERE created_at >= _since GROUP BY age_range
  ) t;

  SELECT COALESCE(jsonb_agg(row_to_json(t) ORDER BY (row_to_json(t)->>'count')::int DESC), '[]'::jsonb) INTO _by_country FROM (
    SELECT COALESCE(NULLIF(pp.country,''),'desconhecido') AS name, COUNT(*)::int AS count
    FROM public.user_onboarding_survey s
    LEFT JOIN public.profiles_private pp ON pp.user_id = s.user_id
    WHERE s.created_at >= _since GROUP BY 1 LIMIT 20
  ) t;
  SELECT COALESCE(jsonb_agg(row_to_json(t) ORDER BY (row_to_json(t)->>'count')::int DESC), '[]'::jsonb) INTO _by_city FROM (
    SELECT COALESCE(NULLIF(pp.city,''),'desconhecido') AS name, COUNT(*)::int AS count
    FROM public.user_onboarding_survey s
    LEFT JOIN public.profiles_private pp ON pp.user_id = s.user_id
    WHERE s.created_at >= _since GROUP BY 1 LIMIT 20
  ) t;

  SELECT COALESCE(jsonb_agg(row_to_json(t)), '[]'::jsonb) INTO _recent FROM (
    SELECT s.id, s.user_id, s.reason_joined, s.source_channel, s.favorite_feature,
           s.main_goal, s.age_range, s.created_at,
           p.username, p.display_name, pp.country, pp.city
    FROM public.user_onboarding_survey s
    LEFT JOIN public.profiles p ON p.id = s.user_id
    LEFT JOIN public.profiles_private pp ON pp.user_id = s.user_id
    WHERE s.created_at >= _since
    ORDER BY s.created_at DESC LIMIT 500
  ) t;

  RETURN jsonb_build_object('total',_total,'today',_today,'week',_week,'month',_month,
    'byReason',_by_reason,'bySource',_by_source,'byFeature',_by_feature,'byGoal',_by_goal,
    'byAge',_by_age,'byCountry',_by_country,'byCity',_by_city,'recent',_recent,'days',_days);
END;
$function$;