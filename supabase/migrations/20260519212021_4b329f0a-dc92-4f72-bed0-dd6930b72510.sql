
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS email TEXT;

UPDATE public.profiles p
SET email = u.email
FROM auth.users u
WHERE p.id = u.id AND p.email IS NULL;

CREATE INDEX IF NOT EXISTS idx_profiles_email ON public.profiles (lower(email));

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
BEGIN
  uname := COALESCE(
    NEW.raw_user_meta_data->>'username',
    split_part(NEW.email, '@', 1) || substr(md5(random()::text), 1, 4)
  );
  dname := COALESCE(NEW.raw_user_meta_data->>'display_name', uname);
  uemail := NEW.email;
  invite_username := NULLIF(lower(trim(NEW.raw_user_meta_data->>'invite')), '');

  IF invite_username IS NOT NULL THEN
    SELECT id INTO inviter_id
    FROM public.profiles
    WHERE lower(username) = invite_username
    LIMIT 1;
  END IF;

  INSERT INTO public.profiles (id, username, display_name, email, invited_by)
  VALUES (NEW.id, uname, dname, uemail, inviter_id)
  ON CONFLICT (id) DO NOTHING;

  IF inviter_id IS NOT NULL THEN
    INSERT INTO public.notifications (user_id, type, title, body, data)
    VALUES (
      inviter_id,
      'invite_accepted',
      'Seu convite foi aceito!',
      dname || ' (' || uemail || ') criou uma conta usando seu link.',
      jsonb_build_object('new_user_id', NEW.id, 'username', uname, 'display_name', dname, 'email', uemail)
    );
  ELSE
    INSERT INTO public.notifications (user_id, type, title, body, data)
    SELECT
      p.id,
      'new_user',
      'Novo usuário no Wavechat',
      dname || ' (' || uemail || ') acabou de criar uma conta.',
      jsonb_build_object('new_user_id', NEW.id, 'username', uname, 'display_name', dname, 'email', uemail)
    FROM public.profiles p
    WHERE p.id <> NEW.id;
  END IF;

  RETURN NEW;
END;
$function$;
