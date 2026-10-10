-- Local replica of the production team/permission schema as of 2026-10-10.
-- Copied from the live Supabase project (read-only inspection). Used only to
-- test proposed permission changes on a throwaway local Postgres.
-- Contains no production data.

create extension if not exists pgcrypto;

-- Supabase stand-ins ---------------------------------------------------------
do $$ begin
  if not exists (select 1 from pg_roles where rolname = 'anon') then create role anon nologin; end if;
  if not exists (select 1 from pg_roles where rolname = 'authenticated') then create role authenticated nologin; end if;
  if not exists (select 1 from pg_roles where rolname = 'service_role') then create role service_role nologin bypassrls; end if;
end $$;

create schema if not exists auth;
grant usage on schema auth to anon, authenticated, service_role;
create or replace function auth.uid() returns uuid language sql stable as
$$ select nullif(current_setting('request.jwt.claims', true)::jsonb ->> 'sub', '')::uuid $$;
create or replace function auth.role() returns text language sql stable as
$$ select coalesce(current_setting('request.jwt.claims', true)::jsonb ->> 'role', '') $$;
create or replace function auth.jwt() returns jsonb language sql stable as
$$ select coalesce(current_setting('request.jwt.claims', true)::jsonb, '{}'::jsonb) $$;
grant execute on all functions in schema auth to anon, authenticated, service_role;

grant usage on schema public to anon, authenticated, service_role;

