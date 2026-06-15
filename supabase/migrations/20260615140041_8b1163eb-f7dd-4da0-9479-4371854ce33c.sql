-- 1) Plays event table
CREATE TABLE public.music_track_plays (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  track_id uuid NOT NULL REFERENCES public.story_music_tracks(id) ON DELETE CASCADE,
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  source text NOT NULL DEFAULT 'picker',
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT INSERT ON public.music_track_plays TO authenticated;
GRANT ALL ON public.music_track_plays TO service_role;

ALTER TABLE public.music_track_plays ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can log their own plays"
  ON public.music_track_plays FOR INSERT
  TO authenticated
  WITH CHECK (user_id IS NULL OR user_id = auth.uid());

CREATE INDEX idx_music_track_plays_recent ON public.music_track_plays(track_id, created_at DESC);
CREATE INDEX idx_music_track_plays_created_at ON public.music_track_plays(created_at DESC);

-- 2) Trending RPC (7-day window by default)
CREATE OR REPLACE FUNCTION public.trending_music_tracks(_days int DEFAULT 7, _limit int DEFAULT 50)
RETURNS TABLE (
  id uuid,
  title text,
  artist text,
  source text,
  source_url text,
  license text,
  audio_url text,
  cover_url text,
  duration_sec int,
  genre text,
  mood text,
  is_active boolean,
  sort_order int,
  play_count int,
  created_at timestamptz,
  updated_at timestamptz,
  trend_plays bigint
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT t.*, COALESCE(p.cnt, 0)::bigint AS trend_plays
  FROM public.story_music_tracks t
  LEFT JOIN (
    SELECT track_id, COUNT(*) AS cnt
    FROM public.music_track_plays
    WHERE created_at >= now() - make_interval(days => GREATEST(_days, 1))
    GROUP BY track_id
  ) p ON p.track_id = t.id
  WHERE t.is_active = true
  ORDER BY COALESCE(p.cnt, 0) DESC, t.play_count DESC, t.sort_order ASC, t.created_at DESC
  LIMIT GREATEST(_limit, 1);
$$;

GRANT EXECUTE ON FUNCTION public.trending_music_tracks(int, int) TO anon, authenticated;

-- 3) New tracks RPC
CREATE OR REPLACE FUNCTION public.new_music_tracks(_limit int DEFAULT 50)
RETURNS SETOF public.story_music_tracks
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT * FROM public.story_music_tracks
  WHERE is_active = true
  ORDER BY created_at DESC
  LIMIT GREATEST(_limit, 1);
$$;

GRANT EXECUTE ON FUNCTION public.new_music_tracks(int) TO anon, authenticated;

-- 4) Log a play event (also bumps lifetime play_count)
CREATE OR REPLACE FUNCTION public.log_music_play(_track_id uuid, _source text DEFAULT 'picker')
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.music_track_plays(track_id, user_id, source)
  VALUES (_track_id, auth.uid(), COALESCE(_source, 'picker'));

  UPDATE public.story_music_tracks
  SET play_count = COALESCE(play_count, 0) + 1
  WHERE id = _track_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.log_music_play(uuid, text) TO authenticated;