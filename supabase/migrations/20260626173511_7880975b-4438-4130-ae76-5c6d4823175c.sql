
-- Extract @usernames (case-insensitive, 2-30 chars)
CREATE OR REPLACE FUNCTION public.extract_mentions(p_text text)
RETURNS text[]
LANGUAGE sql
IMMUTABLE
SET search_path = public
AS $$
  SELECT COALESCE(
    array_agg(DISTINCT lower(m[1])),
    '{}'::text[]
  )
  FROM regexp_matches(COALESCE(p_text, ''), '(?:^|[^A-Za-z0-9_])@([A-Za-z0-9_]{2,30})', 'g') AS m;
$$;

-- MESSAGES
CREATE OR REPLACE FUNCTION public.tg_notify_mentions_messages()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  uname text;
  target uuid;
BEGIN
  IF NEW.content IS NULL THEN RETURN NEW; END IF;
  FOREACH uname IN ARRAY public.extract_mentions(NEW.content) LOOP
    SELECT id INTO target FROM public.profiles WHERE lower(username) = uname LIMIT 1;
    IF target IS NULL OR target = NEW.sender_id THEN CONTINUE; END IF;
    IF NOT EXISTS (SELECT 1 FROM public.conversation_members
                   WHERE conversation_id = NEW.conversation_id AND user_id = target) THEN CONTINUE; END IF;
    IF EXISTS (SELECT 1 FROM public.user_blocks WHERE blocker_id = target AND blocked_id = NEW.sender_id) THEN CONTINUE; END IF;
    INSERT INTO public.notifications (user_id, type, title, body, data)
    VALUES (target, 'mention', 'Você foi mencionado',
            left(NEW.content, 140),
            jsonb_build_object('source','message','conversation_id', NEW.conversation_id,
                               'message_id', NEW.id, 'actor_id', NEW.sender_id));
  END LOOP;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS trg_notify_mentions_messages ON public.messages;
CREATE TRIGGER trg_notify_mentions_messages AFTER INSERT ON public.messages
FOR EACH ROW EXECUTE FUNCTION public.tg_notify_mentions_messages();

-- POST_COMMENTS
CREATE OR REPLACE FUNCTION public.tg_notify_mentions_post_comments()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  uname text;
  target uuid;
BEGIN
  FOREACH uname IN ARRAY public.extract_mentions(NEW.content) LOOP
    SELECT id INTO target FROM public.profiles WHERE lower(username) = uname LIMIT 1;
    IF target IS NULL OR target = NEW.user_id THEN CONTINUE; END IF;
    IF EXISTS (SELECT 1 FROM public.user_blocks WHERE blocker_id = target AND blocked_id = NEW.user_id) THEN CONTINUE; END IF;
    INSERT INTO public.notifications (user_id, type, title, body, data)
    VALUES (target, 'mention', 'Você foi mencionado em um comentário',
            left(NEW.content, 140),
            jsonb_build_object('source','post_comment','post_id', NEW.post_id,
                               'comment_id', NEW.id, 'actor_id', NEW.user_id));
  END LOOP;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS trg_notify_mentions_post_comments ON public.post_comments;
CREATE TRIGGER trg_notify_mentions_post_comments AFTER INSERT ON public.post_comments
FOR EACH ROW EXECUTE FUNCTION public.tg_notify_mentions_post_comments();

-- POSTS
CREATE OR REPLACE FUNCTION public.tg_notify_mentions_posts()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  uname text;
  target uuid;
  src text;
BEGIN
  src := COALESCE(NEW.content,'') || ' ' || COALESCE(NEW.caption,'');
  FOREACH uname IN ARRAY public.extract_mentions(src) LOOP
    SELECT id INTO target FROM public.profiles WHERE lower(username) = uname LIMIT 1;
    IF target IS NULL OR target = NEW.user_id THEN CONTINUE; END IF;
    IF EXISTS (SELECT 1 FROM public.user_blocks WHERE blocker_id = target AND blocked_id = NEW.user_id) THEN CONTINUE; END IF;
    INSERT INTO public.notifications (user_id, type, title, body, data)
    VALUES (target, 'mention', 'Você foi mencionado em um post',
            left(src, 140),
            jsonb_build_object('source','post','post_id', NEW.id, 'actor_id', NEW.user_id));
  END LOOP;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS trg_notify_mentions_posts ON public.posts;
CREATE TRIGGER trg_notify_mentions_posts AFTER INSERT ON public.posts
FOR EACH ROW EXECUTE FUNCTION public.tg_notify_mentions_posts();

-- STATUS_COMMENTS
CREATE OR REPLACE FUNCTION public.tg_notify_mentions_status_comments()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  uname text;
  target uuid;
BEGIN
  FOREACH uname IN ARRAY public.extract_mentions(NEW.content) LOOP
    SELECT id INTO target FROM public.profiles WHERE lower(username) = uname LIMIT 1;
    IF target IS NULL OR target = NEW.user_id THEN CONTINUE; END IF;
    IF EXISTS (SELECT 1 FROM public.user_blocks WHERE blocker_id = target AND blocked_id = NEW.user_id) THEN CONTINUE; END IF;
    INSERT INTO public.notifications (user_id, type, title, body, data)
    VALUES (target, 'mention', 'Você foi mencionado em um story',
            left(NEW.content, 140),
            jsonb_build_object('source','status_comment','status_id', NEW.status_id,
                               'comment_id', NEW.id, 'actor_id', NEW.user_id));
  END LOOP;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS trg_notify_mentions_status_comments ON public.status_comments;
CREATE TRIGGER trg_notify_mentions_status_comments AFTER INSERT ON public.status_comments
FOR EACH ROW EXECUTE FUNCTION public.tg_notify_mentions_status_comments();

-- LIVE_CHAT_MESSAGES
CREATE OR REPLACE FUNCTION public.tg_notify_mentions_live_chat()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  uname text;
  target uuid;
BEGIN
  FOREACH uname IN ARRAY public.extract_mentions(NEW.body) LOOP
    SELECT id INTO target FROM public.profiles WHERE lower(username) = uname LIMIT 1;
    IF target IS NULL OR target = NEW.user_id THEN CONTINUE; END IF;
    IF EXISTS (SELECT 1 FROM public.user_blocks WHERE blocker_id = target AND blocked_id = NEW.user_id) THEN CONTINUE; END IF;
    INSERT INTO public.notifications (user_id, type, title, body, data)
    VALUES (target, 'mention', 'Você foi mencionado em uma live',
            left(NEW.body, 140),
            jsonb_build_object('source','live_chat','live_id', NEW.live_id,
                               'message_id', NEW.id, 'actor_id', NEW.user_id));
  END LOOP;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS trg_notify_mentions_live_chat ON public.live_chat_messages;
CREATE TRIGGER trg_notify_mentions_live_chat AFTER INSERT ON public.live_chat_messages
FOR EACH ROW EXECUTE FUNCTION public.tg_notify_mentions_live_chat();

-- Allow searching profiles by username prefix for autocomplete (already covered by public read policy on profiles).
CREATE INDEX IF NOT EXISTS profiles_username_lower_idx ON public.profiles (lower(username));
