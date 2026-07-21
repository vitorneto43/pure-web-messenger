
ALTER TABLE public.videos
  ADD COLUMN IF NOT EXISTS is_short boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS saves_count integer NOT NULL DEFAULT 0;

CREATE INDEX IF NOT EXISTS videos_is_short_published_idx
  ON public.videos (is_short, published_at DESC)
  WHERE status = 'ready' AND visibility = 'public';

CREATE TABLE IF NOT EXISTS public.video_saves (
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  video_id uuid NOT NULL REFERENCES public.videos(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, video_id)
);

GRANT SELECT, INSERT, DELETE ON public.video_saves TO authenticated;
GRANT ALL ON public.video_saves TO service_role;

ALTER TABLE public.video_saves ENABLE ROW LEVEL SECURITY;

CREATE POLICY "own saves read" ON public.video_saves FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "own saves insert" ON public.video_saves FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "own saves delete" ON public.video_saves FOR DELETE TO authenticated USING (auth.uid() = user_id);

CREATE OR REPLACE FUNCTION public.tg_video_saves_count()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE public.videos SET saves_count = saves_count + 1 WHERE id = NEW.video_id;
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE public.videos SET saves_count = GREATEST(saves_count - 1, 0) WHERE id = OLD.video_id;
    RETURN OLD;
  END IF;
  RETURN NULL;
END $$;

DROP TRIGGER IF EXISTS video_saves_count_ins ON public.video_saves;
DROP TRIGGER IF EXISTS video_saves_count_del ON public.video_saves;
CREATE TRIGGER video_saves_count_ins AFTER INSERT ON public.video_saves FOR EACH ROW EXECUTE FUNCTION public.tg_video_saves_count();
CREATE TRIGGER video_saves_count_del AFTER DELETE ON public.video_saves FOR EACH ROW EXECUTE FUNCTION public.tg_video_saves_count();

CREATE OR REPLACE FUNCTION public.discover_waveshorts(
  _cursor timestamptz DEFAULT NULL,
  _limit int DEFAULT 12
) RETURNS TABLE (
  id uuid,
  owner_id uuid,
  title text,
  description text,
  category text,
  file_url text,
  thumbnail_url text,
  duration_sec int,
  views_count int,
  likes_count int,
  comments_count int,
  saves_count int,
  cta_label text,
  cta_url text,
  allow_pix boolean,
  pix_key text,
  published_at timestamptz,
  owner_username text,
  owner_display_name text,
  owner_avatar_url text
) LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT v.id, v.owner_id, v.title, v.description, v.category, v.file_url, v.thumbnail_url,
         v.duration_sec, v.views_count, v.likes_count, v.comments_count, v.saves_count,
         v.cta_label, v.cta_url, v.allow_pix, v.pix_key, v.published_at,
         p.username, p.display_name, p.avatar_url
  FROM public.videos v
  LEFT JOIN public.profiles p ON p.id = v.owner_id
  WHERE v.is_short = true
    AND v.status = 'ready'
    AND v.visibility = 'public'
    AND (_cursor IS NULL OR v.published_at < _cursor)
  ORDER BY v.published_at DESC NULLS LAST
  LIMIT LEAST(GREATEST(_limit, 1), 50);
$$;

GRANT EXECUTE ON FUNCTION public.discover_waveshorts(timestamptz, int) TO anon, authenticated;
