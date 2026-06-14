CREATE TABLE public.status_comments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  status_id uuid NOT NULL REFERENCES public.statuses(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  content text NOT NULL CHECK (char_length(content) BETWEEN 1 AND 1000),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_status_comments_status ON public.status_comments(status_id, created_at DESC);
CREATE INDEX idx_status_comments_user ON public.status_comments(user_id);

GRANT SELECT ON public.status_comments TO anon;
GRANT SELECT, INSERT, DELETE ON public.status_comments TO authenticated;
GRANT ALL ON public.status_comments TO service_role;

ALTER TABLE public.status_comments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public read comments" ON public.status_comments FOR SELECT USING (true);
CREATE POLICY "Auth insert own comment" ON public.status_comments FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Delete own comment or status owner" ON public.status_comments FOR DELETE TO authenticated USING (
  auth.uid() = user_id OR auth.uid() = (SELECT user_id FROM public.statuses WHERE id = status_id)
);