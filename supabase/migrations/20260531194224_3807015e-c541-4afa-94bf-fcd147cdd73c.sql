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

  INSERT INTO public.profiles (id, username, display_name, invited_by)
  VALUES (NEW.id, uname, dname, inviter_id)
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO public.profiles_private (user_id, email)
  VALUES (NEW.id, uemail)
  ON CONFLICT (user_id) DO UPDATE SET email = EXCLUDED.email;

  -- PRIVACY FIX: only notify the inviter (when present).
  -- Do NOT broadcast a 'new_user' notification to everyone in the app.
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

-- Also purge old broadcast notifications already sent to all users
DELETE FROM public.notifications WHERE type = 'new_user';