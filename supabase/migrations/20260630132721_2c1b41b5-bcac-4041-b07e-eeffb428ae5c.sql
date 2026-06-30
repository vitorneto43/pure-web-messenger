
-- Allow live_recordings to also store 1:1 call recordings
ALTER TABLE public.live_recordings ALTER COLUMN live_id DROP NOT NULL;
ALTER TABLE public.live_recordings ADD COLUMN IF NOT EXISTS call_id uuid REFERENCES public.calls(id) ON DELETE CASCADE;
CREATE INDEX IF NOT EXISTS live_recordings_call_id_idx ON public.live_recordings(call_id);
-- At least one of live_id / call_id must be set
ALTER TABLE public.live_recordings DROP CONSTRAINT IF EXISTS live_recordings_target_check;
ALTER TABLE public.live_recordings ADD CONSTRAINT live_recordings_target_check
  CHECK (live_id IS NOT NULL OR call_id IS NOT NULL);

-- Extend RLS: host can read/manage call recordings too (host_id already used)
-- Existing policies key off host_id, so no change needed.
