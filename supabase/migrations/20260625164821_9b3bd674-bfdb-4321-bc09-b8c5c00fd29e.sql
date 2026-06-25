
CREATE TABLE public.invite_clicks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  inviter_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  channel text NOT NULL DEFAULT 'other',
  referrer text,
  user_agent text,
  utm jsonb NOT NULL DEFAULT '{}'::jsonb,
  ip_hash text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_invite_clicks_inviter_created ON public.invite_clicks(inviter_id, created_at DESC);
CREATE INDEX idx_invite_clicks_channel ON public.invite_clicks(channel);
GRANT SELECT ON public.invite_clicks TO authenticated;
GRANT INSERT ON public.invite_clicks TO anon, authenticated;
GRANT ALL ON public.invite_clicks TO service_role;
ALTER TABLE public.invite_clicks ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can record an invite click" ON public.invite_clicks FOR INSERT TO anon, authenticated WITH CHECK (true);
CREATE POLICY "Inviter sees own clicks" ON public.invite_clicks FOR SELECT TO authenticated USING (inviter_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));

CREATE TABLE public.invite_signups (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  inviter_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  invited_user_id uuid NOT NULL UNIQUE REFERENCES public.profiles(id) ON DELETE CASCADE,
  channel text NOT NULL DEFAULT 'other',
  click_id uuid REFERENCES public.invite_clicks(id) ON DELETE SET NULL,
  install_source text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_invite_signups_inviter ON public.invite_signups(inviter_id, created_at DESC);
GRANT SELECT, INSERT ON public.invite_signups TO authenticated;
GRANT ALL ON public.invite_signups TO service_role;
ALTER TABLE public.invite_signups ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Inviter or admin sees signups" ON public.invite_signups FOR SELECT TO authenticated USING (inviter_id = auth.uid() OR invited_user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));
CREATE POLICY "User creates own signup link" ON public.invite_signups FOR INSERT TO authenticated WITH CHECK (invited_user_id = auth.uid());
CREATE POLICY "Admin can manage signups" ON public.invite_signups FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE TABLE public.ambassador_tiers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  icon text NOT NULL DEFAULT '🏅',
  min_invites integer NOT NULL,
  active boolean NOT NULL DEFAULT true,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX idx_ambassador_tiers_min ON public.ambassador_tiers(min_invites);
GRANT SELECT ON public.ambassador_tiers TO anon, authenticated;
GRANT ALL ON public.ambassador_tiers TO service_role;
ALTER TABLE public.ambassador_tiers ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone reads tiers" ON public.ambassador_tiers FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "Admin manages tiers" ON public.ambassador_tiers FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));

INSERT INTO public.ambassador_tiers (name, icon, min_invites, sort_order) VALUES
  ('Primeiro Convite', '🌱', 1, 1),
  ('Embaixador Bronze', '🥉', 5, 2),
  ('Embaixador Prata', '🥈', 10, 3),
  ('Embaixador Ouro', '🥇', 25, 4),
  ('Embaixador Platina', '💠', 50, 5),
  ('Embaixador Diamante', '💎', 100, 6),
  ('Embaixador Mestre', '🏆', 250, 7),
  ('Embaixador Lenda', '👑', 500, 8),
  ('Embaixador Imortal', '⚡', 1000, 9);

CREATE TABLE public.ambassador_settings (
  id boolean PRIMARY KEY DEFAULT true CHECK (id),
  ranking_public boolean NOT NULL DEFAULT true,
  rewards_enabled boolean NOT NULL DEFAULT true,
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.ambassador_settings TO anon, authenticated;
GRANT ALL ON public.ambassador_settings TO service_role;
ALTER TABLE public.ambassador_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone reads ambassador settings" ON public.ambassador_settings FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "Admin manages ambassador settings" ON public.ambassador_settings FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));
INSERT INTO public.ambassador_settings (id) VALUES (true);

CREATE OR REPLACE FUNCTION public.get_my_invite_stats()
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE uid uuid := auth.uid(); result jsonb;
BEGIN
  IF uid IS NULL THEN RETURN '{}'::jsonb; END IF;
  SELECT jsonb_build_object(
    'clicks', (SELECT COUNT(*) FROM invite_clicks WHERE inviter_id = uid),
    'signups', (SELECT COUNT(*) FROM invite_signups WHERE inviter_id = uid),
    'active', (SELECT COUNT(*) FROM invite_signups s JOIN profiles p ON p.id = s.invited_user_id WHERE s.inviter_id = uid AND p.last_seen > now() - interval '30 days'),
    'by_channel', COALESCE((SELECT jsonb_object_agg(channel, n) FROM (SELECT channel, COUNT(*) AS n FROM invite_clicks WHERE inviter_id = uid GROUP BY channel) c), '{}'::jsonb),
    'signups_by_channel', COALESCE((SELECT jsonb_object_agg(channel, n) FROM (SELECT channel, COUNT(*) AS n FROM invite_signups WHERE inviter_id = uid GROUP BY channel) c), '{}'::jsonb)
  ) INTO result;
  RETURN result;
END; $$;
GRANT EXECUTE ON FUNCTION public.get_my_invite_stats() TO authenticated;

CREATE OR REPLACE FUNCTION public.get_ambassador_level(_user_id uuid)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE total int; tier record; next_tier record;
BEGIN
  SELECT COUNT(*) INTO total FROM invite_signups WHERE inviter_id = _user_id;
  SELECT * INTO tier FROM ambassador_tiers WHERE active AND min_invites <= total ORDER BY min_invites DESC LIMIT 1;
  SELECT * INTO next_tier FROM ambassador_tiers WHERE active AND min_invites > total ORDER BY min_invites ASC LIMIT 1;
  RETURN jsonb_build_object(
    'invited', total,
    'tier', CASE WHEN tier.id IS NULL THEN NULL ELSE jsonb_build_object('id', tier.id, 'name', tier.name, 'icon', tier.icon, 'min_invites', tier.min_invites) END,
    'next', CASE WHEN next_tier.id IS NULL THEN NULL ELSE jsonb_build_object('id', next_tier.id, 'name', next_tier.name, 'icon', next_tier.icon, 'min_invites', next_tier.min_invites) END
  );
END; $$;
GRANT EXECUTE ON FUNCTION public.get_ambassador_level(uuid) TO anon, authenticated;

CREATE OR REPLACE FUNCTION public.get_top_ambassadors(_limit int DEFAULT 50)
RETURNS TABLE(user_id uuid, username text, display_name text, avatar_url text, invited bigint, tier_name text, tier_icon text)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE is_public boolean;
BEGIN
  SELECT ranking_public INTO is_public FROM ambassador_settings WHERE id = true;
  IF NOT COALESCE(is_public, false) AND NOT public.has_role(auth.uid(), 'admin') THEN RETURN; END IF;
  RETURN QUERY
  SELECT p.id, p.username, p.display_name, p.avatar_url, c.n, t.name, t.icon
  FROM (SELECT inviter_id, COUNT(*)::bigint AS n FROM invite_signups GROUP BY inviter_id ORDER BY n DESC LIMIT _limit) c
  JOIN profiles p ON p.id = c.inviter_id
  LEFT JOIN LATERAL (SELECT name, icon FROM ambassador_tiers WHERE active AND min_invites <= c.n ORDER BY min_invites DESC LIMIT 1) t ON true;
END; $$;
GRANT EXECUTE ON FUNCTION public.get_top_ambassadors(int) TO anon, authenticated;

CREATE OR REPLACE FUNCTION public.get_admin_invite_overview()
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN RAISE EXCEPTION 'forbidden'; END IF;
  RETURN jsonb_build_object(
    'total_clicks', (SELECT COUNT(*) FROM invite_clicks),
    'total_signups', (SELECT COUNT(*) FROM invite_signups),
    'unique_inviters', (SELECT COUNT(DISTINCT inviter_id) FROM invite_signups),
    'by_channel', COALESCE((SELECT jsonb_object_agg(channel, n) FROM (SELECT channel, COUNT(*) n FROM invite_clicks GROUP BY channel) x), '{}'::jsonb),
    'signups_by_channel', COALESCE((SELECT jsonb_object_agg(channel, n) FROM (SELECT channel, COUNT(*) n FROM invite_signups GROUP BY channel) x), '{}'::jsonb),
    'daily', COALESCE((SELECT jsonb_agg(jsonb_build_object('day', d, 'clicks', clicks, 'signups', signups) ORDER BY d) FROM (
      SELECT day::date AS d,
        (SELECT COUNT(*) FROM invite_clicks WHERE created_at::date = day::date) AS clicks,
        (SELECT COUNT(*) FROM invite_signups WHERE created_at::date = day::date) AS signups
      FROM generate_series(now() - interval '29 days', now(), interval '1 day') day) z), '[]'::jsonb)
  );
END; $$;
GRANT EXECUTE ON FUNCTION public.get_admin_invite_overview() TO authenticated;
