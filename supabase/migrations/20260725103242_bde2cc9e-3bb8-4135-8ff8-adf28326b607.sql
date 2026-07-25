-- ============================================================
-- Wavechat For: integra Lives, Chat, WaveTube e WaveShorts
-- ============================================================

-- 1. start_live: permitir vincular a live a um ecossistema
CREATE OR REPLACE FUNCTION public.start_live(
  p_title text,
  p_cover_url text DEFAULT NULL::text,
  p_ecosystem_id uuid DEFAULT NULL::uuid
)
RETURNS public.live_sessions
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_uid uuid := auth.uid();
  v_row public.live_sessions;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'auth required'; END IF;

  IF p_ecosystem_id IS NOT NULL THEN
    IF NOT public.is_ecosystem_member(p_ecosystem_id, v_uid) THEN
      RAISE EXCEPTION 'not a member of this ecosystem';
    END IF;
  END IF;

  -- end any previous lives of this host
  UPDATE public.live_sessions SET status='ended', ended_at=now() WHERE host_id=v_uid AND status='live';

  INSERT INTO public.live_sessions (host_id, title, cover_url, livekit_room, ecosystem_id)
  VALUES (v_uid, COALESCE(p_title,''), p_cover_url, 'live_' || replace(gen_random_uuid()::text,'-',''), p_ecosystem_id)
  RETURNING * INTO v_row;

  RETURN v_row;
END $function$;

