
CREATE OR REPLACE FUNCTION public.wavetube_touch_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path=public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;

CREATE TYPE public.video_status AS ENUM ('uploading','processing','ready','failed');
CREATE TYPE public.video_visibility AS ENUM ('public','unlisted','private');
CREATE TYPE public.video_reaction_kind AS ENUM ('like','dislike','heart','fire','clap','laugh','wow','sad');

CREATE TABLE public.videos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT DEFAULT '',
  category TEXT DEFAULT 'geral',
  hashtags TEXT[] DEFAULT '{}',
  visibility public.video_visibility NOT NULL DEFAULT 'public',
  status public.video_status NOT NULL DEFAULT 'uploading',
  duration_sec INTEGER DEFAULT 0,
  file_url TEXT,
  hls_url TEXT,
  thumbnail_url TEXT,
  cta_label TEXT,
  cta_url TEXT,
  allow_pix BOOLEAN NOT NULL DEFAULT true,
  pix_key TEXT,
  live_session_id UUID,
  views_count INTEGER NOT NULL DEFAULT 0,
  likes_count INTEGER NOT NULL DEFAULT 0,
  dislikes_count INTEGER NOT NULL DEFAULT 0,
  comments_count INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  published_at TIMESTAMPTZ
);
CREATE INDEX idx_videos_owner ON public.videos(owner_id);
CREATE INDEX idx_videos_public_ready ON public.videos(published_at DESC) WHERE visibility='public' AND status='ready';
CREATE INDEX idx_videos_category ON public.videos(category);
CREATE INDEX idx_videos_hashtags ON public.videos USING GIN(hashtags);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.videos TO authenticated;
GRANT SELECT ON public.videos TO anon;
GRANT ALL ON public.videos TO service_role;
ALTER TABLE public.videos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "videos_select_public" ON public.videos FOR SELECT USING (visibility='public' AND status='ready');
CREATE POLICY "videos_select_unlisted" ON public.videos FOR SELECT USING (visibility='unlisted' AND status='ready');
CREATE POLICY "videos_select_own" ON public.videos FOR SELECT TO authenticated USING (auth.uid()=owner_id);
CREATE POLICY "videos_insert_own" ON public.videos FOR INSERT TO authenticated WITH CHECK (auth.uid()=owner_id);
CREATE POLICY "videos_update_own" ON public.videos FOR UPDATE TO authenticated USING (auth.uid()=owner_id);
CREATE POLICY "videos_delete_own" ON public.videos FOR DELETE TO authenticated USING (auth.uid()=owner_id);

CREATE TABLE public.video_views (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  video_id UUID NOT NULL REFERENCES public.videos(id) ON DELETE CASCADE,
  viewer_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  watched_seconds INTEGER NOT NULL DEFAULT 0,
  country TEXT, state TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_video_views_video ON public.video_views(video_id);
GRANT SELECT, INSERT ON public.video_views TO authenticated;
GRANT INSERT ON public.video_views TO anon;
GRANT ALL ON public.video_views TO service_role;
ALTER TABLE public.video_views ENABLE ROW LEVEL SECURITY;
CREATE POLICY "vv_select_owner" ON public.video_views FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.videos v WHERE v.id=video_id AND v.owner_id=auth.uid()));
CREATE POLICY "vv_insert_any" ON public.video_views FOR INSERT WITH CHECK (true);

CREATE TABLE public.video_reactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  video_id UUID NOT NULL REFERENCES public.videos(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  kind public.video_reaction_kind NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (video_id, user_id, kind)
);
CREATE INDEX idx_video_reactions_video ON public.video_reactions(video_id);
GRANT SELECT, INSERT, DELETE ON public.video_reactions TO authenticated;
GRANT SELECT ON public.video_reactions TO anon;
GRANT ALL ON public.video_reactions TO service_role;
ALTER TABLE public.video_reactions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "vr_select" ON public.video_reactions FOR SELECT USING (true);
CREATE POLICY "vr_insert_own" ON public.video_reactions FOR INSERT TO authenticated WITH CHECK (auth.uid()=user_id);
CREATE POLICY "vr_delete_own" ON public.video_reactions FOR DELETE TO authenticated USING (auth.uid()=user_id);

