
-- 1) Newsletter: drop permissive insert; require authenticated email match. Tighten select.
DROP POLICY IF EXISTS "Anyone can subscribe" ON public.newsletter_subscribers;
DROP POLICY IF EXISTS "Owner views own subscription" ON public.newsletter_subscribers;
DROP POLICY IF EXISTS "Owner updates own subscription" ON public.newsletter_subscribers;

CREATE POLICY "newsletter_authenticated_insert_own_email"
  ON public.newsletter_subscribers FOR INSERT
  TO authenticated
  WITH CHECK (
    user_id = auth.uid()
    AND lower(email) = lower((SELECT u.email FROM auth.users u WHERE u.id = auth.uid()))
  );

CREATE POLICY "newsletter_select_owner_or_admin"
  ON public.newsletter_subscribers FOR SELECT
  TO authenticated
  USING (
    (user_id IS NOT NULL AND user_id = auth.uid())
    OR public.has_role(auth.uid(), 'admin'::public.app_role)
  );

CREATE POLICY "newsletter_update_owner_or_admin"
  ON public.newsletter_subscribers FOR UPDATE
  TO authenticated
  USING (
    (user_id IS NOT NULL AND user_id = auth.uid())
    OR public.has_role(auth.uid(), 'admin'::public.app_role)
  );

-- 2) Profiles: enforce explicit column-level SELECT grants. Revoke all then grant only safe cols.
REVOKE SELECT ON public.profiles FROM anon, authenticated;
GRANT SELECT (
  id, username, display_name, avatar_url, bio, last_seen, created_at, updated_at,
  onboarded, goal, visibility, show_city, social_links, interests, birth_date
) ON public.profiles TO authenticated;
GRANT SELECT (
  id, username, display_name, avatar_url, bio, last_seen, visibility
) ON public.profiles TO anon;
-- Re-grant write privileges; RLS still gates these
GRANT INSERT, UPDATE, DELETE ON public.profiles TO authenticated;

-- 3) Remove sensitive tables from Realtime publication (no consumer subscribes to them)
ALTER PUBLICATION supabase_realtime DROP TABLE public.live_gifts_sent;
ALTER PUBLICATION supabase_realtime DROP TABLE public.live_recordings;
ALTER PUBLICATION supabase_realtime DROP TABLE public.scheduled_lives;

-- 4) Storage: admin-only writes on private buckets group-avatars and story-music
CREATE POLICY "group_avatars_admin_insert"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (bucket_id = 'group-avatars' AND public.has_role(auth.uid(), 'admin'::public.app_role));
CREATE POLICY "group_avatars_admin_update"
  ON storage.objects FOR UPDATE
  TO authenticated
  USING (bucket_id = 'group-avatars' AND public.has_role(auth.uid(), 'admin'::public.app_role));
CREATE POLICY "group_avatars_admin_delete"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (bucket_id = 'group-avatars' AND public.has_role(auth.uid(), 'admin'::public.app_role));

CREATE POLICY "story_music_admin_select"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (bucket_id = 'story-music' AND public.has_role(auth.uid(), 'admin'::public.app_role));
CREATE POLICY "story_music_admin_insert"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (bucket_id = 'story-music' AND public.has_role(auth.uid(), 'admin'::public.app_role));
CREATE POLICY "story_music_admin_update"
  ON storage.objects FOR UPDATE
  TO authenticated
  USING (bucket_id = 'story-music' AND public.has_role(auth.uid(), 'admin'::public.app_role));
CREATE POLICY "story_music_admin_delete"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (bucket_id = 'story-music' AND public.has_role(auth.uid(), 'admin'::public.app_role));
