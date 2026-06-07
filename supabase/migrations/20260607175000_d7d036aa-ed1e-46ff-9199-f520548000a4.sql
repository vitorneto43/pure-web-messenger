
-- 1) Column-level privilege: hide sensitive profile columns from authenticated/anon
REVOKE SELECT (last_ip, device_platform, app_version, city, region, country,
               signup_source, signup_medium, signup_campaign, signup_referrer, signup_landing)
  ON public.profiles FROM authenticated;
REVOKE SELECT (last_ip, device_platform, app_version, city, region, country,
               signup_source, signup_medium, signup_campaign, signup_referrer, signup_landing)
  ON public.profiles FROM anon;

-- 2) status_reactions: restrict SELECT to reactions on visible statuses
DROP POLICY IF EXISTS "auth can read reactions" ON public.status_reactions;
CREATE POLICY "users read reactions on visible statuses"
  ON public.status_reactions FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.statuses s
      WHERE s.id = status_reactions.status_id
        AND (
          s.user_id = auth.uid()
          OR public.has_role(auth.uid(), 'admin'::public.app_role)
          OR s.is_official = true
          OR public.users_share_conversation(auth.uid(), s.user_id)
          OR EXISTS (
            SELECT 1 FROM public.status_boosts sb
            WHERE sb.status_id = s.id
              AND sb.status = 'active'
              AND sb.views_remaining > 0
          )
        )
    )
  );

-- 3) admin_pins: explicit owner-only SELECT policy
DROP POLICY IF EXISTS "Owner can read own admin pin" ON public.admin_pins;
CREATE POLICY "Owner can read own admin pin"
  ON public.admin_pins FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

-- 4) Fix mutable search_path on email queue helpers
ALTER FUNCTION public.move_to_dlq(text, text, bigint, jsonb) SET search_path = public, pg_temp;
ALTER FUNCTION public.enqueue_email(text, jsonb) SET search_path = public, pg_temp;
ALTER FUNCTION public.read_email_batch(text, integer, integer) SET search_path = public, pg_temp;
ALTER FUNCTION public.delete_email(text, bigint) SET search_path = public, pg_temp;

-- 5) Revoke public/anon EXECUTE on privileged SECURITY DEFINER functions.
--    Keep authenticated + service_role grants intact.
DO $$
DECLARE
  fn text;
BEGIN
  FOR fn IN SELECT unnest(ARRAY[
    'public.admin_invites_overview()',
    'public.admin_newsletter_stats()',
    'public.admin_push_logs(integer)',
    'public.admin_send_newsletter(uuid)',
    'public.admin_signup_sources()',
    'public.admin_usage_analytics(integer)',
    'public.admin_user_activity_stats()',
    'public.admin_user_confirmation_stats()',
    'public.claim_invite_reward()',
    'public.complete_onboarding(text, text)',
    'public.discover_people(integer)',
    'public.get_invite_stats()',
    'public.get_my_sponsored_status_ids()',
    'public.get_people_you_may_know(integer)',
    'public.is_group_amin(uuid, uuid)',
    'public.redeem_free_boost(uuid)'
  ])
  LOOP
    BEGIN
      EXECUTE format('REVOKE EXECUTE ON FUNCTION %s FROM PUBLIC', fn);
      EXECUTE format('REVOKE EXECUTE ON FUNCTION %s FROM anon', fn);
      EXECUTE format('GRANT  EXECUTE ON FUNCTION %s TO authenticated', fn);
    EXCEPTION WHEN undefined_function THEN
      -- skip if signature mismatches (e.g. typo placeholder)
      NULL;
    END;
  END LOOP;
END $$;

-- explicit fix for is_group_admin (correct spelling)
REVOKE EXECUTE ON FUNCTION public.is_group_admin(uuid, uuid) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.is_group_admin(uuid, uuid) FROM anon;
GRANT  EXECUTE ON FUNCTION public.is_group_admin(uuid, uuid) TO authenticated;
