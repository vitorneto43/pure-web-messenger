
-- POSTS
CREATE TABLE public.posts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  kind text NOT NULL CHECK (kind IN ('text','image','video')),
  content text,
  media_url text,
  caption text,
  background text,
  hashtags text[] NOT NULL DEFAULT '{}',
  music_track_id uuid REFERENCES public.story_music_tracks(id) ON DELETE SET NULL,
  music_start_sec integer DEFAULT 0,
  music_volume numeric DEFAULT 0.8,
  visibility text NOT NULL DEFAULT 'public' CHECK (visibility IN ('public','followers')),
  is_official boolean NOT NULL DEFAULT false,
  pinned boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_posts_user_created ON public.posts(user_id, created_at DESC);
CREATE INDEX idx_posts_visibility_created ON public.posts(visibility, created_at DESC);
CREATE INDEX idx_posts_hashtags ON public.posts USING GIN(hashtags);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.posts TO authenticated;
GRANT SELECT ON public.posts TO anon;
GRANT ALL ON public.posts TO service_role;
ALTER TABLE public.posts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "posts_select_public" ON public.posts FOR SELECT
  USING (visibility = 'public' OR user_id = auth.uid());
CREATE POLICY "posts_insert_own" ON public.posts FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
CREATE POLICY "posts_update_own" ON public.posts FOR UPDATE TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE POLICY "posts_delete_own" ON public.posts FOR DELETE TO authenticated USING (user_id = auth.uid());
CREATE TRIGGER posts_set_updated_at BEFORE UPDATE ON public.posts
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- REACTIONS
CREATE TABLE public.post_reactions (
  post_id uuid NOT NULL REFERENCES public.posts(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  emoji text NOT NULL DEFAULT '❤️',
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (post_id, user_id)
);
CREATE INDEX idx_post_reactions_post ON public.post_reactions(post_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.post_reactions TO authenticated;
GRANT SELECT ON public.post_reactions TO anon;
GRANT ALL ON public.post_reactions TO service_role;
ALTER TABLE public.post_reactions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "post_reactions_select_all" ON public.post_reactions FOR SELECT USING (true);
CREATE POLICY "post_reactions_insert_own" ON public.post_reactions FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
CREATE POLICY "post_reactions_delete_own" ON public.post_reactions FOR DELETE TO authenticated USING (user_id = auth.uid());

-- COMMENTS (max 2 levels)
CREATE TABLE public.post_comments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id uuid NOT NULL REFERENCES public.posts(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  parent_id uuid REFERENCES public.post_comments(id) ON DELETE CASCADE,
  content text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_post_comments_post_created ON public.post_comments(post_id, created_at);
CREATE INDEX idx_post_comments_parent ON public.post_comments(parent_id) WHERE parent_id IS NOT NULL;
CREATE OR REPLACE FUNCTION public.post_comments_check_depth()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
DECLARE parent_parent uuid;
BEGIN
  IF NEW.parent_id IS NULL THEN RETURN NEW; END IF;
  SELECT parent_id INTO parent_parent FROM public.post_comments WHERE id = NEW.parent_id;
  IF parent_parent IS NOT NULL THEN
    RAISE EXCEPTION 'Replies cannot be nested beyond 2 levels';
  END IF;
  RETURN NEW;
END;$$;
CREATE TRIGGER post_comments_depth BEFORE INSERT ON public.post_comments
  FOR EACH ROW EXECUTE FUNCTION public.post_comments_check_depth();
GRANT SELECT, INSERT, UPDATE, DELETE ON public.post_comments TO authenticated;
GRANT SELECT ON public.post_comments TO anon;
GRANT ALL ON public.post_comments TO service_role;
ALTER TABLE public.post_comments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "post_comments_select_all" ON public.post_comments FOR SELECT USING (true);
CREATE POLICY "post_comments_insert_own" ON public.post_comments FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
CREATE POLICY "post_comments_delete_own_or_post_owner" ON public.post_comments FOR DELETE TO authenticated
  USING (user_id = auth.uid() OR EXISTS (SELECT 1 FROM public.posts p WHERE p.id = post_id AND p.user_id = auth.uid()));

CREATE TABLE public.post_comment_reactions (
  comment_id uuid NOT NULL REFERENCES public.post_comments(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  emoji text NOT NULL DEFAULT '❤️',
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (comment_id, user_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.post_comment_reactions TO authenticated;
GRANT SELECT ON public.post_comment_reactions TO anon;
GRANT ALL ON public.post_comment_reactions TO service_role;
ALTER TABLE public.post_comment_reactions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "pcr_select_all" ON public.post_comment_reactions FOR SELECT USING (true);
CREATE POLICY "pcr_insert_own" ON public.post_comment_reactions FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
CREATE POLICY "pcr_delete_own" ON public.post_comment_reactions FOR DELETE TO authenticated USING (user_id = auth.uid());

-- VIEWS
CREATE TABLE public.post_views (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id uuid NOT NULL REFERENCES public.posts(id) ON DELETE CASCADE,
  viewer_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  session_hash text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_post_views_post ON public.post_views(post_id);
GRANT SELECT ON public.post_views TO authenticated;
GRANT ALL ON public.post_views TO service_role;
ALTER TABLE public.post_views ENABLE ROW LEVEL SECURITY;
CREATE POLICY "post_views_select_post_owner" ON public.post_views FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.posts p WHERE p.id = post_id AND p.user_id = auth.uid()));

-- SHARES
CREATE TABLE public.post_shares (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id uuid NOT NULL REFERENCES public.posts(id) ON DELETE CASCADE,
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  channel text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_post_shares_post ON public.post_shares(post_id);
GRANT SELECT, INSERT ON public.post_shares TO authenticated;
GRANT ALL ON public.post_shares TO service_role;
ALTER TABLE public.post_shares ENABLE ROW LEVEL SECURITY;
CREATE POLICY "post_shares_select_owner" ON public.post_shares FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.posts p WHERE p.id = post_id AND p.user_id = auth.uid()));
CREATE POLICY "post_shares_insert_auth" ON public.post_shares FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());

-- BOOSTS
CREATE TABLE public.post_boosts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id uuid NOT NULL REFERENCES public.posts(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  package text NOT NULL,
  views_total integer NOT NULL DEFAULT 0,
  views_remaining integer NOT NULL DEFAULT 0,
  amount_cents integer NOT NULL DEFAULT 0,
  currency text NOT NULL DEFAULT 'BRL',
  status text NOT NULL DEFAULT 'pending',
  checkout_session_id text,
  transaction_id text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  activated_at timestamptz,
  refunded_amount_cents integer NOT NULL DEFAULT 0,
  refunded_at timestamptz,
  refund_reason text,
  environment text NOT NULL DEFAULT 'sandbox',
  is_free_reward boolean NOT NULL DEFAULT false,
  boost_type text NOT NULL DEFAULT 'package',
  duration_days integer NOT NULL DEFAULT 7,
  target_states text[] NOT NULL DEFAULT '{}',
  target_age_min integer DEFAULT 18,
  target_age_max integer DEFAULT 65,
  target_gender text DEFAULT 'all',
  target_countries text[] NOT NULL DEFAULT '{}',
  objective text DEFAULT 'views',
  cpm_cents integer DEFAULT 0,
  ends_at timestamptz
);
CREATE INDEX idx_post_boosts_post ON public.post_boosts(post_id);
CREATE INDEX idx_post_boosts_user ON public.post_boosts(user_id);
CREATE INDEX idx_post_boosts_active ON public.post_boosts(status, ends_at) WHERE status='active';
GRANT SELECT, INSERT, UPDATE ON public.post_boosts TO authenticated;
GRANT ALL ON public.post_boosts TO service_role;
ALTER TABLE public.post_boosts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "post_boosts_select_own" ON public.post_boosts FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "post_boosts_insert_own" ON public.post_boosts FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
CREATE TRIGGER post_boosts_set_updated_at BEFORE UPDATE ON public.post_boosts
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE public.post_boost_clicks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  boost_id uuid REFERENCES public.post_boosts(id) ON DELETE CASCADE,
  post_id uuid NOT NULL REFERENCES public.posts(id) ON DELETE CASCADE,
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  session_hash text,
  cta_url text,
  amount_charged_cents integer DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_pbc_boost ON public.post_boost_clicks(boost_id);
GRANT SELECT ON public.post_boost_clicks TO authenticated;
GRANT ALL ON public.post_boost_clicks TO service_role;
ALTER TABLE public.post_boost_clicks ENABLE ROW LEVEL SECURITY;
CREATE POLICY "pbc_select_boost_owner" ON public.post_boost_clicks FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.post_boosts b WHERE b.id = boost_id AND b.user_id = auth.uid()));

-- RPCs
CREATE OR REPLACE FUNCTION public.discover_public_posts(_limit integer DEFAULT 20, _offset integer DEFAULT 0)
RETURNS TABLE (
  post_id uuid, user_id uuid, username text, display_name text, avatar_url text,
  kind text, content text, media_url text, caption text, background text, hashtags text[],
  music_track_id uuid, created_at timestamptz, is_official boolean,
  reactions_count bigint, comments_count bigint, views_count bigint,
  is_boosted boolean, viewer_already_liked boolean
)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT p.id, p.user_id, pr.username, pr.display_name, pr.avatar_url,
    p.kind, p.content, p.media_url, p.caption, p.background, p.hashtags,
    p.music_track_id, p.created_at, p.is_official,
    (SELECT count(*) FROM public.post_reactions WHERE post_id = p.id),
    (SELECT count(*) FROM public.post_comments WHERE post_id = p.id),
    (SELECT count(*) FROM public.post_views WHERE post_id = p.id),
    EXISTS (SELECT 1 FROM public.post_boosts b WHERE b.post_id = p.id AND b.status='active' AND (b.ends_at IS NULL OR b.ends_at > now())),
    CASE WHEN auth.uid() IS NULL THEN false ELSE EXISTS (
      SELECT 1 FROM public.post_reactions r WHERE r.post_id = p.id AND r.user_id = auth.uid()
    ) END
  FROM public.posts p JOIN public.profiles pr ON pr.id = p.user_id
  WHERE p.visibility = 'public'
  ORDER BY
    (EXISTS (SELECT 1 FROM public.post_boosts b WHERE b.post_id = p.id AND b.status='active' AND (b.ends_at IS NULL OR b.ends_at > now()))) DESC,
    p.created_at DESC
  LIMIT _limit OFFSET _offset;
$$;
GRANT EXECUTE ON FUNCTION public.discover_public_posts(integer, integer) TO anon, authenticated;

CREATE OR REPLACE FUNCTION public.register_post_view(_post_id uuid, _session_hash text DEFAULT NULL)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.post_views(post_id, viewer_id, session_hash) VALUES (_post_id, auth.uid(), _session_hash);
END;$$;
GRANT EXECUTE ON FUNCTION public.register_post_view(uuid, text) TO anon, authenticated;

CREATE OR REPLACE FUNCTION public.register_post_boost_click(_post_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE b record;
BEGIN
  SELECT * INTO b FROM public.post_boosts WHERE post_id = _post_id AND status='active' ORDER BY created_at DESC LIMIT 1;
  IF b.id IS NULL THEN RETURN jsonb_build_object('ok', false); END IF;
  INSERT INTO public.post_boost_clicks(boost_id, post_id, user_id) VALUES (b.id, _post_id, auth.uid());
  RETURN jsonb_build_object('ok', true);
END;$$;
GRANT EXECUTE ON FUNCTION public.register_post_boost_click(uuid) TO anon, authenticated;

CREATE OR REPLACE FUNCTION public.get_public_post(_post_id uuid)
RETURNS TABLE (
  post_id uuid, user_id uuid, username text, display_name text, avatar_url text,
  kind text, content text, media_url text, caption text, background text, hashtags text[],
  music_track_id uuid, created_at timestamptz, is_official boolean,
  reactions_count bigint, comments_count bigint, views_count bigint
)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT p.id, p.user_id, pr.username, pr.display_name, pr.avatar_url,
    p.kind, p.content, p.media_url, p.caption, p.background, p.hashtags,
    p.music_track_id, p.created_at, p.is_official,
    (SELECT count(*) FROM public.post_reactions WHERE post_id = p.id),
    (SELECT count(*) FROM public.post_comments WHERE post_id = p.id),
    (SELECT count(*) FROM public.post_views WHERE post_id = p.id)
  FROM public.posts p JOIN public.profiles pr ON pr.id = p.user_id
  WHERE p.id = _post_id AND p.visibility = 'public';
$$;
GRANT EXECUTE ON FUNCTION public.get_public_post(uuid) TO anon, authenticated;

CREATE OR REPLACE FUNCTION public.get_public_post_comments(_post_id uuid)
RETURNS TABLE (
  id uuid, post_id uuid, parent_id uuid, user_id uuid,
  username text, display_name text, avatar_url text,
  content text, created_at timestamptz, reactions_count bigint
)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT c.id, c.post_id, c.parent_id, c.user_id, pr.username, pr.display_name, pr.avatar_url,
    c.content, c.created_at,
    (SELECT count(*) FROM public.post_comment_reactions WHERE comment_id = c.id)
  FROM public.post_comments c JOIN public.profiles pr ON pr.id = c.user_id
  WHERE c.post_id = _post_id ORDER BY c.created_at ASC;
$$;
GRANT EXECUTE ON FUNCTION public.get_public_post_comments(uuid) TO anon, authenticated;
