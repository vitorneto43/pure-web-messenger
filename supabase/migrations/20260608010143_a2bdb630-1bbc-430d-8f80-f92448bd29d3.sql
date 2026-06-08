
-- Helper: deriva tags de interesse amplas a partir das respostas da pesquisa
CREATE OR REPLACE FUNCTION public.survey_interest_tags(_user_id uuid)
RETURNS text[]
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  WITH s AS (
    SELECT reason_joined, source_channel, favorite_feature, main_goal, age_range
    FROM public.user_onboarding_survey
    WHERE user_id = _user_id
    ORDER BY created_at DESC
    LIMIT 1
  )
  SELECT COALESCE(ARRAY(
    SELECT DISTINCT tag FROM (
      SELECT 'networking'::text AS tag FROM s
        WHERE main_goal ILIKE '%trabalho%' OR main_goal ILIKE '%network%'
           OR favorite_feature ILIKE '%network%' OR favorite_feature ILIKE '%profission%'
           OR reason_joined ILIKE '%trabalho%' OR reason_joined ILIKE '%network%'
      UNION ALL
      SELECT 'amizades' FROM s
        WHERE main_goal ILIKE '%amiza%' OR main_goal ILIKE '%amig%'
           OR reason_joined ILIKE '%conhecer%' OR reason_joined ILIKE '%pessoas%'
           OR reason_joined ILIKE '%amig%'
      UNION ALL
      SELECT 'privacidade' FROM s
        WHERE favorite_feature ILIKE '%privacidade%' OR favorite_feature ILIKE '%sem telefone%'
           OR favorite_feature ILIKE '%anonim%' OR reason_joined ILIKE '%privacidade%'
      UNION ALL
      SELECT 'relacionamento' FROM s
        WHERE main_goal ILIKE '%relacionament%' OR main_goal ILIKE '%namor%'
           OR reason_joined ILIKE '%namor%' OR reason_joined ILIKE '%relacionament%'
      UNION ALL
      SELECT 'conteudo' FROM s
        WHERE favorite_feature ILIKE '%status%' OR favorite_feature ILIKE '%conteúd%'
           OR favorite_feature ILIKE '%conteud%' OR main_goal ILIKE '%conteúd%'
           OR main_goal ILIKE '%conteud%' OR main_goal ILIKE '%divulg%'
      UNION ALL
      SELECT 'descoberta' FROM s
        WHERE reason_joined ILIKE '%curiosidade%' OR reason_joined ILIKE '%descobr%'
           OR reason_joined ILIKE '%novidad%' OR main_goal ILIKE '%explor%'
      UNION ALL
      SELECT 'familia' FROM s
        WHERE main_goal ILIKE '%famíl%' OR main_goal ILIKE '%famil%'
           OR reason_joined ILIKE '%famíl%' OR reason_joined ILIKE '%famil%'
      UNION ALL
      SELECT 'idade:' || age_range FROM s WHERE age_range IS NOT NULL
    ) t
  ), ARRAY[]::text[]);
$$;

GRANT EXECUTE ON FUNCTION public.survey_interest_tags(uuid) TO authenticated, service_role;

