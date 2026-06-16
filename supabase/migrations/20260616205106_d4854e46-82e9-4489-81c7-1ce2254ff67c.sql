CREATE OR REPLACE FUNCTION public.get_top_hosts_weekly(p_limit int DEFAULT 20)
RETURNS TABLE (
  host_id uuid,
  username text,
  display_name text,
  avatar_url text,
  total_coins bigint,
  gifts_count bigint,
  lives_count bigint
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    ls.host_id,
    p.username,
    p.display_name,
    p.avatar_url,
    COALESCE(SUM(g.coins_spent), 0)::bigint AS total_coins,
    COUNT(g.id)::bigint AS gifts_count,
    COUNT(DISTINCT ls.id)::bigint AS lives_count
  FROM public.live_gifts_sent g
  JOIN public.live_sessions ls ON ls.id = g.live_id
  JOIN public.profiles p ON p.id = ls.host_id
  WHERE g.created_at >= now() - interval '7 days'
  GROUP BY ls.host_id, p.username, p.display_name, p.avatar_url
  ORDER BY total_coins DESC
  LIMIT GREATEST(1, LEAST(p_limit, 100));
$$;

GRANT EXECUTE ON FUNCTION public.get_top_hosts_weekly(int) TO anon, authenticated;