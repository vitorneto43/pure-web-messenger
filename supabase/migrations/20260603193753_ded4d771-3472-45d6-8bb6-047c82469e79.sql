CREATE OR REPLACE FUNCTION public.is_wavechat_official_account(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.profiles_private pp
    WHERE pp.user_id = _user_id
      AND lower(pp.email) = 'wavechataplicativo@gmail.com'
  );
$$;

CREATE OR REPLACE FUNCTION public.mark_wavechat_official_status()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF public.is_wavechat_official_account(NEW.user_id) THEN
    NEW.is_official := true;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS mark_wavechat_official_status_before_write ON public.statuses;
CREATE TRIGGER mark_wavechat_official_status_before_write
BEFORE INSERT OR UPDATE OF user_id, is_official ON public.statuses
FOR EACH ROW
EXECUTE FUNCTION public.mark_wavechat_official_status();

CREATE OR REPLACE FUNCTION public.get_status_profile_cards(_user_ids uuid[])
RETURNS TABLE(id uuid, display_name text, avatar_url text)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT p.id, p.display_name, p.avatar_url
  FROM public.profiles p
  WHERE auth.uid() IS NOT NULL
    AND p.id = ANY(_user_ids)
    AND (
      p.id = auth.uid()
      OR public.has_role(p.id, 'admin'::public.app_role)
      OR public.users_share_conversation(auth.uid(), p.id)
      OR EXISTS (
        SELECT 1
        FROM public.statuses s
        WHERE s.user_id = p.id
          AND s.expires_at > now()
          AND (
            s.is_official = true
            OR EXISTS (
              SELECT 1
              FROM public.status_boosts sb
              WHERE sb.status_id = s.id
                AND sb.status = 'active'
                AND sb.views_remaining > 0
            )
          )
      )
    );
$$;

GRANT EXECUTE ON FUNCTION public.get_status_profile_cards(uuid[]) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_wavechat_official_account(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.mark_wavechat_official_status() TO service_role;