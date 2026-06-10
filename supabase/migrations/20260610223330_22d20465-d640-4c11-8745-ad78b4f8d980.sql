CREATE OR REPLACE FUNCTION public.notify_on_new_follow()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _name text;
  _username text;
BEGIN
  SELECT display_name, username INTO _name, _username FROM public.profiles WHERE id = NEW.follower_id;
  INSERT INTO public.notifications(user_id, type, title, body, data)
  VALUES (
    NEW.following_id,
    'new_follower',
    COALESCE(_name, COALESCE(_username, 'Alguém')) || ' começou a seguir você',
    '',
    jsonb_build_object('follower_id', NEW.follower_id, 'username', _username)
  );
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS notify_on_new_follow_trg ON public.profile_follows;
CREATE TRIGGER notify_on_new_follow_trg
AFTER INSERT ON public.profile_follows
FOR EACH ROW EXECUTE FUNCTION public.notify_on_new_follow();