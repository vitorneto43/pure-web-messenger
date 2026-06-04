
-- Invite rewards table
CREATE TABLE IF NOT EXISTS public.invite_rewards (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  views_amount integer NOT NULL DEFAULT 100,
  granted_for_count integer NOT NULL DEFAULT 3,
  redeemed boolean NOT NULL DEFAULT false,
  redeemed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.invite_rewards TO authenticated;
GRANT ALL ON public.invite_rewards TO service_role;

ALTER TABLE public.invite_rewards ENABLE ROW LEVEL SECURITY;

CREATE POLICY "owner_select_invite_rewards" ON public.invite_rewards
  FOR SELECT TO authenticated USING (auth.uid() = user_id);

-- Add free reward flag to boosts (column already exists in many setups; guarded)
ALTER TABLE public.status_boosts
  ADD COLUMN IF NOT EXISTS is_free_reward boolean NOT NULL DEFAULT false;

-- Claim invite reward: 1 reward per 3 uncredited accepted invites
CREATE OR REPLACE FUNCTION public.claim_invite_reward()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _uid uuid := auth.uid();
  _accepted int;
  _already_credited int;
  _eligible int;
  _new_rewards int;
  _i int;
BEGIN
  IF _uid IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  SELECT COUNT(*) INTO _accepted FROM public.profiles WHERE invited_by = _uid;
  SELECT COALESCE(SUM(granted_for_count),0) INTO _already_credited
    FROM public.invite_rewards WHERE user_id = _uid;
  _eligible := _accepted - _already_credited;
  _new_rewards := _eligible / 3;
  IF _new_rewards <= 0 THEN
    RETURN jsonb_build_object('granted', 0, 'invited', _accepted, 'eligible_next', _eligible);
  END IF;
  FOR _i IN 1.._new_rewards LOOP
    INSERT INTO public.invite_rewards (user_id, views_amount, granted_for_count)
    VALUES (_uid, 100, 3);
  END LOOP;
  RETURN jsonb_build_object('granted', _new_rewards, 'invited', _accepted, 'eligible_next', _eligible - (_new_rewards*3));
END;
$$;

GRANT EXECUTE ON FUNCTION public.claim_invite_reward() TO authenticated;

-- Invite stats summary
CREATE OR REPLACE FUNCTION public.get_invite_stats()
RETURNS jsonb
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _uid uuid := auth.uid();
  _accepted int;
  _credited int;
  _pending_rewards int;
  _unredeemed_views int;
BEGIN
  IF _uid IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  SELECT COUNT(*) INTO _accepted FROM public.profiles WHERE invited_by = _uid;
  SELECT COALESCE(SUM(granted_for_count),0) INTO _credited
    FROM public.invite_rewards WHERE user_id = _uid;
  SELECT COUNT(*) INTO _pending_rewards
    FROM public.invite_rewards WHERE user_id = _uid AND redeemed = false;
  SELECT COALESCE(SUM(views_amount),0) INTO _unredeemed_views
    FROM public.invite_rewards WHERE user_id = _uid AND redeemed = false;
  RETURN jsonb_build_object(
    'invited', _accepted,
    'invited_credited', _credited,
    'invited_until_next_reward', GREATEST(3 - ((_accepted - _credited) % 3), 0) % 3,
    'pending_rewards', _pending_rewards,
    'pending_views', _unredeemed_views
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_invite_stats() TO authenticated;

-- People you may know: friends-of-friends + invited-by-my-invitees
CREATE OR REPLACE FUNCTION public.get_people_you_may_know(_limit int DEFAULT 12)
RETURNS TABLE(id uuid, username text, display_name text, avatar_url text, mutual_count int, reason text)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  WITH me AS (SELECT auth.uid() AS uid),
  my_contacts AS (
    SELECT DISTINCT mb.user_id AS contact_id
    FROM public.conversation_members ma
    JOIN public.conversation_members mb ON ma.conversation_id = mb.conversation_id
    WHERE ma.user_id = (SELECT uid FROM me)
      AND mb.user_id <> (SELECT uid FROM me)
  ),
  fof AS (
    SELECT mb.user_id AS candidate_id, COUNT(DISTINCT mc.contact_id)::int AS mutual_count
    FROM my_contacts mc
    JOIN public.conversation_members ma ON ma.user_id = mc.contact_id
    JOIN public.conversation_members mb ON mb.conversation_id = ma.conversation_id
    WHERE mb.user_id <> (SELECT uid FROM me)
      AND mb.user_id NOT IN (SELECT contact_id FROM my_contacts)
    GROUP BY mb.user_id
  ),
  invitees_of_invitees AS (
    SELECT p.id AS candidate_id, 0::int AS mutual_count
    FROM public.profiles p
    WHERE p.invited_by IN (
      SELECT id FROM public.profiles WHERE invited_by = (SELECT uid FROM me)
    )
    AND p.id <> (SELECT uid FROM me)
    AND p.id NOT IN (SELECT contact_id FROM my_contacts)
  ),
  combined AS (
    SELECT candidate_id, mutual_count, 'amigos em comum' AS reason FROM fof
    UNION
    SELECT candidate_id, mutual_count, 'rede de convites' AS reason FROM invitees_of_invitees
  )
  SELECT p.id, p.username, p.display_name, p.avatar_url,
         MAX(c.mutual_count)::int AS mutual_count,
         MAX(c.reason) AS reason
  FROM combined c
  JOIN public.profiles p ON p.id = c.candidate_id
  GROUP BY p.id, p.username, p.display_name, p.avatar_url
  ORDER BY MAX(c.mutual_count) DESC, p.username
  LIMIT _limit;
$$;

GRANT EXECUTE ON FUNCTION public.get_people_you_may_know(int) TO authenticated;
