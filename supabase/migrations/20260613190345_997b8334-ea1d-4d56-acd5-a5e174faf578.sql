
-- 1) content_reports: snapshot + assigned_to + status in_review
ALTER TABLE public.content_reports
  ADD COLUMN IF NOT EXISTS evidence_snapshot jsonb,
  ADD COLUMN IF NOT EXISTS assigned_to uuid REFERENCES auth.users(id);

-- Extend enum report_status with 'in_review' if not present
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_enum e JOIN pg_type t ON t.oid = e.enumtypid
    WHERE t.typname = 'report_status' AND e.enumlabel = 'in_review'
  ) THEN
    ALTER TYPE report_status ADD VALUE 'in_review';
  END IF;
END$$;

-- 2) behavior_signals (metadata only, no content)
CREATE TABLE IF NOT EXISTS public.behavior_signals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  kind text NOT NULL,
  weight int NOT NULL DEFAULT 1,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  ip_hash text,
  device_hash text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_behavior_signals_user ON public.behavior_signals(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_behavior_signals_kind ON public.behavior_signals(kind, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_behavior_signals_ip ON public.behavior_signals(ip_hash);

GRANT SELECT ON public.behavior_signals TO authenticated;
GRANT ALL ON public.behavior_signals TO service_role;
ALTER TABLE public.behavior_signals ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Moderators read behavior_signals" ON public.behavior_signals FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(),'admin'::app_role) OR public.has_role(auth.uid(),'moderator'::app_role) OR public.has_role(auth.uid(),'superadmin'::app_role));

-- 3) user_trust_scores
CREATE TABLE IF NOT EXISTS public.user_trust_scores (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  score int NOT NULL DEFAULT 50,
  components jsonb NOT NULL DEFAULT '{}'::jsonb,
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.user_trust_scores TO authenticated;
GRANT ALL ON public.user_trust_scores TO service_role;
ALTER TABLE public.user_trust_scores ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Self or moderators read trust" ON public.user_trust_scores FOR SELECT TO authenticated
  USING (
    auth.uid() = user_id
    OR public.has_role(auth.uid(),'admin'::app_role)
    OR public.has_role(auth.uid(),'moderator'::app_role)
    OR public.has_role(auth.uid(),'superadmin'::app_role)
  );

-- 4) moderation_weights (singleton)
CREATE TABLE IF NOT EXISTS public.moderation_weights (
  id int PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  weight_report int NOT NULL DEFAULT 10,
  weight_spam int NOT NULL DEFAULT 5,
  weight_links int NOT NULL DEFAULT 3,
  weight_blocks int NOT NULL DEFAULT 4,
  weight_behavior int NOT NULL DEFAULT 6,
  threshold_warning int NOT NULL DEFAULT 20,
  threshold_restriction int NOT NULL DEFAULT 40,
  threshold_suspension int NOT NULL DEFAULT 70,
  threshold_ban int NOT NULL DEFAULT 100,
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid REFERENCES auth.users(id)
);
INSERT INTO public.moderation_weights (id) VALUES (1) ON CONFLICT (id) DO NOTHING;
GRANT SELECT ON public.moderation_weights TO authenticated;
GRANT ALL ON public.moderation_weights TO service_role;
ALTER TABLE public.moderation_weights ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Moderators read weights" ON public.moderation_weights FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(),'admin'::app_role) OR public.has_role(auth.uid(),'moderator'::app_role) OR public.has_role(auth.uid(),'superadmin'::app_role));

-- 5) app_settings (key/value)
CREATE TABLE IF NOT EXISTS public.app_settings (
  key text PRIMARY KEY,
  value jsonb NOT NULL DEFAULT '{}'::jsonb,
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid REFERENCES auth.users(id)
);
INSERT INTO public.app_settings (key, value) VALUES
  ('moderation_learning_mode', 'true'::jsonb)
ON CONFLICT (key) DO NOTHING;
GRANT SELECT ON public.app_settings TO authenticated;
GRANT ALL ON public.app_settings TO service_role;
ALTER TABLE public.app_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated read settings" ON public.app_settings FOR SELECT TO authenticated USING (true);

