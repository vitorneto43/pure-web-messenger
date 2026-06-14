
ALTER TABLE public.status_comments
  ADD COLUMN IF NOT EXISTS parent_id uuid REFERENCES public.status_comments(id) ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS idx_status_comments_parent ON public.status_comments(parent_id, created_at);

ALTER TYPE report_target_type ADD VALUE IF NOT EXISTS 'status_comment';

CREATE OR REPLACE FUNCTION public.get_status_view_count(_status_id uuid)
RETURNS integer
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COUNT(*)::int FROM public.status_views WHERE status_id = _status_id;
$$;

GRANT EXECUTE ON FUNCTION public.get_status_view_count(uuid) TO anon, authenticated;
