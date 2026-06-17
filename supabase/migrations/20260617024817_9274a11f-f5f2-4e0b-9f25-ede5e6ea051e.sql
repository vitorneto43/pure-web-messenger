CREATE POLICY "Users can follow anyone" ON public.profile_follows FOR INSERT TO authenticated WITH CHECK (auth.uid() = follower_id);

-- Drop old policy if exists
DROP POLICY IF EXISTS "Users follow as themselves" ON public.profile_follows;