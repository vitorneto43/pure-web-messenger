
-- Move sensitive tracking columns from profiles to profiles_private (owner-only access)
ALTER TABLE public.profiles_private
  ADD COLUMN IF NOT EXISTS last_ip text,
  ADD COLUMN IF NOT EXISTS city text,
  ADD COLUMN IF NOT EXISTS region text,
  ADD COLUMN IF NOT EXISTS country text,
  ADD COLUMN IF NOT EXISTS device_platform text,
  ADD COLUMN IF NOT EXISTS app_version text;

INSERT INTO public.profiles_private (user_id, last_ip, city, region, country, device_platform, app_version)
SELECT id, last_ip, city, region, country, device_platform, app_version
FROM public.profiles
WHERE last_ip IS NOT NULL OR city IS NOT NULL OR region IS NOT NULL
   OR country IS NOT NULL OR device_platform IS NOT NULL OR app_version IS NOT NULL
ON CONFLICT (user_id) DO UPDATE SET
  last_ip = COALESCE(EXCLUDED.last_ip, public.profiles_private.last_ip),
  city = COALESCE(EXCLUDED.city, public.profiles_private.city),
  region = COALESCE(EXCLUDED.region, public.profiles_private.region),
  country = COALESCE(EXCLUDED.country, public.profiles_private.country),
  device_platform = COALESCE(EXCLUDED.device_platform, public.profiles_private.device_platform),
  app_version = COALESCE(EXCLUDED.app_version, public.profiles_private.app_version);

-- Update functions that referenced profiles.country/city to use profiles_private
CREATE OR REPLACE FUNCTION public.admin_user_activity_stats()
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  _total int; _active_today int; _active_7 int; _active_30 int;
  _cohort_d1 int; _ret_d1 int; _cohort_d7 int; _ret_d7 int; _cohort_d30 int; _ret_d30 int;
  _series jsonb; _recent jsonb;
  _total_logins int; _messages_total int; _calls_total int;
  _top_countries jsonb; _top_languages jsonb; _top_sources jsonb;
