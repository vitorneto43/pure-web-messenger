ALTER TABLE public.conversations
  ADD COLUMN IF NOT EXISTS rules text,
  ADD COLUMN IF NOT EXISTS pinned_message text;