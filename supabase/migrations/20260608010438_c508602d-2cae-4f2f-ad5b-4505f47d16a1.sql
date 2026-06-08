
-- 1) admin_pins: write policies (owner only)
CREATE POLICY "Owner can insert own admin pin"
  ON public.admin_pins
  FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Owner can update own admin pin"
  ON public.admin_pins
  FOR UPDATE TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Owner can delete own admin pin"
  ON public.admin_pins
  FOR DELETE TO authenticated
  USING (user_id = auth.uid());

-- 2) conversation_members: restrict joining to creator-or-group-admin paths
DROP POLICY IF EXISTS "Users can join conversations they create or are added to" ON public.conversation_members;

CREATE POLICY "Creator can add members"
  ON public.conversation_members
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.conversations c
      WHERE c.id = conversation_members.conversation_id
        AND c.created_by = auth.uid()
    )
  );

-- 3) analytics_events: tighten anon/auth insert
DROP POLICY IF EXISTS "Anyone can insert events" ON public.analytics_events;

CREATE POLICY "Anon can insert anonymous events"
  ON public.analytics_events
  FOR INSERT TO anon
  WITH CHECK (user_id IS NULL);

CREATE POLICY "Authenticated can insert own events"
  ON public.analytics_events
  FOR INSERT TO authenticated
  WITH CHECK (user_id IS NULL OR user_id = auth.uid());