-- discover_people: substitui matches exatos por sobreposição de tags (parecidos)
CREATE OR REPLACE FUNCTION public.discover_people(_limit integer DEFAULT 12)
RETURNS TABLE(id uuid, username text, display_name text, avatar_url text, city text, region text, country text, mutual_count integer, reason text, score integer)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  WITH me AS (SELECT auth.uid() AS uid),
  myp AS (SELECT pp.city, pp.region, pp.country FROM public.profiles_private pp WHERE pp.user_id = (SELECT uid FROM me)),
  mytags AS (SELECT public.survey_interest_tags((SELECT uid FROM me)) AS tags),
  my_contacts AS (
    SELECT DISTINCT mb.user_id AS contact_id
    FROM public.conversation_members ma
    JOIN public.conversation_members mb ON ma.conversation_id = mb.conversation_id
    WHERE ma.user_id = (SELECT uid FROM me) AND mb.user_id <> (SELECT uid FROM me)
  ),
  fof AS (
    SELECT mb.user_id AS candidate_id, COUNT(DISTINCT mc.contact_id)::int AS mutual_count, 'amigos em comum'::text AS reason, 100 AS score
    FROM my_contacts mc
    JOIN public.conversation_members ma ON ma.user_id = mc.contact_id
    JOIN public.conversation_members mb ON mb.conversation_id = ma.conversation_id
    WHERE mb.user_id <> (SELECT uid FROM me) AND mb.user_id NOT IN (SELECT contact_id FROM my_contacts)
    GROUP BY mb.user_id
  ),
  similar_interests AS (
    SELECT
      s.user_id AS candidate_id,
      0::int AS mutual_count,
      CASE cardinality(ARRAY(SELECT unnest(public.survey_interest_tags(s.user_id)) INTERSECT SELECT unnest((SELECT tags FROM mytags))))
        WHEN 1 THEN 'interesses parecidos'::text
        ELSE 'vários interesses em comum'::text
      END AS reason,
      (55 + 10 * LEAST(cardinality(ARRAY(SELECT unnest(public.survey_interest_tags(s.user_id)) INTERSECT SELECT unnest((SELECT tags FROM mytags)))), 4))::int AS score
    FROM public.user_onboarding_survey s
    WHERE s.user_id <> (SELECT uid FROM me)
      AND s.user_id NOT IN (SELECT contact_id FROM my_contacts)
      AND public.survey_interest_tags(s.user_id) && (SELECT tags FROM mytags)
      AND cardinality((SELECT tags FROM mytags)) > 0
  ),
  same_city AS (
    SELECT p.id AS candidate_id, 0::int AS mutual_count, 'da sua cidade'::text AS reason, 80 AS score
    FROM public.profiles p
    JOIN public.profiles_private pp ON pp.user_id = p.id, myp
    WHERE myp.city IS NOT NULL AND pp.city IS NOT NULL AND lower(pp.city) = lower(myp.city)
      AND p.id <> (SELECT uid FROM me) AND p.id NOT IN (SELECT contact_id FROM my_contacts)
  ),
  same_region AS (
    SELECT p.id AS candidate_id, 0::int AS mutual_count, 'da sua região'::text AS reason, 50 AS score
    FROM public.profiles p
    JOIN public.profiles_private pp ON pp.user_id = p.id, myp
    WHERE myp.region IS NOT NULL AND pp.region IS NOT NULL AND lower(pp.region) = lower(myp.region)
      AND p.id <> (SELECT uid FROM me) AND p.id NOT IN (SELECT contact_id FROM my_contacts)
  ),
  same_country AS (
    SELECT p.id AS candidate_id, 0::int AS mutual_count, 'do seu país'::text AS reason, 30 AS score
    FROM public.profiles p
    JOIN public.profiles_private pp ON pp.user_id = p.id, myp
    WHERE myp.country IS NOT NULL AND pp.country IS NOT NULL AND lower(pp.country) = lower(myp.country)
      AND p.id <> (SELECT uid FROM me) AND p.id NOT IN (SELECT contact_id FROM my_contacts)
  ),
  invitees_of_invitees AS (
    SELECT p.id AS candidate_id, 0::int AS mutual_count, 'rede de convites'::text AS reason, 60 AS score
    FROM public.profiles p
    WHERE p.invited_by IN (SELECT id FROM public.profiles WHERE invited_by = (SELECT uid FROM me))
      AND p.id <> (SELECT uid FROM me)
      AND p.id NOT IN (SELECT contact_id FROM my_contacts)
  ),
  recent_users AS (
    SELECT p.id AS candidate_id, 0::int AS mutual_count, 'novo no WaveChat'::text AS reason, 10 AS score
    FROM public.profiles p
    WHERE p.id <> (SELECT uid FROM me) AND p.id NOT IN (SELECT contact_id FROM my_contacts)
    ORDER BY p.created_at DESC
    LIMIT 30
  ),
  combined AS (
    SELECT * FROM fof
    UNION ALL SELECT * FROM similar_interests
    UNION ALL SELECT * FROM same_city
    UNION ALL SELECT * FROM same_region
    UNION ALL SELECT * FROM same_country
    UNION ALL SELECT * FROM invitees_of_invitees
    UNION ALL SELECT * FROM recent_users
  ),
  ranked AS (
    SELECT candidate_id, MAX(mutual_count)::int AS mutual_count,
      (ARRAY_AGG(reason ORDER BY score DESC))[1] AS reason, MAX(score)::int AS score
    FROM combined GROUP BY candidate_id
  )
  SELECT p.id, p.username, p.display_name, p.avatar_url, pp.city, pp.region, pp.country,
         r.mutual_count, r.reason, r.score
  FROM ranked r
  JOIN public.profiles p ON p.id = r.candidate_id
  LEFT JOIN public.profiles_private pp ON pp.user_id = p.id
  ORDER BY r.score DESC, r.mutual_count DESC, p.created_at DESC
  LIMIT _limit;
