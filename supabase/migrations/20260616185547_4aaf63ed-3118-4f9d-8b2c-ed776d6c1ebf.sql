
-- ============ ENUMS ============
DO $$ BEGIN
  CREATE TYPE public.live_status AS ENUM ('live', 'ended');
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  CREATE TYPE public.stage_request_status AS ENUM ('pending','approved','rejected','kicked','left');
EXCEPTION WHEN duplicate_object THEN null; END $$;

-- ============ live_sessions ============
CREATE TABLE public.live_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  host_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title text NOT NULL DEFAULT '',
  cover_url text,
  livekit_room text NOT NULL UNIQUE,
  status public.live_status NOT NULL DEFAULT 'live',
  viewer_count integer NOT NULL DEFAULT 0,
  peak_viewers integer NOT NULL DEFAULT 0,
  total_reactions integer NOT NULL DEFAULT 0,
  total_gift_coins integer NOT NULL DEFAULT 0,
  started_at timestamptz NOT NULL DEFAULT now(),
  ended_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_live_sessions_status_started ON public.live_sessions(status, started_at DESC);
CREATE INDEX idx_live_sessions_host ON public.live_sessions(host_id, started_at DESC);
GRANT SELECT ON public.live_sessions TO anon, authenticated;
GRANT INSERT, UPDATE ON public.live_sessions TO authenticated;
GRANT ALL ON public.live_sessions TO service_role;
ALTER TABLE public.live_sessions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "lives are public" ON public.live_sessions FOR SELECT USING (true);
CREATE POLICY "host can insert own live" ON public.live_sessions FOR INSERT TO authenticated WITH CHECK (host_id = auth.uid());
CREATE POLICY "host can update own live" ON public.live_sessions FOR UPDATE TO authenticated USING (host_id = auth.uid());

