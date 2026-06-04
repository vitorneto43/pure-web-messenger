
CREATE OR REPLACE FUNCTION public.get_my_sponsored_status_ids()
RETURNS SETOF uuid
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT s.id
  FROM public.statuses s
  WHERE auth.uid() IS NOT NULL
    AND s.user_id <> auth.uid()
    AND s.expires_at > now()
    AND EXISTS (
      SELECT 1 FROM public.status_boosts sb
      WHERE sb.status_id = s.id
        AND sb.status = 'active'
        AND sb.views_remaining > 0
    )
    AND NOT public.users_share_conversation(auth.uid(), s.user_id);
$$;

GRANT EXECUTE ON FUNCTION public.get_my_sponsored_status_ids() TO authenticated;
