
CREATE OR REPLACE FUNCTION public.admin_invites_overview()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _totals jsonb;
  _inviters jsonb;
  _recent jsonb;
BEGIN
  SELECT jsonb_build_object(
    'total_invites', COUNT(*)::int,
    'confirmed', COUNT(*) FILTER (WHERE u.email_confirmed_at IS NOT NULL)::int,
    'pending', COUNT(*) FILTER (WHERE u.email_confirmed_at IS NULL)::int,
    'unique_inviters', COUNT(DISTINCT p.invited_by)::int
  ) INTO _totals
  FROM public.profiles p
  LEFT JOIN auth.users u ON u.id = p.id
  WHERE p.invited_by IS NOT NULL;

  SELECT COALESCE(jsonb_agg(row_to_json(t) ORDER BY (row_to_json(t)->>'total')::int DESC), '[]'::jsonb)
  INTO _inviters
  FROM (
    SELECT
      ip.id AS inviter_id,
      ip.username AS inviter_username,
      ip.display_name AS inviter_name,
      ipp.email AS inviter_email,
      COUNT(*)::int AS total,
      COUNT(*) FILTER (WHERE u.email_confirmed_at IS NOT NULL)::int AS confirmed,
      COUNT(*) FILTER (WHERE u.email_confirmed_at IS NULL)::int AS pending,
      COALESCE(
        jsonb_agg(
          jsonb_build_object(
            'id', p.id,
            'username', p.username,
            'display_name', p.display_name,
            'email', pp.email,
            'created_at', p.created_at,
            'confirmed_at', u.email_confirmed_at,
            'status', CASE WHEN u.email_confirmed_at IS NOT NULL THEN 'confirmed' ELSE 'pending' END
          )
          ORDER BY p.created_at DESC
        ),
        '[]'::jsonb
      ) AS invitees
    FROM public.profiles p
    LEFT JOIN auth.users u ON u.id = p.id
    LEFT JOIN public.profiles_private pp ON pp.user_id = p.id
    JOIN public.profiles ip ON ip.id = p.invited_by
    LEFT JOIN public.profiles_private ipp ON ipp.user_id = ip.id
    WHERE p.invited_by IS NOT NULL
    GROUP BY ip.id, ip.username, ip.display_name, ipp.email
  ) t;

  SELECT COALESCE(jsonb_agg(row_to_json(r)), '[]'::jsonb) INTO _recent
  FROM (
    SELECT
      p.id, p.username, p.display_name, p.created_at,
      pp.email,
      u.email_confirmed_at,
      CASE WHEN u.email_confirmed_at IS NOT NULL THEN 'confirmed' ELSE 'pending' END AS status,
      ip.id AS inviter_id, ip.username AS inviter_username, ip.display_name AS inviter_name
    FROM public.profiles p
    LEFT JOIN auth.users u ON u.id = p.id
    LEFT JOIN public.profiles_private pp ON pp.user_id = p.id
    JOIN public.profiles ip ON ip.id = p.invited_by
    WHERE p.invited_by IS NOT NULL
    ORDER BY p.created_at DESC
    LIMIT 100
  ) r;

  RETURN jsonb_build_object(
    'totals', _totals,
    'inviters', _inviters,
    'recent', _recent
  );
END;
$$;
