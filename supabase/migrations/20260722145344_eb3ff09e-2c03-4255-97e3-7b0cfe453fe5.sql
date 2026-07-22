
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
  bdate DATE;
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

  BEGIN
    bdate := NULLIF(trim(NEW.raw_user_meta_data->>'birth_date'), '')::date;
  EXCEPTION WHEN OTHERS THEN
    bdate := NULL;
  END;

  -- Bloqueia menores de 15 anos no momento do cadastro por e-mail.
  IF bdate IS NOT NULL AND bdate > (CURRENT_DATE - INTERVAL '15 years') THEN
    RAISE EXCEPTION 'Você precisa ter pelo menos 15 anos para utilizar a Wavechat.'
      USING ERRCODE = 'check_violation';
  END IF;

  IF invite_username IS NOT NULL THEN
    SELECT id INTO inviter_id
    FROM public.profiles
    WHERE lower(username) = invite_username
    LIMIT 1;
  END IF;

  INSERT INTO public.profiles (id, username, display_name, invited_by,
    signup_source, signup_medium, signup_campaign, signup_referrer, signup_landing, onboarded, birth_date)
  VALUES (NEW.id, uname, dname, inviter_id,
    s_source, s_medium, s_campaign, s_referrer, s_landing,
    had_explicit_username AND had_explicit_display, bdate)
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

-- RPC para definir data de nascimento (usado no gate pós-OAuth do Google
-- e para contas antigas). Valida idade mínima no servidor.
CREATE OR REPLACE FUNCTION public.set_birth_date(_birth_date date)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'not authenticated' USING ERRCODE = '42501';
  END IF;
  IF _birth_date IS NULL OR _birth_date > CURRENT_DATE THEN
    RAISE EXCEPTION 'Data de nascimento inválida.' USING ERRCODE = 'check_violation';
  END IF;
  IF _birth_date > (CURRENT_DATE - INTERVAL '15 years') THEN
    RAISE EXCEPTION 'Você precisa ter pelo menos 15 anos para utilizar a Wavechat.'
      USING ERRCODE = 'check_violation';
  END IF;
  UPDATE public.profiles
     SET birth_date = _birth_date,
         updated_at = now()
   WHERE id = auth.uid();
END;
$$;

GRANT EXECUTE ON FUNCTION public.set_birth_date(date) TO authenticated;
