
CREATE OR REPLACE FUNCTION public.get_post_boost_report(_boost_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  _uid uuid := auth.uid();
  _b RECORD;
  _views int; _clicks int; _reactions int;
  _by_state jsonb; _by_age jsonb; _by_gender jsonb; _by_country jsonb;
  _by_interest jsonb; _series jsonb;
  _since timestamptz;
BEGIN
  SELECT * INTO _b FROM public.post_boosts WHERE id = _boost_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Boost not found'; END IF;
  IF _b.user_id <> _uid AND NOT has_role(_uid,'admin'::app_role) AND NOT has_role(_uid,'moderator'::app_role) THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;

  _since := COALESCE(_b.activated_at, _b.created_at);

  SELECT COUNT(*) INTO _views FROM public.post_views
    WHERE post_id = _b.post_id AND created_at >= _since;
  SELECT COUNT(*) INTO _clicks FROM public.post_boost_clicks WHERE boost_id = _boost_id;
  SELECT COUNT(*) INTO _reactions FROM public.post_reactions
    WHERE post_id = _b.post_id AND created_at >= _since;

  SELECT COALESCE(jsonb_agg(row_to_json(t) ORDER BY (row_to_json(t)->>'count')::int DESC), '[]'::jsonb)
  INTO _by_country FROM (
    SELECT COALESCE(NULLIF(pp.country,''),'?') AS name, COUNT(*)::int AS count
    FROM public.post_views v
    LEFT JOIN public.profiles_private pp ON pp.user_id = v.viewer_id
    WHERE v.post_id = _b.post_id AND v.created_at >= _since
    GROUP BY 1 ORDER BY 2 DESC LIMIT 15
  ) t;

  SELECT COALESCE(jsonb_agg(row_to_json(t) ORDER BY (row_to_json(t)->>'count')::int DESC), '[]'::jsonb)
  INTO _by_state FROM (
    SELECT COALESCE(NULLIF(pp.region,''),'?') AS name, COUNT(*)::int AS count
    FROM public.post_views v
    LEFT JOIN public.profiles_private pp ON pp.user_id = v.viewer_id
    WHERE v.post_id = _b.post_id AND v.created_at >= _since
    GROUP BY 1 ORDER BY 2 DESC LIMIT 15
  ) t;

  SELECT COALESCE(jsonb_agg(row_to_json(t) ORDER BY (row_to_json(t)->>'count')::int DESC), '[]'::jsonb)
  INTO _by_gender FROM (
    SELECT COALESCE(NULLIF(pp.gender,''),'?') AS name, COUNT(*)::int AS count
    FROM public.post_views v
    LEFT JOIN public.profiles_private pp ON pp.user_id = v.viewer_id
    WHERE v.post_id = _b.post_id AND v.created_at >= _since
    GROUP BY 1
  ) t;

  SELECT COALESCE(jsonb_agg(row_to_json(t) ORDER BY (row_to_json(t)->>'count')::int DESC), '[]'::jsonb)
  INTO _by_age FROM (
    SELECT CASE
      WHEN p.birth_date IS NULL THEN '?'
      WHEN age(p.birth_date) < interval '18 years' THEN '13-17'
      WHEN age(p.birth_date) < interval '25 years' THEN '18-24'
      WHEN age(p.birth_date) < interval '35 years' THEN '25-34'
      WHEN age(p.birth_date) < interval '45 years' THEN '35-44'
      WHEN age(p.birth_date) < interval '55 years' THEN '45-54'
      WHEN age(p.birth_date) < interval '65 years' THEN '55-64'
      ELSE '65+' END AS name,
      COUNT(*)::int AS count
    FROM public.post_views v
    LEFT JOIN public.profiles p ON p.id = v.viewer_id
    WHERE v.post_id = _b.post_id AND v.created_at >= _since
    GROUP BY 1
  ) t;

  SELECT COALESCE(jsonb_agg(row_to_json(t) ORDER BY (row_to_json(t)->>'count')::int DESC), '[]'::jsonb)
  INTO _by_interest FROM (
    SELECT interest AS name, COUNT(*)::int AS count
    FROM public.post_views v
    JOIN public.profiles p ON p.id = v.viewer_id
    CROSS JOIN LATERAL unnest(p.interests) AS interest
    WHERE v.post_id = _b.post_id AND v.created_at >= _since
    GROUP BY 1
    ORDER BY 2 DESC LIMIT 15
  ) t;

  SELECT COALESCE(jsonb_agg(row_to_json(t)), '[]'::jsonb)
  INTO _series FROM (
    SELECT to_char(date_trunc('day', created_at), 'YYYY-MM-DD') AS date,
      COUNT(*)::int AS views, 0::int AS clicks
    FROM public.post_views WHERE post_id = _b.post_id AND created_at >= _since
    GROUP BY 1
    UNION ALL
    SELECT to_char(date_trunc('day', created_at), 'YYYY-MM-DD') AS date,
      0::int AS views, COUNT(*)::int AS clicks
    FROM public.post_boost_clicks WHERE boost_id = _boost_id
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
    'by_interest', _by_interest,
    'series', _series
  );
END;
$function$;

GRANT EXECUTE ON FUNCTION public.get_post_boost_report(uuid) TO authenticated;
