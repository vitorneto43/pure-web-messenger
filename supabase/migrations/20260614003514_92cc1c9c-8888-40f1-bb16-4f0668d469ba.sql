
-- 1) Add pin columns to statuses
ALTER TABLE public.statuses
  ADD COLUMN IF NOT EXISTS pinned boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS pinned_at timestamptz;

CREATE INDEX IF NOT EXISTS idx_statuses_user_pinned ON public.statuses (user_id, pinned DESC, created_at DESC);

-- 2) Replace SELECT policy: statuses become a permanent public archive
DROP POLICY IF EXISTS "View own, contacts, boosted, or official statuses" ON public.statuses;

CREATE POLICY "Public can read statuses"
ON public.statuses FOR SELECT
USING (true);

-- Make sure anon can read (public profile archive)
GRANT SELECT ON public.statuses TO anon;

-- 3) Toggle pin (owner only)
CREATE OR REPLACE FUNCTION public.toggle_status_pin(_status_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_owner uuid;
  v_pinned boolean;
BEGIN
  SELECT user_id, pinned INTO v_owner, v_pinned
  FROM public.statuses WHERE id = _status_id;
  IF v_owner IS NULL THEN
    RAISE EXCEPTION 'Status not found';
  END IF;
  IF v_owner <> auth.uid() THEN
    RAISE EXCEPTION 'Not allowed';
  END IF;
  UPDATE public.statuses
    SET pinned = NOT COALESCE(v_pinned, false),
        pinned_at = CASE WHEN NOT COALESCE(v_pinned, false) THEN now() ELSE NULL END
    WHERE id = _status_id;
  RETURN NOT COALESCE(v_pinned, false);
END;
$$;

GRANT EXECUTE ON FUNCTION public.toggle_status_pin(uuid) TO authenticated;

-- 4) Archive listing: statuses + counts for a user's profile (public)
CREATE OR REPLACE FUNCTION public.get_user_status_archive(_user_id uuid)
RETURNS TABLE (
  id uuid,
  user_id uuid,
  kind text,
  content text,
  media_url text,
  caption text,
  background text,
  created_at timestamptz,
  expires_at timestamptz,
  pinned boolean,
  pinned_at timestamptz,
  view_count int,
  comment_count int,
  reaction_count int
)
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
  ORDER BY s.pinned DESC, COALESCE(s.pinned_at, s.created_at) DESC, s.created_at DESC;
$$;

GRANT EXECUTE ON FUNCTION public.get_user_status_archive(uuid) TO anon, authenticated;