BEGIN
  SELECT COUNT(*) INTO _total FROM public.profiles;
  SELECT COUNT(*) INTO _active_today FROM public.profiles WHERE last_seen >= now() - interval '1 day';
  SELECT COUNT(*) INTO _active_7 FROM public.profiles WHERE last_seen >= now() - interval '7 days';
  SELECT COUNT(*) INTO _active_30 FROM public.profiles WHERE last_seen >= now() - interval '30 days';

  SELECT COUNT(*) INTO _cohort_d1 FROM public.profiles WHERE created_at <= now() - interval '1 day';
  SELECT COUNT(*) INTO _ret_d1 FROM public.profiles
    WHERE created_at <= now() - interval '1 day' AND last_seen >= created_at + interval '1 day';
  SELECT COUNT(*) INTO _cohort_d7 FROM public.profiles WHERE created_at <= now() - interval '7 days';
  SELECT COUNT(*) INTO _ret_d7 FROM public.profiles
    WHERE created_at <= now() - interval '7 days' AND last_seen >= created_at + interval '7 days';
  SELECT COUNT(*) INTO _cohort_d30 FROM public.profiles WHERE created_at <= now() - interval '30 days';
  SELECT COUNT(*) INTO _ret_d30 FROM public.profiles
    WHERE created_at <= now() - interval '30 days' AND last_seen >= created_at + interval '30 days';

  SELECT COUNT(*) INTO _total_logins FROM (
    SELECT DISTINCT user_id, session_id FROM public.analytics_events
    WHERE user_id IS NOT NULL AND session_id IS NOT NULL
  ) s;

  SELECT COUNT(*) INTO _messages_total FROM public.messages;
  SELECT COUNT(*) INTO _calls_total FROM public.calls;

  SELECT COALESCE(jsonb_agg(row_to_json(t) ORDER BY (row_to_json(t)->>'count')::int DESC), '[]'::jsonb)
  INTO _top_countries FROM (
    SELECT COALESCE(NULLIF(pp.country,''), 'desconhecido') AS name, COUNT(*)::int AS count
    FROM public.profiles p
    LEFT JOIN public.profiles_private pp ON pp.user_id = p.id
    GROUP BY 1 ORDER BY 2 DESC LIMIT 15
  ) t;

  SELECT COALESCE(jsonb_agg(row_to_json(t) ORDER BY (row_to_json(t)->>'count')::int DESC), '[]'::jsonb)
  INTO _top_languages FROM (
    SELECT COALESCE(NULLIF(metadata->>'language',''), 'desconhecido') AS name,
           COUNT(DISTINCT COALESCE(user_id::text, session_id))::int AS count
    FROM public.analytics_events WHERE created_at >= now() - interval '90 days'
    GROUP BY 1 ORDER BY 2 DESC LIMIT 15
  ) t;

  SELECT COALESCE(jsonb_agg(row_to_json(t) ORDER BY (row_to_json(t)->>'count')::int DESC), '[]'::jsonb)
  INTO _top_sources FROM (
    SELECT COALESCE(NULLIF(signup_source,''), 'desconhecido') AS name, COUNT(*)::int AS count
    FROM public.profiles GROUP BY 1 ORDER BY 2 DESC LIMIT 15
  ) t;

  WITH days AS (
    SELECT generate_series(date_trunc('day', now() - interval '29 days'), date_trunc('day', now()), interval '1 day')::date AS day
  ),
  sg AS (SELECT date_trunc('day', created_at)::date AS day, COUNT(*)::int AS n FROM public.profiles WHERE created_at >= now() - interval '30 days' GROUP BY 1),
  ac AS (SELECT date_trunc('day', last_seen)::date AS day, COUNT(*)::int AS n FROM public.profiles WHERE last_seen >= now() - interval '30 days' GROUP BY 1)
  SELECT COALESCE(jsonb_agg(jsonb_build_object('date', to_char(d.day, 'YYYY-MM-DD'), 'signups', COALESCE(sg.n, 0), 'active', COALESCE(ac.n, 0)) ORDER BY d.day), '[]'::jsonb)
  INTO _series FROM days d LEFT JOIN sg ON sg.day = d.day LEFT JOIN ac ON ac.day = d.day;

  SELECT COALESCE(jsonb_agg(row_to_json(t)), '[]'::jsonb) INTO _recent FROM (
    SELECT p.id, p.username, p.display_name, p.created_at, p.last_seen,
      EXTRACT(EPOCH FROM (p.last_seen - p.created_at))/86400 AS days_since_signup
    FROM public.profiles p ORDER BY p.created_at DESC LIMIT 50
  ) t;

  RETURN jsonb_build_object(
    'total', _total, 'active_today', _active_today, 'active_7', _active_7, 'active_30', _active_30,
    'total_logins', _total_logins, 'messages_total', _messages_total, 'calls_total', _calls_total,
    'top_countries', _top_countries, 'top_languages', _top_languages, 'top_sources', _top_sources,
    'retention', jsonb_build_object(
      'd1', jsonb_build_object('cohort', _cohort_d1, 'returned', _ret_d1, 'rate', CASE WHEN _cohort_d1>0 THEN round((_ret_d1::numeric/_cohort_d1)*100,2) ELSE 0 END),
      'd7', jsonb_build_object('cohort', _cohort_d7, 'returned', _ret_d7, 'rate', CASE WHEN _cohort_d7>0 THEN round((_ret_d7::numeric/_cohort_d7)*100,2) ELSE 0 END),
      'd30', jsonb_build_object('cohort', _cohort_d30, 'returned', _ret_d30, 'rate', CASE WHEN _cohort_d30>0 THEN round((_ret_d30::numeric/_cohort_d30)*100,2) ELSE 0 END)
    ),
    'series', _series, 'recent', _recent
  );
END;
$function$;

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
  IF NOT has_role(auth.uid(), 'admin'::app_role) THEN RAISE EXCEPTION 'Not authorized'; END IF;

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
    ORDER BY s.created_at DESC LIMIT 500
  ) t;

  RETURN jsonb_build_object('total',_total,'today',_today,'week',_week,'month',_month,
    'byReason',_by_reason,'bySource',_by_source,'byFeature',_by_feature,'byGoal',_by_goal,
    'byAge',_by_age,'byCountry',_by_country,'byCity',_by_city,'recent',_recent,'days',_days);
END;
$function$;

