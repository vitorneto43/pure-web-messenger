
CREATE TABLE public.status_reactions (
  id uuid primary key default gen_random_uuid(),
  status_id uuid not null references public.statuses(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  emoji text not null,
  created_at timestamptz not null default now(),
  unique (status_id, user_id)
);

CREATE INDEX status_reactions_status_idx ON public.status_reactions(status_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.status_reactions TO authenticated;
GRANT ALL ON public.status_reactions TO service_role;

ALTER TABLE public.status_reactions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "auth can read reactions"
  ON public.status_reactions FOR SELECT
  TO authenticated USING (true);

CREATE POLICY "users insert own reaction"
  ON public.status_reactions FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = user_id);

CREATE POLICY "users update own reaction"
  ON public.status_reactions FOR UPDATE
  TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE POLICY "users delete own reaction"
  ON public.status_reactions FOR DELETE
  TO authenticated USING (auth.uid() = user_id);
