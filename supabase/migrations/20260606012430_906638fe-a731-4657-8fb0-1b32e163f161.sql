
CREATE OR REPLACE FUNCTION public.admin_user_activity_stats()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
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
BEGIN
  SELECT COUNT(*) INTO _total FROM public.profiles;
  SELECT COUNT(*) INTO _active_today FROM public.profiles WHERE last_seen >= now() - interval '1 day';
  SELECT COUNT(*) INTO _active_7 FROM public.profiles WHERE last_seen >= now() - interval '7 days';
  SELECT COUNT(*) INTO _active_30 FROM public.profiles WHERE last_seen >= now() - interval '30 days';

  -- D+1 retention: users who signed up at least 1 day ago, and have last_seen >= created_at + 1 day
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

  -- 30-day daily series: signups vs active users (by last_seen)
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

  -- Recent users with their last_seen for diagnostic listing
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
$$;
