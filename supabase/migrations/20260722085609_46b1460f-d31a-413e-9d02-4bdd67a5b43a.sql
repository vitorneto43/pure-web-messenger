-- Dispatcher: video interactions -> /api/public/video-push
create or replace function public.dispatch_video_push(
  _video_id uuid,
  _sender_id uuid,
  _kind text,
  _comment_id uuid,
  _emoji text,
  _preview text
)
returns void
language plpgsql
security definer
set search_path = public, extensions, vault
as $$
declare
  _url text := 'https://project--84e5b2ed-fe1c-4906-b46d-5e198f0c6c1c.lovable.app/api/public/video-push';
  _secret text;
begin
  select decrypted_secret into _secret
  from vault.decrypted_secrets
  where name = 'STATUS_PUSH_SECRET'
  limit 1;
  if _secret is null then return; end if;

  perform net.http_post(
    url := _url,
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-dispatch-secret', _secret
    ),
    body := jsonb_build_object(
      'video_id', _video_id,
      'sender_id', _sender_id,
      'kind', _kind,
      'comment_id', _comment_id,
      'emoji', _emoji,
      'preview', _preview
    ),
    timeout_milliseconds := 4000
  );
exception when others then null;
end;
$$;

create or replace function public.trg_dispatch_video_comment_push()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  perform public.dispatch_video_push(
    new.video_id,
    new.user_id,
    case when new.parent_id is null then 'comment' else 'reply' end,
    new.parent_id,
    null,
    new.body
  );
  return new;
end;
$$;

drop trigger if exists trg_dispatch_video_comment_push on public.video_comments;
create trigger trg_dispatch_video_comment_push
after insert on public.video_comments
for each row execute function public.trg_dispatch_video_comment_push();

create or replace function public.trg_dispatch_video_reaction_push()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'UPDATE' and new.kind is not distinct from old.kind then
    return new;
  end if;
  -- Only positive reactions trigger a push
  if new.kind is distinct from 'like' then return new; end if;
  perform public.dispatch_video_push(
    new.video_id,
    new.user_id,
    'video_reaction',
    null,
    null,
    null
  );
  return new;
end;
$$;

drop trigger if exists trg_dispatch_video_reaction_push on public.video_reactions;
create trigger trg_dispatch_video_reaction_push
after insert or update on public.video_reactions
for each row execute function public.trg_dispatch_video_reaction_push();

create or replace function public.trg_dispatch_video_comment_reaction_push()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  _video_id uuid;
begin
  if new.kind is distinct from 'like' then return new; end if;
  select video_id into _video_id from public.video_comments where id = new.comment_id;
  if _video_id is null then return new; end if;
  perform public.dispatch_video_push(
    _video_id,
    new.user_id,
    'comment_reaction',
    new.comment_id,
    null,
    null
  );
  return new;
end;
$$;

drop trigger if exists trg_dispatch_video_comment_reaction_push on public.video_comment_reactions;
create trigger trg_dispatch_video_comment_reaction_push
after insert on public.video_comment_reactions
for each row execute function public.trg_dispatch_video_comment_reaction_push();

-- Dispatcher: live viewer joined -> /api/public/live-join-push
create or replace function public.dispatch_live_join_push(
  _live_id uuid,
  _viewer_id uuid
)
returns void
language plpgsql
security definer
set search_path = public, extensions, vault
as $$
declare
  _url text := 'https://project--84e5b2ed-fe1c-4906-b46d-5e198f0c6c1c.lovable.app/api/public/live-join-push';
  _secret text;
begin
  select decrypted_secret into _secret
  from vault.decrypted_secrets
  where name = 'STATUS_PUSH_SECRET'
  limit 1;
  if _secret is null then return; end if;

  perform net.http_post(
    url := _url,
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-dispatch-secret', _secret
    ),
    body := jsonb_build_object(
      'live_id', _live_id,
      'viewer_id', _viewer_id
    ),
    timeout_milliseconds := 4000
  );
exception when others then null;
end;
$$;

create or replace function public.trg_dispatch_live_join_push()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  _host uuid;
  _status text;
begin
  select host_id, status::text into _host, _status
  from public.live_sessions where id = new.live_id;
  if _host is null or _host = new.user_id then return new; end if;
  if _status is distinct from 'live' then return new; end if;
  perform public.dispatch_live_join_push(new.live_id, new.user_id);
  return new;
end;
$$;

drop trigger if exists trg_dispatch_live_join_push on public.live_viewers;
create trigger trg_dispatch_live_join_push
after insert on public.live_viewers
for each row execute function public.trg_dispatch_live_join_push();