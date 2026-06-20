-- Tighten chat-uploads SELECT policy to owner only.
-- The bucket is currently public so HTTP downloads aren't gated by RLS,
-- but this removes the ability for any authenticated user to enumerate/list
-- arbitrary chat files via the Storage API.
DROP POLICY IF EXISTS "Authenticated users can read chat uploads" ON storage.objects;

CREATE POLICY "Chat upload owners can read"
  ON storage.objects
  FOR SELECT
  TO authenticated
  USING (
    bucket_id = 'chat-uploads'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );