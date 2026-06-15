
-- 1) Catalog table
CREATE TABLE public.story_music_tracks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  artist text NOT NULL,
  source text NOT NULL DEFAULT 'Pixabay Music',
  source_url text,
  license text NOT NULL DEFAULT 'Pixabay Content License',
  audio_url text NOT NULL,
  cover_url text,
  duration_sec integer NOT NULL DEFAULT 0,
  genre text,
  mood text NOT NULL DEFAULT 'chill',
  is_active boolean NOT NULL DEFAULT true,
  sort_order integer NOT NULL DEFAULT 0,
  play_count integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.story_music_tracks TO anon, authenticated;
GRANT ALL ON public.story_music_tracks TO service_role;

ALTER TABLE public.story_music_tracks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read active tracks"
  ON public.story_music_tracks FOR SELECT
  USING (is_active = true OR public.has_role(auth.uid(), 'admin'::app_role) OR public.has_role(auth.uid(), 'moderator'::app_role));

CREATE POLICY "Admins manage tracks"
  ON public.story_music_tracks FOR ALL
  USING (public.has_role(auth.uid(), 'admin'::app_role) OR public.has_role(auth.uid(), 'moderator'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role) OR public.has_role(auth.uid(), 'moderator'::app_role));

CREATE TRIGGER trg_story_music_tracks_updated
  BEFORE UPDATE ON public.story_music_tracks
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE INDEX idx_story_music_tracks_active_mood ON public.story_music_tracks(is_active, mood, sort_order);

-- 2) statuses columns
ALTER TABLE public.statuses
  ADD COLUMN IF NOT EXISTS music_track_id uuid REFERENCES public.story_music_tracks(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS music_start_sec integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS music_duration_sec integer NOT NULL DEFAULT 15,
  ADD COLUMN IF NOT EXISTS music_volume numeric(3,2) NOT NULL DEFAULT 0.80;

-- 3) Helper RPCs
CREATE OR REPLACE FUNCTION public.list_active_music_tracks(_mood text DEFAULT NULL, _search text DEFAULT NULL)
RETURNS SETOF public.story_music_tracks
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT * FROM public.story_music_tracks
  WHERE is_active = true
    AND (_mood IS NULL OR _mood = '' OR mood = _mood)
    AND (
      _search IS NULL OR _search = ''
      OR title ILIKE '%' || _search || '%'
      OR artist ILIKE '%' || _search || '%'
    )
  ORDER BY sort_order ASC, play_count DESC, created_at DESC
  LIMIT 200;
$$;

CREATE OR REPLACE FUNCTION public.increment_music_play_count(_track_id uuid)
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  UPDATE public.story_music_tracks
  SET play_count = play_count + 1
  WHERE id = _track_id;
$$;
