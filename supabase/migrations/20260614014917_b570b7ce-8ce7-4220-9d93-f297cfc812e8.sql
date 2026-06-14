
-- Replace status comment trigger: notify status owner only for top-level comments,
-- and notify parent-comment author when it's a reply.
CREATE OR REPLACE FUNCTION public.notify_status_owner_on_comment()
RETURNS TRIGGER
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  _owner uuid;
  _parent_author uuid;
  _from_name text;
  _preview text;
BEGIN
  SELECT COALESCE(display_name, username, 'Alguém')
    INTO _from_name FROM public.profiles WHERE id = NEW.user_id;
  _preview := left(NEW.content, 120);

  IF NEW.parent_id IS NOT NULL THEN
    SELECT user_id INTO _parent_author
      FROM public.status_comments WHERE id = NEW.parent_id;
    IF _parent_author IS NOT NULL AND _parent_author <> NEW.user_id THEN
      INSERT INTO public.notifications (user_id, type, title, body, data)
      VALUES (
        _parent_author,
        'comment_reply',
        _from_name || ' respondeu seu comentário',
        _preview,
        jsonb_build_object(
          'status_id', NEW.status_id,
          'comment_id', NEW.id,
          'parent_comment_id', NEW.parent_id,
          'from_user_id', NEW.user_id,
          'new_user_id', NEW.user_id
        )
      );
    END IF;
  ELSE
    SELECT user_id INTO _owner FROM public.statuses WHERE id = NEW.status_id;
    IF _owner IS NOT NULL AND _owner <> NEW.user_id THEN
      INSERT INTO public.notifications (user_id, type, title, body, data)
      VALUES (
        _owner,
        'status_comment',
        _from_name || ' comentou no seu status',
        _preview,
        jsonb_build_object(
          'status_id', NEW.status_id,
          'comment_id', NEW.id,
          'from_user_id', NEW.user_id,
          'new_user_id', NEW.user_id
        )
      );
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

-- Notify comment owner on new reaction to their comment
CREATE OR REPLACE FUNCTION public.notify_comment_owner_on_reaction()
RETURNS TRIGGER
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  _owner uuid;
  _status_id uuid;
  _from_name text;
BEGIN
  SELECT user_id, status_id INTO _owner, _status_id
    FROM public.status_comments WHERE id = NEW.comment_id;
  IF _owner IS NULL OR _owner = NEW.user_id THEN RETURN NEW; END IF;

  SELECT COALESCE(display_name, username, 'Alguém')
    INTO _from_name FROM public.profiles WHERE id = NEW.user_id;

  INSERT INTO public.notifications (user_id, type, title, body, data)
  VALUES (
    _owner,
    'comment_reaction',
    _from_name || ' reagiu ao seu comentário ' || NEW.emoji,
    NULL,
    jsonb_build_object(
      'status_id', _status_id,
      'comment_id', NEW.comment_id,
      'emoji', NEW.emoji,
      'from_user_id', NEW.user_id,
      'new_user_id', NEW.user_id
    )
  );
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_notify_comment_owner_on_reaction ON public.status_comment_reactions;
CREATE TRIGGER trg_notify_comment_owner_on_reaction
AFTER INSERT ON public.status_comment_reactions
FOR EACH ROW EXECUTE FUNCTION public.notify_comment_owner_on_reaction();
