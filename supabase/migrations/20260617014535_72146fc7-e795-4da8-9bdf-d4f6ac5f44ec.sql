
-- ============ Scheduled posts ============
CREATE TABLE public.scheduled_posts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  kind text NOT NULL CHECK (kind IN ('text','image','video')),
  content text,
  media_url text,
  thumbnail_url text,
  caption text,
  background text,
  hashtags text[] NOT NULL DEFAULT '{}',
  music_track_id uuid,
  visibility text NOT NULL DEFAULT 'public' CHECK (visibility IN ('public','followers')),
  scheduled_at timestamptz NOT NULL,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','published','cancelled','failed')),
  published_post_id uuid,
  error_message text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_scheduled_posts_due ON public.scheduled_posts (scheduled_at) WHERE status = 'pending';
CREATE INDEX idx_scheduled_posts_user ON public.scheduled_posts (user_id, scheduled_at DESC);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.scheduled_posts TO authenticated;
GRANT ALL ON public.scheduled_posts TO service_role;
ALTER TABLE public.scheduled_posts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own scheduled posts select" ON public.scheduled_posts FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "own scheduled posts insert" ON public.scheduled_posts FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
CREATE POLICY "own scheduled posts update" ON public.scheduled_posts FOR UPDATE TO authenticated USING (user_id = auth.uid());
CREATE POLICY "own scheduled posts delete" ON public.scheduled_posts FOR DELETE TO authenticated USING (user_id = auth.uid());

-- ============ Scheduled statuses ============
CREATE TABLE public.scheduled_statuses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  kind text NOT NULL CHECK (kind IN ('text','image','video')),
  content text,
  media_url text,
  caption text,
  background text,
  description text,
  hashtags text[] NOT NULL DEFAULT '{}',
  cta_url text,
  cta_label text,
  music_track_id uuid,
  music_start_sec integer NOT NULL DEFAULT 0,
  music_duration_sec integer NOT NULL DEFAULT 15,
  music_volume numeric(3,2) NOT NULL DEFAULT 0.80,
  scheduled_at timestamptz NOT NULL,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','published','cancelled','failed')),
  published_status_id uuid,
  error_message text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_scheduled_statuses_due ON public.scheduled_statuses (scheduled_at) WHERE status = 'pending';
CREATE INDEX idx_scheduled_statuses_user ON public.scheduled_statuses (user_id, scheduled_at DESC);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.scheduled_statuses TO authenticated;
GRANT ALL ON public.scheduled_statuses TO service_role;
ALTER TABLE public.scheduled_statuses ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own scheduled statuses select" ON public.scheduled_statuses FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "own scheduled statuses insert" ON public.scheduled_statuses FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
CREATE POLICY "own scheduled statuses update" ON public.scheduled_statuses FOR UPDATE TO authenticated USING (user_id = auth.uid());
CREATE POLICY "own scheduled statuses delete" ON public.scheduled_statuses FOR DELETE TO authenticated USING (user_id = auth.uid());

-- ============ Scheduled lives ============
CREATE TABLE public.scheduled_lives (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  host_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title text NOT NULL DEFAULT '',
  description text,
  cover_url text,
  scheduled_at timestamptz NOT NULL,
  status text NOT NULL DEFAULT 'scheduled' CHECK (status IN ('scheduled','reminded','started','cancelled','missed')),
  will_record boolean NOT NULL DEFAULT false,
  reminder_sent_at timestamptz,
  host_alert_sent_at timestamptz,
  live_session_id uuid REFERENCES public.live_sessions(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_scheduled_lives_due ON public.scheduled_lives (scheduled_at) WHERE status IN ('scheduled','reminded');
CREATE INDEX idx_scheduled_lives_host ON public.scheduled_lives (host_id, scheduled_at DESC);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.scheduled_lives TO authenticated;
GRANT SELECT ON public.scheduled_lives TO anon;
GRANT ALL ON public.scheduled_lives TO service_role;
ALTER TABLE public.scheduled_lives ENABLE ROW LEVEL SECURITY;
-- public: ver lives agendadas futuras (próximos 14 dias) — equivalente ao "Em breve"
CREATE POLICY "scheduled lives public future" ON public.scheduled_lives FOR SELECT
  USING (status IN ('scheduled','reminded') AND scheduled_at >= now() - interval '1 hour' AND scheduled_at <= now() + interval '30 days');
CREATE POLICY "scheduled lives own all" ON public.scheduled_lives FOR SELECT TO authenticated USING (host_id = auth.uid());
CREATE POLICY "scheduled lives host insert" ON public.scheduled_lives FOR INSERT TO authenticated WITH CHECK (host_id = auth.uid());
CREATE POLICY "scheduled lives host update" ON public.scheduled_lives FOR UPDATE TO authenticated USING (host_id = auth.uid());
CREATE POLICY "scheduled lives host delete" ON public.scheduled_lives FOR DELETE TO authenticated USING (host_id = auth.uid());

-- ============ live_sessions: gravação ============
ALTER TABLE public.live_sessions
  ADD COLUMN IF NOT EXISTS will_record boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS scheduled_live_id uuid REFERENCES public.scheduled_lives(id) ON DELETE SET NULL;

-- ============ Live recordings ============
CREATE TABLE public.live_recordings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  live_id uuid NOT NULL REFERENCES public.live_sessions(id) ON DELETE CASCADE,
  host_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  livekit_egress_id text,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','recording','processing','ready','failed','cancelled')),
  storage_path text,
  file_url text,
  thumbnail_url text,
  duration_sec integer,
  size_bytes bigint,
  started_at timestamptz,
  ended_at timestamptz,
  is_public boolean NOT NULL DEFAULT false,
  error_message text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_live_recordings_host ON public.live_recordings (host_id, created_at DESC);
CREATE INDEX idx_live_recordings_live ON public.live_recordings (live_id);
CREATE INDEX idx_live_recordings_egress ON public.live_recordings (livekit_egress_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.live_recordings TO authenticated;
GRANT SELECT ON public.live_recordings TO anon;
GRANT ALL ON public.live_recordings TO service_role;
ALTER TABLE public.live_recordings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "recordings host all" ON public.live_recordings FOR ALL TO authenticated
  USING (host_id = auth.uid()) WITH CHECK (host_id = auth.uid());
CREATE POLICY "recordings public when published" ON public.live_recordings FOR SELECT
  USING (is_public = true AND status = 'ready');

-- ============ updated_at triggers ============
CREATE OR REPLACE FUNCTION public.touch_updated_at() RETURNS trigger
  LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END $$;

CREATE TRIGGER trg_scheduled_posts_touch BEFORE UPDATE ON public.scheduled_posts
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
CREATE TRIGGER trg_scheduled_statuses_touch BEFORE UPDATE ON public.scheduled_statuses
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
CREATE TRIGGER trg_scheduled_lives_touch BEFORE UPDATE ON public.scheduled_lives
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
CREATE TRIGGER trg_live_recordings_touch BEFORE UPDATE ON public.live_recordings
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- Realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.scheduled_lives;
ALTER PUBLICATION supabase_realtime ADD TABLE public.live_recordings;
