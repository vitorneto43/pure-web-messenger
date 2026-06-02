-- Enums
CREATE TYPE public.app_role AS ENUM ('admin', 'user');

-- pgcrypto for PIN hashing (crypt/gen_salt)
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- ===== user_roles =====
CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.app_role NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, role)
);

GRANT SELECT ON public.user_roles TO authenticated;
GRANT ALL ON public.user_roles TO service_role;

ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own roles"
ON public.user_roles FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

-- Security definer function (no recursion in RLS)
CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role public.app_role)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role = _role
  );
$$;

-- ===== admin_pins =====
CREATE TABLE public.admin_pins (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  pin_hash TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT ALL ON public.admin_pins TO service_role;
-- No grants for authenticated/anon: only server with service role can touch this

ALTER TABLE public.admin_pins ENABLE ROW LEVEL SECURITY;
-- No policies => no client access at all. Only service role bypasses RLS.

-- ===== admin_access_logs =====
CREATE TABLE public.admin_access_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  action TEXT NOT NULL,           -- 'login_attempt', 'pin_ok', 'pin_fail', 'view_dashboard', etc
  success BOOLEAN NOT NULL DEFAULT true,
  ip TEXT,
  user_agent TEXT,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT ON public.admin_access_logs TO authenticated;
GRANT ALL ON public.admin_access_logs TO service_role;

ALTER TABLE public.admin_access_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can view access logs"
ON public.admin_access_logs FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

CREATE INDEX idx_admin_logs_created ON public.admin_access_logs(created_at DESC);

-- ===== ai_usage_logs =====
CREATE TABLE public.ai_usage_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  feature TEXT NOT NULL,           -- 'translate', 'suggest', 'improve', 'summarize'
  model TEXT,
  input_chars INT NOT NULL DEFAULT 0,
  output_chars INT NOT NULL DEFAULT 0,
  success BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT ON public.ai_usage_logs TO authenticated;
GRANT ALL ON public.ai_usage_logs TO service_role;

ALTER TABLE public.ai_usage_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users insert own ai usage"
ON public.ai_usage_logs FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users view own ai usage"
ON public.ai_usage_logs FOR SELECT
TO authenticated
USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin'));

CREATE INDEX idx_ai_usage_created ON public.ai_usage_logs(created_at DESC);
CREATE INDEX idx_ai_usage_feature ON public.ai_usage_logs(feature);

-- ===== share_logs =====
CREATE TABLE public.share_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  target TEXT NOT NULL,            -- 'whatsapp','telegram','facebook','instagram','discord','x','copy','native','email'
  content_type TEXT NOT NULL,      -- 'text','image','video','audio','link','file'
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT ON public.share_logs TO authenticated;
GRANT ALL ON public.share_logs TO service_role;

ALTER TABLE public.share_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users insert own share logs"
ON public.share_logs FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users view own share logs"
ON public.share_logs FOR SELECT
TO authenticated
USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin'));

CREATE INDEX idx_share_logs_created ON public.share_logs(created_at DESC);

-- ===== profiles: device + geo columns =====
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS device_platform TEXT,
  ADD COLUMN IF NOT EXISTS app_version TEXT,
  ADD COLUMN IF NOT EXISTS country TEXT,
  ADD COLUMN IF NOT EXISTS region TEXT,
  ADD COLUMN IF NOT EXISTS city TEXT,
  ADD COLUMN IF NOT EXISTS last_ip TEXT;

-- Triggers updated_at
CREATE TRIGGER trg_admin_pins_updated_at
BEFORE UPDATE ON public.admin_pins
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();