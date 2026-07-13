-- 1) Store status-push shared secret in Vault + expose read RPC (service_role only)
do $$
declare
  _existing uuid;
begin
  select id into _existing from vault.secrets where name = 'STATUS_PUSH_SECRET' limit 1;
  if _existing is null then
    perform vault.create_secret(encode(gen_random_bytes(32), 'hex'), 'STATUS_PUSH_SECRET');
  end if;
end $$;

create or replace function public.get_status_push_secret()
returns text
language sql
security definer
set search_path = public, extensions, vault
as $$
  select decrypted_secret from vault.decrypted_secrets where name = 'STATUS_PUSH_SECRET' limit 1
$$;

revoke all on function public.get_status_push_secret() from public;
revoke all on function public.get_status_push_secret() from anon;
revoke all on function public.get_status_push_secret() from authenticated;
grant execute on function public.get_status_push_secret() to service_role;

-- 2) Update dispatch_status_push to read the secret from Vault (no hardcode)
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
set search_path = public, extensions, vault
as $$
declare
  _url text := 'https://project--84e5b2ed-fe1c-4906-b46d-5e198f0c6c1c.lovable.app/api/public/status-push';
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

-- 3) Restrict app_settings SELECT to admin/moderator roles only
drop policy if exists "Authenticated read settings" on public.app_settings;

create policy "Admins and moderators read settings"
on public.app_settings
for select
to authenticated
using (
  public.has_role(auth.uid(), 'admin')
  or public.has_role(auth.uid(), 'moderator')
);