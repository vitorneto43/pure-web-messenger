
-- Dispatcher: chama o endpoint que faz o fan-out para seguidores.
CREATE OR REPLACE FUNCTION public.dispatch_follower_content_push(
  _kind text,
  _content_id uuid,
  _author_id uuid
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'extensions', 'vault'
AS $function$
declare
  _url text := 'https://project--84e5b2ed-fe1c-4906-b46d-5e198f0c6c1c.lovable.app/api/public/follower-content-push';
  _secret text;
begin
  select decrypted_secret into _secret
  from vault.decrypted_secrets
  where name = 'STATUS_PUSH_SECRET'
  limit 1;

  if _secret is null then
    return;
  end if;

  perform net.http_post(
    url := _url,
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-dispatch-secret', _secret
    ),
    body := jsonb_build_object(
      'kind', _kind,
      'content_id', _content_id,
      'author_id', _author_id
    ),
    timeout_milliseconds := 4000
  );
exception when others then
  null;
end;
$function$;

-- Trigger fn para posts
CREATE OR REPLACE FUNCTION public.trg_dispatch_follower_post_push()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
begin
  if NEW.visibility is null or NEW.visibility in ('public','followers') then
    perform public.dispatch_follower_content_push('post', NEW.id, NEW.user_id);
  end if;
  return NEW;
end;
$function$;

-- Trigger fn para statuses
CREATE OR REPLACE FUNCTION public.trg_dispatch_follower_status_push()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
begin
  perform public.dispatch_follower_content_push('status', NEW.id, NEW.user_id);
  return NEW;
end;
$function$;

-- Trigger fn para videos (WaveTube e WaveShorts)
CREATE OR REPLACE FUNCTION public.trg_dispatch_follower_video_push()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
declare
  _kind text;
begin
  if COALESCE(NEW.visibility::text, 'public') not in ('public','followers') then
    return NEW;
  end if;
  _kind := case when NEW.is_short then 'short' else 'video' end;
  perform public.dispatch_follower_content_push(_kind, NEW.id, NEW.owner_id);
  return NEW;
end;
$function$;

DROP TRIGGER IF EXISTS trg_follower_post_push ON public.posts;
CREATE TRIGGER trg_follower_post_push
AFTER INSERT ON public.posts
FOR EACH ROW EXECUTE FUNCTION public.trg_dispatch_follower_post_push();

DROP TRIGGER IF EXISTS trg_follower_status_push ON public.statuses;
CREATE TRIGGER trg_follower_status_push
AFTER INSERT ON public.statuses
FOR EACH ROW EXECUTE FUNCTION public.trg_dispatch_follower_status_push();

DROP TRIGGER IF EXISTS trg_follower_video_push ON public.videos;
CREATE TRIGGER trg_follower_video_push
AFTER INSERT ON public.videos
FOR EACH ROW EXECUTE FUNCTION public.trg_dispatch_follower_video_push();
