
-- Add new profile fields
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS goal text,
  ADD COLUMN IF NOT EXISTS visibility text NOT NULL DEFAULT 'public',
  ADD COLUMN IF NOT EXISTS show_city boolean NOT NULL DEFAULT false;

-- Validate visibility values
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'profiles_visibility_check') THEN
    ALTER TABLE public.profiles ADD CONSTRAINT profiles_visibility_check
      CHECK (visibility IN ('public','private'));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'profiles_goal_check') THEN
    ALTER TABLE public.profiles ADD CONSTRAINT profiles_goal_check
      CHECK (goal IS NULL OR goal IN ('amizades','networking','negocios','comunidades'));
  END IF;
END $$;

-- Profile view requests (for private profiles)
CREATE TABLE IF NOT EXISTS public.profile_view_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  requester_id uuid NOT NULL,
  owner_id uuid NOT NULL,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','approved','denied')),
  created_at timestamptz NOT NULL DEFAULT now(),
  responded_at timestamptz,
  UNIQUE (requester_id, owner_id)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.profile_view_requests TO authenticated;
GRANT ALL ON public.profile_view_requests TO service_role;

ALTER TABLE public.profile_view_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users see own requests"
  ON public.profile_view_requests FOR SELECT TO authenticated
  USING (auth.uid() = requester_id OR auth.uid() = owner_id);

CREATE POLICY "Users create own requests"
  ON public.profile_view_requests FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = requester_id AND requester_id <> owner_id);

CREATE POLICY "Owner responds to request"
  ON public.profile_view_requests FOR UPDATE TO authenticated
  USING (auth.uid() = owner_id) WITH CHECK (auth.uid() = owner_id);

CREATE POLICY "Requester cancels"
  ON public.profile_view_requests FOR DELETE TO authenticated
  USING (auth.uid() = requester_id);

-- Function: can current viewer see private fields of owner?
CREATE OR REPLACE FUNCTION public.can_view_full_profile(_owner uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT
    _owner = auth.uid()
    OR EXISTS (SELECT 1 FROM public.profiles WHERE id = _owner AND visibility = 'public')
    OR public.users_share_conversation(auth.uid(), _owner)
    OR EXISTS (
      SELECT 1 FROM public.profile_view_requests
      WHERE owner_id = _owner AND requester_id = auth.uid() AND status = 'approved'
    );
$$;

-- Public profile fetch RPC
CREATE OR REPLACE FUNCTION public.get_public_profile(_username text)
RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE
  _p record;
  _full boolean;
  _interests text[];
  _city text;
  _request_status text;
BEGIN
  SELECT id, username, display_name, avatar_url, bio, goal, visibility, show_city, created_at
    INTO _p FROM public.profiles WHERE lower(username) = lower(_username);
  IF NOT FOUND THEN RETURN NULL; END IF;

  _full := public.can_view_full_profile(_p.id);
  _interests := public.survey_interest_tags(_p.id);

  IF _p.show_city THEN
    SELECT city INTO _city FROM public.profiles_private WHERE user_id = _p.id;
  END IF;

  IF auth.uid() IS NOT NULL AND auth.uid() <> _p.id THEN
    SELECT status INTO _request_status FROM public.profile_view_requests
      WHERE owner_id = _p.id AND requester_id = auth.uid();
  END IF;

  RETURN jsonb_build_object(
    'id', _p.id,
    'username', _p.username,
    'display_name', _p.display_name,
    'avatar_url', _p.avatar_url,
    'visibility', _p.visibility,
    'created_at', _p.created_at,
    'can_view_full', _full,
    'request_status', _request_status,
    'bio', CASE WHEN _full THEN _p.bio END,
    'goal', CASE WHEN _full THEN _p.goal END,
    'city', CASE WHEN _full THEN _city END,
    'interests', CASE WHEN _full THEN _interests ELSE ARRAY[]::text[] END
  );
END;
$$;

-- Request access RPC
CREATE OR REPLACE FUNCTION public.request_profile_view(_owner uuid)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _uid uuid := auth.uid(); _name text;
BEGIN
  IF _uid IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  IF _uid = _owner THEN RAISE EXCEPTION 'Cannot request own profile'; END IF;

  INSERT INTO public.profile_view_requests (requester_id, owner_id)
  VALUES (_uid, _owner)
  ON CONFLICT (requester_id, owner_id) DO NOTHING;

  SELECT COALESCE(display_name, username, 'Alguém') INTO _name FROM public.profiles WHERE id = _uid;

  INSERT INTO public.notifications (user_id, type, title, body, data)
  VALUES (_owner, 'profile_view_request',
    _name || ' quer ver seu perfil',
    'Toque para aprovar ou recusar.',
    jsonb_build_object('requester_id', _uid));

  RETURN jsonb_build_object('ok', true);
END;
$$;

-- Respond RPC
CREATE OR REPLACE FUNCTION public.respond_profile_view(_requester uuid, _approve boolean)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _uid uuid := auth.uid();
BEGIN
  IF _uid IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  UPDATE public.profile_view_requests
    SET status = CASE WHEN _approve THEN 'approved' ELSE 'denied' END,
        responded_at = now()
    WHERE owner_id = _uid AND requester_id = _requester;
  RETURN jsonb_build_object('ok', true);
END;
$$;