-- Tables (relevant columns) -------------------------------------------------
create table public.profiles (
  id uuid primary key, email text, full_name text, role text not null default 'cleaner',
  contact_name text, business_email text, created_at timestamptz default now(), updated_at timestamptz default now()
);
create table public.groups (
  id uuid primary key default gen_random_uuid(), name text not null, description text,
  created_by uuid not null, status text not null default 'active'
    check (status = any (array['active','inactive','archived'])),
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table public.group_members (
  id uuid primary key default gen_random_uuid(), group_id uuid not null, user_id uuid not null,
  role text not null default 'member', status text not null default 'active', invited_by uuid,
  joined_at timestamptz, created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  constraint group_members_role_check check (role = any (array['owner','administrator','manager','cleaner','team_member','homeowner','client','maintenance','member'])),
  constraint group_members_status_check check (status = any (array['invited','active','inactive','removed'])),
  constraint group_members_group_user_unique unique (group_id, user_id)
);
create table public.group_invites (
  id uuid primary key default gen_random_uuid(), group_id uuid not null, email text, phone_number text,
  invited_user_id uuid, invited_role text not null default 'member', invited_by uuid not null,
  expires_at timestamptz not null default now() + interval '7 days', accepted_at timestamptz, accepted_by uuid,
  status text not null default 'pending', created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  constraint group_invites_invited_role_check check (invited_role = any (array['administrator','manager','cleaner','team_member','homeowner','client','maintenance','member'])),
  constraint group_invites_status_check check (status = any (array['pending','accepted','declined','expired','revoked']))
);
create table public.group_contacts (
  id uuid primary key default gen_random_uuid(), group_id uuid not null, linked_user_id uuid,
  first_name text not null, last_name text not null, email text, role text not null default 'cleaner',
  status text not null default 'manual', created_by uuid not null, linked_at timestamptz,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table public.properties (
  id uuid primary key default gen_random_uuid(), owner_id uuid, property_name text not null, market text,
  address text, cleaning_fee numeric, owner_name text, owner_email text, owner_phone text,
  access_instructions text, wifi_name text, wifi_password text, parking_instructions text,
  trash_instructions text, supply_locations text, notes text, calendar_feed_url text, group_id uuid
);
create table public.reservations (
  id uuid primary key default gen_random_uuid(), owner_id uuid, property_id uuid, guest_name text,
  arrival date, departure date, source text, status text default 'Scheduled', notes text,
  timeline jsonb default '[]'::jsonb, group_id uuid, assigned_user_id uuid, assigned_contact_id uuid,
  customer_cleaning_charge numeric, created_at timestamptz default now()
);
create table public.cleaner_jobs (
  id uuid primary key default gen_random_uuid(), cleaner_id uuid not null, property_id uuid,
  customer_name text not null, job_type text not null, scheduled_date date not null,
  amount_cents integer not null default 0, notes text, status text not null default 'upcoming',
  assigned_user_id uuid, assigned_contact_id uuid,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table public.invoices (
  id uuid primary key default gen_random_uuid(), cleaner_id uuid not null, status text not null default 'draft',
  customer_name text not null, total_cents integer not null default 0, group_id uuid,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);

alter table public.group_members add constraint group_members_group_id_fkey foreign key (group_id) references public.groups(id) on delete cascade;
alter table public.group_invites add constraint group_invites_group_id_fkey foreign key (group_id) references public.groups(id) on delete cascade;
alter table public.group_contacts add constraint group_contacts_group_id_fkey foreign key (group_id) references public.groups(id) on delete cascade;

grant select, insert, update, delete on all tables in schema public to authenticated, service_role;
grant select on all tables in schema public to anon;

-- Functions (verbatim logic from production) --------------------------------
create or replace function public.set_amr_updated_at() returns trigger language plpgsql
set search_path to 'public', 'pg_temp' as $$ begin new.updated_at = now(); return new; end; $$;

create or replace function public.has_group_role(requested_group_id uuid, allowed_roles text[])
returns boolean language sql stable security definer set search_path to 'public', 'pg_temp' as $$
  select exists (select 1 from public.group_members gm where gm.group_id = requested_group_id
    and gm.user_id = auth.uid() and gm.status = 'active' and gm.role = any(allowed_roles));
$$;
create or replace function public.can_manage_group(requested_group_id uuid)
returns boolean language sql stable security definer set search_path to 'public', 'pg_temp' as $$
  select public.has_group_role(requested_group_id, array['owner', 'administrator', 'manager']::text[]);
$$;
create or replace function public.is_group_member(requested_group_id uuid)
returns boolean language sql stable security definer set search_path to 'public', 'pg_temp' as $$
  select exists (select 1 from public.group_members gm where gm.group_id = requested_group_id
    and gm.user_id = auth.uid() and gm.status = 'active');
$$;

create or replace function public.add_group_creator_as_owner() returns trigger language plpgsql
security definer set search_path to 'public', 'pg_temp' as $$
begin
  insert into public.group_members (group_id, user_id, role, status, invited_by, joined_at)
  values (new.id, new.created_by, 'owner', 'active', new.created_by, now())
  on conflict (group_id, user_id) do update set role = 'owner', status = 'active',
    joined_at = coalesce(public.group_members.joined_at, now()), updated_at = now();
  return new;
end; $$;

create or replace function public.link_group_contact_to_active_member() returns trigger language plpgsql
security definer set search_path to 'public' as $$
declare member_email text;
begin
  if new.status <> 'active' then return new; end if;
  select lower(coalesce(p.email, p.business_email)) into member_email from public.profiles p where p.id = new.user_id;
  if member_email is null then return new; end if;
  update public.group_contacts set linked_user_id = new.user_id, status = 'active',
    linked_at = coalesce(linked_at, now()), updated_at = now()
  where group_id = new.group_id and lower(email) = member_email and status in ('manual', 'invitation_pending');
  return new;
end; $$;

create or replace function public.accept_my_group_invite(p_invite_id uuid) returns void language plpgsql
security definer set search_path to 'public' as $$
declare
  v_user_id uuid := auth.uid();
  v_email text := lower(coalesce(auth.jwt() ->> 'email', ''));
  v_invite public.group_invites%rowtype;
begin
  if v_user_id is null then raise exception 'You must be signed in to accept an invitation.'; end if;
  select * into v_invite from public.group_invites where id = p_invite_id and lower(email) = v_email
    and status = 'pending' and expires_at > now() for update;
  if not found then raise exception 'This invitation is unavailable, expired, or belongs to another email address.'; end if;
  insert into public.profiles (id, role, email, created_at, updated_at)
  values (v_user_id, case when v_invite.invited_role in ('cleaner', 'team_member', 'maintenance') then 'employee'
    when v_invite.invited_role in ('owner', 'homeowner') then 'owner' else 'employee' end, v_email, now(), now())
  on conflict (id) do update set email = excluded.email, updated_at = now();
  insert into public.group_members (group_id, user_id, role, status, invited_by, joined_at, created_at, updated_at)
  values (v_invite.group_id, v_user_id, v_invite.invited_role, 'active', v_invite.invited_by, now(), now(), now())
  on conflict (group_id, user_id) do update set role = excluded.role, status = 'active',
    joined_at = coalesce(public.group_members.joined_at, now()), updated_at = now();
  update public.group_invites set status = 'accepted', accepted_at = now(), accepted_by = v_user_id, updated_at = now()
  where id = p_invite_id;
end; $$;

create or replace function public.decline_my_group_invite(p_invite_id uuid) returns void language plpgsql
security definer set search_path to 'public' as $$
declare v_email text := lower(coalesce(auth.jwt() ->> 'email', ''));
begin
  update public.group_invites set status = 'declined', updated_at = now()
  where id = p_invite_id and lower(email) = v_email and status = 'pending';
  if not found then raise exception 'This invitation is unavailable or belongs to another email address.'; end if;
end; $$;

create or replace function public.get_my_pending_group_invites()
returns table(invite_id uuid, group_id uuid, group_name text, invited_role text, expires_at timestamptz)
language sql security definer set search_path to 'public' as $$
  select gi.id, gi.group_id, g.name, gi.invited_role, gi.expires_at
  from public.group_invites gi join public.groups g on g.id = gi.group_id
  where lower(gi.email) = lower(coalesce(auth.jwt() ->> 'email', '')) and gi.status = 'pending'
    and gi.expires_at > now() and g.status = 'active' order by gi.created_at desc;
$$;

create or replace function public.create_my_business_workspace(p_name text)
returns table(group_id uuid, group_name text) language plpgsql security definer set search_path to 'public' as $$
declare v_user_id uuid := auth.uid(); v_name text := trim(coalesce(p_name, '')); v_group_id uuid;
begin
  if v_user_id is null then raise exception 'You must be signed in to create a business workspace.'; end if;
  if length(v_name) < 2 then raise exception 'Enter a valid business name.'; end if;
  insert into public.groups (name, description, created_by, status)
  values (v_name, 'Cleaning business workspace', v_user_id, 'active') returning id into v_group_id;
  return query select v_group_id, v_name;
end; $$;

-- Default Supabase behaviour: functions are executable by PUBLIC (incl. anon).
grant execute on all functions in schema public to public;

-- Triggers --------------------------------------------------------------------
create trigger add_group_creator_as_owner_trigger after insert on public.groups
  for each row execute function public.add_group_creator_as_owner();
create trigger link_group_contact_after_membership after insert or update on public.group_members
  for each row execute function public.link_group_contact_to_active_member();
create trigger set_group_members_updated_at before update on public.group_members
  for each row execute function public.set_amr_updated_at();
create trigger set_group_invites_updated_at before update on public.group_invites
  for each row execute function public.set_amr_updated_at();

-- RLS policies (verbatim from production) -------------------------------------
alter table public.profiles enable row level security;
alter table public.groups enable row level security;
alter table public.group_members enable row level security;
alter table public.group_invites enable row level security;
alter table public.group_contacts enable row level security;
alter table public.properties enable row level security;
alter table public.reservations enable row level security;
alter table public.cleaner_jobs enable row level security;
alter table public.invoices enable row level security;

create policy "Users can read their own profile" on public.profiles for select to authenticated using (auth.uid() = id);

create policy "Members can view their groups" on public.groups for select to authenticated using (is_group_member(id));
create policy "Authenticated users can create groups" on public.groups for insert to authenticated with check (created_by = auth.uid());
create policy "Group managers can update groups" on public.groups for update to authenticated using (can_manage_group(id)) with check (can_manage_group(id));
create policy "Group owners can delete groups" on public.groups for delete to authenticated using (has_group_role(id, array['owner']));

create policy "Members can view memberships in their groups" on public.group_members for select to authenticated using (is_group_member(group_id));
create policy "Group managers can add members" on public.group_members for insert to authenticated with check (can_manage_group(group_id));
create policy "Group managers can update members" on public.group_members for update to authenticated using (can_manage_group(group_id)) with check (can_manage_group(group_id));
create policy "Group managers can remove members" on public.group_members for delete to authenticated using (can_manage_group(group_id) and role <> 'owner');

create policy "Group managers can view group invitations" on public.group_invites for select to authenticated
  using (can_manage_group(group_id) or invited_user_id = auth.uid() or (email is not null and lower(email) = lower(coalesce(auth.jwt() ->> 'email', ''))));
create policy "Group managers can create invitations" on public.group_invites for insert to authenticated with check (can_manage_group(group_id) and invited_by = auth.uid());
create policy "Group managers can update invitations" on public.group_invites for update to authenticated using (can_manage_group(group_id)) with check (can_manage_group(group_id));
create policy "Group managers can delete invitations" on public.group_invites for delete to authenticated using (can_manage_group(group_id));

create policy "Assigned cleaners can read task properties" on public.properties for select to authenticated
  using (exists (select 1 from reservations r where r.property_id = properties.id and r.assigned_user_id = auth.uid()));
create policy "Group managers can read group properties" on public.properties for select to authenticated using (group_id is not null and can_manage_group(group_id));
create policy "Owners can read own properties" on public.properties for select to authenticated using (owner_id = auth.uid());

create policy "Group managers can manage group reservations" on public.reservations for all to authenticated
  using (group_id is not null and can_manage_group(group_id)) with check (group_id is not null and can_manage_group(group_id));
create policy "Assigned cleaners can read reservations" on public.reservations for select to authenticated using (assigned_user_id = auth.uid());
create policy "Owners can read own reservations" on public.reservations for select to authenticated using (owner_id = auth.uid());
create policy "Assigned cleaners can update reservations" on public.reservations for update to authenticated
  using (assigned_user_id = auth.uid()) with check (assigned_user_id = auth.uid());
create policy "Owners can update their reservations" on public.reservations for update to public
  using (auth.uid() = owner_id) with check (auth.uid() = owner_id);

create policy "cleaners_select_own_jobs" on public.cleaner_jobs for select to authenticated using (cleaner_id = auth.uid() or assigned_user_id = auth.uid());
create policy "cleaners_update_own_jobs" on public.cleaner_jobs for update to authenticated
  using (cleaner_id = auth.uid() or assigned_user_id = auth.uid()) with check (cleaner_id = auth.uid() or assigned_user_id = auth.uid());
create policy "cleaners_insert_own_jobs" on public.cleaner_jobs for insert to authenticated with check (cleaner_id = auth.uid());

create policy "Group managers can manage group invoices" on public.invoices for all to authenticated
  using (group_id is not null and can_manage_group(group_id)) with check (group_id is not null and can_manage_group(group_id));
create policy "Cleaners can read own invoices" on public.invoices for select to authenticated using (cleaner_id = auth.uid());
