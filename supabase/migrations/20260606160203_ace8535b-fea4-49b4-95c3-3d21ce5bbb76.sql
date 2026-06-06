ALTER TABLE public.statuses
  ADD COLUMN IF NOT EXISTS cta_url text,
  ADD COLUMN IF NOT EXISTS cta_label text;

ALTER TABLE public.statuses
  ADD CONSTRAINT statuses_cta_url_format
  CHECK (cta_url IS NULL OR cta_url ~* '^https?://[^[:space:]]+$');

ALTER TABLE public.statuses
  ADD CONSTRAINT statuses_cta_label_len
  CHECK (cta_label IS NULL OR char_length(cta_label) <= 30);

DROP POLICY IF EXISTS "Owner updates own status" ON public.statuses;
CREATE POLICY "Owner updates own status"
  ON public.statuses FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);
