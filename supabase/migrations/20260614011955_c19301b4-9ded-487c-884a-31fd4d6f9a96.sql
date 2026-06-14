
CREATE OR REPLACE FUNCTION public.can_view_profile(_owner uuid, _viewer uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    _owner IS NOT NULL AND (
      _viewer = _owner
      OR EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = _owner AND COALESCE(p.visibility, 'public') = 'public')
      OR (
        _viewer IS NOT NULL
        AND EXISTS (
          SELECT 1 FROM public.profile_view_requests r
          WHERE r.owner_id = _owner AND r.requester_id = _viewer AND r.status = 'approved'
        )
      )
    );
$$;

GRANT EXECUTE ON FUNCTION public.can_view_profile(uuid, uuid) TO anon, authenticated;

-- Statuses: enforce privacy at the row level
DROP POLICY IF EXISTS "Public can read statuses" ON public.statuses;
CREATE POLICY "Read statuses respecting privacy"
  ON public.statuses FOR SELECT
  USING (public.can_view_profile(user_id, auth.uid()));

-- Archive RPC: also enforce privacy
CREATE OR REPLACE FUNCTION public.get_user_status_archive(_user_id uuid)
RETURNS TABLE(id uuid, user_id uuid, kind text, content text, media_url text, caption text, background text, created_at timestamp with time zone, expires_at timestamp with time zone, pinned boolean, pinned_at timestamp with time zone, view_count integer, comment_count integer, reaction_count integer)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    s.id, s.user_id, s.kind, s.content, s.media_url, s.caption, s.background,
    s.created_at, s.expires_at, s.pinned, s.pinned_at,
    COALESCE((SELECT COUNT(*)::int FROM public.status_views v WHERE v.status_id = s.id), 0) AS view_count,
    COALESCE((SELECT COUNT(*)::int FROM public.status_comments c WHERE c.status_id = s.id), 0) AS comment_count,
    COALESCE((SELECT COUNT(*)::int FROM public.status_reactions r WHERE r.status_id = s.id), 0) AS reaction_count
  FROM public.statuses s
  WHERE s.user_id = _user_id
    AND public.can_view_profile(s.user_id, auth.uid())
  ORDER BY s.pinned DESC, COALESCE(s.pinned_at, s.created_at) DESC, s.created_at DESC;
$$;

-- Follows: require permission to view private profiles before following
DROP POLICY IF EXISTS "Users follow as themselves" ON public.profile_follows;
CREATE POLICY "Users follow as themselves"
  ON public.profile_follows FOR INSERT
  TO authenticated
  WITH CHECK (
    auth.uid() = follower_id
    AND public.can_view_profile(following_id, auth.uid())
  );
