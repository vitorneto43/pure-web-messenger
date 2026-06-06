CREATE OR REPLACE FUNCTION public.admin_user_activity_stats()
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  _total int;
  _active_today int;
  _active_7 int;
  _active_30 int;
  _cohort_d1 int; _ret_d1 int;
  _cohort_d7 int; _ret_d7 int;
  _cohort_d30 int; _ret_d30 int;
  _series jsonb;
  _recent jsonb;
  _total_logins int;
  _messages_total int;
  _calls_total int;
  _top_countries jsonb;
  _top_languages jsonb;
  _top_sources jsonb;
BEGIN
  SELECT COUNT(*) INTO _total FROM public.profiles;
  SELECT COUNT(*) INTO _active_today FROM public.profiles WHERE last_seen >= now() - interval '1 day';
  SELECT COUNT(*) INTO _active_7 FROM public.profiles WHERE last_seen >= now() - interval '7 days';
  SELECT COUNT(*) INTO _active_30 FROM public.profiles WHERE last_seen >= now() - interval '30 days';

  SELECT COUNT(*) INTO _cohort_d1 FROM public.profiles WHERE created_at <= now() - interval '1 day';
  SELECT COUNT(*) INTO _ret_d1 FROM public.profiles
    WHERE created_at <= now() - interval '1 day'
      AND last_seen >= created_at + interval '1 day';

  SELECT COUNT(*) INTO _cohort_d7 FROM public.profiles WHERE created_at <= now() - interval '7 days';
  SELECT COUNT(*) INTO _ret_d7 FROM public.profiles
    WHERE created_at <= now() - interval '7 days'
      AND last_seen >= created_at + interval '7 days';

  SELECT COUNT(*) INTO _cohort_d30 FROM public.profiles WHERE created_at <= now() - interval '30 days';
  SELECT COUNT(*) INTO _ret_d30 FROM public.profiles
    WHERE created_at <= now() - interval '30 days'
      AND last_seen >= created_at + interval '30 days';

  -- Total logins = distinct (user_id, session_id) for authenticated sessions
  SELECT COUNT(*) INTO _total_logins FROM (
    SELECT DISTINCT user_id, session_id
    FROM public.analytics_events
    WHERE user_id IS NOT NULL AND session_id IS NOT NULL
  ) s;

  SELECT COUNT(*) INTO _messages_total FROM public.messages;
  SELECT COUNT(*) INTO _calls_total FROM public.calls;

  SELECT COALESCE(jsonb_agg(row_to_json(t) ORDER BY (row_to_json(t)->>'count')::int DESC), '[]'::jsonb)
  INTO _top_countries FROM (
    SELECT COALESCE(NULLIF(country,''), 'desconhecido') AS name, COUNT(*)::int AS count
    FROM public.profiles
    GROUP BY 1
    ORDER BY 2 DESC
    LIMIT 15
  ) t;

  SELECT COALESCE(jsonb_agg(row_to_json(t) ORDER BY (row_to_json(t)->>'count')::int DESC), '[]'::jsonb)
  INTO _top_languages FROM (
    SELECT COALESCE(NULLIF(metadata->>'language',''), 'desconhecido') AS name,
           COUNT(DISTINCT COALESCE(user_id::text, session_id))::int AS count
    FROM public.analytics_events
    WHERE created_at >= now() - interval '90 days'
    GROUP BY 1
    ORDER BY 2 DESC
    LIMIT 15
  ) t;

  SELECT COALESCE(jsonb_agg(row_to_json(t) ORDER BY (row_to_json(t)->>'count')::int DESC), '[]'::jsonb)
  INTO _top_sources FROM (
    SELECT COALESCE(NULLIF(signup_source,''), 'desconhecido') AS name, COUNT(*)::int AS count
    FROM public.profiles
    GROUP BY 1
    ORDER BY 2 DESC
    LIMIT 15
  ) t;

  WITH days AS (
    SELECT generate_series(
      date_trunc('day', now() - interval '29 days'),
      date_trunc('day', now()),
      interval '1 day'
    )::date AS day
  ),
  sg AS (
    SELECT date_trunc('day', created_at)::date AS day, COUNT(*)::int AS n
    FROM public.profiles
    WHERE created_at >= now() - interval '30 days'
    GROUP BY 1
  ),
  ac AS (
    SELECT date_trunc('day', last_seen)::date AS day, COUNT(*)::int AS n
    FROM public.profiles
    WHERE last_seen >= now() - interval '30 days'
    GROUP BY 1
  )
  SELECT COALESCE(jsonb_agg(jsonb_build_object(
    'date', to_char(d.day, 'YYYY-MM-DD'),
    'signups', COALESCE(sg.n, 0),
    'active', COALESCE(ac.n, 0)
  ) ORDER BY d.day), '[]'::jsonb)
  INTO _series
  FROM days d
  LEFT JOIN sg ON sg.day = d.day
  LEFT JOIN ac ON ac.day = d.day;

  SELECT COALESCE(jsonb_agg(row_to_json(t)), '[]'::jsonb)
  INTO _recent
  FROM (
    SELECT id, username, display_name, created_at, last_seen,
      EXTRACT(EPOCH FROM (last_seen - created_at))/86400 AS days_since_signup
    FROM public.profiles
    ORDER BY created_at DESC
    LIMIT 50
  ) t;

  RETURN jsonb_build_object(
    'total', _total,
    'active_today', _active_today,
    'active_7', _active_7,
    'active_30', _active_30,
    'total_logins', _total_logins,
    'messages_total', _messages_total,
    'calls_total', _calls_total,
    'top_countries', _top_countries,
    'top_languages', _top_languages,
    'top_sources', _top_sources,
    'retention', jsonb_build_object(
      'd1', jsonb_build_object('cohort', _cohort_d1, 'returned', _ret_d1,
        'rate', CASE WHEN _cohort_d1 > 0 THEN round((_ret_d1::numeric / _cohort_d1) * 100, 2) ELSE 0 END),
      'd7', jsonb_build_object('cohort', _cohort_d7, 'returned', _ret_d7,
        'rate', CASE WHEN _cohort_d7 > 0 THEN round((_ret_d7::numeric / _cohort_d7) * 100, 2) ELSE 0 END),
      'd30', jsonb_build_object('cohort', _cohort_d30, 'returned', _ret_d30,
        'rate', CASE WHEN _cohort_d30 > 0 THEN round((_ret_d30::numeric / _cohort_d30) * 100, 2) ELSE 0 END)
    ),
    'series', _series,
    'recent', _recent
  );
END;
$function$;