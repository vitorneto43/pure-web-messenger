
-- Notify status owner on new comment
CREATE OR REPLACE FUNCTION public.notify_status_owner_on_comment()
RETURNS TRIGGER
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  _owner uuid;
  _commenter_name text;
  _preview text;
BEGIN
  SELECT user_id INTO _owner FROM public.statuses WHERE id = NEW.status_id;
  IF _owner IS NULL OR _owner = NEW.user_id THEN RETURN NEW; END IF;

  SELECT COALESCE(display_name, username, 'Alguém')
    INTO _commenter_name FROM public.profiles WHERE id = NEW.user_id;

  _preview := left(NEW.content, 120);

  INSERT INTO public.notifications (user_id, type, title, body, data)
  VALUES (
    _owner,
    'status_comment',
    _commenter_name || ' comentou no seu status',
    _preview,
    jsonb_build_object(
      'status_id', NEW.status_id,
      'comment_id', NEW.id,
      'from_user_id', NEW.user_id,
      'new_user_id', NEW.user_id
    )
  );
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_notify_status_owner_on_comment ON public.status_comments;
CREATE TRIGGER trg_notify_status_owner_on_comment
AFTER INSERT ON public.status_comments
FOR EACH ROW EXECUTE FUNCTION public.notify_status_owner_on_comment();

-- Notify status owner on new reaction
CREATE OR REPLACE FUNCTION public.notify_status_owner_on_reaction()
RETURNS TRIGGER
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  _owner uuid;
  _reactor_name text;
BEGIN
  SELECT user_id INTO _owner FROM public.statuses WHERE id = NEW.status_id;
  IF _owner IS NULL OR _owner = NEW.user_id THEN RETURN NEW; END IF;

  SELECT COALESCE(display_name, username, 'Alguém')
    INTO _reactor_name FROM public.profiles WHERE id = NEW.user_id;

  INSERT INTO public.notifications (user_id, type, title, body, data)
  VALUES (
    _owner,
    'status_reaction',
    _reactor_name || ' reagiu ao seu status ' || NEW.emoji,
    NULL,
    jsonb_build_object(
      'status_id', NEW.status_id,
      'emoji', NEW.emoji,
      'from_user_id', NEW.user_id,
      'new_user_id', NEW.user_id
    )
  );
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_notify_status_owner_on_reaction ON public.status_reactions;
CREATE TRIGGER trg_notify_status_owner_on_reaction
AFTER INSERT ON public.status_reactions
FOR EACH ROW EXECUTE FUNCTION public.notify_status_owner_on_reaction();
