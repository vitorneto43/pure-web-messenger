
-- Privacidade: remover trechos de mensagens armazenadas; usar apenas hash anônimo
ALTER TABLE public.spam_signals DROP COLUMN IF EXISTS content_excerpt;
ALTER TABLE public.spam_signals ADD COLUMN IF NOT EXISTS content_hash text;
ALTER TABLE public.spam_signals ADD COLUMN IF NOT EXISTS ip_hash text;
-- Tornar IP bruto opcional (mantemos por compatibilidade, mas preferimos ip_hash)
ALTER TABLE public.spam_signals ALTER COLUMN ip DROP NOT NULL;

CREATE INDEX IF NOT EXISTS idx_spam_signals_ip_hash ON public.spam_signals(ip_hash, created_at DESC);

-- Tabela de IPs banidos (somente hash, nunca o IP em claro)
CREATE TABLE IF NOT EXISTS public.banned_ips (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ip_hash text NOT NULL UNIQUE,
  reason text,
  banned_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  related_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  expires_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.banned_ips TO authenticated;
GRANT ALL ON public.banned_ips TO service_role;

ALTER TABLE public.banned_ips ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Mods/Admins read banned_ips" ON public.banned_ips
  FOR SELECT TO authenticated
  USING (has_role(auth.uid(),'admin') OR has_role(auth.uid(),'moderator') OR has_role(auth.uid(),'superadmin'));

CREATE POLICY "Mods/Admins manage banned_ips" ON public.banned_ips
  FOR ALL TO authenticated
  USING (has_role(auth.uid(),'admin') OR has_role(auth.uid(),'superadmin'))
  WITH CHECK (has_role(auth.uid(),'admin') OR has_role(auth.uid(),'superadmin'));

CREATE INDEX IF NOT EXISTS idx_banned_ips_hash ON public.banned_ips(ip_hash);

-- RPC pública para checar se um hash de IP está banido (sem expor a lista)
CREATE OR REPLACE FUNCTION public.is_ip_hash_banned(_ip_hash text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.banned_ips
    WHERE ip_hash = _ip_hash
      AND (expires_at IS NULL OR expires_at > now())
  );
$$;

GRANT EXECUTE ON FUNCTION public.is_ip_hash_banned(text) TO anon, authenticated, service_role;
