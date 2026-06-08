
CREATE OR REPLACE FUNCTION public.discover_people(_limit integer DEFAULT 12)
 RETURNS TABLE(id uuid, username text, display_name text, avatar_url text, city text, region text, country text, mutual_count integer, reason text, score integer)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  WITH me AS (SELECT auth.uid() AS uid),
  myp AS (SELECT pp.city, pp.region, pp.country FROM public.profiles_private pp WHERE pp.user_id = (SELECT uid FROM me)),
  mysurvey AS (SELECT s.reason_joined, s.main_goal, s.favorite_feature FROM public.user_onboarding_survey s WHERE s.user_id = (SELECT uid FROM me)),
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
  same_goal AS (
    SELECT s.user_id AS candidate_id, 0::int AS mutual_count, 'mesmo objetivo no WaveChat' AS reason, 85 AS score
    FROM public.user_onboarding_survey s, mysurvey
    WHERE mysurvey.main_goal IS NOT NULL AND s.main_goal = mysurvey.main_goal
      AND s.user_id <> (SELECT uid FROM me) AND s.user_id NOT IN (SELECT contact_id FROM my_contacts)
  ),
  same_reason AS (
    SELECT s.user_id AS candidate_id, 0::int AS mutual_count, 'entrou pelo mesmo motivo' AS reason, 75 AS score
    FROM public.user_onboarding_survey s, mysurvey
    WHERE mysurvey.reason_joined IS NOT NULL AND s.reason_joined = mysurvey.reason_joined
      AND s.user_id <> (SELECT uid FROM me) AND s.user_id NOT IN (SELECT contact_id FROM my_contacts)
  ),
  same_feature AS (
    SELECT s.user_id AS candidate_id, 0::int AS mutual_count, 'curte os mesmos recursos' AS reason, 65 AS score
    FROM public.user_onboarding_survey s, mysurvey
    WHERE mysurvey.favorite_feature IS NOT NULL AND s.favorite_feature = mysurvey.favorite_feature
      AND s.user_id <> (SELECT uid FROM me) AND s.user_id NOT IN (SELECT contact_id FROM my_contacts)
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
    SELECT * FROM fof
    UNION ALL SELECT * FROM same_goal
    UNION ALL SELECT * FROM same_reason
    UNION ALL SELECT * FROM same_feature
    UNION ALL SELECT * FROM same_city
    UNION ALL SELECT * FROM same_region
    UNION ALL SELECT * FROM same_country
    UNION ALL SELECT * FROM invitees_of_invitees
    UNION ALL SELECT * FROM recent
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

CREATE OR REPLACE FUNCTION public.get_people_you_may_know(_limit integer DEFAULT 12)
 RETURNS TABLE(id uuid, username text, display_name text, avatar_url text, mutual_count integer, reason text)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  WITH me AS (SELECT auth.uid() AS uid),
  mysurvey AS (SELECT s.reason_joined, s.main_goal, s.favorite_feature FROM public.user_onboarding_survey s WHERE s.user_id = (SELECT uid FROM me)),
  my_contacts AS (
    SELECT DISTINCT mb.user_id AS contact_id
    FROM public.conversation_members ma
    JOIN public.conversation_members mb ON ma.conversation_id = mb.conversation_id
    WHERE ma.user_id = (SELECT uid FROM me)
      AND mb.user_id <> (SELECT uid FROM me)
  ),
  fof AS (
    SELECT mb.user_id AS candidate_id, COUNT(DISTINCT mc.contact_id)::int AS mutual_count, 'amigos em comum' AS reason, 100 AS score
    FROM my_contacts mc
    JOIN public.conversation_members ma ON ma.user_id = mc.contact_id
    JOIN public.conversation_members mb ON mb.conversation_id = ma.conversation_id
    WHERE mb.user_id <> (SELECT uid FROM me)
      AND mb.user_id NOT IN (SELECT contact_id FROM my_contacts)
    GROUP BY mb.user_id
  ),
  same_goal AS (
    SELECT s.user_id AS candidate_id, 0::int AS mutual_count, 'mesmo objetivo no WaveChat' AS reason, 85 AS score
    FROM public.user_onboarding_survey s, mysurvey
    WHERE mysurvey.main_goal IS NOT NULL AND s.main_goal = mysurvey.main_goal
      AND s.user_id <> (SELECT uid FROM me) AND s.user_id NOT IN (SELECT contact_id FROM my_contacts)
  ),
  same_reason AS (
    SELECT s.user_id AS candidate_id, 0::int AS mutual_count, 'entrou pelo mesmo motivo' AS reason, 75 AS score
    FROM public.user_onboarding_survey s, mysurvey
    WHERE mysurvey.reason_joined IS NOT NULL AND s.reason_joined = mysurvey.reason_joined
      AND s.user_id <> (SELECT uid FROM me) AND s.user_id NOT IN (SELECT contact_id FROM my_contacts)
  ),
  same_feature AS (
    SELECT s.user_id AS candidate_id, 0::int AS mutual_count, 'curte os mesmos recursos' AS reason, 65 AS score
    FROM public.user_onboarding_survey s, mysurvey
    WHERE mysurvey.favorite_feature IS NOT NULL AND s.favorite_feature = mysurvey.favorite_feature
      AND s.user_id <> (SELECT uid FROM me) AND s.user_id NOT IN (SELECT contact_id FROM my_contacts)
  ),
  invitees_of_invitees AS (
    SELECT p.id AS candidate_id, 0::int AS mutual_count, 'rede de convites' AS reason, 60 AS score
    FROM public.profiles p
    WHERE p.invited_by IN (
      SELECT id FROM public.profiles WHERE invited_by = (SELECT uid FROM me)
    )
    AND p.id <> (SELECT uid FROM me)
    AND p.id NOT IN (SELECT contact_id FROM my_contacts)
  ),
  combined AS (
    SELECT * FROM fof
    UNION ALL SELECT * FROM same_goal
    UNION ALL SELECT * FROM same_reason
    UNION ALL SELECT * FROM same_feature
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
$function$;
