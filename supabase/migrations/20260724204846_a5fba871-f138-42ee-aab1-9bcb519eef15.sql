
-- ============================================================================
-- Fase 5: Planos e Cotas por Ecossistema (SaaS)
-- ============================================================================

-- 1) Enum de planos
DO $$ BEGIN
  CREATE TYPE public.ecosystem_plan_tier AS ENUM ('free','pro','business','enterprise');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.ecosystem_plan_status AS ENUM ('active','past_due','canceled','trialing');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- 2) Colunas de plano em ecosystems
ALTER TABLE public.ecosystems
  ADD COLUMN IF NOT EXISTS plan_tier public.ecosystem_plan_tier NOT NULL DEFAULT 'free',
  ADD COLUMN IF NOT EXISTS plan_status public.ecosystem_plan_status NOT NULL DEFAULT 'active',
  ADD COLUMN IF NOT EXISTS plan_started_at timestamptz NOT NULL DEFAULT now(),
  ADD COLUMN IF NOT EXISTS plan_expires_at timestamptz,
  ADD COLUMN IF NOT EXISTS custom_subdomain text UNIQUE,
  ADD COLUMN IF NOT EXISTS billing_contact_email text,
  ADD COLUMN IF NOT EXISTS member_limit_override integer,
  ADD COLUMN IF NOT EXISTS post_limit_override integer;

-- 3) Tabela de definição dos limites por plano (read-only para autenticados)
CREATE TABLE IF NOT EXISTS public.ecosystem_plan_limits (
  tier public.ecosystem_plan_tier PRIMARY KEY,
  display_name text NOT NULL,
  price_brl_month numeric(10,2) NOT NULL DEFAULT 0,
  member_limit integer NOT NULL,
  posts_per_month integer NOT NULL,
  videos_per_month integer NOT NULL,
  lives_per_month integer NOT NULL,
  custom_branding boolean NOT NULL DEFAULT false,
  advanced_metrics boolean NOT NULL DEFAULT false,
  custom_subdomain boolean NOT NULL DEFAULT false,
  priority_support boolean NOT NULL DEFAULT false,
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.ecosystem_plan_limits TO anon, authenticated;
GRANT ALL ON public.ecosystem_plan_limits TO service_role;
ALTER TABLE public.ecosystem_plan_limits ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "plan_limits_public_read" ON public.ecosystem_plan_limits;
CREATE POLICY "plan_limits_public_read" ON public.ecosystem_plan_limits FOR SELECT TO anon, authenticated USING (true);

INSERT INTO public.ecosystem_plan_limits (tier, display_name, price_brl_month, member_limit, posts_per_month, videos_per_month, lives_per_month, custom_branding, advanced_metrics, custom_subdomain, priority_support)
VALUES
  ('free',       'Free',        0,      25,   100,   10,   5,   false, false, false, false),
  ('pro',        'Pro',         49.00,  250,  2000,  100,  50,  true,  true,  false, false),
  ('business',   'Business',    199.00, 2000, 20000, 1000, 500, true,  true,  true,  true),
  ('enterprise', 'Enterprise',  0,      1000000, 1000000, 1000000, 1000000, true, true, true, true)
ON CONFLICT (tier) DO UPDATE SET
  display_name = EXCLUDED.display_name,
  price_brl_month = EXCLUDED.price_brl_month,
  member_limit = EXCLUDED.member_limit,
  posts_per_month = EXCLUDED.posts_per_month,
  videos_per_month = EXCLUDED.videos_per_month,
  lives_per_month = EXCLUDED.lives_per_month,
  custom_branding = EXCLUDED.custom_branding,
  advanced_metrics = EXCLUDED.advanced_metrics,
  custom_subdomain = EXCLUDED.custom_subdomain,
  priority_support = EXCLUDED.priority_support,
  updated_at = now();

-- 4) Tabela de faturas / pedidos de upgrade (registrar intenção de pagamento manual)
CREATE TABLE IF NOT EXISTS public.ecosystem_billing_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ecosystem_id uuid NOT NULL REFERENCES public.ecosystems(id) ON DELETE CASCADE,
  requested_tier public.ecosystem_plan_tier NOT NULL,
  requested_by uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  amount_brl numeric(10,2) NOT NULL,
  billing_cycle text NOT NULL DEFAULT 'monthly',
  status text NOT NULL DEFAULT 'pending', -- pending | approved | rejected | paid
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  processed_at timestamptz
);

