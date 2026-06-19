
ALTER TABLE public.posts ADD COLUMN IF NOT EXISTS pinned_at timestamptz;

CREATE OR REPLACE FUNCTION public.toggle_post_pin(_post_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_owner uuid;
  v_pinned boolean;
BEGIN
  SELECT user_id, pinned INTO v_owner, v_pinned FROM public.posts WHERE id = _post_id;
  IF v_owner IS NULL THEN RAISE EXCEPTION 'post_not_found'; END IF;
  IF v_owner <> auth.uid() THEN RAISE EXCEPTION 'forbidden'; END IF;
  UPDATE public.posts
     SET pinned = NOT COALESCE(v_pinned, false),
         pinned_at = CASE WHEN NOT COALESCE(v_pinned, false) THEN now() ELSE NULL END
   WHERE id = _post_id;
  RETURN NOT COALESCE(v_pinned, false);
END;
$$;
GRANT EXECUTE ON FUNCTION public.toggle_post_pin(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.get_user_posts_archive(_user_id uuid)
RETURNS TABLE(
  id uuid, user_id uuid, kind text, content text, media_url text,
  caption text, background text, created_at timestamptz,
  pinned boolean, pinned_at timestamptz,
  reaction_count integer, comment_count integer
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT p.id, p.user_id, p.kind, p.content, p.media_url, p.caption,
         p.background, p.created_at, p.pinned, p.pinned_at,
         COALESCE((SELECT count(*)::int FROM public.post_reactions r WHERE r.post_id = p.id), 0),
         COALESCE((SELECT count(*)::int FROM public.post_comments c WHERE c.post_id = p.id), 0)
    FROM public.posts p
   WHERE p.user_id = _user_id
     AND (p.visibility = 'public' OR p.user_id = auth.uid())
   ORDER BY p.pinned DESC, COALESCE(p.pinned_at, p.created_at) DESC, p.created_at DESC;
$$;
GRANT EXECUTE ON FUNCTION public.get_user_posts_archive(uuid) TO authenticated, anon;

DROP FUNCTION IF EXISTS public.discover_public_posts(integer, integer);
CREATE OR REPLACE FUNCTION public.discover_public_posts(_limit integer DEFAULT 20, _offset integer DEFAULT 0)
RETURNS TABLE (
  post_id uuid, user_id uuid, username text, display_name text, avatar_url text,
  kind text, content text, media_url text, thumbnail_url text, caption text, background text, hashtags text[],
  music_track_id uuid, created_at timestamptz, is_official boolean, pinned boolean,
  reactions_count bigint, comments_count bigint, views_count bigint,
  is_boosted boolean, viewer_already_liked boolean
)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT p.id, p.user_id, pr.username, pr.display_name, pr.avatar_url,
    p.kind, p.content, p.media_url, p.thumbnail_url, p.caption, p.background, p.hashtags,
    p.music_track_id, p.created_at, p.is_official, p.pinned,
    (SELECT count(*) FROM public.post_reactions WHERE post_id = p.id),
    (SELECT count(*) FROM public.post_comments WHERE post_id = p.id),
    (SELECT count(*) FROM public.post_views WHERE post_id = p.id),
    EXISTS (SELECT 1 FROM public.post_boosts b WHERE b.post_id = p.id AND b.status='active' AND (b.ends_at IS NULL OR b.ends_at > now())),
    CASE WHEN auth.uid() IS NULL THEN false ELSE EXISTS (
      SELECT 1 FROM public.post_reactions r WHERE r.post_id = p.id AND r.user_id = auth.uid()
    ) END
  FROM public.posts p JOIN public.profiles pr ON pr.id = p.user_id
  WHERE p.visibility = 'public'
  ORDER BY
    (EXISTS (SELECT 1 FROM public.post_boosts b WHERE b.post_id = p.id AND b.status='active' AND (b.ends_at IS NULL OR b.ends_at > now()))) DESC,
    p.created_at DESC
  LIMIT _limit OFFSET _offset;
$$;
GRANT EXECUTE ON FUNCTION public.discover_public_posts(integer, integer) TO anon, authenticated;
