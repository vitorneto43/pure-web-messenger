
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS social_links jsonb NOT NULL DEFAULT '{}'::jsonb;

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
  SELECT id, username, display_name, avatar_url, bio, goal, visibility, show_city, created_at, social_links
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
    'interests', CASE WHEN _full THEN _interests ELSE ARRAY[]::text[] END,
    'social_links', CASE WHEN _full THEN COALESCE(_p.social_links, '{}'::jsonb) ELSE '{}'::jsonb END
  );
END;
$$;
