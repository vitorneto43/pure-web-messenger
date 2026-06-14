
-- =========================
-- 1. CATALOG TABLE
-- =========================
CREATE TABLE public.badges (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text NOT NULL UNIQUE,
  name text NOT NULL,
  description text NOT NULL,
  icon text NOT NULL,
  color text NOT NULL DEFAULT '#3B82F6',
  category text NOT NULL CHECK (category IN ('verification','followers','invites','profile','historical','activity')),
  tier int NOT NULL DEFAULT 0,
  criteria jsonb NOT NULL DEFAULT '{}'::jsonb,
  is_automatic boolean NOT NULL DEFAULT true,
  display_priority int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.badges TO anon, authenticated;
GRANT ALL ON public.badges TO service_role;
ALTER TABLE public.badges ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Badges are public" ON public.badges FOR SELECT USING (true);

-- =========================
-- 2. USER BADGES
-- =========================
CREATE TABLE public.user_badges (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  badge_id uuid NOT NULL REFERENCES public.badges(id) ON DELETE CASCADE,
  awarded_at timestamptz NOT NULL DEFAULT now(),
  awarded_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  UNIQUE (user_id, badge_id)
);

CREATE INDEX idx_user_badges_user ON public.user_badges(user_id);
CREATE INDEX idx_user_badges_badge ON public.user_badges(badge_id);

GRANT SELECT ON public.user_badges TO anon, authenticated;
GRANT ALL ON public.user_badges TO service_role;
ALTER TABLE public.user_badges ENABLE ROW LEVEL SECURITY;
CREATE POLICY "User badges are public" ON public.user_badges FOR SELECT USING (true);
-- writes only via security definer functions / service_role

-- =========================
-- 3. SEED CATALOG
-- =========================
INSERT INTO public.badges (code, name, description, icon, color, category, tier, criteria, is_automatic, display_priority) VALUES
  ('verified',          'Verificado',           'Conta autenticada pelo WaveChat.', '✔️', '#1DA1F2', 'verification', 1, '{}'::jsonb, false, 100),
  ('founder',           'Membro Fundador',      'Você ajudou a construir o WaveChat desde o início.', '🏆', '#F59E0B', 'historical', 1, '{"first_n":500}'::jsonb, true, 90),
  ('creator_starter',   'Criador Iniciante',    '100 seguidores no WaveChat.', '🥉', '#CD7F32', 'followers', 1, '{"min_followers":100}'::jsonb, true, 60),
  ('creator_growing',   'Criador em Crescimento','1.000 seguidores no WaveChat.', '🥈', '#C0C0C0', 'followers', 2, '{"min_followers":1000}'::jsonb, true, 61),
  ('creator_popular',   'Criador Popular',      '10.000 seguidores no WaveChat.', '🥇', '#FFD700', 'followers', 3, '{"min_followers":10000}'::jsonb, true, 62),
  ('creator_featured',  'Criador de Destaque',  '100.000 seguidores no WaveChat.', '💎', '#22D3EE', 'followers', 4, '{"min_followers":100000}'::jsonb, true, 63),
  ('creator_legend',    'Lenda WaveChat',       '1.000.000 de seguidores no WaveChat.', '👑', '#A855F7', 'followers', 5, '{"min_followers":1000000}'::jsonb, true, 64),
  ('inviter',           'Convidador',           'Trouxe novos membros para a comunidade.', '🎉', '#10B981', 'invites', 1, '{"min_invites":3}'::jsonb, true, 50),
  ('ambassador',        'Embaixador',           'Ajudou o WaveChat a crescer.', '🚀', '#3B82F6', 'invites', 2, '{"min_invites":10}'::jsonb, true, 51),
  ('super_ambassador',  'Super Embaixador',     'Um dos maiores divulgadores da plataforma.', '🌟', '#F97316', 'invites', 3, '{"min_invites":50}'::jsonb, true, 52),
  ('profile_complete',  'Perfil Completo',      'Perfil completo e pronto para novas conexões.', '🔥', '#EF4444', 'profile', 1, '{}'::jsonb, true, 40),
  ('communicator',      'Comunicador',          '100 mensagens enviadas.', '💬', '#06B6D4', 'activity', 1, '{"min_messages":100}'::jsonb, true, 20),
  ('connected',         'Conectado',            '50 chamadas realizadas.', '📞', '#8B5CF6', 'activity', 1, '{"min_calls":50}'::jsonb, true, 21),
  ('content_creator',   'Criador de Conteúdo',  '50 status publicados.', '📸', '#EC4899', 'activity', 1, '{"min_statuses":50}'::jsonb, true, 22),
  ('engager',           'Engajador',            '100 comentários realizados.', '❤️', '#F43F5E', 'activity', 1, '{"min_comments":100}'::jsonb, true, 23),
  ('explorer',          'Explorador',           'Conversou com pessoas de 5 cidades diferentes.', '🌍', '#14B8A6', 'activity', 1, '{"min_cities":5}'::jsonb, true, 24);

-- =========================
-- 4. RECOMPUTE FUNCTION
-- =========================
CREATE OR REPLACE FUNCTION public.recompute_user_badges(_user_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _followers int;
  _invites int;
  _msgs int;
  _calls int;
  _statuses int;
  _comments int;
  _cities int;
  _has_avatar boolean;
  _has_bio boolean;
  _has_name boolean;
  _has_city boolean;
  _has_interests boolean;
  _profile_complete boolean;
  _rank int;
  _is_founder boolean;
  _follower_code text;
  _invite_code text;
  _b record;
BEGIN
  IF _user_id IS NULL THEN RETURN; END IF;

  -- Followers
  SELECT COUNT(*) INTO _followers FROM public.profile_follows WHERE following_id = _user_id;
  _follower_code := CASE
    WHEN _followers >= 1000000 THEN 'creator_legend'
    WHEN _followers >= 100000 THEN 'creator_featured'
    WHEN _followers >= 10000 THEN 'creator_popular'
    WHEN _followers >= 1000 THEN 'creator_growing'
    WHEN _followers >= 100 THEN 'creator_starter'
    ELSE NULL
  END;

  -- Invites accepted (confirmed users invited by this user)
  SELECT COUNT(*) INTO _invites
  FROM public.profiles p
  JOIN auth.users u ON u.id = p.id
  WHERE p.invited_by = _user_id AND u.email_confirmed_at IS NOT NULL;

  _invite_code := CASE
    WHEN _invites >= 50 THEN 'super_ambassador'
    WHEN _invites >= 10 THEN 'ambassador'
    WHEN _invites >= 3 THEN 'inviter'
    ELSE NULL
  END;

  -- Profile completeness
  SELECT
    (avatar_url IS NOT NULL AND length(avatar_url) > 0),
    (bio IS NOT NULL AND length(trim(bio)) > 0),
    (display_name IS NOT NULL AND length(trim(display_name)) > 0)
  INTO _has_avatar, _has_bio, _has_name
  FROM public.profiles WHERE id = _user_id;

  SELECT (city IS NOT NULL AND length(trim(city)) > 0) INTO _has_city
  FROM public.profiles_private WHERE user_id = _user_id;
  _has_city := COALESCE(_has_city, false);

  SELECT EXISTS(SELECT 1 FROM public.user_onboarding_survey WHERE user_id = _user_id) INTO _has_interests;

  _profile_complete := COALESCE(_has_avatar,false) AND COALESCE(_has_bio,false) AND COALESCE(_has_name,false) AND _has_city AND _has_interests;

  -- Founder check (top 500 earliest profiles) - persistent once earned
  SELECT rnk INTO _rank FROM (
    SELECT id, ROW_NUMBER() OVER (ORDER BY created_at ASC) AS rnk
    FROM public.profiles
  ) t WHERE id = _user_id;
  _is_founder := COALESCE(_rank, 999999) <= 500;

  -- Activity
  SELECT COUNT(*) INTO _msgs FROM public.messages WHERE sender_id = _user_id;
  SELECT COUNT(*) INTO _calls FROM public.calls WHERE caller_id = _user_id OR callee_id = _user_id;
  SELECT COUNT(*) INTO _statuses FROM public.statuses WHERE user_id = _user_id;
  SELECT COUNT(*) INTO _comments FROM public.status_comments WHERE user_id = _user_id;
  SELECT COUNT(DISTINCT pp.city) INTO _cities
    FROM public.conversation_members cm1
    JOIN public.conversation_members cm2 ON cm1.conversation_id = cm2.conversation_id AND cm1.user_id <> cm2.user_id
    JOIN public.profiles_private pp ON pp.user_id = cm2.user_id
    WHERE cm1.user_id = _user_id AND pp.city IS NOT NULL AND length(trim(pp.city)) > 0;

  -- Award helper: insert if missing, ignore conflict
  -- We process all relevant badges, then prune

  -- Verified is manual; never touched here. Founder: award if eligible (never revoke).
  IF _is_founder THEN
    INSERT INTO public.user_badges(user_id, badge_id)
    SELECT _user_id, id FROM public.badges WHERE code = 'founder'
    ON CONFLICT DO NOTHING;
  END IF;

  -- Followers tier: award current, remove lower tiers
  IF _follower_code IS NOT NULL THEN
    INSERT INTO public.user_badges(user_id, badge_id)
    SELECT _user_id, id FROM public.badges WHERE code = _follower_code
    ON CONFLICT DO NOTHING;
  END IF;
  DELETE FROM public.user_badges ub
   USING public.badges b
   WHERE ub.badge_id = b.id
     AND ub.user_id = _user_id
     AND b.category = 'followers'
     AND (_follower_code IS NULL OR b.code <> _follower_code);

  -- Invites tier
  IF _invite_code IS NOT NULL THEN
    INSERT INTO public.user_badges(user_id, badge_id)
    SELECT _user_id, id FROM public.badges WHERE code = _invite_code
    ON CONFLICT DO NOTHING;
  END IF;
  DELETE FROM public.user_badges ub
   USING public.badges b
   WHERE ub.badge_id = b.id
     AND ub.user_id = _user_id
     AND b.category = 'invites'
     AND (_invite_code IS NULL OR b.code <> _invite_code);

  -- Profile complete
  IF _profile_complete THEN
    INSERT INTO public.user_badges(user_id, badge_id)
    SELECT _user_id, id FROM public.badges WHERE code = 'profile_complete'
    ON CONFLICT DO NOTHING;
  ELSE
    DELETE FROM public.user_badges ub
     USING public.badges b
     WHERE ub.badge_id = b.id AND ub.user_id = _user_id AND b.code = 'profile_complete';
  END IF;

  -- Activity (independent badges)
  IF _msgs >= 100 THEN
    INSERT INTO public.user_badges(user_id, badge_id)
    SELECT _user_id, id FROM public.badges WHERE code = 'communicator' ON CONFLICT DO NOTHING;
  END IF;
  IF _calls >= 50 THEN
    INSERT INTO public.user_badges(user_id, badge_id)
    SELECT _user_id, id FROM public.badges WHERE code = 'connected' ON CONFLICT DO NOTHING;
  END IF;
  IF _statuses >= 50 THEN
    INSERT INTO public.user_badges(user_id, badge_id)
    SELECT _user_id, id FROM public.badges WHERE code = 'content_creator' ON CONFLICT DO NOTHING;
  END IF;
  IF _comments >= 100 THEN
    INSERT INTO public.user_badges(user_id, badge_id)
    SELECT _user_id, id FROM public.badges WHERE code = 'engager' ON CONFLICT DO NOTHING;
  END IF;
  IF COALESCE(_cities,0) >= 5 THEN
    INSERT INTO public.user_badges(user_id, badge_id)
    SELECT _user_id, id FROM public.badges WHERE code = 'explorer' ON CONFLICT DO NOTHING;
  END IF;
END;
$$;

-- =========================
-- 5. PUBLIC READER
-- =========================
CREATE OR REPLACE FUNCTION public.get_user_badges(_user_id uuid)
RETURNS TABLE (
  code text, name text, description text, icon text, color text,
  category text, tier int, display_priority int, awarded_at timestamptz
)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT b.code, b.name, b.description, b.icon, b.color, b.category, b.tier, b.display_priority, ub.awarded_at
  FROM public.user_badges ub
  JOIN public.badges b ON b.id = ub.badge_id
  WHERE ub.user_id = _user_id
  ORDER BY b.display_priority DESC, b.tier DESC;
$$;

GRANT EXECUTE ON FUNCTION public.get_user_badges(uuid) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.recompute_user_badges(uuid) TO authenticated;

-- =========================
-- 6. ADMIN AWARD / REVOKE
-- =========================
CREATE OR REPLACE FUNCTION public.admin_award_badge(_user_id uuid, _badge_code text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE _bid uuid;
BEGIN
  IF NOT (has_role(auth.uid(),'admin'::app_role) OR has_role(auth.uid(),'superadmin'::app_role) OR has_role(auth.uid(),'moderator'::app_role)) THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;
  SELECT id INTO _bid FROM public.badges WHERE code = _badge_code;
  IF _bid IS NULL THEN RAISE EXCEPTION 'Badge not found'; END IF;
  INSERT INTO public.user_badges(user_id, badge_id, awarded_by)
  VALUES (_user_id, _bid, auth.uid())
  ON CONFLICT (user_id, badge_id) DO NOTHING;
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_revoke_badge(_user_id uuid, _badge_code text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE _bid uuid;
BEGIN
  IF NOT (has_role(auth.uid(),'admin'::app_role) OR has_role(auth.uid(),'superadmin'::app_role) OR has_role(auth.uid(),'moderator'::app_role)) THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;
  SELECT id INTO _bid FROM public.badges WHERE code = _badge_code;
  IF _bid IS NULL THEN RAISE EXCEPTION 'Badge not found'; END IF;
  DELETE FROM public.user_badges WHERE user_id = _user_id AND badge_id = _bid;
END;
$$;

GRANT EXECUTE ON FUNCTION public.admin_award_badge(uuid,text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_revoke_badge(uuid,text) TO authenticated;

-- =========================
-- 7. TRIGGERS
-- =========================
CREATE OR REPLACE FUNCTION public.trg_recompute_badges_follow()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  PERFORM public.recompute_user_badges(COALESCE(NEW.following_id, OLD.following_id));
  RETURN COALESCE(NEW, OLD);
END;$$;
CREATE TRIGGER trg_badges_follow
AFTER INSERT OR DELETE ON public.profile_follows
FOR EACH ROW EXECUTE FUNCTION public.trg_recompute_badges_follow();

CREATE OR REPLACE FUNCTION public.trg_recompute_badges_profile()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  PERFORM public.recompute_user_badges(NEW.id);
  IF NEW.invited_by IS NOT NULL AND (TG_OP = 'INSERT' OR NEW.invited_by IS DISTINCT FROM OLD.invited_by) THEN
    PERFORM public.recompute_user_badges(NEW.invited_by);
  END IF;
  RETURN NEW;
END;$$;
CREATE TRIGGER trg_badges_profile
AFTER INSERT OR UPDATE OF avatar_url, display_name, bio, invited_by ON public.profiles
FOR EACH ROW EXECUTE FUNCTION public.trg_recompute_badges_profile();

CREATE OR REPLACE FUNCTION public.trg_recompute_badges_profile_private()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  PERFORM public.recompute_user_badges(NEW.user_id);
  RETURN NEW;
END;$$;
CREATE TRIGGER trg_badges_profile_private
AFTER INSERT OR UPDATE OF city ON public.profiles_private
FOR EACH ROW EXECUTE FUNCTION public.trg_recompute_badges_profile_private();

CREATE OR REPLACE FUNCTION public.trg_recompute_badges_survey()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  PERFORM public.recompute_user_badges(NEW.user_id);
  RETURN NEW;
END;$$;
CREATE TRIGGER trg_badges_survey
AFTER INSERT ON public.user_onboarding_survey
FOR EACH ROW EXECUTE FUNCTION public.trg_recompute_badges_survey();

-- Lightweight activity triggers: only recompute when crossing thresholds is cheap.
-- To avoid hot-path overhead we sample (only on inserts; recompute is idempotent).
CREATE OR REPLACE FUNCTION public.trg_recompute_badges_message()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _c bigint;
BEGIN
  SELECT count(*) INTO _c FROM public.messages WHERE sender_id = NEW.sender_id;
  IF _c IN (100) OR _c % 50 = 0 THEN
    PERFORM public.recompute_user_badges(NEW.sender_id);
  END IF;
  RETURN NEW;
END;$$;
CREATE TRIGGER trg_badges_message
AFTER INSERT ON public.messages
FOR EACH ROW EXECUTE FUNCTION public.trg_recompute_badges_message();

CREATE OR REPLACE FUNCTION public.trg_recompute_badges_call()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  PERFORM public.recompute_user_badges(NEW.caller_id);
  IF NEW.callee_id IS NOT NULL THEN
    PERFORM public.recompute_user_badges(NEW.callee_id);
  END IF;
  RETURN NEW;
END;$$;
CREATE TRIGGER trg_badges_call
AFTER INSERT ON public.calls
FOR EACH ROW EXECUTE FUNCTION public.trg_recompute_badges_call();

CREATE OR REPLACE FUNCTION public.trg_recompute_badges_status()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  PERFORM public.recompute_user_badges(NEW.user_id);
  RETURN NEW;
END;$$;
CREATE TRIGGER trg_badges_status
AFTER INSERT ON public.statuses
FOR EACH ROW EXECUTE FUNCTION public.trg_recompute_badges_status();

CREATE OR REPLACE FUNCTION public.trg_recompute_badges_comment()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  PERFORM public.recompute_user_badges(NEW.user_id);
  RETURN NEW;
END;$$;
CREATE TRIGGER trg_badges_comment
AFTER INSERT ON public.status_comments
FOR EACH ROW EXECUTE FUNCTION public.trg_recompute_badges_comment();
