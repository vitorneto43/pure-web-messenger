
-- =========================================================================
-- FASE 1: FUNDAÇÃO DOS ECOSSISTEMAS WAVECHAT
-- =========================================================================

-- 1) ENUMS
DO $$ BEGIN
  CREATE TYPE public.ecosystem_category AS ENUM ('business','study','sports','community','government','other');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.ecosystem_visibility AS ENUM ('private','unlisted');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.ecosystem_join_policy AS ENUM ('invite','link','code','request');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.ecosystem_role AS ENUM ('owner','admin','moderator','member');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.ecosystem_member_status AS ENUM ('active','pending','banned');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- 2) TABELA ecosystems
CREATE TABLE IF NOT EXISTS public.ecosystems (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug text NOT NULL UNIQUE CHECK (slug ~ '^[a-z0-9][a-z0-9-]{2,48}$'),
  name text NOT NULL,
  description text,
  category public.ecosystem_category NOT NULL DEFAULT 'other',
  logo_url text,
  banner_url text,
  primary_color text,
  website text,
  contact_email text,
  visibility public.ecosystem_visibility NOT NULL DEFAULT 'private',
  join_policy public.ecosystem_join_policy NOT NULL DEFAULT 'invite',
  join_code text UNIQUE,
  settings jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_by uuid NOT NULL REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.ecosystems TO authenticated;
GRANT ALL ON public.ecosystems TO service_role;
ALTER TABLE public.ecosystems ENABLE ROW LEVEL SECURITY;

-- 3) TABELA ecosystem_members
CREATE TABLE IF NOT EXISTS public.ecosystem_members (
  ecosystem_id uuid NOT NULL REFERENCES public.ecosystems(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.ecosystem_role NOT NULL DEFAULT 'member',
  status public.ecosystem_member_status NOT NULL DEFAULT 'active',
  invited_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  joined_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (ecosystem_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_ecosystem_members_user ON public.ecosystem_members(user_id) WHERE status = 'active';
CREATE INDEX IF NOT EXISTS idx_ecosystem_members_eco  ON public.ecosystem_members(ecosystem_id) WHERE status = 'active';

GRANT SELECT, INSERT, UPDATE, DELETE ON public.ecosystem_members TO authenticated;
GRANT ALL ON public.ecosystem_members TO service_role;
ALTER TABLE public.ecosystem_members ENABLE ROW LEVEL SECURITY;

-- 4) TABELA ecosystem_invites
CREATE TABLE IF NOT EXISTS public.ecosystem_invites (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ecosystem_id uuid NOT NULL REFERENCES public.ecosystems(id) ON DELETE CASCADE,
  code text NOT NULL UNIQUE,
  email text,
  role_on_join public.ecosystem_role NOT NULL DEFAULT 'member',
  expires_at timestamptz,
  max_uses int,
  uses int NOT NULL DEFAULT 0,
  created_by uuid NOT NULL REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.ecosystem_invites TO authenticated;
GRANT ALL ON public.ecosystem_invites TO service_role;
ALTER TABLE public.ecosystem_invites ENABLE ROW LEVEL SECURITY;

-- 5) FUNÇÕES SECURITY DEFINER (fonte única de verdade pra RLS)
CREATE OR REPLACE FUNCTION public.is_ecosystem_member(_eco uuid, _user uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT _eco IS NOT NULL AND _user IS NOT NULL AND EXISTS (
    SELECT 1 FROM public.ecosystem_members
    WHERE ecosystem_id = _eco AND user_id = _user AND status = 'active'
  );
$$;

CREATE OR REPLACE FUNCTION public.get_ecosystem_role(_eco uuid, _user uuid)
RETURNS public.ecosystem_role
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT role FROM public.ecosystem_members
  WHERE ecosystem_id = _eco AND user_id = _user AND status = 'active'
  LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION public.is_ecosystem_admin(_eco uuid, _user uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.ecosystem_members
    WHERE ecosystem_id = _eco AND user_id = _user
      AND status = 'active' AND role IN ('owner','admin')
  );
$$;

-- 6) POLICIES: ecosystems
DROP POLICY IF EXISTS "eco_select_members_or_unlisted" ON public.ecosystems;
CREATE POLICY "eco_select_members_or_unlisted" ON public.ecosystems
  FOR SELECT TO authenticated
  USING (
    visibility = 'unlisted'
    OR public.is_ecosystem_member(id, auth.uid())
    OR created_by = auth.uid()
  );

DROP POLICY IF EXISTS "eco_insert_authenticated" ON public.ecosystems;
CREATE POLICY "eco_insert_authenticated" ON public.ecosystems
  FOR INSERT TO authenticated
  WITH CHECK (created_by = auth.uid());

DROP POLICY IF EXISTS "eco_update_admins" ON public.ecosystems;
CREATE POLICY "eco_update_admins" ON public.ecosystems
  FOR UPDATE TO authenticated
  USING (public.is_ecosystem_admin(id, auth.uid()))
  WITH CHECK (public.is_ecosystem_admin(id, auth.uid()));

DROP POLICY IF EXISTS "eco_delete_owner" ON public.ecosystems;
CREATE POLICY "eco_delete_owner" ON public.ecosystems
  FOR DELETE TO authenticated
  USING (public.get_ecosystem_role(id, auth.uid()) = 'owner');

-- 7) POLICIES: ecosystem_members
DROP POLICY IF EXISTS "em_select_members" ON public.ecosystem_members;
CREATE POLICY "em_select_members" ON public.ecosystem_members
  FOR SELECT TO authenticated
  USING (
    user_id = auth.uid()
    OR public.is_ecosystem_member(ecosystem_id, auth.uid())
  );

DROP POLICY IF EXISTS "em_insert_self_or_admin" ON public.ecosystem_members;
CREATE POLICY "em_insert_self_or_admin" ON public.ecosystem_members
  FOR INSERT TO authenticated
  WITH CHECK (
    user_id = auth.uid()
    OR public.is_ecosystem_admin(ecosystem_id, auth.uid())
  );

DROP POLICY IF EXISTS "em_update_admin" ON public.ecosystem_members;
CREATE POLICY "em_update_admin" ON public.ecosystem_members
  FOR UPDATE TO authenticated
  USING (public.is_ecosystem_admin(ecosystem_id, auth.uid()))
  WITH CHECK (public.is_ecosystem_admin(ecosystem_id, auth.uid()));

DROP POLICY IF EXISTS "em_delete_self_or_admin" ON public.ecosystem_members;
CREATE POLICY "em_delete_self_or_admin" ON public.ecosystem_members
  FOR DELETE TO authenticated
  USING (
    user_id = auth.uid()
    OR public.is_ecosystem_admin(ecosystem_id, auth.uid())
  );

-- 8) POLICIES: ecosystem_invites (só admins gerenciam)
DROP POLICY IF EXISTS "einv_select_admin" ON public.ecosystem_invites;
CREATE POLICY "einv_select_admin" ON public.ecosystem_invites
  FOR SELECT TO authenticated
  USING (public.is_ecosystem_admin(ecosystem_id, auth.uid()));

