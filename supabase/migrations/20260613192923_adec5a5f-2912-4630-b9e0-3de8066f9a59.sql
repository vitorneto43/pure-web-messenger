
-- =========================================================
-- DEVICE FINGERPRINTS
-- =========================================================
CREATE TABLE IF NOT EXISTS public.device_fingerprints (
  fingerprint_hash text PRIMARY KEY,
  account_count integer NOT NULL DEFAULT 0,
  banned_account_count integer NOT NULL DEFAULT 0,
  risk_level text NOT NULL DEFAULT 'low' CHECK (risk_level IN ('low','medium','high','critical')),
  is_blocked boolean NOT NULL DEFAULT false,
  blocked_reason text,
  blocked_at timestamptz,
  first_seen_at timestamptz NOT NULL DEFAULT now(),
  last_seen_at timestamptz NOT NULL DEFAULT now(),
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb
);

GRANT SELECT ON public.device_fingerprints TO authenticated;
GRANT ALL ON public.device_fingerprints TO service_role;
ALTER TABLE public.device_fingerprints ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Moderators read device fingerprints"
  ON public.device_fingerprints FOR SELECT TO authenticated
  USING (
    has_role(auth.uid(), 'admin'::app_role)
    OR has_role(auth.uid(), 'moderator'::app_role)
    OR has_role(auth.uid(), 'superadmin'::app_role)
  );

-- =========================================================
-- DEVICE ↔ USER LINKS (histórico)
-- =========================================================
CREATE TABLE IF NOT EXISTS public.device_user_links (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  fingerprint_hash text NOT NULL REFERENCES public.device_fingerprints(fingerprint_hash) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  first_seen_at timestamptz NOT NULL DEFAULT now(),
  last_seen_at timestamptz NOT NULL DEFAULT now(),
  seen_count integer NOT NULL DEFAULT 1,
  UNIQUE (fingerprint_hash, user_id)
);
CREATE INDEX IF NOT EXISTS idx_device_user_links_user ON public.device_user_links(user_id);
CREATE INDEX IF NOT EXISTS idx_device_user_links_fp ON public.device_user_links(fingerprint_hash);

GRANT SELECT ON public.device_user_links TO authenticated;
GRANT ALL ON public.device_user_links TO service_role;
ALTER TABLE public.device_user_links ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Self or moderators read device links"
  ON public.device_user_links FOR SELECT TO authenticated
  USING (
    auth.uid() = user_id
    OR has_role(auth.uid(), 'admin'::app_role)
    OR has_role(auth.uid(), 'moderator'::app_role)
    OR has_role(auth.uid(), 'superadmin'::app_role)
  );

