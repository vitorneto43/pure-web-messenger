
-- ============ Perfis ============
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS interests text[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS birth_date date;

-- Limite de 8 interesses por usuário
ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_interests_max;
ALTER TABLE public.profiles ADD CONSTRAINT profiles_interests_max
  CHECK (array_length(interests, 1) IS NULL OR array_length(interests, 1) <= 8);

CREATE INDEX IF NOT EXISTS idx_profiles_interests_gin ON public.profiles USING gin (interests);

-- ============ status_boosts ============
ALTER TABLE public.status_boosts
  ADD COLUMN IF NOT EXISTS target_interests text[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS review_status text NOT NULL DEFAULT 'approved',
  ADD COLUMN IF NOT EXISTS review_reason text,
  ADD COLUMN IF NOT EXISTS reviewed_at timestamptz;

ALTER TABLE public.status_boosts DROP CONSTRAINT IF EXISTS status_boosts_review_status_check;
ALTER TABLE public.status_boosts ADD CONSTRAINT status_boosts_review_status_check
  CHECK (review_status IN ('under_review','approved','rejected'));

CREATE INDEX IF NOT EXISTS idx_status_boosts_review ON public.status_boosts (review_status)
  WHERE review_status = 'under_review';

-- ============ post_boosts ============
ALTER TABLE public.post_boosts
  ADD COLUMN IF NOT EXISTS target_interests text[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS review_status text NOT NULL DEFAULT 'approved',
  ADD COLUMN IF NOT EXISTS review_reason text,
  ADD COLUMN IF NOT EXISTS reviewed_at timestamptz;

ALTER TABLE public.post_boosts DROP CONSTRAINT IF EXISTS post_boosts_review_status_check;
ALTER TABLE public.post_boosts ADD CONSTRAINT post_boosts_review_status_check
  CHECK (review_status IN ('under_review','approved','rejected'));

CREATE INDEX IF NOT EXISTS idx_post_boosts_review ON public.post_boosts (review_status)
  WHERE review_status = 'under_review';

-- ============ Resultados de análise ============
CREATE TABLE IF NOT EXISTS public.boost_review_results (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  boost_id uuid NOT NULL,
  boost_kind text NOT NULL CHECK (boost_kind IN ('status','post')),
  verdict text NOT NULL CHECK (verdict IN ('approved','rejected','needs_review')),
  reviewer text NOT NULL CHECK (reviewer IN ('auto_local','auto_ai','admin')),
  category text,
  reason text,
  confidence numeric(3,2),
  payload jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_boost_review_boost ON public.boost_review_results (boost_id);

GRANT SELECT ON public.boost_review_results TO authenticated;
GRANT ALL ON public.boost_review_results TO service_role;

ALTER TABLE public.boost_review_results ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Owner reads own review results" ON public.boost_review_results;
CREATE POLICY "Owner reads own review results"
  ON public.boost_review_results FOR SELECT
  TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.status_boosts sb
            WHERE sb.id = boost_review_results.boost_id AND sb.user_id = auth.uid())
    OR EXISTS (SELECT 1 FROM public.post_boosts pb
            WHERE pb.id = boost_review_results.boost_id AND pb.user_id = auth.uid())
    OR has_role(auth.uid(), 'admin'::app_role)
    OR has_role(auth.uid(), 'moderator'::app_role)
  );

-- ============ Relatório com by_interest ============
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
  _by_state jsonb; _by_age jsonb; _by_gender jsonb; _by_country jsonb;
  _by_interest jsonb; _series jsonb;
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

  -- NOVO: por interesse (junta interesses do viewer)
  SELECT COALESCE(jsonb_agg(row_to_json(t) ORDER BY (row_to_json(t)->>'count')::int DESC), '[]'::jsonb)
  INTO _by_interest FROM (
    SELECT interest AS name, COUNT(*)::int AS count
    FROM public.status_views sv
    JOIN public.profiles p ON p.id = sv.viewer_id
    CROSS JOIN LATERAL unnest(p.interests) AS interest
    WHERE sv.status_id = _b.status_id AND sv.from_boost = true
    GROUP BY 1
    ORDER BY 2 DESC LIMIT 15
  ) t;

  SELECT COALESCE(jsonb_agg(row_to_json(t)), '[]'::jsonb)
  INTO _series FROM (
    SELECT to_char(date_trunc('day', viewed_at), 'YYYY-MM-DD') AS date,
      COUNT(*)::int AS views, 0::int AS clicks
    FROM public.status_views WHERE status_id = _b.status_id AND from_boost = true
    GROUP BY 1
    UNION ALL
    SELECT to_char(date_trunc('day', created_at), 'YYYY-MM-DD') AS date,
      0::int AS views, COUNT(*)::int AS clicks
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
    'by_interest', _by_interest,
    'series', _series
  );
END;
$function$;
