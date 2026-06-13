
-- ============ COMPLIANCE & AUDIT MODULE ============

-- 1) AUDIT LOGS (imutável)
CREATE TABLE IF NOT EXISTS public.audit_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  actor_role text,
  action text NOT NULL,
  target_type text,
  target_id text,
  target_user_id uuid,
  ip_hash text,
  device_hash text,
  user_agent text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS audit_logs_created_at_idx ON public.audit_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS audit_logs_actor_idx ON public.audit_logs(actor_id);
CREATE INDEX IF NOT EXISTS audit_logs_target_user_idx ON public.audit_logs(target_user_id);
CREATE INDEX IF NOT EXISTS audit_logs_action_idx ON public.audit_logs(action);

GRANT SELECT ON public.audit_logs TO authenticated;
GRANT ALL ON public.audit_logs TO service_role;
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

-- Apenas admins/superadmins leem
CREATE POLICY "audit_logs_admin_read"
  ON public.audit_logs FOR SELECT TO authenticated
  USING (public.has_min_role(auth.uid(), 'admin'::app_role));

-- Bloqueia UPDATE/DELETE para qualquer um (trilha imutável). service_role pode via GRANT ALL.
-- Sem políticas de UPDATE/DELETE → ninguém via Data API consegue alterar.

-- 2) COMPLIANCE REQUESTS (solicitações de autoridades)
CREATE TABLE IF NOT EXISTS public.compliance_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  process_number text NOT NULL,
  requesting_authority text NOT NULL,
  requester_name text,
  requester_contact text,
  legal_basis text,
  reason text NOT NULL,
  target_user_id uuid,
  target_username text,
  date_range_start timestamptz,
  date_range_end timestamptz,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','approved','fulfilled','denied','expired')),
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  approved_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  approved_at timestamptz,
  fulfilled_at timestamptz,
  attachments jsonb DEFAULT '[]'::jsonb,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS compliance_requests_status_idx ON public.compliance_requests(status);
CREATE INDEX IF NOT EXISTS compliance_requests_created_at_idx ON public.compliance_requests(created_at DESC);

GRANT SELECT, INSERT, UPDATE ON public.compliance_requests TO authenticated;
GRANT ALL ON public.compliance_requests TO service_role;
ALTER TABLE public.compliance_requests ENABLE ROW LEVEL SECURITY;

-- Somente SuperAdmin acessa
CREATE POLICY "compliance_requests_superadmin_select"
  ON public.compliance_requests FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'superadmin'::app_role));
CREATE POLICY "compliance_requests_superadmin_insert"
  ON public.compliance_requests FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'superadmin'::app_role));
CREATE POLICY "compliance_requests_superadmin_update"
  ON public.compliance_requests FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'superadmin'::app_role));

CREATE TRIGGER compliance_requests_updated_at
  BEFORE UPDATE ON public.compliance_requests
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- 3) COMPLIANCE ACCESS LOGS (toda consulta de dados privados via compliance)
CREATE TABLE IF NOT EXISTS public.compliance_access_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  request_id uuid REFERENCES public.compliance_requests(id) ON DELETE SET NULL,
  accessor_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  accessor_email text,
  process_number text,
  reason text NOT NULL,
  target_user_id uuid,
  data_accessed text NOT NULL,
  data_summary jsonb NOT NULL DEFAULT '{}'::jsonb,
  ip_hash text,
  user_agent text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS compliance_access_logs_created_at_idx ON public.compliance_access_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS compliance_access_logs_request_idx ON public.compliance_access_logs(request_id);

GRANT SELECT ON public.compliance_access_logs TO authenticated;
GRANT ALL ON public.compliance_access_logs TO service_role;
ALTER TABLE public.compliance_access_logs ENABLE ROW LEVEL SECURITY;

-- Somente superadmin lê. Sem UPDATE/DELETE (imutável).
CREATE POLICY "compliance_access_logs_superadmin_read"
  ON public.compliance_access_logs FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'superadmin'::app_role));

-- 4) APP SETTINGS: garantir chave compliance_enabled (default desligado)
INSERT INTO public.app_settings(key, value, updated_at)
VALUES ('compliance_enabled', 'false'::jsonb, now())
ON CONFLICT (key) DO NOTHING;

-- 5) HELPER: registrar evento de auditoria (chamado via RPC pelos serverFns)
CREATE OR REPLACE FUNCTION public.write_audit_log(
  _action text,
  _target_type text DEFAULT NULL,
  _target_id text DEFAULT NULL,
  _target_user_id uuid DEFAULT NULL,
  _metadata jsonb DEFAULT '{}'::jsonb,
  _ip_hash text DEFAULT NULL,
  _device_hash text DEFAULT NULL,
  _user_agent text DEFAULT NULL
) RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _id uuid;
  _role text;
BEGIN
  SELECT role::text INTO _role FROM public.user_roles
    WHERE user_id = auth.uid()
    ORDER BY public.role_rank(role) DESC
    LIMIT 1;

  INSERT INTO public.audit_logs(
    actor_id, actor_role, action, target_type, target_id, target_user_id,
    ip_hash, device_hash, user_agent, metadata
  ) VALUES (
    auth.uid(), _role, _action, _target_type, _target_id, _target_user_id,
    _ip_hash, _device_hash, _user_agent, COALESCE(_metadata,'{}'::jsonb)
  ) RETURNING id INTO _id;

  RETURN _id;
END$$;

-- 6) HELPER: registrar acesso excepcional (compliance)
CREATE OR REPLACE FUNCTION public.log_compliance_access(
  _request_id uuid,
  _reason text,
  _target_user_id uuid,
  _data_accessed text,
  _data_summary jsonb DEFAULT '{}'::jsonb,
  _ip_hash text DEFAULT NULL,
  _user_agent text DEFAULT NULL
) RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _id uuid;
  _email text;
  _process text;
BEGIN
  IF NOT public.has_role(auth.uid(), 'superadmin'::app_role) THEN
    RAISE EXCEPTION 'Acesso de compliance restrito ao SuperAdmin';
  END IF;
  IF _reason IS NULL OR length(trim(_reason)) < 10 THEN
    RAISE EXCEPTION 'Justificativa obrigatória (mínimo 10 caracteres)';
  END IF;

  SELECT email INTO _email FROM public.profiles_private WHERE user_id = auth.uid();
  SELECT process_number INTO _process FROM public.compliance_requests WHERE id = _request_id;

  INSERT INTO public.compliance_access_logs(
    request_id, accessor_id, accessor_email, process_number, reason,
    target_user_id, data_accessed, data_summary, ip_hash, user_agent
  ) VALUES (
    _request_id, auth.uid(), _email, _process, _reason,
    _target_user_id, _data_accessed, COALESCE(_data_summary,'{}'::jsonb), _ip_hash, _user_agent
  ) RETURNING id INTO _id;

  -- Também espelha em audit_logs
  INSERT INTO public.audit_logs(actor_id, actor_role, action, target_type, target_id, target_user_id, metadata)
  VALUES (auth.uid(), 'superadmin', 'compliance.access', 'compliance_request', _request_id::text, _target_user_id,
    jsonb_build_object('reason', _reason, 'process_number', _process, 'data_accessed', _data_accessed));

  RETURN _id;
END$$;