-- =========================================================
-- IP REPUTATION (classificação, NUNCA bloqueio definitivo)
-- =========================================================
CREATE TABLE IF NOT EXISTS public.ip_reputation (
  ip_hash text PRIMARY KEY,
  country text,
  region text,
  accounts_created integer NOT NULL DEFAULT 0,
  accounts_banned integer NOT NULL DEFAULT 0,
  risk_level text NOT NULL DEFAULT 'low' CHECK (risk_level IN ('low','medium','high','critical')),
  notes text,
  first_seen_at timestamptz NOT NULL DEFAULT now(),
  last_seen_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.ip_reputation TO authenticated;
GRANT ALL ON public.ip_reputation TO service_role;
ALTER TABLE public.ip_reputation ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Moderators read ip reputation"
  ON public.ip_reputation FOR SELECT TO authenticated
  USING (
    has_role(auth.uid(), 'admin'::app_role)
    OR has_role(auth.uid(), 'moderator'::app_role)
    OR has_role(auth.uid(), 'superadmin'::app_role)
  );

-- IP ↔ usuário (histórico leve)
CREATE TABLE IF NOT EXISTS public.ip_user_links (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ip_hash text NOT NULL REFERENCES public.ip_reputation(ip_hash) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  first_seen_at timestamptz NOT NULL DEFAULT now(),
  last_seen_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (ip_hash, user_id)
);
CREATE INDEX IF NOT EXISTS idx_ip_user_links_user ON public.ip_user_links(user_id);
CREATE INDEX IF NOT EXISTS idx_ip_user_links_ip ON public.ip_user_links(ip_hash);

GRANT SELECT ON public.ip_user_links TO authenticated;
GRANT ALL ON public.ip_user_links TO service_role;
ALTER TABLE public.ip_user_links ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Moderators read ip links"
  ON public.ip_user_links FOR SELECT TO authenticated
  USING (
    has_role(auth.uid(), 'admin'::app_role)
    OR has_role(auth.uid(), 'moderator'::app_role)
    OR has_role(auth.uid(), 'superadmin'::app_role)
  );

-- =========================================================
-- MODERATION_WEIGHTS — limites para contas novas
-- =========================================================
ALTER TABLE public.moderation_weights
  ADD COLUMN IF NOT EXISTS new_account_days integer NOT NULL DEFAULT 7,
  ADD COLUMN IF NOT EXISTS new_account_trust_threshold integer NOT NULL DEFAULT 30,
  ADD COLUMN IF NOT EXISTS limit_messages_per_day_new integer NOT NULL DEFAULT 50,
  ADD COLUMN IF NOT EXISTS limit_invites_per_day_new integer NOT NULL DEFAULT 5,
  ADD COLUMN IF NOT EXISTS limit_groups_per_day_new integer NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS limit_links_per_day_new integer NOT NULL DEFAULT 5;

-- =========================================================
-- RPC: recompute_ip_risk
-- =========================================================
CREATE OR REPLACE FUNCTION public.recompute_ip_risk(_ip_hash text)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  created int;
  banned int;
  ratio numeric;
  new_level text;
  current_level text;
BEGIN
  SELECT accounts_created, accounts_banned, risk_level
    INTO created, banned, current_level
  FROM public.ip_reputation WHERE ip_hash = _ip_hash;

  IF NOT FOUND THEN RETURN NULL; END IF;

  -- Nunca rebaixa de 'critical' automaticamente
  IF current_level = 'critical' THEN RETURN 'critical'; END IF;

  ratio := CASE WHEN created > 0 THEN banned::numeric / created ELSE 0 END;
  new_level := 'low';
  IF banned >= 10 AND ratio >= 0.8 THEN
    new_level := 'critical';
  ELSIF banned >= 5 AND ratio >= 0.5 THEN
    new_level := 'high';
  ELSIF banned >= 2 OR (created >= 10 AND ratio >= 0.2) THEN
    new_level := 'medium';
  END IF;

  UPDATE public.ip_reputation
    SET risk_level = new_level, updated_at = now()
  WHERE ip_hash = _ip_hash;

  RETURN new_level;
END;
$$;

-- =========================================================
-- RPC: recompute_device_risk
-- =========================================================
CREATE OR REPLACE FUNCTION public.recompute_device_risk(_fp_hash text)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  acc int;
  banned int;
  ratio numeric;
  new_level text;
  is_blk boolean;
BEGIN
  SELECT account_count, banned_account_count, is_blocked
    INTO acc, banned, is_blk
  FROM public.device_fingerprints WHERE fingerprint_hash = _fp_hash;

  IF NOT FOUND THEN RETURN NULL; END IF;
  IF is_blk THEN RETURN 'critical'; END IF;

  ratio := CASE WHEN acc > 0 THEN banned::numeric / acc ELSE 0 END;
  new_level := 'low';
  IF banned >= 3 AND ratio >= 0.5 THEN
    new_level := 'critical';
  ELSIF banned >= 2 THEN
    new_level := 'high';
  ELSIF banned >= 1 OR acc >= 5 THEN
    new_level := 'medium';
  END IF;

  UPDATE public.device_fingerprints
    SET risk_level = new_level, last_seen_at = now()
  WHERE fingerprint_hash = _fp_hash;

  RETURN new_level;
END;
$$;

-- =========================================================
-- RPC: register_device_seen (upsert + link)
-- =========================================================
CREATE OR REPLACE FUNCTION public.register_device_seen(_user_id uuid, _fp_hash text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.device_fingerprints (fingerprint_hash, account_count)
    VALUES (_fp_hash, 1)
  ON CONFLICT (fingerprint_hash) DO UPDATE
    SET last_seen_at = now();

  INSERT INTO public.device_user_links (fingerprint_hash, user_id, seen_count)
    VALUES (_fp_hash, _user_id, 1)
  ON CONFLICT (fingerprint_hash, user_id) DO UPDATE
    SET last_seen_at = now(), seen_count = device_user_links.seen_count + 1;

  -- recompute account_count = distinct users for this fp
  UPDATE public.device_fingerprints d
    SET account_count = (SELECT count(*) FROM public.device_user_links WHERE fingerprint_hash = _fp_hash)
  WHERE d.fingerprint_hash = _fp_hash;

  PERFORM public.recompute_device_risk(_fp_hash);
END;
$$;

-- =========================================================
-- RPC: register_ip_seen
-- =========================================================
CREATE OR REPLACE FUNCTION public.register_ip_seen(_user_id uuid, _ip_hash text, _country text DEFAULT NULL, _region text DEFAULT NULL)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.ip_reputation (ip_hash, country, region, accounts_created)
    VALUES (_ip_hash, _country, _region, 1)
  ON CONFLICT (ip_hash) DO UPDATE
    SET last_seen_at = now(),
        country = COALESCE(ip_reputation.country, EXCLUDED.country),
        region = COALESCE(ip_reputation.region, EXCLUDED.region);

  IF _user_id IS NOT NULL THEN
    INSERT INTO public.ip_user_links (ip_hash, user_id)
      VALUES (_ip_hash, _user_id)
    ON CONFLICT (ip_hash, user_id) DO UPDATE
      SET last_seen_at = now();

    UPDATE public.ip_reputation r
      SET accounts_created = (SELECT count(*) FROM public.ip_user_links WHERE ip_hash = _ip_hash)
    WHERE r.ip_hash = _ip_hash;
  END IF;

  PERFORM public.recompute_ip_risk(_ip_hash);
END;
$$;

-- =========================================================
-- RPC: propagate_severe_ban
-- =========================================================
CREATE OR REPLACE FUNCTION public.propagate_severe_ban(_user_id uuid, _reason text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  fp text;
  ip text;
BEGIN
  -- Bloqueia fingerprints vinculados
  FOR fp IN SELECT fingerprint_hash FROM public.device_user_links WHERE user_id = _user_id LOOP
    UPDATE public.device_fingerprints
      SET is_blocked = true,
          blocked_reason = COALESCE(_reason, 'severe_ban'),
          blocked_at = now(),
          risk_level = 'critical',
          banned_account_count = banned_account_count + 1
    WHERE fingerprint_hash = fp;
  END LOOP;

  -- Marca IPs como críticos e incrementa banidos
  FOR ip IN SELECT ip_hash FROM public.ip_user_links WHERE user_id = _user_id LOOP
    UPDATE public.ip_reputation
      SET risk_level = 'critical',
          accounts_banned = accounts_banned + 1,
          updated_at = now()
    WHERE ip_hash = ip;
  END LOOP;
END;
$$;

-- =========================================================
-- RPC: register_ban (chamado quando usuário é banido — atualiza contadores)
-- =========================================================
CREATE OR REPLACE FUNCTION public.register_ban(_user_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  fp text;
  ip text;
BEGIN
  FOR fp IN SELECT fingerprint_hash FROM public.device_user_links WHERE user_id = _user_id LOOP
    UPDATE public.device_fingerprints
      SET banned_account_count = banned_account_count + 1
    WHERE fingerprint_hash = fp;
    PERFORM public.recompute_device_risk(fp);
  END LOOP;

  FOR ip IN SELECT ip_hash FROM public.ip_user_links WHERE user_id = _user_id LOOP
    UPDATE public.ip_reputation
      SET accounts_banned = accounts_banned + 1, updated_at = now()
    WHERE ip_hash = ip;
    PERFORM public.recompute_ip_risk(ip);
  END LOOP;
END;
$$;

-- =========================================================
-- RPC: check_account_rate_limit
-- =========================================================
CREATE OR REPLACE FUNCTION public.check_account_rate_limit(_user_id uuid, _action text)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  w public.moderation_weights;
  prof public.profiles;
  score int;
  is_new boolean;
  used int;
  cap int;
BEGIN
  SELECT * INTO w FROM public.moderation_weights WHERE id = 1;
  SELECT * INTO prof FROM public.profiles WHERE id = _user_id;
  IF prof.id IS NULL THEN
    RETURN jsonb_build_object('allowed', false, 'reason', 'no_profile');
  END IF;
  SELECT score INTO score FROM public.user_trust_scores WHERE user_id = _user_id;
  score := COALESCE(score, 50);

  is_new := (now() - prof.created_at) < make_interval(days => w.new_account_days)
            OR score < w.new_account_trust_threshold;

  IF NOT is_new THEN
    RETURN jsonb_build_object('allowed', true, 'is_new', false);
  END IF;

  cap := CASE _action
    WHEN 'message' THEN w.limit_messages_per_day_new
    WHEN 'invite'  THEN w.limit_invites_per_day_new
    WHEN 'group'   THEN w.limit_groups_per_day_new
    WHEN 'link'    THEN w.limit_links_per_day_new
    ELSE 9999 END;

  SELECT count(*) INTO used FROM public.behavior_signals
    WHERE user_id = _user_id AND kind = 'rate_' || _action
      AND created_at > now() - interval '1 day';

  RETURN jsonb_build_object(
    'allowed', used < cap,
    'is_new', true,
    'used', used,
    'cap', cap,
    'action', _action
  );
END;
$$;
