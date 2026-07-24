
CREATE OR REPLACE FUNCTION public.get_ecosystem_metrics(_ecosystem_id uuid, _days int DEFAULT 30)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  result jsonb;
  since timestamptz := now() - make_interval(days => GREATEST(_days, 1));
BEGIN
  -- Only admins/owners can read metrics
  IF NOT public.is_ecosystem_admin(_ecosystem_id, auth.uid()) THEN
    RAISE EXCEPTION 'forbidden' USING ERRCODE = '42501';
  END IF;

  SELECT jsonb_build_object(
    'members_total',        (SELECT count(*) FROM ecosystem_members WHERE ecosystem_id = _ecosystem_id AND status = 'active'),
    'members_new',          (SELECT count(*) FROM ecosystem_members WHERE ecosystem_id = _ecosystem_id AND status = 'active' AND joined_at >= since),
    'members_banned',       (SELECT count(*) FROM ecosystem_members WHERE ecosystem_id = _ecosystem_id AND status = 'banned'),
    'members_pending',      (SELECT count(*) FROM ecosystem_members WHERE ecosystem_id = _ecosystem_id AND status = 'pending'),
    'posts_total',          (SELECT count(*) FROM posts WHERE ecosystem_id = _ecosystem_id),
    'posts_recent',         (SELECT count(*) FROM posts WHERE ecosystem_id = _ecosystem_id AND created_at >= since),
    'statuses_recent',      (SELECT count(*) FROM statuses WHERE ecosystem_id = _ecosystem_id AND created_at >= since),
    'videos_total',         (SELECT count(*) FROM videos WHERE ecosystem_id = _ecosystem_id),
    'videos_recent',        (SELECT count(*) FROM videos WHERE ecosystem_id = _ecosystem_id AND created_at >= since),
    'lives_recent',         (SELECT count(*) FROM live_sessions WHERE ecosystem_id = _ecosystem_id AND created_at >= since),
    'lives_live_now',       (SELECT count(*) FROM live_sessions WHERE ecosystem_id = _ecosystem_id AND status = 'live'),
    'reactions_recent',     (SELECT count(*) FROM post_reactions r JOIN posts p ON p.id = r.post_id WHERE p.ecosystem_id = _ecosystem_id AND r.created_at >= since),
    'comments_recent',      (SELECT count(*) FROM post_comments c JOIN posts p ON p.id = c.post_id WHERE p.ecosystem_id = _ecosystem_id AND c.created_at >= since),
    'top_authors', (
      SELECT COALESCE(jsonb_agg(row_to_json(t)), '[]'::jsonb) FROM (
        SELECT p.user_id, count(*)::int AS posts,
               pr.display_name, pr.username, pr.avatar_url
        FROM posts p
        LEFT JOIN profiles pr ON pr.user_id = p.user_id
        WHERE p.ecosystem_id = _ecosystem_id AND p.created_at >= since
        GROUP BY p.user_id, pr.display_name, pr.username, pr.avatar_url
        ORDER BY posts DESC
        LIMIT 5
      ) t
    ),
    'activity_by_day', (
      SELECT COALESCE(jsonb_agg(row_to_json(d) ORDER BY d.day), '[]'::jsonb) FROM (
        SELECT day::date AS day,
               COALESCE((SELECT count(*) FROM posts p WHERE p.ecosystem_id = _ecosystem_id AND p.created_at::date = day::date), 0)::int AS posts,
               COALESCE((SELECT count(*) FROM statuses s WHERE s.ecosystem_id = _ecosystem_id AND s.created_at::date = day::date), 0)::int AS statuses,
               COALESCE((SELECT count(*) FROM videos v WHERE v.ecosystem_id = _ecosystem_id AND v.created_at::date = day::date), 0)::int AS videos
        FROM generate_series(since::date, now()::date, interval '1 day') AS day
      ) d
    )
  ) INTO result;

  RETURN result;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_ecosystem_metrics(uuid, int) TO authenticated;
