CREATE OR REPLACE FUNCTION public.get_live_pix_info(p_live_id uuid)
RETURNS TABLE (
  pix_key text,
  pix_key_type text,
  recipient_name text,
  city text
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    pp.pix_key,
    pp.pix_key_type,
    COALESCE(NULLIF(p.display_name, ''), p.username, 'Recebedor') AS recipient_name,
    COALESCE(NULLIF(pp.city, ''), 'BRASIL') AS city
  FROM public.live_sessions ls
  JOIN public.profiles_private pp ON pp.user_id = ls.host_id
  JOIN public.profiles p ON p.id = ls.host_id
  WHERE ls.id = p_live_id
    AND ls.status = 'live'
    AND pp.pix_key IS NOT NULL
    AND length(trim(pp.pix_key)) > 0
  LIMIT 1;
$$;

GRANT EXECUTE ON FUNCTION public.get_live_pix_info(uuid) TO anon, authenticated;