GRANT SELECT, INSERT ON public.ecosystem_billing_requests TO authenticated;
GRANT ALL ON public.ecosystem_billing_requests TO service_role;
ALTER TABLE public.ecosystem_billing_requests ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "billing_req_admin_read" ON public.ecosystem_billing_requests;
CREATE POLICY "billing_req_admin_read" ON public.ecosystem_billing_requests
  FOR SELECT TO authenticated
  USING (public.is_ecosystem_admin(ecosystem_id, auth.uid()) OR public.has_role(auth.uid(), 'admin'::app_role));

DROP POLICY IF EXISTS "billing_req_admin_insert" ON public.ecosystem_billing_requests;
CREATE POLICY "billing_req_admin_insert" ON public.ecosystem_billing_requests
  FOR INSERT TO authenticated
  WITH CHECK (
    public.is_ecosystem_admin(ecosystem_id, auth.uid())
    AND requested_by = auth.uid()
  );

-- 5) Função utilitária: uso e limites atuais do ecossistema
CREATE OR REPLACE FUNCTION public.get_ecosystem_billing(_ecosystem_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  eco RECORD;
  lim RECORD;
  members_count int;
  posts_month int;
  videos_month int;
  lives_month int;
BEGIN
  IF NOT (public.is_ecosystem_member(_ecosystem_id, auth.uid()) OR public.has_role(auth.uid(), 'admin'::app_role)) THEN
    RETURN NULL;
  END IF;

  SELECT * INTO eco FROM public.ecosystems WHERE id = _ecosystem_id;
  IF eco IS NULL THEN RETURN NULL; END IF;

  SELECT * INTO lim FROM public.ecosystem_plan_limits WHERE tier = eco.plan_tier;

  SELECT count(*) INTO members_count FROM public.ecosystem_members WHERE ecosystem_id = _ecosystem_id AND status='active';
  SELECT count(*) INTO posts_month  FROM public.posts     WHERE ecosystem_id = _ecosystem_id AND created_at > now() - interval '30 days';
  SELECT count(*) INTO videos_month FROM public.videos    WHERE ecosystem_id = _ecosystem_id AND created_at > now() - interval '30 days';
  SELECT count(*) INTO lives_month  FROM public.live_sessions WHERE ecosystem_id = _ecosystem_id AND created_at > now() - interval '30 days';

  RETURN jsonb_build_object(
    'tier', eco.plan_tier,
    'status', eco.plan_status,
    'started_at', eco.plan_started_at,
    'expires_at', eco.plan_expires_at,
    'custom_subdomain', eco.custom_subdomain,
    'billing_contact_email', eco.billing_contact_email,
    'limits', jsonb_build_object(
      'members', COALESCE(eco.member_limit_override, lim.member_limit),
      'posts_per_month', COALESCE(eco.post_limit_override, lim.posts_per_month),
      'videos_per_month', lim.videos_per_month,
      'lives_per_month', lim.lives_per_month,
      'custom_branding', lim.custom_branding,
      'advanced_metrics', lim.advanced_metrics,
      'custom_subdomain', lim.custom_subdomain,
      'priority_support', lim.priority_support,
      'display_name', lim.display_name,
      'price_brl_month', lim.price_brl_month
    ),
    'usage', jsonb_build_object(
      'members', members_count,
      'posts_month', posts_month,
      'videos_month', videos_month,
      'lives_month', lives_month
    )
  );
END $$;

GRANT EXECUTE ON FUNCTION public.get_ecosystem_billing(uuid) TO authenticated;

-- 6) Enforcement: bloquear inserts quando ultrapassar cota
CREATE OR REPLACE FUNCTION public.enforce_ecosystem_member_quota()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE
  eco RECORD; lim RECORD; current int; ceiling int;
BEGIN
  IF NEW.status <> 'active' THEN RETURN NEW; END IF;
  SELECT * INTO eco FROM public.ecosystems WHERE id = NEW.ecosystem_id;
  IF eco IS NULL THEN RETURN NEW; END IF;
  SELECT * INTO lim FROM public.ecosystem_plan_limits WHERE tier = eco.plan_tier;
  ceiling := COALESCE(eco.member_limit_override, lim.member_limit);
  SELECT count(*) INTO current FROM public.ecosystem_members WHERE ecosystem_id = NEW.ecosystem_id AND status='active';
  IF current >= ceiling THEN
    RAISE EXCEPTION 'ecosystem_member_limit_reached: plano % permite % membros ativos', eco.plan_tier, ceiling
      USING ERRCODE = 'check_violation';
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_enforce_ecosystem_member_quota ON public.ecosystem_members;
CREATE TRIGGER trg_enforce_ecosystem_member_quota
  BEFORE INSERT ON public.ecosystem_members
  FOR EACH ROW EXECUTE FUNCTION public.enforce_ecosystem_member_quota();

