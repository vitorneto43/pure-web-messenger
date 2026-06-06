
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS onboarded boolean NOT NULL DEFAULT false;

-- Marcar perfis antigos como já onboarded para não bombardear usuários atuais
UPDATE public.profiles SET onboarded = true WHERE created_at < now();

-- Atualizar handle_new_user: cadastros com display_name informado pelo formulário ficam onboarded=true; Google sem display_name customizado fica false
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
  had_explicit_username BOOLEAN;
  had_explicit_display BOOLEAN;
BEGIN
  had_explicit_username := NULLIF(trim(NEW.raw_user_meta_data->>'username'), '') IS NOT NULL;
  had_explicit_display := NULLIF(trim(NEW.raw_user_meta_data->>'display_name'), '') IS NOT NULL;

  uname := COALESCE(
    NEW.raw_user_meta_data->>'username',
    split_part(NEW.email, '@', 1) || substr(md5(random()::text), 1, 4)
  );
  dname := COALESCE(NEW.raw_user_meta_data->>'display_name', NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'name', uname);
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
    signup_source, signup_medium, signup_campaign, signup_referrer, signup_landing, onboarded)
  VALUES (NEW.id, uname, dname, inviter_id,
    s_source, s_medium, s_campaign, s_referrer, s_landing,
    had_explicit_username AND had_explicit_display)
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

-- RPC para validar e gravar nome/username escolhidos no onboarding
CREATE OR REPLACE FUNCTION public.complete_onboarding(_display_name text, _username text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  _uid uuid := auth.uid();
  _u text;
  _d text;
  _exists int;
BEGIN
  IF _uid IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  _u := lower(regexp_replace(trim(_username), '\s+', '_', 'g'));
  _d := trim(_display_name);
  IF length(_u) < 3 OR length(_u) > 24 OR _u !~ '^[a-z0-9_]+$' THEN
    RAISE EXCEPTION 'Nome de usuário inválido';
  END IF;
  IF length(_d) < 1 OR length(_d) > 60 THEN
    RAISE EXCEPTION 'Nome de exibição inválido';
  END IF;
  SELECT COUNT(*) INTO _exists FROM public.profiles WHERE lower(username) = _u AND id <> _uid;
  IF _exists > 0 THEN RAISE EXCEPTION 'Esse nome de usuário já está em uso'; END IF;
  UPDATE public.profiles
    SET username = _u, display_name = _d, onboarded = true, updated_at = now()
    WHERE id = _uid;
  RETURN jsonb_build_object('ok', true);
END;
$$;

GRANT EXECUTE ON FUNCTION public.complete_onboarding(text, text) TO authenticated;
