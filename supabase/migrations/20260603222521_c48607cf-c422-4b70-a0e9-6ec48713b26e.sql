CREATE OR REPLACE FUNCTION public.admin_user_confirmation_stats()
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  _confirmed int;
  _unconfirmed int;
  _unconfirmed_list jsonb;
  _confirmed_recent jsonb;
BEGIN
  -- Permission check is enforced by the calling server function (assertAdmin)
  -- using the service role key. auth.uid() is NULL here, so we skip the in-DB check.
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