DROP POLICY IF EXISTS "einv_write_admin" ON public.ecosystem_invites;
CREATE POLICY "einv_write_admin" ON public.ecosystem_invites
  FOR ALL TO authenticated
  USING (public.is_ecosystem_admin(ecosystem_id, auth.uid()))
  WITH CHECK (public.is_ecosystem_admin(ecosystem_id, auth.uid()));

-- 9) TRIGGER: criador vira owner automaticamente
CREATE OR REPLACE FUNCTION public.ecosystems_add_owner_after_insert()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.ecosystem_members (ecosystem_id, user_id, role, status)
  VALUES (NEW.id, NEW.created_by, 'owner', 'active')
  ON CONFLICT DO NOTHING;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_ecosystems_add_owner ON public.ecosystems;
CREATE TRIGGER trg_ecosystems_add_owner
  AFTER INSERT ON public.ecosystems
  FOR EACH ROW EXECUTE FUNCTION public.ecosystems_add_owner_after_insert();

-- 10) TRIGGER: updated_at
CREATE OR REPLACE FUNCTION public.ecosystems_touch_updated_at()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END $$;

DROP TRIGGER IF EXISTS trg_ecosystems_touch ON public.ecosystems;
CREATE TRIGGER trg_ecosystems_touch BEFORE UPDATE ON public.ecosystems
  FOR EACH ROW EXECUTE FUNCTION public.ecosystems_touch_updated_at();

