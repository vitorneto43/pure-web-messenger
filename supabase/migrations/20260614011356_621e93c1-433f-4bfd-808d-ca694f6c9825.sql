
CREATE OR REPLACE FUNCTION public.record_status_share(_status_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN;
  END IF;
  INSERT INTO public.share_logs (user_id, target, content_type)
  VALUES (auth.uid(), _status_id::text, 'status');
END;
$$;

CREATE OR REPLACE FUNCTION public.get_status_share_count(_status_id uuid)
RETURNS integer
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COUNT(*)::int
  FROM public.share_logs
  WHERE content_type = 'status' AND target = _status_id::text;
$$;

GRANT EXECUTE ON FUNCTION public.record_status_share(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_status_share_count(uuid) TO anon, authenticated;
