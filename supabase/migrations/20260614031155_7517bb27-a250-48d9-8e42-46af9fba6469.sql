create or replace function public.dispatch_status_push(
  _status_id uuid,
  _sender_id uuid,
  _kind text,
  _comment_id uuid,
  _emoji text,
  _preview text
)
returns void
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  _url text := 'https://project--84e5b2ed-fe1c-4906-b46d-5e198f0c6c1c.lovable.app/api/public/status-push';
  _secret text := 'wc_status_push_v1_92f3a1e8b6d44c11';
begin
  perform net.http_post(
    url := _url,
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-dispatch-secret', _secret
    ),
    body := jsonb_build_object(
      'status_id', _status_id,
      'sender_id', _sender_id,
      'kind', _kind,
      'comment_id', _comment_id,
      'emoji', _emoji,
      'preview', _preview
    ),
    timeout_milliseconds := 4000
  );
exception when others then
  null;
end;
$$;

create or replace function public.trg_dispatch_status_comment_push()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.dispatch_status_push(
    new.status_id,
    new.user_id,
    case when new.parent_id is null then 'comment' else 'reply' end,
    new.parent_id,
    null,
    new.content
  );
  return new;
end;
$$;

drop trigger if exists trg_dispatch_status_comment_push on public.status_comments;
create trigger trg_dispatch_status_comment_push
after insert on public.status_comments
for each row execute function public.trg_dispatch_status_comment_push();

create or replace function public.trg_dispatch_status_reaction_push()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'UPDATE' and new.emoji is not distinct from old.emoji then
    return new;
  end if;
  perform public.dispatch_status_push(
    new.status_id,
    new.user_id,
    'status_reaction',
    null,
    new.emoji,
    null
  );
  return new;
end;
$$;

drop trigger if exists trg_dispatch_status_reaction_push on public.status_reactions;
create trigger trg_dispatch_status_reaction_push
after insert or update on public.status_reactions
for each row execute function public.trg_dispatch_status_reaction_push();

create or replace function public.trg_dispatch_status_comment_reaction_push()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  _status_id uuid;
begin
  select status_id into _status_id
  from public.status_comments
  where id = new.comment_id;
  if _status_id is null then
    return new;
  end if;
  perform public.dispatch_status_push(
    _status_id,
    new.user_id,
    'comment_reaction',
    new.comment_id,
    new.emoji,
    null
  );
  return new;
end;
$$;

drop trigger if exists trg_dispatch_status_comment_reaction_push on public.status_comment_reactions;
create trigger trg_dispatch_status_comment_reaction_push
after insert on public.status_comment_reactions
for each row execute function public.trg_dispatch_status_comment_reaction_push();