CREATE OR REPLACE FUNCTION public.enforce_ecosystem_content_quota()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE
  eco RECORD; lim RECORD; used int; ceiling int; kind text := TG_TABLE_NAME;
BEGIN
  IF NEW.ecosystem_id IS NULL THEN RETURN NEW; END IF;
  SELECT * INTO eco FROM public.ecosystems WHERE id = NEW.ecosystem_id;
  IF eco IS NULL THEN RETURN NEW; END IF;
  SELECT * INTO lim FROM public.ecosystem_plan_limits WHERE tier = eco.plan_tier;

  IF kind = 'posts' THEN
    ceiling := COALESCE(eco.post_limit_override, lim.posts_per_month);
    SELECT count(*) INTO used FROM public.posts WHERE ecosystem_id = NEW.ecosystem_id AND created_at > now() - interval '30 days';
  ELSIF kind = 'videos' THEN
    ceiling := lim.videos_per_month;
    SELECT count(*) INTO used FROM public.videos WHERE ecosystem_id = NEW.ecosystem_id AND created_at > now() - interval '30 days';
  ELSIF kind = 'live_sessions' THEN
    ceiling := lim.lives_per_month;
    SELECT count(*) INTO used FROM public.live_sessions WHERE ecosystem_id = NEW.ecosystem_id AND created_at > now() - interval '30 days';
  ELSE
    RETURN NEW;
  END IF;

  IF used >= ceiling THEN
    RAISE EXCEPTION 'ecosystem_quota_reached: plano % permite % %s por 30 dias', eco.plan_tier, ceiling, kind
      USING ERRCODE = 'check_violation';
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_enforce_eco_posts_quota ON public.posts;
CREATE TRIGGER trg_enforce_eco_posts_quota BEFORE INSERT ON public.posts
  FOR EACH ROW WHEN (NEW.ecosystem_id IS NOT NULL)
  EXECUTE FUNCTION public.enforce_ecosystem_content_quota();

DROP TRIGGER IF EXISTS trg_enforce_eco_videos_quota ON public.videos;
CREATE TRIGGER trg_enforce_eco_videos_quota BEFORE INSERT ON public.videos
  FOR EACH ROW WHEN (NEW.ecosystem_id IS NOT NULL)
  EXECUTE FUNCTION public.enforce_ecosystem_content_quota();

DROP TRIGGER IF EXISTS trg_enforce_eco_lives_quota ON public.live_sessions;
CREATE TRIGGER trg_enforce_eco_lives_quota BEFORE INSERT ON public.live_sessions
  FOR EACH ROW WHEN (NEW.ecosystem_id IS NOT NULL)
  EXECUTE FUNCTION public.enforce_ecosystem_content_quota();

-- 7) RPC para admins do ecossistema solicitarem upgrade
CREATE OR REPLACE FUNCTION public.request_ecosystem_upgrade(_ecosystem_id uuid, _tier public.ecosystem_plan_tier, _cycle text DEFAULT 'monthly', _notes text DEFAULT NULL)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE new_id uuid; price numeric(10,2);
BEGIN
  IF NOT public.is_ecosystem_admin(_ecosystem_id, auth.uid()) THEN
    RAISE EXCEPTION 'not_ecosystem_admin' USING ERRCODE='insufficient_privilege';
  END IF;
  SELECT price_brl_month INTO price FROM public.ecosystem_plan_limits WHERE tier = _tier;
  IF price IS NULL THEN RAISE EXCEPTION 'invalid_tier'; END IF;

  INSERT INTO public.ecosystem_billing_requests (ecosystem_id, requested_tier, requested_by, amount_brl, billing_cycle, notes)
  VALUES (_ecosystem_id, _tier, auth.uid(), price * (CASE WHEN _cycle='yearly' THEN 12 ELSE 1 END), _cycle, _notes)
  RETURNING id INTO new_id;
  RETURN new_id;
END $$;

GRANT EXECUTE ON FUNCTION public.request_ecosystem_upgrade(uuid, public.ecosystem_plan_tier, text, text) TO authenticated;
