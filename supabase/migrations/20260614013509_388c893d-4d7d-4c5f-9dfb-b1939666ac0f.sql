
CREATE TABLE IF NOT EXISTS public.status_comment_reactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  comment_id uuid NOT NULL REFERENCES public.status_comments(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  emoji text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (comment_id, user_id, emoji)
);

CREATE INDEX IF NOT EXISTS idx_status_comment_reactions_comment ON public.status_comment_reactions(comment_id);

GRANT SELECT ON public.status_comment_reactions TO anon;
GRANT SELECT, INSERT, DELETE ON public.status_comment_reactions TO authenticated;
GRANT ALL ON public.status_comment_reactions TO service_role;

ALTER TABLE public.status_comment_reactions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public read comment reactions"
  ON public.status_comment_reactions FOR SELECT USING (true);

CREATE POLICY "Auth insert own comment reaction"
  ON public.status_comment_reactions FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Auth delete own comment reaction"
  ON public.status_comment_reactions FOR DELETE
  TO authenticated USING (auth.uid() = user_id);