-- 2. discover_wavetube_videos: filtrar por ecossistema
CREATE OR REPLACE FUNCTION public.discover_wavetube_videos(
  _sort text DEFAULT 'recent'::text,
  _category text DEFAULT NULL::text,
  _search text DEFAULT NULL::text,
  _limit integer DEFAULT 24,
  _offset integer DEFAULT 0,
  _ecosystem_id uuid DEFAULT NULL::uuid
)
RETURNS TABLE(
  id uuid, owner_id uuid, title text, description text, category text,
  thumbnail_url text, duration_sec integer, views_count integer,
  likes_count integer, published_at timestamp with time zone,
  owner_username text, owner_display_name text, owner_avatar_url text
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT v.id, v.owner_id, v.title, v.description, v.category,
         v.thumbnail_url, v.duration_sec, v.views_count, v.likes_count,
         v.published_at, p.username, p.display_name, p.avatar_url
  FROM public.videos v
  LEFT JOIN public.profiles p ON p.id = v.owner_id
  WHERE v.status='ready'
    AND (
      (_ecosystem_id IS NOT NULL AND v.ecosystem_id = _ecosystem_id)
      OR
      (_ecosystem_id IS NULL AND v.ecosystem_id IS NULL AND v.visibility='public')
    )
    AND (_category IS NULL OR v.category = _category)
    AND (_search IS NULL OR v.title ILIKE '%'||_search||'%' OR v.description ILIKE '%'||_search||'%')
  ORDER BY
    CASE WHEN _sort='trending' THEN v.views_count END DESC NULLS LAST,
    v.published_at DESC NULLS LAST
  LIMIT _limit OFFSET _offset;
$function$;

-- 3. discover_waveshorts: filtrar por ecossistema
CREATE OR REPLACE FUNCTION public.discover_waveshorts(
  _cursor timestamp with time zone DEFAULT NULL::timestamp with time zone,
  _limit integer DEFAULT 12,
  _ecosystem_id uuid DEFAULT NULL::uuid
)
RETURNS TABLE(
  id uuid, owner_id uuid, title text, description text, category text,
  file_url text, thumbnail_url text, duration_sec integer, views_count integer,
  likes_count integer, comments_count integer, saves_count integer,
  cta_label text, cta_url text, allow_pix boolean, pix_key text,
  published_at timestamp with time zone, owner_username text,
  owner_display_name text, owner_avatar_url text
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT v.id, v.owner_id, v.title, v.description, v.category, v.file_url, v.thumbnail_url,
         v.duration_sec, v.views_count, v.likes_count, v.comments_count, v.saves_count,
         v.cta_label, v.cta_url, v.allow_pix, v.pix_key, v.published_at,
         p.username, p.display_name, p.avatar_url
  FROM public.videos v
  LEFT JOIN public.profiles p ON p.id = v.owner_id
  WHERE v.is_short = true
    AND v.status = 'ready'
    AND (
      (_ecosystem_id IS NOT NULL AND v.ecosystem_id = _ecosystem_id)
      OR
      (_ecosystem_id IS NULL AND v.ecosystem_id IS NULL AND v.visibility = 'public')
    )
    AND (_cursor IS NULL OR v.published_at < _cursor)
  ORDER BY v.published_at DESC NULLS LAST
  LIMIT LEAST(GREATEST(_limit, 1), 50);
$function$;

-- 4. get_ecosystem_active_lives: lives ao vivo de um ecossistema
CREATE OR REPLACE FUNCTION public.get_ecosystem_active_lives(
  _ecosystem_id uuid,
  _limit integer DEFAULT 50
)
RETURNS TABLE(
  id uuid, title text, cover_url text, viewer_count integer, host_id uuid,
  started_at timestamp with time zone, total_gift_coins integer,
  host_username text, host_display_name text, host_avatar_url text
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT ls.id, ls.title, ls.cover_url, ls.viewer_count, ls.host_id,
         ls.started_at, ls.total_gift_coins,
         p.username, p.display_name, p.avatar_url
  FROM public.live_sessions ls
  LEFT JOIN public.profiles p ON p.id = ls.host_id
  WHERE ls.ecosystem_id = _ecosystem_id
    AND ls.status = 'live'
  ORDER BY ls.viewer_count DESC NULLS LAST
  LIMIT LEAST(GREATEST(_limit, 1), 100);
$function$;

-- 5. get_or_create_ecosystem_conversation: chat oficial do ecossistema
CREATE OR REPLACE FUNCTION public.get_or_create_ecosystem_conversation(
  _ecosystem_id uuid
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_uid uuid := auth.uid();
  v_conv_id uuid;
  v_eco_name text;
  v_eco_avatar text;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'auth required'; END IF;

  IF NOT public.is_ecosystem_member(_ecosystem_id, v_uid) THEN
    RAISE EXCEPTION 'not a member of this ecosystem';
  END IF;

  -- already exists?
  SELECT id INTO v_conv_id
  FROM public.conversations
  WHERE ecosystem_id = _ecosystem_id
  LIMIT 1;

  SELECT name, logo_url INTO v_eco_name, v_eco_avatar
  FROM public.ecosystems
  WHERE id = _ecosystem_id;

  IF v_conv_id IS NULL THEN
    INSERT INTO public.conversations (
      name, is_group, ecosystem_id, created_by, avatar_url, visibility, join_policy
    )
    VALUES (
      COALESCE(v_eco_name, 'Ecossistema'), true, _ecosystem_id, v_uid,
      v_eco_avatar, 'private', 'request'
    )
    RETURNING id INTO v_conv_id;

    -- add all active members
    INSERT INTO public.conversation_members (conversation_id, user_id, role)
    SELECT v_conv_id, em.user_id,
           CASE WHEN em.role = 'owner' THEN 'admin' ELSE 'member' END
    FROM public.ecosystem_members em
    WHERE em.ecosystem_id = _ecosystem_id AND em.status = 'active'
    ON CONFLICT (conversation_id, user_id) DO NOTHING;
  END IF;

  RETURN v_conv_id;
END $function$;

-- Trigger to keep conversation members in sync with ecosystem members
CREATE OR REPLACE FUNCTION public.sync_ecosystem_members_to_conversation()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_conv_id uuid;
BEGIN
  SELECT id INTO v_conv_id FROM public.conversations
  WHERE ecosystem_id = NEW.ecosystem_id LIMIT 1;

  IF v_conv_id IS NULL THEN RETURN NEW; END IF;

  IF TG_OP = 'INSERT' AND NEW.status = 'active' THEN
    INSERT INTO public.conversation_members (conversation_id, user_id, role)
    VALUES (v_conv_id, NEW.user_id,
            CASE WHEN NEW.role = 'owner' THEN 'admin' ELSE 'member' END)
    ON CONFLICT (conversation_id, user_id) DO NOTHING;
  ELSIF TG_OP = 'UPDATE' THEN
    IF NEW.status = 'active' THEN
      INSERT INTO public.conversation_members (conversation_id, user_id, role)
      VALUES (v_conv_id, NEW.user_id,
              CASE WHEN NEW.role = 'owner' THEN 'admin' ELSE 'member' END)
      ON CONFLICT (conversation_id, user_id) DO NOTHING;
    ELSE
      UPDATE public.conversation_members
      SET left_at = now()
      WHERE conversation_id = v_conv_id AND user_id = NEW.user_id;
    END IF;
  END IF;

  RETURN NEW;
END $function$;

DROP TRIGGER IF EXISTS sync_ecosystem_members_to_conversation
  ON public.ecosystem_members;
CREATE TRIGGER sync_ecosystem_members_to_conversation
  AFTER INSERT OR UPDATE ON public.ecosystem_members
  FOR EACH ROW EXECUTE FUNCTION public.sync_ecosystem_members_to_conversation();