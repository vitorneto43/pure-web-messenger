
-- ============================================================
-- Ecosystem cross-post policy: per-institution control over
-- whether members can also publish to the public WaveChat feed.
-- ============================================================

-- 1) Policy flags on the ecosystem itself
ALTER TABLE public.ecosystems
  ADD COLUMN IF NOT EXISTS allow_public_crosspost boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS public_crosspost_requires_admin boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN public.ecosystems.allow_public_crosspost IS
  'When false, members cannot cross-post ecosystem content to the public WaveChat feed.';
COMMENT ON COLUMN public.ecosystems.public_crosspost_requires_admin IS
  'When true, only ecosystem admins/moderators can cross-post publicly.';

-- 2) Marker column on content tables. NULL = native content. Non-null =
--    the public row was cross-posted from this ecosystem.
ALTER TABLE public.posts
  ADD COLUMN IF NOT EXISTS crossposted_from_ecosystem_id uuid REFERENCES public.ecosystems(id) ON DELETE SET NULL;
ALTER TABLE public.statuses
  ADD COLUMN IF NOT EXISTS crossposted_from_ecosystem_id uuid REFERENCES public.ecosystems(id) ON DELETE SET NULL;
ALTER TABLE public.videos
  ADD COLUMN IF NOT EXISTS crossposted_from_ecosystem_id uuid REFERENCES public.ecosystems(id) ON DELETE SET NULL;
ALTER TABLE public.live_sessions
  ADD COLUMN IF NOT EXISTS crossposted_from_ecosystem_id uuid REFERENCES public.ecosystems(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS public_crosspost boolean NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS idx_posts_crosspost_eco     ON public.posts(crossposted_from_ecosystem_id)     WHERE crossposted_from_ecosystem_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_statuses_crosspost_eco  ON public.statuses(crossposted_from_ecosystem_id)  WHERE crossposted_from_ecosystem_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_videos_crosspost_eco    ON public.videos(crossposted_from_ecosystem_id)    WHERE crossposted_from_ecosystem_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_lives_public_crosspost  ON public.live_sessions(status) WHERE public_crosspost = true;

-- 3) Enforcement trigger. Runs BEFORE INSERT/UPDATE. If the row is marked as
--    a public cross-post (crossposted_from_ecosystem_id set AND ecosystem_id
--    is NULL), check the ecosystem policy + the author's role.
CREATE OR REPLACE FUNCTION public.enforce_ecosystem_crosspost_policy()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_eco_id uuid := NEW.crossposted_from_ecosystem_id;
  v_owner uuid;
  v_allow boolean;
  v_admin_only boolean;
BEGIN
  IF v_eco_id IS NULL THEN
    RETURN NEW;
  END IF;

  -- Determine owner column across the different tables
  IF TG_TABLE_NAME = 'posts' THEN
    v_owner := NEW.user_id;
  ELSIF TG_TABLE_NAME = 'statuses' THEN
    v_owner := NEW.user_id;
  ELSIF TG_TABLE_NAME = 'videos' THEN
    v_owner := NEW.owner_id;
  ELSIF TG_TABLE_NAME = 'live_sessions' THEN
    v_owner := NEW.host_id;
  ELSE
    RETURN NEW;
  END IF;

  IF v_owner IS NULL THEN
    RAISE EXCEPTION 'Owner is required to cross-post from an ecosystem';
  END IF;

  -- The author must be a member of the ecosystem they're claiming to cross-post from.
  IF NOT public.is_ecosystem_member(v_eco_id, v_owner) THEN
    RAISE EXCEPTION 'You are not a member of this ecosystem';
  END IF;

  SELECT allow_public_crosspost, public_crosspost_requires_admin
    INTO v_allow, v_admin_only
  FROM public.ecosystems
  WHERE id = v_eco_id;

  IF v_allow IS DISTINCT FROM true THEN
    RAISE EXCEPTION 'Este ecossistema não permite publicar no feed público';
  END IF;

  IF v_admin_only = true AND NOT public.is_ecosystem_admin(v_eco_id, v_owner) THEN
    RAISE EXCEPTION 'Apenas administradores deste ecossistema podem publicar no feed público';
  END IF;

  RETURN NEW;
END;
$$;