-- 6) report_message_with_snapshot
-- Captures the message content/attachment at the moment of report, but only
-- if the caller is a participant of that conversation. The snapshot lives
-- inside content_reports.evidence_snapshot. No other code path stores
-- private message content.
CREATE OR REPLACE FUNCTION public.report_message_with_snapshot(
  _message_id uuid,
  _reason text,
  _details text DEFAULT NULL
) RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _uid uuid := auth.uid();
  _msg RECORD;
  _is_member boolean;
  _report_id uuid;
  _snap jsonb;
BEGIN
  IF _uid IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  SELECT m.id, m.conversation_id, m.sender_id, m.content,
         m.attachment_url, m.attachment_type, m.attachment_name, m.created_at
    INTO _msg
  FROM public.messages m WHERE m.id = _message_id;
  IF _msg.id IS NULL THEN RAISE EXCEPTION 'Mensagem não encontrada'; END IF;

  SELECT public.is_conversation_member(_msg.conversation_id, _uid) INTO _is_member;
  IF NOT _is_member THEN
    RAISE EXCEPTION 'Apenas participantes da conversa podem denunciar';
  END IF;

  _snap := jsonb_build_object(
    'message_id', _msg.id,
    'conversation_id', _msg.conversation_id,
    'sender_id', _msg.sender_id,
    'reporter_id', _uid,
    'content', _msg.content,
    'attachment_url', _msg.attachment_url,
    'attachment_type', _msg.attachment_type,
    'attachment_name', _msg.attachment_name,
    'message_created_at', _msg.created_at,
    'snapshot_at', now()
  );

  INSERT INTO public.content_reports(
    reporter_id, reported_user_id, target_type, target_id,
    reason, details, evidence_snapshot
  ) VALUES (
    _uid, _msg.sender_id, 'message', _msg.id::text,
    _reason, _details, _snap
  ) RETURNING id INTO _report_id;

  RETURN _report_id;
END$$;

GRANT EXECUTE ON FUNCTION public.report_message_with_snapshot(uuid, text, text) TO authenticated;

-- 7) recompute_trust_score
CREATE OR REPLACE FUNCTION public.recompute_trust_score(_user_id uuid)
RETURNS int
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _age_days int;
  _profile_complete boolean;
  _confirmed_reports int;
  _blocks_received int;
  _behavior_weight int;
  _score int := 50;
  _components jsonb;
BEGIN
  SELECT GREATEST(0, EXTRACT(DAY FROM now() - created_at)::int) INTO _age_days
    FROM public.profiles WHERE id = _user_id;
  SELECT (display_name IS NOT NULL AND username IS NOT NULL AND avatar_url IS NOT NULL) INTO _profile_complete
    FROM public.profiles WHERE id = _user_id;
  SELECT COUNT(*) INTO _confirmed_reports FROM public.content_reports
    WHERE reported_user_id = _user_id AND status = 'resolved';
  SELECT COUNT(*) INTO _blocks_received FROM public.user_blocks WHERE blocked_id = _user_id;
  SELECT COALESCE(SUM(weight),0) INTO _behavior_weight FROM public.behavior_signals
    WHERE user_id = _user_id AND created_at > now() - interval '30 days';

  _score := 50
    + LEAST(20, COALESCE(_age_days,0)/3)
    + (CASE WHEN _profile_complete THEN 10 ELSE 0 END)
    - (_confirmed_reports * 15)
    - (_blocks_received * 3)
    - LEAST(40, _behavior_weight);
  _score := GREATEST(0, LEAST(100, _score));

  _components := jsonb_build_object(
    'age_days', _age_days,
    'profile_complete', _profile_complete,
    'confirmed_reports', _confirmed_reports,
    'blocks_received', _blocks_received,
    'behavior_weight', _behavior_weight
  );

  INSERT INTO public.user_trust_scores(user_id, score, components, updated_at)
  VALUES (_user_id, _score, _components, now())
  ON CONFLICT (user_id) DO UPDATE SET score = EXCLUDED.score, components = EXCLUDED.components, updated_at = now();

  RETURN _score;
END$$;

GRANT EXECUTE ON FUNCTION public.recompute_trust_score(uuid) TO authenticated, service_role;
