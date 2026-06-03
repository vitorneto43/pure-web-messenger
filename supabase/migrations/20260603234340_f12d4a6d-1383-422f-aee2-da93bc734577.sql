
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS signup_source text,
  ADD COLUMN IF NOT EXISTS signup_medium text,
  ADD COLUMN IF NOT EXISTS signup_campaign text,
  ADD COLUMN IF NOT EXISTS signup_referrer text,
  ADD COLUMN IF NOT EXISTS signup_landing text;

UPDATE public.profiles
  SET signup_source = 'desconhecido'
  WHERE signup_source IS NULL;

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  uname TEXT;
  dname TEXT;
  uemail TEXT;
  invite_username TEXT;
  inviter_id UUID;
  s_source TEXT;
  s_medium TEXT;
  s_campaign TEXT;
  s_referrer TEXT;
  s_landing TEXT;
BEGIN
  uname := COALESCE(
    NEW.raw_user_meta_data->>'username',
    split_part(NEW.email, '@', 1) || substr(md5(random()::text), 1, 4)
  );
  dname := COALESCE(NEW.raw_user_meta_data->>'display_name', uname);
  uemail := NEW.email;
  invite_username := NULLIF(lower(trim(NEW.raw_user_meta_data->>'invite')), '');

  s_source   := NULLIF(trim(NEW.raw_user_meta_data->>'signup_source'),   '');
  s_medium   := NULLIF(trim(NEW.raw_user_meta_data->>'signup_medium'),   '');
  s_campaign := NULLIF(trim(NEW.raw_user_meta_data->>'signup_campaign'), '');
  s_referrer := NULLIF(trim(NEW.raw_user_meta_data->>'signup_referrer'), '');
  s_landing  := NULLIF(trim(NEW.raw_user_meta_data->>'signup_landing'),  '');

  IF s_source IS NULL THEN
    s_source := 'desconhecido';
  END IF;

  IF invite_username IS NOT NULL THEN
    SELECT id INTO inviter_id
    FROM public.profiles
    WHERE lower(username) = invite_username
    LIMIT 1;
  END IF;

  INSERT INTO public.profiles (id, username, display_name, invited_by,
    signup_source, signup_medium, signup_campaign, signup_referrer, signup_landing)
  VALUES (NEW.id, uname, dname, inviter_id,
    s_source, s_medium, s_campaign, s_referrer, s_landing)
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO public.profiles_private (user_id, email)
  VALUES (NEW.id, uemail)
  ON CONFLICT (user_id) DO UPDATE SET email = EXCLUDED.email;

  IF inviter_id IS NOT NULL THEN
    INSERT INTO public.notifications (user_id, type, title, body, data)
    VALUES (
      inviter_id,
      'invite_accepted',
      'Seu convite foi aceito!',
      dname || ' (' || uemail || ') criou uma conta usando seu link.',
      jsonb_build_object('new_user_id', NEW.id, 'username', uname, 'display_name', dname, 'email', uemail)
    );
  END IF;

  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.admin_signup_sources()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  _by_source jsonb;
  _by_campaign jsonb;
  _recent jsonb;
  _series jsonb;
  _total int;
BEGIN
  SELECT COUNT(*) INTO _total FROM public.profiles;

  SELECT COALESCE(jsonb_agg(row_to_json(t) ORDER BY (row_to_json(t)->>'count')::int DESC), '[]'::jsonb)
  INTO _by_source
  FROM (
    SELECT COALESCE(NULLIF(signup_source,''), 'desconhecido') AS source,
           COUNT(*)::int AS count
    FROM public.profiles
    GROUP BY 1
  ) t;

  SELECT COALESCE(jsonb_agg(row_to_json(t)), '[]'::jsonb)
  INTO _by_campaign
  FROM (
    SELECT COALESCE(NULLIF(signup_source,''), 'desconhecido') AS source,
           COALESCE(NULLIF(signup_campaign,''), '—') AS campaign,
           COALESCE(NULLIF(signup_medium,''), '—') AS medium,
           COUNT(*)::int AS count
    FROM public.profiles
    GROUP BY 1, 2, 3
    ORDER BY COUNT(*) DESC
    LIMIT 50
  ) t;

  SELECT COALESCE(jsonb_agg(row_to_json(t)), '[]'::jsonb)
  INTO _recent
  FROM (
    SELECT p.id, p.username, p.display_name, p.created_at,
           COALESCE(NULLIF(p.signup_source,''),'desconhecido') AS source,
           p.signup_medium, p.signup_campaign, p.signup_referrer
    FROM public.profiles p
    ORDER BY p.created_at DESC
    LIMIT 50
  ) t;

  SELECT COALESCE(jsonb_agg(row_to_json(t)), '[]'::jsonb)
  INTO _series
  FROM (
    SELECT to_char(date_trunc('day', created_at), 'YYYY-MM-DD') AS date,
           COALESCE(NULLIF(signup_source,''),'desconhecido') AS source,
           COUNT(*)::int AS count
    FROM public.profiles
    WHERE created_at >= now() - interval '30 days'
    GROUP BY 1, 2
    ORDER BY 1
  ) t;

  RETURN jsonb_build_object(
    'total', _total,
    'bySource', _by_source,
    'byCampaign', _by_campaign,
    'recent', _recent,
    'series', _series
  );
END;
$function$;
