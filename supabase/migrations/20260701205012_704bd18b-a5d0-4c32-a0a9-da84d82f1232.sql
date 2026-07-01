
ALTER TABLE public.posts
  ADD COLUMN IF NOT EXISTS cta_label text,
  ADD COLUMN IF NOT EXISTS cta_url text;

DROP FUNCTION IF EXISTS public.discover_public_posts(integer, integer);

CREATE OR REPLACE FUNCTION public.discover_public_posts(_limit integer DEFAULT 20, _offset integer DEFAULT 0)
 RETURNS TABLE(post_id uuid, user_id uuid, username text, display_name text, avatar_url text, kind text, content text, media_url text, thumbnail_url text, caption text, background text, hashtags text[], music_track_id uuid, created_at timestamp with time zone, is_official boolean, pinned boolean, cta_label text, cta_url text, reactions_count bigint, comments_count bigint, views_count bigint, is_boosted boolean, viewer_already_liked boolean)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT p.id, p.user_id, pr.username, pr.display_name, pr.avatar_url,
    p.kind, p.content, p.media_url, p.thumbnail_url, p.caption, p.background, p.hashtags,
    p.music_track_id, p.created_at, p.is_official, p.pinned, p.cta_label, p.cta_url,
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
$function$;