-- ============ live_chat_messages ============
CREATE TABLE public.live_chat_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  live_id uuid NOT NULL REFERENCES public.live_sessions(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  body text NOT NULL CHECK (length(body) BETWEEN 1 AND 500),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_live_chat_live_time ON public.live_chat_messages(live_id, created_at DESC);
GRANT SELECT ON public.live_chat_messages TO anon, authenticated;
GRANT INSERT ON public.live_chat_messages TO authenticated;
GRANT DELETE ON public.live_chat_messages TO authenticated;
GRANT ALL ON public.live_chat_messages TO service_role;
ALTER TABLE public.live_chat_messages ENABLE ROW LEVEL SECURITY;
CREATE POLICY "chat public read" ON public.live_chat_messages FOR SELECT USING (true);
CREATE POLICY "logged users can chat" ON public.live_chat_messages FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
CREATE POLICY "author or host can delete" ON public.live_chat_messages FOR DELETE TO authenticated
  USING (user_id = auth.uid() OR EXISTS (SELECT 1 FROM public.live_sessions s WHERE s.id = live_id AND s.host_id = auth.uid()));

-- ============ live_reactions ============
CREATE TABLE public.live_reactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  live_id uuid NOT NULL REFERENCES public.live_sessions(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  emoji text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_live_reactions_live_time ON public.live_reactions(live_id, created_at DESC);
GRANT SELECT ON public.live_reactions TO anon, authenticated;
GRANT INSERT ON public.live_reactions TO authenticated;
GRANT ALL ON public.live_reactions TO service_role;
ALTER TABLE public.live_reactions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "reactions public read" ON public.live_reactions FOR SELECT USING (true);
CREATE POLICY "logged users can react" ON public.live_reactions FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());

-- ============ live_stage_requests ============
CREATE TABLE public.live_stage_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  live_id uuid NOT NULL REFERENCES public.live_sessions(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  status public.stage_request_status NOT NULL DEFAULT 'pending',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (live_id, user_id)
);
CREATE INDEX idx_stage_live_status ON public.live_stage_requests(live_id, status);
GRANT SELECT ON public.live_stage_requests TO anon, authenticated;
GRANT INSERT, UPDATE ON public.live_stage_requests TO authenticated;
GRANT ALL ON public.live_stage_requests TO service_role;
ALTER TABLE public.live_stage_requests ENABLE ROW LEVEL SECURITY;
CREATE POLICY "stage public read" ON public.live_stage_requests FOR SELECT USING (true);
CREATE POLICY "user can request stage" ON public.live_stage_requests FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
CREATE POLICY "user or host can update" ON public.live_stage_requests FOR UPDATE TO authenticated
  USING (user_id = auth.uid() OR EXISTS (SELECT 1 FROM public.live_sessions s WHERE s.id = live_id AND s.host_id = auth.uid()));

-- ============ live_viewers (heartbeat) ============
CREATE TABLE public.live_viewers (
  live_id uuid NOT NULL REFERENCES public.live_sessions(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  last_seen timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (live_id, user_id)
);
CREATE INDEX idx_live_viewers_seen ON public.live_viewers(live_id, last_seen DESC);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.live_viewers TO authenticated;
GRANT SELECT ON public.live_viewers TO anon;
GRANT ALL ON public.live_viewers TO service_role;
ALTER TABLE public.live_viewers ENABLE ROW LEVEL SECURITY;
CREATE POLICY "viewers public read" ON public.live_viewers FOR SELECT USING (true);
CREATE POLICY "self viewer write" ON public.live_viewers FOR ALL TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

-- ============ live_gifts_catalog ============
CREATE TABLE public.live_gifts_catalog (
  id text PRIMARY KEY,
  name text NOT NULL,
  emoji text NOT NULL,
  coins_cost integer NOT NULL CHECK (coins_cost > 0),
  rarity text NOT NULL DEFAULT 'common',
  enabled boolean NOT NULL DEFAULT true,
  sort_order integer NOT NULL DEFAULT 0
);
GRANT SELECT ON public.live_gifts_catalog TO anon, authenticated;
GRANT ALL ON public.live_gifts_catalog TO service_role;
ALTER TABLE public.live_gifts_catalog ENABLE ROW LEVEL SECURITY;
CREATE POLICY "gifts public read" ON public.live_gifts_catalog FOR SELECT USING (enabled);

INSERT INTO public.live_gifts_catalog (id, name, emoji, coins_cost, rarity, sort_order) VALUES
  ('rose','Rosa','🌹',10,'common',1),
  ('heart','Coração','💖',20,'common',2),
  ('clap','Aplauso','👏',30,'common',3),
  ('star','Estrelinha','⭐',50,'common',4),
  ('beer','Cerveja','🍺',80,'rare',5),
  ('cake','Bolo','🎂',120,'rare',6),
  ('crown','Coroa','👑',300,'rare',7),
  ('diamond','Diamante','💎',500,'epic',8),
  ('rocket','Foguete','🚀',1000,'epic',9),
  ('lion','Leão','🦁',2000,'legendary',10),
  ('dragon','Dragão','🐉',5000,'legendary',11);

-- ============ live_gifts_sent ============
CREATE TABLE public.live_gifts_sent (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  live_id uuid NOT NULL REFERENCES public.live_sessions(id) ON DELETE CASCADE,
  sender_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  gift_id text NOT NULL REFERENCES public.live_gifts_catalog(id),
  quantity integer NOT NULL DEFAULT 1 CHECK (quantity > 0),
  coins_spent integer NOT NULL CHECK (coins_spent > 0),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_gifts_sent_live ON public.live_gifts_sent(live_id, created_at DESC);
CREATE INDEX idx_gifts_sent_sender ON public.live_gifts_sent(sender_id);
GRANT SELECT ON public.live_gifts_sent TO anon, authenticated;
GRANT ALL ON public.live_gifts_sent TO service_role;
ALTER TABLE public.live_gifts_sent ENABLE ROW LEVEL SECURITY;
CREATE POLICY "gifts sent public read" ON public.live_gifts_sent FOR SELECT USING (true);

-- ============ user_coins ============
CREATE TABLE public.user_coins (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  balance integer NOT NULL DEFAULT 0 CHECK (balance >= 0),
  lifetime_earned integer NOT NULL DEFAULT 0,
  lifetime_spent integer NOT NULL DEFAULT 0,
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.user_coins TO authenticated;
GRANT ALL ON public.user_coins TO service_role;
ALTER TABLE public.user_coins ENABLE ROW LEVEL SECURITY;
CREATE POLICY "self coins read" ON public.user_coins FOR SELECT TO authenticated USING (user_id = auth.uid());

-- ============ coin_purchases ============
CREATE TABLE public.coin_purchases (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  package_id text NOT NULL,
  coins integer NOT NULL CHECK (coins > 0),
  amount_cents integer NOT NULL,
  currency text NOT NULL DEFAULT 'brl',
  stripe_session_id text UNIQUE,
  status text NOT NULL DEFAULT 'pending',
  created_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz
);
CREATE INDEX idx_coin_purchases_user ON public.coin_purchases(user_id, created_at DESC);
GRANT SELECT ON public.coin_purchases TO authenticated;
GRANT ALL ON public.coin_purchases TO service_role;
ALTER TABLE public.coin_purchases ENABLE ROW LEVEL SECURITY;
CREATE POLICY "self purchases read" ON public.coin_purchases FOR SELECT TO authenticated USING (user_id = auth.uid());

-- ============ RPCs ============
CREATE OR REPLACE FUNCTION public.start_live(p_title text, p_cover_url text DEFAULT NULL)
RETURNS public.live_sessions LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_row public.live_sessions;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'auth required'; END IF;
  -- end any previous lives of this host
  UPDATE public.live_sessions SET status='ended', ended_at=now() WHERE host_id=v_uid AND status='live';
  INSERT INTO public.live_sessions (host_id, title, cover_url, livekit_room)
  VALUES (v_uid, COALESCE(p_title,''), p_cover_url, 'live_' || replace(gen_random_uuid()::text,'-',''))
  RETURNING * INTO v_row;
  RETURN v_row;
END $$;
GRANT EXECUTE ON FUNCTION public.start_live(text, text) TO authenticated;

CREATE OR REPLACE FUNCTION public.end_live(p_live_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
  UPDATE public.live_sessions SET status='ended', ended_at=now()
  WHERE id=p_live_id AND host_id=auth.uid();
END $$;
GRANT EXECUTE ON FUNCTION public.end_live(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.heartbeat_viewer(p_live_id uuid)
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE v_count integer;
BEGIN
  IF auth.uid() IS NOT NULL THEN
    INSERT INTO public.live_viewers (live_id, user_id, last_seen)
    VALUES (p_live_id, auth.uid(), now())
    ON CONFLICT (live_id, user_id) DO UPDATE SET last_seen=now();
  END IF;
  -- expire stale viewers (>45s)
  DELETE FROM public.live_viewers WHERE live_id=p_live_id AND last_seen < now() - interval '45 seconds';
  SELECT count(*) INTO v_count FROM public.live_viewers WHERE live_id=p_live_id;
  UPDATE public.live_sessions
    SET viewer_count=v_count, peak_viewers=GREATEST(peak_viewers, v_count)
    WHERE id=p_live_id;
  RETURN v_count;
END $$;
GRANT EXECUTE ON FUNCTION public.heartbeat_viewer(uuid) TO anon, authenticated;

CREATE OR REPLACE FUNCTION public.send_live_reaction(p_live_id uuid, p_emoji text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'auth required'; END IF;
  INSERT INTO public.live_reactions (live_id, user_id, emoji) VALUES (p_live_id, auth.uid(), p_emoji);
  UPDATE public.live_sessions SET total_reactions = total_reactions + 1 WHERE id=p_live_id;
END $$;
GRANT EXECUTE ON FUNCTION public.send_live_reaction(uuid, text) TO authenticated;

CREATE OR REPLACE FUNCTION public.request_stage(p_live_id uuid)
RETURNS public.live_stage_requests LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE v_row public.live_stage_requests;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'auth required'; END IF;
  INSERT INTO public.live_stage_requests (live_id, user_id, status)
  VALUES (p_live_id, auth.uid(), 'pending')
  ON CONFLICT (live_id, user_id) DO UPDATE SET status='pending', updated_at=now()
  RETURNING * INTO v_row;
  RETURN v_row;
END $$;
GRANT EXECUTE ON FUNCTION public.request_stage(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.resolve_stage_request(p_request_id uuid, p_new_status public.stage_request_status)
RETURNS public.live_stage_requests LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE v_row public.live_stage_requests;
BEGIN
  UPDATE public.live_stage_requests r
    SET status=p_new_status, updated_at=now()
    FROM public.live_sessions s
    WHERE r.id=p_request_id AND s.id=r.live_id AND s.host_id=auth.uid()
    RETURNING r.* INTO v_row;
  IF v_row.id IS NULL THEN RAISE EXCEPTION 'not allowed'; END IF;
  RETURN v_row;
END $$;
GRANT EXECUTE ON FUNCTION public.resolve_stage_request(uuid, public.stage_request_status) TO authenticated;

CREATE OR REPLACE FUNCTION public.leave_stage(p_live_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
  UPDATE public.live_stage_requests SET status='left', updated_at=now()
  WHERE live_id=p_live_id AND user_id=auth.uid();
END $$;
GRANT EXECUTE ON FUNCTION public.leave_stage(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.send_live_gift(p_live_id uuid, p_gift_id text, p_quantity integer DEFAULT 1)
RETURNS public.live_gifts_sent LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_cost integer;
  v_total integer;
  v_balance integer;
  v_row public.live_gifts_sent;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'auth required'; END IF;
  IF p_quantity < 1 OR p_quantity > 99 THEN RAISE EXCEPTION 'invalid quantity'; END IF;
  SELECT coins_cost INTO v_cost FROM public.live_gifts_catalog WHERE id=p_gift_id AND enabled;
  IF v_cost IS NULL THEN RAISE EXCEPTION 'gift not found'; END IF;
  v_total := v_cost * p_quantity;

  INSERT INTO public.user_coins (user_id, balance) VALUES (v_uid, 0) ON CONFLICT (user_id) DO NOTHING;
  SELECT balance INTO v_balance FROM public.user_coins WHERE user_id=v_uid FOR UPDATE;
  IF v_balance < v_total THEN RAISE EXCEPTION 'insufficient coins' USING ERRCODE='P0001'; END IF;

  UPDATE public.user_coins
    SET balance=balance-v_total, lifetime_spent=lifetime_spent+v_total, updated_at=now()
    WHERE user_id=v_uid;

  INSERT INTO public.live_gifts_sent (live_id, sender_id, gift_id, quantity, coins_spent)
  VALUES (p_live_id, v_uid, p_gift_id, p_quantity, v_total)
  RETURNING * INTO v_row;

  UPDATE public.live_sessions SET total_gift_coins = total_gift_coins + v_total WHERE id=p_live_id;
  RETURN v_row;
END $$;
GRANT EXECUTE ON FUNCTION public.send_live_gift(uuid, text, integer) TO authenticated;

-- ============ realtime ============
ALTER PUBLICATION supabase_realtime ADD TABLE public.live_sessions;
ALTER PUBLICATION supabase_realtime ADD TABLE public.live_chat_messages;
ALTER PUBLICATION supabase_realtime ADD TABLE public.live_reactions;
ALTER PUBLICATION supabase_realtime ADD TABLE public.live_stage_requests;
ALTER PUBLICATION supabase_realtime ADD TABLE public.live_gifts_sent;
