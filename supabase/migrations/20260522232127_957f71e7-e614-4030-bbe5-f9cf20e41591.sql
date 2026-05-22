-- 1. Drop the prior view + owner-only policy (replaced by column split)
DROP VIEW IF EXISTS public.profiles_public;
DROP POLICY IF EXISTS "Users can view own profile" ON public.profiles;

-- 2. Restore the prior contact-visible SELECT policy on safe columns
CREATE POLICY "Profiles viewable by self or shared conversation"
ON public.profiles
FOR SELECT
TO authenticated
USING ((id = auth.uid()) OR public.users_share_conversation(auth.uid(), id));

-- 3. Create profiles_private for sensitive data
CREATE TABLE public.profiles_private (
  user_id UUID PRIMARY KEY REFERENCES public.profiles(id) ON DELETE CASCADE,
  email TEXT,
  pix_key TEXT,
  pix_key_type TEXT,
  preferred_bank TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.profiles_private ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Owner reads own private profile"
ON public.profiles_private FOR SELECT TO authenticated
USING (user_id = auth.uid());

CREATE POLICY "Owner inserts own private profile"
ON public.profiles_private FOR INSERT TO authenticated
WITH CHECK (user_id = auth.uid());

CREATE POLICY "Owner updates own private profile"
ON public.profiles_private FOR UPDATE TO authenticated
USING (user_id = auth.uid())
WITH CHECK (user_id = auth.uid());

CREATE POLICY "Owner deletes own private profile"
ON public.profiles_private FOR DELETE TO authenticated
USING (user_id = auth.uid());

CREATE TRIGGER set_profiles_private_updated_at
BEFORE UPDATE ON public.profiles_private
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- 4. Backfill from existing profiles data
INSERT INTO public.profiles_private (user_id, email, pix_key, pix_key_type, preferred_bank)
SELECT id, email, pix_key, pix_key_type, preferred_bank
FROM public.profiles
WHERE email IS NOT NULL OR pix_key IS NOT NULL OR pix_key_type IS NOT NULL OR preferred_bank IS NOT NULL
ON CONFLICT (user_id) DO NOTHING;

-- 5. Drop sensitive columns from profiles
ALTER TABLE public.profiles
  DROP COLUMN IF EXISTS email,
  DROP COLUMN IF EXISTS pix_key,
  DROP COLUMN IF EXISTS pix_key_type,
  DROP COLUMN IF EXISTS preferred_bank;

-- 6. Update handle_new_user to write email into private table
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