DROP TRIGGER IF EXISTS trg_ecosystem_members_touch ON public.ecosystem_members;
CREATE TRIGGER trg_ecosystem_members_touch BEFORE UPDATE ON public.ecosystem_members
  FOR EACH ROW EXECUTE FUNCTION public.ecosystems_touch_updated_at();

-- =========================================================================
-- 11) COLUNAS ecosystem_id / origin_post_id NAS TABELAS DE CONTEÚDO
-- =========================================================================
-- Semântica: ecosystem_id IS NULL => Rede Social Pública (comportamento atual)
--            ecosystem_id = X     => conteúdo exclusivo do ecossistema X

ALTER TABLE public.posts          ADD COLUMN IF NOT EXISTS ecosystem_id uuid REFERENCES public.ecosystems(id) ON DELETE CASCADE;
ALTER TABLE public.posts          ADD COLUMN IF NOT EXISTS origin_post_id uuid REFERENCES public.posts(id) ON DELETE SET NULL;

ALTER TABLE public.statuses       ADD COLUMN IF NOT EXISTS ecosystem_id uuid REFERENCES public.ecosystems(id) ON DELETE CASCADE;
ALTER TABLE public.statuses       ADD COLUMN IF NOT EXISTS origin_status_id uuid REFERENCES public.statuses(id) ON DELETE SET NULL;

ALTER TABLE public.videos         ADD COLUMN IF NOT EXISTS ecosystem_id uuid REFERENCES public.ecosystems(id) ON DELETE CASCADE;
ALTER TABLE public.videos         ADD COLUMN IF NOT EXISTS origin_video_id uuid REFERENCES public.videos(id) ON DELETE SET NULL;

ALTER TABLE public.live_sessions  ADD COLUMN IF NOT EXISTS ecosystem_id uuid REFERENCES public.ecosystems(id) ON DELETE CASCADE;
ALTER TABLE public.scheduled_lives ADD COLUMN IF NOT EXISTS ecosystem_id uuid REFERENCES public.ecosystems(id) ON DELETE CASCADE;

ALTER TABLE public.conversations  ADD COLUMN IF NOT EXISTS ecosystem_id uuid REFERENCES public.ecosystems(id) ON DELETE CASCADE;
ALTER TABLE public.notifications  ADD COLUMN IF NOT EXISTS ecosystem_id uuid REFERENCES public.ecosystems(id) ON DELETE CASCADE;

-- Índices parciais para performance (só onde há valor)
CREATE INDEX IF NOT EXISTS idx_posts_ecosystem         ON public.posts(ecosystem_id, created_at DESC) WHERE ecosystem_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_statuses_ecosystem      ON public.statuses(ecosystem_id, created_at DESC) WHERE ecosystem_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_videos_ecosystem        ON public.videos(ecosystem_id, created_at DESC) WHERE ecosystem_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_live_sessions_ecosystem ON public.live_sessions(ecosystem_id) WHERE ecosystem_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_conversations_ecosystem ON public.conversations(ecosystem_id) WHERE ecosystem_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_notifications_ecosystem ON public.notifications(ecosystem_id) WHERE ecosystem_id IS NOT NULL;

-- =========================================================================
-- 12) RLS: adicionar policies "ecosystem-aware" SEM remover as existentes
-- =========================================================================
-- Estratégia: policies existentes cobrem ecosystem_id IS NULL (rede pública).
-- Adicionamos policies restritivas que BLOQUEIAM linhas de ecossistema para
-- não-membros, mantendo tudo o mais igual.

-- POSTS
DROP POLICY IF EXISTS "eco_restrict_posts_select"   ON public.posts;
CREATE POLICY "eco_restrict_posts_select" ON public.posts
  AS RESTRICTIVE FOR SELECT TO public, authenticated, anon
  USING (
    ecosystem_id IS NULL
    OR public.is_ecosystem_member(ecosystem_id, auth.uid())
  );

DROP POLICY IF EXISTS "eco_restrict_posts_insert"   ON public.posts;
CREATE POLICY "eco_restrict_posts_insert" ON public.posts
  AS RESTRICTIVE FOR INSERT TO authenticated
  WITH CHECK (
    ecosystem_id IS NULL
    OR public.is_ecosystem_member(ecosystem_id, auth.uid())
  );

