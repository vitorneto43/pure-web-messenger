
CREATE OR REPLACE FUNCTION public.search_users(q text)
RETURNS TABLE(id uuid, username text, display_name text, avatar_url text)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $function$
  SELECT p.id, p.username, p.display_name, p.avatar_url
  FROM public.profiles p
  JOIN auth.users u ON u.id = p.id
  WHERE auth.uid() IS NOT NULL
    AND p.id <> auth.uid()
    AND u.email_confirmed_at IS NOT NULL
    AND length(trim(q)) >= 1
    AND (
      p.username ILIKE '%' || q || '%'
      OR p.display_name ILIKE '%' || q || '%'
    )
  ORDER BY p.username
  LIMIT 20;
$function$;

CREATE OR REPLACE FUNCTION public.admin_user_confirmation_stats()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  _confirmed int;
  _unconfirmed int;
  _unconfirmed_list jsonb;
  _confirmed_recent jsonb;
BEGIN
  IF auth.uid() IS NULL OR NOT public.has_role(auth.uid(), 'admin'::public.app_role) THEN
    RAISE EXCEPTION 'Acesso negado';
  END IF;

  SELECT COUNT(*) INTO _confirmed FROM auth.users WHERE email_confirmed_at IS NOT NULL;
  SELECT COUNT(*) INTO _unconfirmed FROM auth.users WHERE email_confirmed_at IS NULL;

  SELECT COALESCE(jsonb_agg(row_to_json(t)), '[]'::jsonb) INTO _unconfirmed_list FROM (
    SELECT u.id, u.email, u.created_at,
           p.username, p.display_name
    FROM auth.users u
    LEFT JOIN public.profiles p ON p.id = u.id
    WHERE u.email_confirmed_at IS NULL
    ORDER BY u.created_at DESC
    LIMIT 50
  ) t;

  SELECT COALESCE(jsonb_agg(row_to_json(t)), '[]'::jsonb) INTO _confirmed_recent FROM (
    SELECT u.id, u.email, u.created_at, u.email_confirmed_at,
           p.username, p.display_name
    FROM auth.users u
    LEFT JOIN public.profiles p ON p.id = u.id
    WHERE u.email_confirmed_at IS NOT NULL
    ORDER BY u.email_confirmed_at DESC
    LIMIT 20
  ) t;

  RETURN jsonb_build_object(
    'confirmed', _confirmed,
    'unconfirmed', _unconfirmed,
    'unconfirmedList', _unconfirmed_list,
    'confirmedRecent', _confirmed_recent
  );
END;
$function$;

GRANT EXECUTE ON FUNCTION public.admin_user_confirmation_stats() TO authenticated;
