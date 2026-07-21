
create or replace function public.dispatch_post_push(
  _post_id uuid,
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
  _url text := 'https://project--84e5b2ed-fe1c-4906-b46d-5e198f0c6c1c.lovable.app/api/public/post-push';
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
      'post_id', _post_id,
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

create or replace function public.trg_dispatch_post_comment_push()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.dispatch_post_push(
    new.post_id,
    new.user_id,
    case when new.parent_id is null then 'comment' else 'reply' end,
    new.parent_id,
    null,
    new.content
  );
  return new;
end;
$$;

drop trigger if exists trg_dispatch_post_comment_push on public.post_comments;
create trigger trg_dispatch_post_comment_push
after insert on public.post_comments
for each row execute function public.trg_dispatch_post_comment_push();

create or replace function public.trg_dispatch_post_reaction_push()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'UPDATE' and new.emoji is not distinct from old.emoji then
    return new;
  end if;
  perform public.dispatch_post_push(
    new.post_id,
    new.user_id,
    'post_reaction',
    null,
    new.emoji,
    null
  );
  return new;
end;
$$;

drop trigger if exists trg_dispatch_post_reaction_push on public.post_reactions;
create trigger trg_dispatch_post_reaction_push
after insert or update on public.post_reactions
for each row execute function public.trg_dispatch_post_reaction_push();

create or replace function public.trg_dispatch_post_comment_reaction_push()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  _post_id uuid;
begin
  select post_id into _post_id
  from public.post_comments
  where id = new.comment_id;
  if _post_id is null then
    return new;
  end if;
  perform public.dispatch_post_push(
    _post_id,
    new.user_id,
    'comment_reaction',
    new.comment_id,
    new.emoji,
    null
  );
  return new;
end;
$$;

drop trigger if exists trg_dispatch_post_comment_reaction_push on public.post_comment_reactions;
create trigger trg_dispatch_post_comment_reaction_push
after insert on public.post_comment_reactions
for each row execute function public.trg_dispatch_post_comment_reaction_push();
