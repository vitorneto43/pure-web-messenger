
-- Community Guidelines & Moderation System

-- Enum for report status
DO $$ BEGIN
  CREATE TYPE public.report_status AS ENUM ('pending','in_review','resolved','rejected');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.report_target_type AS ENUM ('profile','status','message','group','conversation');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.moderation_action_type AS ENUM ('warning','content_removed','suspended','banned','content_hidden','report_rejected','unsuspended','unbanned');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Content reports table
CREATE TABLE IF NOT EXISTS public.content_reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  reporter_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  reported_user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  target_type public.report_target_type NOT NULL,
  target_id text NOT NULL,
  reason text NOT NULL,
  details text,
  status public.report_status NOT NULL DEFAULT 'pending',
  reviewer_id uuid REFERENCES auth.users(id),
  reviewer_notes text,
  resolved_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_content_reports_status ON public.content_reports(status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_content_reports_reported_user ON public.content_reports(reported_user_id);
CREATE INDEX IF NOT EXISTS idx_content_reports_reporter ON public.content_reports(reporter_id);

GRANT SELECT, INSERT ON public.content_reports TO authenticated;
GRANT ALL ON public.content_reports TO service_role;

ALTER TABLE public.content_reports ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can create reports"
  ON public.content_reports FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = reporter_id);

CREATE POLICY "Users can view own reports"
  ON public.content_reports FOR SELECT TO authenticated
  USING (auth.uid() = reporter_id OR has_role(auth.uid(),'moderator'::app_role) OR has_role(auth.uid(),'admin'::app_role) OR has_role(auth.uid(),'superadmin'::app_role));

CREATE TRIGGER content_reports_set_updated_at
  BEFORE UPDATE ON public.content_reports
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Moderation actions log
CREATE TABLE IF NOT EXISTS public.moderation_actions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  moderator_id uuid REFERENCES auth.users(id),
  target_user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  report_id uuid REFERENCES public.content_reports(id) ON DELETE SET NULL,
  action_type public.moderation_action_type NOT NULL,
  severity text NOT NULL DEFAULT 'light', -- light | grave | gravissima
  reason text,
  duration_days int,
  expires_at timestamptz,
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_moderation_actions_target ON public.moderation_actions(target_user_id, created_at DESC);

GRANT SELECT ON public.moderation_actions TO authenticated;
GRANT ALL ON public.moderation_actions TO service_role;

ALTER TABLE public.moderation_actions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users see own moderation actions"
  ON public.moderation_actions FOR SELECT TO authenticated
  USING (auth.uid() = target_user_id OR has_role(auth.uid(),'moderator'::app_role) OR has_role(auth.uid(),'admin'::app_role) OR has_role(auth.uid(),'superadmin'::app_role));

-- User blocks
CREATE TABLE IF NOT EXISTS public.user_blocks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  blocker_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  blocked_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(blocker_id, blocked_id)
);

CREATE INDEX IF NOT EXISTS idx_user_blocks_blocker ON public.user_blocks(blocker_id);

GRANT SELECT, INSERT, DELETE ON public.user_blocks TO authenticated;
GRANT ALL ON public.user_blocks TO service_role;

ALTER TABLE public.user_blocks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own blocks"
  ON public.user_blocks FOR ALL TO authenticated
  USING (auth.uid() = blocker_id)
  WITH CHECK (auth.uid() = blocker_id);

-- Add moderation columns to profiles
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS suspended_until timestamptz,
  ADD COLUMN IF NOT EXISTS banned_at timestamptz,
  ADD COLUMN IF NOT EXISTS strike_count int NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS moderation_note text;

-- Helper: check if user is suspended or banned
CREATE OR REPLACE FUNCTION public.is_user_restricted(_user_id uuid)
RETURNS jsonb
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT jsonb_build_object(
    'banned', banned_at IS NOT NULL,
    'suspended', suspended_until IS NOT NULL AND suspended_until > now(),
    'suspended_until', suspended_until,
    'banned_at', banned_at,
    'strike_count', strike_count
  )
  FROM public.profiles WHERE id = _user_id;
$$;

-- RPC: get my restriction status
CREATE OR REPLACE FUNCTION public.get_my_restrictions()
RETURNS jsonb
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _uid uuid := auth.uid();
  _restrictions jsonb;
  _last_action jsonb;
BEGIN
  IF _uid IS NULL THEN RETURN jsonb_build_object('banned', false, 'suspended', false); END IF;
  SELECT public.is_user_restricted(_uid) INTO _restrictions;
  SELECT to_jsonb(ma) INTO _last_action
    FROM public.moderation_actions ma
    WHERE ma.target_user_id = _uid AND ma.action_type IN ('warning','suspended','banned','content_removed')
    ORDER BY created_at DESC LIMIT 1;
  RETURN _restrictions || jsonb_build_object('last_action', _last_action);
END $$;
