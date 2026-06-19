
-- 1) Conversations: restrict group updates to admins
DROP POLICY IF EXISTS "Members can update conversations" ON public.conversations;
CREATE POLICY "Members can update conversations"
  ON public.conversations
  FOR UPDATE
  TO authenticated
  USING (
    (is_group = false AND public.is_conversation_member(id, auth.uid()))
    OR (is_group = true AND public.is_group_admin(id, auth.uid()))
  )
  WITH CHECK (
    (is_group = false AND public.is_conversation_member(id, auth.uid()))
    OR (is_group = true AND public.is_group_admin(id, auth.uid()))
  );

-- 2) live_gifts_sent: drop public read, restrict to sender/host/admin
DROP POLICY IF EXISTS "gifts sent public read" ON public.live_gifts_sent;
CREATE POLICY "live_gifts_sent_select_participants"
  ON public.live_gifts_sent
  FOR SELECT
  TO authenticated
  USING (
    sender_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.live_sessions s
      WHERE s.id = live_gifts_sent.live_id AND s.host_id = auth.uid()
    )
    OR public.has_role(auth.uid(), 'admin'::app_role)
  );

-- 3) Profiles: revoke sensitive moderation/attribution columns from client roles
REVOKE SELECT (
  moderation_note,
  strike_count,
  banned_at,
  suspended_until,
  signup_landing,
  signup_referrer,
  signup_campaign,
  signup_medium,
  signup_source,
  invited_by
) ON public.profiles FROM anon, authenticated;
-- service_role retains full access for admin server functions (bypasses RLS too)
GRANT SELECT (
  moderation_note,
  strike_count,
  banned_at,
  suspended_until,
  signup_landing,
  signup_referrer,
  signup_campaign,
  signup_medium,
  signup_source,
  invited_by
) ON public.profiles TO service_role;

-- 4) Support tickets: explicit INSERT policy for self-submitted tickets
DROP POLICY IF EXISTS "Users can submit own tickets" ON public.support_tickets;
CREATE POLICY "Users can submit own tickets"
  ON public.support_tickets
  FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());
