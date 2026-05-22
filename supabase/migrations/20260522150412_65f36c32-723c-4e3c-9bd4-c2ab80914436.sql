
-- 1) statuses
CREATE TABLE public.statuses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  kind TEXT NOT NULL CHECK (kind IN ('text','image','video')),
  content TEXT,
  media_url TEXT,
  caption TEXT,
  background TEXT,
  expires_at TIMESTAMPTZ NOT NULL DEFAULT (now() + interval '24 hours'),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_statuses_user_created ON public.statuses(user_id, created_at DESC);
CREATE INDEX idx_statuses_expires ON public.statuses(expires_at);
ALTER TABLE public.statuses ENABLE ROW LEVEL SECURITY;

-- 2) status_views
CREATE TABLE public.status_views (
  status_id UUID NOT NULL REFERENCES public.statuses(id) ON DELETE CASCADE,
  viewer_id UUID NOT NULL,
  viewed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  from_boost BOOLEAN NOT NULL DEFAULT false,
  PRIMARY KEY (status_id, viewer_id)
);
ALTER TABLE public.status_views ENABLE ROW LEVEL SECURITY;

-- 3) status_boosts (created BEFORE the statuses SELECT policy that references it)
CREATE TABLE public.status_boosts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  status_id UUID NOT NULL REFERENCES public.statuses(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  package TEXT NOT NULL CHECK (package IN ('boost_100','boost_500','boost_2000')),
  views_total INTEGER NOT NULL,
  views_remaining INTEGER NOT NULL,
  amount_cents INTEGER NOT NULL,
  currency TEXT NOT NULL DEFAULT 'brl',
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','active','completed','failed','refunded')),
  checkout_session_id TEXT,
  transaction_id TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  activated_at TIMESTAMPTZ
);
CREATE INDEX idx_boosts_status ON public.status_boosts(status_id) WHERE status = 'active';
CREATE INDEX idx_boosts_session ON public.status_boosts(checkout_session_id);
ALTER TABLE public.status_boosts ENABLE ROW LEVEL SECURITY;

-- Helper function
CREATE OR REPLACE FUNCTION public.users_share_conversation(_a UUID, _b UUID)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM conversation_members ma
    JOIN conversation_members mb ON ma.conversation_id = mb.conversation_id
    WHERE ma.user_id = _a AND mb.user_id = _b
  );
$$;

-- Policies: statuses
CREATE POLICY "Users can insert own status" ON public.statuses
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own status" ON public.statuses
  FOR DELETE TO authenticated USING (auth.uid() = user_id);

CREATE POLICY "View own, contacts, or boosted statuses" ON public.statuses
  FOR SELECT TO authenticated USING (
    expires_at > now() AND (
      user_id = auth.uid()
      OR public.users_share_conversation(auth.uid(), user_id)
      OR EXISTS (
        SELECT 1 FROM public.status_boosts sb
        WHERE sb.status_id = statuses.id
          AND sb.status = 'active'
          AND sb.views_remaining > 0
      )
    )
  );

-- Policies: status_views
CREATE POLICY "Viewers insert own view" ON public.status_views
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = viewer_id);

CREATE POLICY "Status owner or viewer reads view" ON public.status_views
  FOR SELECT TO authenticated USING (
    auth.uid() = viewer_id
    OR EXISTS (SELECT 1 FROM public.statuses s WHERE s.id = status_id AND s.user_id = auth.uid())
  );

-- Policies: status_boosts
CREATE POLICY "Owner views own boosts" ON public.status_boosts
  FOR SELECT TO authenticated USING (auth.uid() = user_id);

CREATE POLICY "Owner inserts boost" ON public.status_boosts
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

CREATE TRIGGER set_boosts_updated_at BEFORE UPDATE ON public.status_boosts
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Storage bucket for status media
INSERT INTO storage.buckets (id, name, public) VALUES ('status-media', 'status-media', true)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "Status media public read" ON storage.objects
  FOR SELECT USING (bucket_id = 'status-media');

CREATE POLICY "Users upload own status media" ON storage.objects
  FOR INSERT TO authenticated WITH CHECK (
    bucket_id = 'status-media' AND auth.uid()::text = (storage.foldername(name))[1]
  );

CREATE POLICY "Users delete own status media" ON storage.objects
  FOR DELETE TO authenticated USING (
    bucket_id = 'status-media' AND auth.uid()::text = (storage.foldername(name))[1]
  );
