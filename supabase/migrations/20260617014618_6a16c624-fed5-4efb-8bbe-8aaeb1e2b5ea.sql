
-- Live recordings storage policies (bucket is private; access via signed URLs or per-policy)
CREATE POLICY "live-recordings host upload" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'live-recordings' AND (storage.foldername(name))[1] = auth.uid()::text);

CREATE POLICY "live-recordings host read own" ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'live-recordings' AND (storage.foldername(name))[1] = auth.uid()::text);

CREATE POLICY "live-recordings host delete own" ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'live-recordings' AND (storage.foldername(name))[1] = auth.uid()::text);

CREATE POLICY "live-recordings public read when published" ON storage.objects FOR SELECT
  USING (
    bucket_id = 'live-recordings'
    AND EXISTS (
      SELECT 1 FROM public.live_recordings r
      WHERE r.storage_path = name AND r.is_public = true AND r.status = 'ready'
    )
  );
