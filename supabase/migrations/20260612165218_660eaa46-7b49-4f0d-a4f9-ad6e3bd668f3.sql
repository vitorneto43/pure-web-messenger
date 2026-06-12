
CREATE OR REPLACE FUNCTION public.get_boost_report(_boost_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  _uid uuid := auth.uid();
  _b RECORD;
  _views int; _clicks int; _reactions int;
  _by_state jsonb; _by_age jsonb; _by_gender jsonb; _by_country jsonb; _series jsonb;
BEGIN
  SELECT * INTO _b FROM public.status_boosts WHERE id = _boost_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Boost not found'; END IF;
  IF _b.user_id <> _uid AND NOT has_role(_uid,'admin'::app_role) AND NOT has_role(_uid,'moderator'::app_role) THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;

  SELECT COUNT(*) INTO _views FROM public.status_views WHERE status_id = _b.status_id AND from_boost = true;
  SELECT COUNT(*) INTO _clicks FROM public.status_boost_clicks WHERE boost_id = _boost_id;
  SELECT COUNT(*) INTO _reactions FROM public.status_reactions
    WHERE status_id = _b.status_id AND created_at >= _b.created_at;

  SELECT COALESCE(jsonb_agg(row_to_json(t) ORDER BY (row_to_json(t)->>'count')::int DESC), '[]'::jsonb)
  INTO _by_state FROM (
    SELECT COALESCE(NULLIF(viewer_state,''),'?') AS name, COUNT(*)::int AS count
    FROM public.status_views WHERE status_id = _b.status_id AND from_boost = true
    GROUP BY 1 ORDER BY 2 DESC LIMIT 15
  ) t;

  SELECT COALESCE(jsonb_agg(row_to_json(t) ORDER BY (row_to_json(t)->>'count')::int DESC), '[]'::jsonb)
  INTO _by_country FROM (
    SELECT COALESCE(NULLIF(viewer_country,''),'?') AS name, COUNT(*)::int AS count
    FROM public.status_views WHERE status_id = _b.status_id AND from_boost = true
    GROUP BY 1 ORDER BY 2 DESC LIMIT 15
  ) t;

  SELECT COALESCE(jsonb_agg(row_to_json(t) ORDER BY (row_to_json(t)->>'count')::int DESC), '[]'::jsonb)
  INTO _by_age FROM (
    SELECT COALESCE(NULLIF(viewer_age_range,''),'?') AS name, COUNT(*)::int AS count
    FROM public.status_views WHERE status_id = _b.status_id AND from_boost = true
    GROUP BY 1
  ) t;

  SELECT COALESCE(jsonb_agg(row_to_json(t) ORDER BY (row_to_json(t)->>'count')::int DESC), '[]'::jsonb)
  INTO _by_gender FROM (
    SELECT COALESCE(NULLIF(viewer_gender,''),'?') AS name, COUNT(*)::int AS count
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
    'reactions', _reactions,
    'ctr', CASE WHEN _views > 0 THEN round((_clicks::numeric/_views)*100, 2) ELSE 0 END,
    'real_cpm_cents', CASE WHEN _views > 0 THEN round((_b.amount_cents::numeric/_views)*1000)::int ELSE 0 END,
    'cpc_cents', CASE WHEN _clicks > 0 THEN round(_b.amount_cents::numeric/_clicks)::int ELSE 0 END,
    'cost_per_view_cents', CASE WHEN _views > 0 THEN round(_b.amount_cents::numeric/_views, 2) ELSE 0 END,
    'by_state', _by_state,
    'by_country', _by_country,
    'by_age', _by_age,
    'by_gender', _by_gender,
    'series', _series
  );
END;
$function$;
