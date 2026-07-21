
CREATE POLICY "wavetube_public_read" ON storage.objects FOR SELECT USING (bucket_id='wavetube');
CREATE POLICY "wavetube_user_insert" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id='wavetube' AND (storage.foldername(name))[1] = auth.uid()::text);
CREATE POLICY "wavetube_user_update" ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id='wavetube' AND (storage.foldername(name))[1] = auth.uid()::text);
CREATE POLICY "wavetube_user_delete" ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id='wavetube' AND (storage.foldername(name))[1] = auth.uid()::text);