CREATE OR REPLACE FUNCTION public.discover_people(_limit integer DEFAULT 12)
 RETURNS TABLE(id uuid, username text, display_name text, avatar_url text, city text, region text, country text, mutual_count integer, reason text, score integer)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  WITH me AS (SELECT auth.uid() AS uid),
  myp AS (SELECT pp.city, pp.region, pp.country FROM public.profiles_private pp WHERE pp.user_id = (SELECT uid FROM me)),
  my_contacts AS (
    SELECT DISTINCT mb.user_id AS contact_id
    FROM public.conversation_members ma
    JOIN public.conversation_members mb ON ma.conversation_id = mb.conversation_id
    WHERE ma.user_id = (SELECT uid FROM me) AND mb.user_id <> (SELECT uid FROM me)
  ),
  fof AS (
    SELECT mb.user_id AS candidate_id, COUNT(DISTINCT mc.contact_id)::int AS mutual_count, 'amigos em comum' AS reason, 100 AS score
    FROM my_contacts mc
    JOIN public.conversation_members ma ON ma.user_id = mc.contact_id
    JOIN public.conversation_members mb ON mb.conversation_id = ma.conversation_id
    WHERE mb.user_id <> (SELECT uid FROM me) AND mb.user_id NOT IN (SELECT contact_id FROM my_contacts)
    GROUP BY mb.user_id
  ),
  same_city AS (
    SELECT p.id AS candidate_id, 0::int AS mutual_count, 'da sua cidade' AS reason, 70 AS score
    FROM public.profiles p
    JOIN public.profiles_private pp ON pp.user_id = p.id, myp
    WHERE myp.city IS NOT NULL AND pp.city IS NOT NULL AND lower(pp.city) = lower(myp.city)
      AND p.id <> (SELECT uid FROM me) AND p.id NOT IN (SELECT contact_id FROM my_contacts)
  ),
  same_region AS (
    SELECT p.id AS candidate_id, 0::int AS mutual_count, 'da sua região' AS reason, 50 AS score
    FROM public.profiles p
    JOIN public.profiles_private pp ON pp.user_id = p.id, myp
    WHERE myp.region IS NOT NULL AND pp.region IS NOT NULL AND lower(pp.region) = lower(myp.region)
      AND p.id <> (SELECT uid FROM me) AND p.id NOT IN (SELECT contact_id FROM my_contacts)
  ),
  same_country AS (
    SELECT p.id AS candidate_id, 0::int AS mutual_count, 'do seu país' AS reason, 30 AS score
    FROM public.profiles p
    JOIN public.profiles_private pp ON pp.user_id = p.id, myp
    WHERE myp.country IS NOT NULL AND pp.country IS NOT NULL AND lower(pp.country) = lower(myp.country)
      AND p.id <> (SELECT uid FROM me) AND p.id NOT IN (SELECT contact_id FROM my_contacts)
  ),
  invitees_of_invitees AS (
    SELECT p.id AS candidate_id, 0::int AS mutual_count, 'rede de convites' AS reason, 60 AS score
    FROM public.profiles p
    WHERE p.invited_by IN (SELECT id FROM public.profiles WHERE invited_by = (SELECT uid FROM me))
      AND p.id <> (SELECT uid FROM me) AND p.id NOT IN (SELECT contact_id FROM my_contacts)
  ),
  recent AS (
    SELECT p.id AS candidate_id, 0::int AS mutual_count, 'novo no Wavechat' AS reason, 20 AS score
    FROM public.profiles p JOIN auth.users u ON u.id = p.id
    WHERE u.email_confirmed_at IS NOT NULL AND p.id <> (SELECT uid FROM me)
      AND p.id NOT IN (SELECT contact_id FROM my_contacts) AND p.created_at > now() - interval '30 days'
  ),
  combined AS (
    SELECT * FROM fof UNION ALL SELECT * FROM same_city UNION ALL SELECT * FROM same_region
    UNION ALL SELECT * FROM same_country UNION ALL SELECT * FROM invitees_of_invitees UNION ALL SELECT * FROM recent
  ),
  ranked AS (
    SELECT candidate_id, MAX(mutual_count)::int AS mutual_count,
      (ARRAY_AGG(reason ORDER BY score DESC))[1] AS reason, MAX(score)::int AS score
    FROM combined GROUP BY candidate_id
  )
  SELECT p.id, p.username, p.display_name, p.avatar_url,
         pp.city, pp.region, pp.country,
         r.mutual_count, r.reason, r.score
  FROM ranked r
  JOIN public.profiles p ON p.id = r.candidate_id
  LEFT JOIN public.profiles_private pp ON pp.user_id = p.id
  ORDER BY r.score DESC, r.mutual_count DESC, p.created_at DESC
  LIMIT _limit;
$function$;

-- Drop sensitive columns from profiles
ALTER TABLE public.profiles
  DROP COLUMN IF EXISTS last_ip,
  DROP COLUMN IF EXISTS city,
  DROP COLUMN IF EXISTS region,
  DROP COLUMN IF EXISTS country,
  DROP COLUMN IF EXISTS device_platform,
  DROP COLUMN IF EXISTS app_version;