-- Attach to each content table
DROP TRIGGER IF EXISTS trg_enforce_crosspost_posts ON public.posts;
CREATE TRIGGER trg_enforce_crosspost_posts
  BEFORE INSERT OR UPDATE OF crossposted_from_ecosystem_id ON public.posts
  FOR EACH ROW EXECUTE FUNCTION public.enforce_ecosystem_crosspost_policy();

DROP TRIGGER IF EXISTS trg_enforce_crosspost_statuses ON public.statuses;
CREATE TRIGGER trg_enforce_crosspost_statuses
  BEFORE INSERT OR UPDATE OF crossposted_from_ecosystem_id ON public.statuses
  FOR EACH ROW EXECUTE FUNCTION public.enforce_ecosystem_crosspost_policy();

DROP TRIGGER IF EXISTS trg_enforce_crosspost_videos ON public.videos;
CREATE TRIGGER trg_enforce_crosspost_videos
  BEFORE INSERT OR UPDATE OF crossposted_from_ecosystem_id ON public.videos
  FOR EACH ROW EXECUTE FUNCTION public.enforce_ecosystem_crosspost_policy();

DROP TRIGGER IF EXISTS trg_enforce_crosspost_lives ON public.live_sessions;
CREATE TRIGGER trg_enforce_crosspost_lives
  BEFORE INSERT OR UPDATE OF crossposted_from_ecosystem_id ON public.live_sessions
  FOR EACH ROW EXECUTE FUNCTION public.enforce_ecosystem_crosspost_policy();

-- 4) start_live: extend to accept p_public_crosspost. When true, the live
--    keeps ecosystem_id (members see it) AND sets public_crosspost=true so
--    public feeds/stories include it — subject to the same policy trigger.
CREATE OR REPLACE FUNCTION public.start_live(
  p_title text,
  p_cover_url text DEFAULT NULL::text,
  p_ecosystem_id uuid DEFAULT NULL::uuid,
  p_public_crosspost boolean DEFAULT false
)
RETURNS public.live_sessions
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_uid uuid := auth.uid();
  v_row public.live_sessions;
  v_allow boolean;
  v_admin_only boolean;
  v_crosspost_marker uuid := NULL;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'auth required'; END IF;

  IF p_ecosystem_id IS NOT NULL THEN
    IF NOT public.is_ecosystem_member(p_ecosystem_id, v_uid) THEN
      RAISE EXCEPTION 'not a member of this ecosystem';
    END IF;

    IF p_public_crosspost THEN
      SELECT allow_public_crosspost, public_crosspost_requires_admin
        INTO v_allow, v_admin_only
      FROM public.ecosystems WHERE id = p_ecosystem_id;

      IF v_allow IS DISTINCT FROM true THEN
        RAISE EXCEPTION 'Este ecossistema não permite lives no feed público';
      END IF;
      IF v_admin_only = true AND NOT public.is_ecosystem_admin(p_ecosystem_id, v_uid) THEN
        RAISE EXCEPTION 'Apenas administradores podem transmitir para o feed público';
      END IF;
      v_crosspost_marker := p_ecosystem_id;
    END IF;
  ELSIF p_public_crosspost THEN
    -- No ecosystem to cross-post from — ignore the flag rather than fail.
    p_public_crosspost := false;
  END IF;

  -- end any previous lives of this host
  UPDATE public.live_sessions SET status='ended', ended_at=now() WHERE host_id=v_uid AND status='live';

  INSERT INTO public.live_sessions (
    host_id, title, cover_url, livekit_room, ecosystem_id,
    public_crosspost, crossposted_from_ecosystem_id
  )
  VALUES (
    v_uid, COALESCE(p_title,''), p_cover_url,
    'live_' || replace(gen_random_uuid()::text,'-',''),
    p_ecosystem_id,
    COALESCE(p_public_crosspost, false),
    v_crosspost_marker
  )
  RETURNING * INTO v_row;

  RETURN v_row;
END $function$;

GRANT EXECUTE ON FUNCTION public.start_live(text, text, uuid, boolean) TO authenticated;

-- 5) discover_public_* / discover_wavetube_videos / discover_waveshorts already
--    filter `ecosystem_id IS NULL`, which excludes the ecosystem row. The
--    public *mirror* row (inserted client-side with ecosystem_id=NULL and
--    crossposted_from_ecosystem_id set) is already picked up by those feeds.
--    No change needed there.
