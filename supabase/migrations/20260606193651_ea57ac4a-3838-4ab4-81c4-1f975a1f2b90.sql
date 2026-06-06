
-- Discover people: blends mutual contacts, region, invite network, recent
CREATE OR REPLACE FUNCTION public.discover_people(_limit int DEFAULT 12)
RETURNS TABLE (
  id uuid,
  username text,
  display_name text,
  avatar_url text,
  city text,
  region text,
  country text,
  mutual_count int,
  reason text,
  score int
)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  WITH me AS (
    SELECT auth.uid() AS uid
  ),
  myp AS (
    SELECT city, region, country FROM public.profiles WHERE id = (SELECT uid FROM me)
  ),
  my_contacts AS (
    SELECT DISTINCT mb.user_id AS contact_id
    FROM public.conversation_members ma
    JOIN public.conversation_members mb ON ma.conversation_id = mb.conversation_id
    WHERE ma.user_id = (SELECT uid FROM me) AND mb.user_id <> (SELECT uid FROM me)
  ),
  fof AS (
    SELECT mb.user_id AS candidate_id, COUNT(DISTINCT mc.contact_id)::int AS mutual_count,
           'amigos em comum' AS reason, 100 AS score
    FROM my_contacts mc
    JOIN public.conversation_members ma ON ma.user_id = mc.contact_id
    JOIN public.conversation_members mb ON mb.conversation_id = ma.conversation_id
    WHERE mb.user_id <> (SELECT uid FROM me)
      AND mb.user_id NOT IN (SELECT contact_id FROM my_contacts)
    GROUP BY mb.user_id
  ),
  same_city AS (
    SELECT p.id AS candidate_id, 0::int AS mutual_count,
           'da sua cidade' AS reason, 70 AS score
    FROM public.profiles p, myp
    WHERE myp.city IS NOT NULL AND p.city IS NOT NULL
      AND lower(p.city) = lower(myp.city)
      AND p.id <> (SELECT uid FROM me)
      AND p.id NOT IN (SELECT contact_id FROM my_contacts)
  ),
  same_region AS (
    SELECT p.id AS candidate_id, 0::int AS mutual_count,
           'da sua região' AS reason, 50 AS score
    FROM public.profiles p, myp
    WHERE myp.region IS NOT NULL AND p.region IS NOT NULL
      AND lower(p.region) = lower(myp.region)
      AND p.id <> (SELECT uid FROM me)
      AND p.id NOT IN (SELECT contact_id FROM my_contacts)
  ),
  same_country AS (
    SELECT p.id AS candidate_id, 0::int AS mutual_count,
           'do seu país' AS reason, 30 AS score
    FROM public.profiles p, myp
    WHERE myp.country IS NOT NULL AND p.country IS NOT NULL
      AND lower(p.country) = lower(myp.country)
      AND p.id <> (SELECT uid FROM me)
      AND p.id NOT IN (SELECT contact_id FROM my_contacts)
  ),
  invitees_of_invitees AS (
    SELECT p.id AS candidate_id, 0::int AS mutual_count,
           'rede de convites' AS reason, 60 AS score
    FROM public.profiles p
    WHERE p.invited_by IN (
      SELECT id FROM public.profiles WHERE invited_by = (SELECT uid FROM me)
    )
    AND p.id <> (SELECT uid FROM me)
    AND p.id NOT IN (SELECT contact_id FROM my_contacts)
  ),
  recent AS (
    SELECT p.id AS candidate_id, 0::int AS mutual_count,
           'novo no Wavechat' AS reason, 20 AS score
    FROM public.profiles p
    JOIN auth.users u ON u.id = p.id
    WHERE u.email_confirmed_at IS NOT NULL
      AND p.id <> (SELECT uid FROM me)
      AND p.id NOT IN (SELECT contact_id FROM my_contacts)
      AND p.created_at > now() - interval '30 days'
  ),
  combined AS (
    SELECT * FROM fof
    UNION ALL SELECT * FROM same_city
    UNION ALL SELECT * FROM same_region
    UNION ALL SELECT * FROM same_country
    UNION ALL SELECT * FROM invitees_of_invitees
    UNION ALL SELECT * FROM recent
  ),
  ranked AS (
    SELECT candidate_id,
           MAX(mutual_count)::int AS mutual_count,
           (ARRAY_AGG(reason ORDER BY score DESC))[1] AS reason,
           MAX(score)::int AS score
    FROM combined
    GROUP BY candidate_id
  )
  SELECT p.id, p.username, p.display_name, p.avatar_url,
         p.city, p.region, p.country,
         r.mutual_count, r.reason, r.score
  FROM ranked r
  JOIN public.profiles p ON p.id = r.candidate_id
  ORDER BY r.score DESC, r.mutual_count DESC, p.created_at DESC
  LIMIT _limit;
$$;

GRANT EXECUTE ON FUNCTION public.discover_people(int) TO authenticated;

-- Notify other user when a new 1:1 conversation is created with them
CREATE OR REPLACE FUNCTION public.notify_on_new_direct_member()
RETURNS TRIGGER
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  _is_group boolean;
  _creator uuid;
  _creator_name text;
  _other uuid;
BEGIN
  SELECT is_group, created_by INTO _is_group, _creator
  FROM public.conversations WHERE id = NEW.conversation_id;
  IF _is_group OR _creator IS NULL THEN RETURN NEW; END IF;
  IF NEW.user_id = _creator THEN RETURN NEW; END IF;

  -- Only notify the recipient (the non-creator just added)
  _other := NEW.user_id;

  SELECT COALESCE(display_name, username, 'Alguém')
    INTO _creator_name FROM public.profiles WHERE id = _creator;

  INSERT INTO public.notifications (user_id, type, title, body, data)
  VALUES (
    _other,
    'new_chat',
    _creator_name || ' quer conversar com você',
    'Abra para responder e começar a conversa.',
    jsonb_build_object('conversation_id', NEW.conversation_id, 'from_user_id', _creator)
  );

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_notify_on_new_direct_member ON public.conversation_members;
CREATE TRIGGER trg_notify_on_new_direct_member
AFTER INSERT ON public.conversation_members
FOR EACH ROW EXECUTE FUNCTION public.notify_on_new_direct_member();
