
-- profile_views
CREATE TABLE public.profile_views (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  viewer_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  viewed_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_profile_views_owner ON public.profile_views(owner_id, viewed_at DESC);
CREATE INDEX idx_profile_views_pair ON public.profile_views(owner_id, viewer_id, viewed_at DESC);
GRANT SELECT, INSERT ON public.profile_views TO authenticated;
GRANT ALL ON public.profile_views TO service_role;
ALTER TABLE public.profile_views ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Owner reads own profile views" ON public.profile_views FOR SELECT TO authenticated USING (auth.uid() = owner_id);
CREATE POLICY "Viewer inserts own view" ON public.profile_views FOR INSERT TO authenticated WITH CHECK (auth.uid() = viewer_id AND viewer_id <> owner_id);

-- profile_follows
CREATE TABLE public.profile_follows (
  follower_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  following_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (follower_id, following_id),
  CHECK (follower_id <> following_id)
);
CREATE INDEX idx_profile_follows_following ON public.profile_follows(following_id);
GRANT SELECT, INSERT, DELETE ON public.profile_follows TO authenticated;
GRANT ALL ON public.profile_follows TO service_role;
ALTER TABLE public.profile_follows ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone signed in can read follows" ON public.profile_follows FOR SELECT TO authenticated USING (true);
CREATE POLICY "Users follow as themselves" ON public.profile_follows FOR INSERT TO authenticated WITH CHECK (auth.uid() = follower_id);
CREATE POLICY "Users unfollow themselves" ON public.profile_follows FOR DELETE TO authenticated USING (auth.uid() = follower_id);

-- record_profile_view
CREATE OR REPLACE FUNCTION public.record_profile_view(_owner uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _viewer uuid := auth.uid();
BEGIN
  IF _viewer IS NULL OR _viewer = _owner THEN RETURN; END IF;
  IF EXISTS (
    SELECT 1 FROM public.profile_views
    WHERE owner_id = _owner AND viewer_id = _viewer
      AND viewed_at > now() - interval '1 hour'
  ) THEN RETURN; END IF;
  INSERT INTO public.profile_views(owner_id, viewer_id) VALUES (_owner, _viewer);
END;
$$;
GRANT EXECUTE ON FUNCTION public.record_profile_view(uuid) TO authenticated;

-- toggle_follow
CREATE OR REPLACE FUNCTION public.toggle_follow(_target uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _me uuid := auth.uid();
  _exists boolean;
BEGIN
  IF _me IS NULL OR _me = _target THEN RAISE EXCEPTION 'invalid'; END IF;
  SELECT EXISTS(SELECT 1 FROM public.profile_follows WHERE follower_id = _me AND following_id = _target) INTO _exists;
  IF _exists THEN
    DELETE FROM public.profile_follows WHERE follower_id = _me AND following_id = _target;
    RETURN false;
  ELSE
    INSERT INTO public.profile_follows(follower_id, following_id) VALUES (_me, _target);
    RETURN true;
  END IF;
END;
$$;
GRANT EXECUTE ON FUNCTION public.toggle_follow(uuid) TO authenticated;

-- updated get_public_profile
CREATE OR REPLACE FUNCTION public.get_public_profile(_username text)
RETURNS jsonb
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  _p record;
  _full boolean;
  _interests text[];
  _city text;
  _request_status text;
  _me uuid := auth.uid();
  _followers int;
  _following int;
  _views int := NULL;
  _is_following boolean := false;
BEGIN
  SELECT id, username, display_name, avatar_url, bio, goal, visibility, show_city, created_at, social_links
    INTO _p FROM public.profiles WHERE lower(username) = lower(_username);
  IF NOT FOUND THEN RETURN NULL; END IF;

  _full := public.can_view_full_profile(_p.id);
  _interests := public.survey_interest_tags(_p.id);

  IF _p.show_city THEN
    SELECT city INTO _city FROM public.profiles_private WHERE user_id = _p.id;
  END IF;

  IF _me IS NOT NULL AND _me <> _p.id THEN
    SELECT status INTO _request_status FROM public.profile_view_requests
      WHERE owner_id = _p.id AND requester_id = _me;
    SELECT EXISTS(SELECT 1 FROM public.profile_follows WHERE follower_id = _me AND following_id = _p.id) INTO _is_following;
  END IF;

  SELECT count(*) INTO _followers FROM public.profile_follows WHERE following_id = _p.id;
  SELECT count(*) INTO _following FROM public.profile_follows WHERE follower_id = _p.id;

  IF _me = _p.id THEN
    SELECT count(*) INTO _views FROM public.profile_views WHERE owner_id = _p.id;
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
    'social_links', CASE WHEN _full THEN COALESCE(_p.social_links, '{}'::jsonb) ELSE '{}'::jsonb END,
    'follower_count', _followers,
    'following_count', _following,
    'is_following', _is_following,
    'view_count', _views
  );
END;
$function$;

-- notify followers when their followed user posts a status
CREATE OR REPLACE FUNCTION public.notify_followers_on_status()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _name text;
BEGIN
  IF NEW.is_official THEN RETURN NEW; END IF;
  SELECT display_name INTO _name FROM public.profiles WHERE id = NEW.user_id;
  INSERT INTO public.notifications(user_id, type, title, body, data)
  SELECT pf.follower_id,
         'follow_status',
         COALESCE(_name, 'Alguém que você segue') || ' publicou um status',
         COALESCE(NEW.caption, NEW.content, ''),
         jsonb_build_object('status_id', NEW.id, 'author_id', NEW.user_id)
  FROM public.profile_follows pf
  WHERE pf.following_id = NEW.user_id;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS notify_followers_on_status_trg ON public.statuses;
CREATE TRIGGER notify_followers_on_status_trg
AFTER INSERT ON public.statuses
FOR EACH ROW EXECUTE FUNCTION public.notify_followers_on_status();