CREATE TABLE public.video_comments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  video_id UUID NOT NULL REFERENCES public.videos(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  parent_id UUID REFERENCES public.video_comments(id) ON DELETE CASCADE,
  body TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_video_comments_video ON public.video_comments(video_id);
CREATE INDEX idx_video_comments_parent ON public.video_comments(parent_id);
GRANT SELECT, INSERT, DELETE ON public.video_comments TO authenticated;
GRANT SELECT ON public.video_comments TO anon;
GRANT ALL ON public.video_comments TO service_role;
ALTER TABLE public.video_comments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "vc_select" ON public.video_comments FOR SELECT USING (true);
CREATE POLICY "vc_insert_own" ON public.video_comments FOR INSERT TO authenticated WITH CHECK (auth.uid()=user_id);
CREATE POLICY "vc_delete_own" ON public.video_comments FOR DELETE TO authenticated USING (auth.uid()=user_id);

CREATE TABLE public.video_comment_reactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  comment_id UUID NOT NULL REFERENCES public.video_comments(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  kind public.video_reaction_kind NOT NULL DEFAULT 'like',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (comment_id, user_id, kind)
);
CREATE INDEX idx_vcr_comment ON public.video_comment_reactions(comment_id);
GRANT SELECT, INSERT, DELETE ON public.video_comment_reactions TO authenticated;
GRANT SELECT ON public.video_comment_reactions TO anon;
GRANT ALL ON public.video_comment_reactions TO service_role;
ALTER TABLE public.video_comment_reactions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "vcr_select" ON public.video_comment_reactions FOR SELECT USING (true);
CREATE POLICY "vcr_insert_own" ON public.video_comment_reactions FOR INSERT TO authenticated WITH CHECK (auth.uid()=user_id);
CREATE POLICY "vcr_delete_own" ON public.video_comment_reactions FOR DELETE TO authenticated USING (auth.uid()=user_id);

CREATE TABLE public.video_boosts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  video_id UUID NOT NULL REFERENCES public.videos(id) ON DELETE CASCADE,
  owner_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'pending',
  amount_cents INTEGER NOT NULL DEFAULT 0,
  currency TEXT NOT NULL DEFAULT 'brl',
  target_countries TEXT[] DEFAULT '{}',
  target_states TEXT[] DEFAULT '{}',
  target_age_min INTEGER, target_age_max INTEGER,
  target_genders TEXT[] DEFAULT '{}',
  target_interests TEXT[] DEFAULT '{}',
  duration_days INTEGER NOT NULL DEFAULT 7,
  starts_at TIMESTAMPTZ, ends_at TIMESTAMPTZ,
  impressions INTEGER NOT NULL DEFAULT 0,
  clicks INTEGER NOT NULL DEFAULT 0,
  stripe_session_id TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_video_boosts_video ON public.video_boosts(video_id);
GRANT SELECT, INSERT, UPDATE ON public.video_boosts TO authenticated;
GRANT ALL ON public.video_boosts TO service_role;
ALTER TABLE public.video_boosts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "vb_select_own" ON public.video_boosts FOR SELECT TO authenticated USING (auth.uid()=owner_id);
CREATE POLICY "vb_insert_own" ON public.video_boosts FOR INSERT TO authenticated WITH CHECK (auth.uid()=owner_id);
CREATE POLICY "vb_update_own" ON public.video_boosts FOR UPDATE TO authenticated USING (auth.uid()=owner_id);

CREATE TABLE public.video_boost_clicks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  boost_id UUID NOT NULL REFERENCES public.video_boosts(id) ON DELETE CASCADE,
  video_id UUID NOT NULL REFERENCES public.videos(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  country TEXT, state TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_vbc_boost ON public.video_boost_clicks(boost_id);
GRANT SELECT, INSERT ON public.video_boost_clicks TO authenticated;
GRANT INSERT ON public.video_boost_clicks TO anon;
GRANT ALL ON public.video_boost_clicks TO service_role;
ALTER TABLE public.video_boost_clicks ENABLE ROW LEVEL SECURITY;
CREATE POLICY "vbc_select_owner" ON public.video_boost_clicks FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.video_boosts b WHERE b.id=boost_id AND b.owner_id=auth.uid()));
CREATE POLICY "vbc_insert_any" ON public.video_boost_clicks FOR INSERT WITH CHECK (true);

