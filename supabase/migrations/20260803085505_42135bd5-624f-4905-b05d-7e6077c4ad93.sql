-- 1) Admin RPCs: only the server (service_role) may execute them
REVOKE EXECUTE ON FUNCTION public.admin_user_confirmation_stats() FROM authenticated, anon;
REVOKE EXECUTE ON FUNCTION public.admin_signup_sources() FROM authenticated, anon;
REVOKE EXECUTE ON FUNCTION public.admin_usage_analytics(integer) FROM authenticated, anon;
REVOKE EXECUTE ON FUNCTION public.admin_push_logs(integer) FROM authenticated, anon;
REVOKE EXECUTE ON FUNCTION public.admin_invites_overview() FROM authenticated, anon;
REVOKE EXECUTE ON FUNCTION public.admin_user_activity_stats() FROM authenticated, anon;

GRANT EXECUTE ON FUNCTION public.admin_user_confirmation_stats() TO service_role;
GRANT EXECUTE ON FUNCTION public.admin_signup_sources() TO service_role;
GRANT EXECUTE ON FUNCTION public.admin_usage_analytics(integer) TO service_role;
GRANT EXECUTE ON FUNCTION public.admin_push_logs(integer) TO service_role;
GRANT EXECUTE ON FUNCTION public.admin_invites_overview() TO service_role;
GRANT EXECUTE ON FUNCTION public.admin_user_activity_stats() TO service_role;

-- 2) Prevent forged attribution on analytics inserts
DROP POLICY IF EXISTS "vv_insert_any" ON public.video_views;
CREATE POLICY "vv_insert_self_or_anon" ON public.video_views
  FOR INSERT TO anon, authenticated
  WITH CHECK (viewer_id IS NULL OR viewer_id = auth.uid());

DROP POLICY IF EXISTS "vbc_insert_any" ON public.video_boost_clicks;
CREATE POLICY "vbc_insert_self_or_anon" ON public.video_boost_clicks
  FOR INSERT TO anon, authenticated
  WITH CHECK (user_id IS NULL OR user_id = auth.uid());

DROP POLICY IF EXISTS "Anyone authed can insert click" ON public.status_boost_clicks;
CREATE POLICY "sbc_insert_self" ON public.status_boost_clicks
  FOR INSERT TO authenticated
  WITH CHECK (clicker_id IS NULL OR clicker_id = auth.uid());

-- 3) Ecosystem conversation restriction must also cover anonymous readers
DROP POLICY IF EXISTS "eco_restrict_convs_select" ON public.conversations;
CREATE POLICY "eco_restrict_convs_select" ON public.conversations
  AS RESTRICTIVE FOR SELECT TO public
  USING (ecosystem_id IS NULL OR is_ecosystem_member(ecosystem_id, auth.uid()));