-- STATUSES
DROP POLICY IF EXISTS "eco_restrict_statuses_select" ON public.statuses;
CREATE POLICY "eco_restrict_statuses_select" ON public.statuses
  AS RESTRICTIVE FOR SELECT TO public, authenticated, anon
  USING (
    ecosystem_id IS NULL
    OR public.is_ecosystem_member(ecosystem_id, auth.uid())
  );

DROP POLICY IF EXISTS "eco_restrict_statuses_insert" ON public.statuses;
CREATE POLICY "eco_restrict_statuses_insert" ON public.statuses
  AS RESTRICTIVE FOR INSERT TO authenticated
  WITH CHECK (
    ecosystem_id IS NULL
    OR public.is_ecosystem_member(ecosystem_id, auth.uid())
  );

-- VIDEOS (WaveTube + Shorts)
DROP POLICY IF EXISTS "eco_restrict_videos_select" ON public.videos;
CREATE POLICY "eco_restrict_videos_select" ON public.videos
  AS RESTRICTIVE FOR SELECT TO public, authenticated, anon
  USING (
    ecosystem_id IS NULL
    OR public.is_ecosystem_member(ecosystem_id, auth.uid())
  );

DROP POLICY IF EXISTS "eco_restrict_videos_insert" ON public.videos;
CREATE POLICY "eco_restrict_videos_insert" ON public.videos
  AS RESTRICTIVE FOR INSERT TO authenticated
  WITH CHECK (
    ecosystem_id IS NULL
    OR public.is_ecosystem_member(ecosystem_id, auth.uid())
  );

-- LIVE SESSIONS
DROP POLICY IF EXISTS "eco_restrict_lives_select" ON public.live_sessions;
CREATE POLICY "eco_restrict_lives_select" ON public.live_sessions
  AS RESTRICTIVE FOR SELECT TO public, authenticated, anon
  USING (
    ecosystem_id IS NULL
    OR public.is_ecosystem_member(ecosystem_id, auth.uid())
  );

DROP POLICY IF EXISTS "eco_restrict_lives_insert" ON public.live_sessions;
CREATE POLICY "eco_restrict_lives_insert" ON public.live_sessions
  AS RESTRICTIVE FOR INSERT TO authenticated
  WITH CHECK (
    ecosystem_id IS NULL
    OR public.is_ecosystem_member(ecosystem_id, auth.uid())
  );

-- SCHEDULED LIVES
DROP POLICY IF EXISTS "eco_restrict_slives_select" ON public.scheduled_lives;
CREATE POLICY "eco_restrict_slives_select" ON public.scheduled_lives
  AS RESTRICTIVE FOR SELECT TO public, authenticated, anon
  USING (
    ecosystem_id IS NULL
    OR public.is_ecosystem_member(ecosystem_id, auth.uid())
  );

DROP POLICY IF EXISTS "eco_restrict_slives_insert" ON public.scheduled_lives;
CREATE POLICY "eco_restrict_slives_insert" ON public.scheduled_lives
  AS RESTRICTIVE FOR INSERT TO authenticated
  WITH CHECK (
    ecosystem_id IS NULL
    OR public.is_ecosystem_member(ecosystem_id, auth.uid())
  );

-- CONVERSATIONS (chats/grupos internos)
DROP POLICY IF EXISTS "eco_restrict_convs_select" ON public.conversations;
CREATE POLICY "eco_restrict_convs_select" ON public.conversations
  AS RESTRICTIVE FOR SELECT TO authenticated
  USING (
    ecosystem_id IS NULL
    OR public.is_ecosystem_member(ecosystem_id, auth.uid())
  );

DROP POLICY IF EXISTS "eco_restrict_convs_insert" ON public.conversations;
CREATE POLICY "eco_restrict_convs_insert" ON public.conversations
  AS RESTRICTIVE FOR INSERT TO authenticated
  WITH CHECK (
    ecosystem_id IS NULL
    OR public.is_ecosystem_member(ecosystem_id, auth.uid())
  );

-- NOTIFICATIONS (leitura já é escopada por user_id; garantimos que ecossistema respeita membership)
DROP POLICY IF EXISTS "eco_restrict_notifs_select" ON public.notifications;
CREATE POLICY "eco_restrict_notifs_select" ON public.notifications
  AS RESTRICTIVE FOR SELECT TO authenticated
  USING (
    ecosystem_id IS NULL
    OR public.is_ecosystem_member(ecosystem_id, auth.uid())
  );