ALTER TABLE public.live_sessions ADD COLUMN IF NOT EXISTS orientation TEXT NOT NULL DEFAULT 'portrait';

CREATE TRIGGER trg_videos_updated BEFORE UPDATE ON public.videos
  FOR EACH ROW EXECUTE FUNCTION public.wavetube_touch_updated_at();
CREATE TRIGGER trg_video_boosts_updated BEFORE UPDATE ON public.video_boosts
  FOR EACH ROW EXECUTE FUNCTION public.wavetube_touch_updated_at();

CREATE OR REPLACE FUNCTION public.tg_video_reaction_count()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path=public AS $$
BEGIN
  IF TG_OP='INSERT' THEN
    IF NEW.kind='like' THEN UPDATE public.videos SET likes_count=likes_count+1 WHERE id=NEW.video_id;
    ELSIF NEW.kind='dislike' THEN UPDATE public.videos SET dislikes_count=dislikes_count+1 WHERE id=NEW.video_id;
    END IF;
  ELSIF TG_OP='DELETE' THEN
    IF OLD.kind='like' THEN UPDATE public.videos SET likes_count=GREATEST(0,likes_count-1) WHERE id=OLD.video_id;
    ELSIF OLD.kind='dislike' THEN UPDATE public.videos SET dislikes_count=GREATEST(0,dislikes_count-1) WHERE id=OLD.video_id;
    END IF;
  END IF;
  RETURN NULL;
END;$$;
CREATE TRIGGER trg_video_reaction_count AFTER INSERT OR DELETE ON public.video_reactions
  FOR EACH ROW EXECUTE FUNCTION public.tg_video_reaction_count();

CREATE OR REPLACE FUNCTION public.tg_video_comment_count()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path=public AS $$
BEGIN
  IF TG_OP='INSERT' THEN UPDATE public.videos SET comments_count=comments_count+1 WHERE id=NEW.video_id;
  ELSIF TG_OP='DELETE' THEN UPDATE public.videos SET comments_count=GREATEST(0,comments_count-1) WHERE id=OLD.video_id;
  END IF;
  RETURN NULL;
END;$$;
CREATE TRIGGER trg_video_comment_count AFTER INSERT OR DELETE ON public.video_comments
  FOR EACH ROW EXECUTE FUNCTION public.tg_video_comment_count();

CREATE OR REPLACE FUNCTION public.tg_video_view_count()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path=public AS $$
BEGIN UPDATE public.videos SET views_count=views_count+1 WHERE id=NEW.video_id; RETURN NULL; END;$$;
CREATE TRIGGER trg_video_view_count AFTER INSERT ON public.video_views
  FOR EACH ROW EXECUTE FUNCTION public.tg_video_view_count();

CREATE OR REPLACE FUNCTION public.discover_wavetube_videos(
  _sort TEXT DEFAULT 'recent',
  _category TEXT DEFAULT NULL,
  _search TEXT DEFAULT NULL,
  _limit INT DEFAULT 24,
  _offset INT DEFAULT 0
)
RETURNS TABLE (
  id UUID, owner_id UUID, title TEXT, description TEXT, category TEXT,
  thumbnail_url TEXT, duration_sec INT, views_count INT, likes_count INT,
  published_at TIMESTAMPTZ, owner_username TEXT, owner_display_name TEXT,
  owner_avatar_url TEXT
)
LANGUAGE sql STABLE SET search_path=public AS $$
  SELECT v.id, v.owner_id, v.title, v.description, v.category,
         v.thumbnail_url, v.duration_sec, v.views_count, v.likes_count,
         v.published_at, p.username, p.display_name, p.avatar_url
  FROM public.videos v
  LEFT JOIN public.profiles p ON p.id = v.owner_id
  WHERE v.visibility='public' AND v.status='ready'
    AND (_category IS NULL OR v.category = _category)
    AND (_search IS NULL OR v.title ILIKE '%'||_search||'%' OR v.description ILIKE '%'||_search||'%')
  ORDER BY
    CASE WHEN _sort='trending' THEN v.views_count END DESC NULLS LAST,
    v.published_at DESC NULLS LAST
  LIMIT _limit OFFSET _offset;
$$;
GRANT EXECUTE ON FUNCTION public.discover_wavetube_videos(TEXT,TEXT,TEXT,INT,INT) TO anon, authenticated;
