
-- enums
do $$ begin
  create type public.group_visibility as enum ('private','public');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.group_category as enum ('business','tech','games','music','entertainment','relationships','travel','sports','education','other');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.group_join_policy as enum ('open','request');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.group_join_request_status as enum ('pending','approved','rejected');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.group_report_reason as enum ('spam','adult','violence','scam','copyright','other');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.group_report_status as enum ('pending','reviewed','dismissed','actioned');
exception when duplicate_object then null; end $$;

-- extend conversations
alter table public.conversations
  add column if not exists visibility public.group_visibility not null default 'private',
  add column if not exists category public.group_category,
  add column if not exists description text,
  add column if not exists join_policy public.group_join_policy not null default 'request',
  add column if not exists member_count integer not null default 0;

-- length guard via trigger (avoid CHECK on mutable text? simple check is fine — but use trigger for safety)
create or replace function public.validate_conversation_description()
returns trigger language plpgsql as $$
begin
  if new.description is not null and char_length(new.description) > 500 then
    raise exception 'description too long (max 500 chars)';
  end if;
  if new.name is not null and char_length(new.name) > 80 then
    raise exception 'name too long (max 80 chars)';
  end if;
  return new;
end $$;

drop trigger if exists trg_validate_conversation on public.conversations;
create trigger trg_validate_conversation
before insert or update on public.conversations
for each row execute function public.validate_conversation_description();

-- backfill member_count
update public.conversations c
set member_count = coalesce((
  select count(*) from public.conversation_members m
  where m.conversation_id = c.id and m.left_at is null
), 0);

-- maintain member_count via trigger
create or replace function public.bump_conversation_member_count()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'INSERT' then
    update public.conversations set member_count = member_count + 1 where id = new.conversation_id;
  elsif tg_op = 'DELETE' then
    update public.conversations set member_count = greatest(member_count - 1, 0) where id = old.conversation_id;
  end if;
  return null;
end $$;

drop trigger if exists trg_bump_member_count_ins on public.conversation_members;
create trigger trg_bump_member_count_ins
after insert on public.conversation_members
for each row execute function public.bump_conversation_member_count();

drop trigger if exists trg_bump_member_count_del on public.conversation_members;
create trigger trg_bump_member_count_del
after delete on public.conversation_members
for each row execute function public.bump_conversation_member_count();

-- public visibility: anyone (including anon) can read metadata of public groups
drop policy if exists "Public groups are visible to all" on public.conversations;
create policy "Public groups are visible to all"
  on public.conversations for select
  to anon, authenticated
  using (is_group = true and visibility = 'public');

grant select on public.conversations to anon;

-- group join requests
create table if not exists public.group_join_requests (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.conversations(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  status public.group_join_request_status not null default 'pending',
  message text,
  created_at timestamptz not null default now(),
  decided_at timestamptz,
  decided_by uuid references auth.users(id) on delete set null,
  unique (conversation_id, user_id)
);

grant select, insert, update, delete on public.group_join_requests to authenticated;
grant all on public.group_join_requests to service_role;

alter table public.group_join_requests enable row level security;

create policy "Users see their own join requests"
  on public.group_join_requests for select to authenticated
  using (auth.uid() = user_id);

create policy "Group admins see requests for their group"
  on public.group_join_requests for select to authenticated
  using (public.is_group_admin(conversation_id, auth.uid()));

create policy "Users create their own join request"
  on public.group_join_requests for insert to authenticated
  with check (auth.uid() = user_id);

create policy "Users cancel their own pending request"
  on public.group_join_requests for delete to authenticated
  using (auth.uid() = user_id and status = 'pending');

create policy "Group admins decide requests"
  on public.group_join_requests for update to authenticated
  using (public.is_group_admin(conversation_id, auth.uid()))
  with check (public.is_group_admin(conversation_id, auth.uid()));

-- approval trigger: when approved, insert membership
create or replace function public.handle_join_request_approval()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.status = 'approved' and (old.status is distinct from 'approved') then
    insert into public.conversation_members (conversation_id, user_id, role)
    values (new.conversation_id, new.user_id, 'member')
    on conflict (conversation_id, user_id) do nothing;
    new.decided_at = now();
  elsif new.status = 'rejected' and (old.status is distinct from 'rejected') then
    new.decided_at = now();
  end if;
  return new;
end $$;

drop trigger if exists trg_handle_join_request_approval on public.group_join_requests;
create trigger trg_handle_join_request_approval
before update on public.group_join_requests
for each row execute function public.handle_join_request_approval();

-- group reports
create table if not exists public.group_reports (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.conversations(id) on delete cascade,
  reporter_id uuid not null references auth.users(id) on delete cascade,
  reason public.group_report_reason not null,
  details text,
  status public.group_report_status not null default 'pending',
  created_at timestamptz not null default now(),
  reviewed_at timestamptz,
  reviewed_by uuid references auth.users(id) on delete set null
);

grant select, insert, update, delete on public.group_reports to authenticated;
grant all on public.group_reports to service_role;

alter table public.group_reports enable row level security;

create policy "Users see their own reports"
  on public.group_reports for select to authenticated
  using (auth.uid() = reporter_id);

create policy "Admins see all reports"
  on public.group_reports for select to authenticated
  using (public.has_role(auth.uid(), 'admin') or public.has_role(auth.uid(), 'moderator'));

create policy "Users create reports"
  on public.group_reports for insert to authenticated
  with check (auth.uid() = reporter_id);

create policy "Admins update reports"
  on public.group_reports for update to authenticated
  using (public.has_role(auth.uid(), 'admin') or public.has_role(auth.uid(), 'moderator'));