$$;

-- get_people_you_may_know: mesma lógica de interesses parecidos
CREATE OR REPLACE FUNCTION public.get_people_you_may_know(_limit integer DEFAULT 8)
RETURNS TABLE(id uuid, username text, display_name text, avatar_url text, mutual_count integer, reason text)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  WITH me AS (SELECT auth.uid() AS uid),
  mytags AS (SELECT public.survey_interest_tags((SELECT uid FROM me)) AS tags),
  my_contacts AS (
    SELECT DISTINCT mb.user_id AS contact_id
    FROM public.conversation_members ma
    JOIN public.conversation_members mb ON ma.conversation_id = mb.conversation_id
    WHERE ma.user_id = (SELECT uid FROM me) AND mb.user_id <> (SELECT uid FROM me)
  ),
  fof AS (
    SELECT mb.user_id AS candidate_id, COUNT(DISTINCT mc.contact_id)::int AS mutual_count, 'amigos em comum'::text AS reason, 100 AS score
    FROM my_contacts mc
    JOIN public.conversation_members ma ON ma.user_id = mc.contact_id
    JOIN public.conversation_members mb ON mb.conversation_id = ma.conversation_id
    WHERE mb.user_id <> (SELECT uid FROM me) AND mb.user_id NOT IN (SELECT contact_id FROM my_contacts)
    GROUP BY mb.user_id
  ),
  similar_interests AS (
    SELECT
      s.user_id AS candidate_id,
      0::int AS mutual_count,
      CASE cardinality(ARRAY(SELECT unnest(public.survey_interest_tags(s.user_id)) INTERSECT SELECT unnest((SELECT tags FROM mytags))))
        WHEN 1 THEN 'interesses parecidos'::text
        ELSE 'vários interesses em comum'::text
      END AS reason,
      (55 + 10 * LEAST(cardinality(ARRAY(SELECT unnest(public.survey_interest_tags(s.user_id)) INTERSECT SELECT unnest((SELECT tags FROM mytags)))), 4))::int AS score
    FROM public.user_onboarding_survey s
    WHERE s.user_id <> (SELECT uid FROM me)
      AND s.user_id NOT IN (SELECT contact_id FROM my_contacts)
      AND public.survey_interest_tags(s.user_id) && (SELECT tags FROM mytags)
      AND cardinality((SELECT tags FROM mytags)) > 0
  ),
  invitees_of_invitees AS (
    SELECT p.id AS candidate_id, 0::int AS mutual_count, 'rede de convites'::text AS reason, 60 AS score
    FROM public.profiles p
    WHERE p.invited_by IN (SELECT id FROM public.profiles WHERE invited_by = (SELECT uid FROM me))
      AND p.id <> (SELECT uid FROM me)
      AND p.id NOT IN (SELECT contact_id FROM my_contacts)
  ),
  combined AS (
    SELECT * FROM fof
    UNION ALL SELECT * FROM similar_interests
    UNION ALL SELECT * FROM invitees_of_invitees
  ),
  ranked AS (
    SELECT candidate_id, MAX(mutual_count)::int AS mutual_count,
      (ARRAY_AGG(reason ORDER BY score DESC))[1] AS reason, MAX(score)::int AS score
    FROM combined GROUP BY candidate_id
  )
  SELECT p.id, p.username, p.display_name, p.avatar_url, r.mutual_count, r.reason
  FROM ranked r
  JOIN public.profiles p ON p.id = r.candidate_id
  ORDER BY r.score DESC, r.mutual_count DESC, p.username
  LIMIT _limit;
$$;
