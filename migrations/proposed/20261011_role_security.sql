-- PROPOSED — NOT APPLIED. Requires owner approval before running in production.
-- AMR team roles and permission hardening (part A).
-- Tested against tests/db/replica_current.sql with tests/db/role_security_tests.sql.
--
-- What this does:
--   1. Keeps "inspector" as a valid team role (it was in the app's menus but the
--      database rejected it).
--   2. Managers/administrators may add, change, or remove ONLY cleaners and
--      maintenance staff; they cannot promote anyone, change their own role, or
--      touch owners/managers/administrators. Owners keep full control, and a team
--      can never be left without an owner.
--   3. Managers may only invite cleaners and maintenance staff.
--   4. Assigned team members (cleaners, maintenance, inspectors) may change only a
--      task's status, shared job notes, and progress timeline — not charges,
--      customer details, dates, or assignments.
--   5. Adds private business notes (owners/managers only), separate from shared
--      job notes.
--   6. Removes anonymous (signed-out) access to the nine database functions.
-- It does NOT change anyone's role. No accounts are remapped.

begin;

-- 1. Allow inspector ---------------------------------------------------------
alter table public.group_members drop constraint group_members_role_check;
alter table public.group_members add constraint group_members_role_check check (role = any (array[
  'owner','administrator','manager','cleaner','team_member','homeowner','client','maintenance','inspector','member'])) ;
alter table public.group_invites drop constraint group_invites_invited_role_check;
alter table public.group_invites add constraint group_invites_invited_role_check check (invited_role = any (array[
  'administrator','manager','cleaner','team_member','homeowner','client','maintenance','inspector','member']));

-- Helper: the signed-in user's active role in a team -----------------------------
create or replace function public.my_group_role(requested_group_id uuid)
returns text language sql stable security definer set search_path to 'public', 'pg_temp' as $$
  select gm.role from public.group_members gm
  where gm.group_id = requested_group_id and gm.user_id = auth.uid() and gm.status = 'active'
  limit 1;
$$;

-- Internal writers (backend service, group-creation trigger, invite acceptance)
-- mark themselves as trusted for the current transaction only.
create or replace function public.amr_is_trusted_writer()
returns boolean language sql stable set search_path to 'public', 'pg_temp' as $$
  select auth.uid() is null
      or auth.role() = 'service_role'
      or coalesce(current_setting('amr.trusted_membership_write', true), '') = 'on';
$$;

-- 2. Membership hierarchy ---------------------------------------------------------
create or replace function public.enforce_group_member_hierarchy()
returns trigger language plpgsql security definer set search_path to 'public', 'pg_temp' as $$
declare
  v_group uuid := coalesce(new.group_id, old.group_id);
  v_actor text;
  v_staff constant text[] := array['cleaner', 'maintenance'];
begin
  -- Cascading delete of a whole team or account (only owners can delete a team,
  -- and only the auth system can delete an account).
  if tg_op = 'DELETE' and pg_trigger_depth() > 1 then
    return old;
  end if;

  if tg_op = 'UPDATE' and (new.group_id <> old.group_id or new.user_id <> old.user_id) then
    raise exception 'A membership cannot be moved to another team or person.';
  end if;

  -- Never leave a team without an active owner (applies to everyone). Skipped
  -- when the whole team or account is being deleted (cascading delete).
  if pg_trigger_depth() = 1
     and tg_op in ('UPDATE', 'DELETE') and old.role = 'owner' and old.status = 'active'
     and (tg_op = 'DELETE' or new.role <> 'owner' or new.status <> 'active')
     and not exists (select 1 from public.group_members gm where gm.group_id = v_group
                     and gm.role = 'owner' and gm.status = 'active' and gm.id <> old.id) then
    raise exception 'A team must keep at least one owner.';
  end if;

  if public.amr_is_trusted_writer() then
    return coalesce(new, old);
  end if;

  v_actor := public.my_group_role(v_group);

  if v_actor = 'owner' then
    return coalesce(new, old);
  end if;

  if v_actor in ('administrator', 'manager') then
    if tg_op in ('UPDATE', 'DELETE') and old.user_id = auth.uid() then
      raise exception 'You cannot change your own team role.';
    end if;
    if tg_op in ('UPDATE', 'DELETE') and not (old.role = any (v_staff)) then
      raise exception 'Managers can only manage cleaners and maintenance staff.';
    end if;
    if tg_op in ('INSERT', 'UPDATE') and not (new.role = any (v_staff)) then
      raise exception 'Managers can only assign the cleaner or maintenance role.';
    end if;
    return coalesce(new, old);
  end if;

  raise exception 'You do not have permission to change team membership.';
end; $$;

drop trigger if exists enforce_group_member_hierarchy on public.group_members;
create trigger enforce_group_member_hierarchy before insert or update or delete on public.group_members
  for each row execute function public.enforce_group_member_hierarchy();

-- 3. Invitation hierarchy ---------------------------------------------------------
create or replace function public.enforce_group_invite_hierarchy()
returns trigger language plpgsql security definer set search_path to 'public', 'pg_temp' as $$
declare v_actor text;
begin
  -- Accepting, declining, revoking, or expiring an invite does not change its role.
  if tg_op = 'UPDATE' and new.invited_role is not distinct from old.invited_role
     and new.group_id = old.group_id then
    return new;
  end if;
  if public.amr_is_trusted_writer() then return new; end if;
  v_actor := public.my_group_role(new.group_id);
  if v_actor = 'owner' then return new; end if;
  if v_actor in ('administrator', 'manager') and new.invited_role in ('cleaner', 'maintenance') then
    return new;
  end if;
  raise exception 'Managers can only invite cleaners and maintenance staff.';
end; $$;

drop trigger if exists enforce_group_invite_hierarchy on public.group_invites;
create trigger enforce_group_invite_hierarchy before insert or update on public.group_invites
  for each row execute function public.enforce_group_invite_hierarchy();

-- Trusted internal writers set the flag for their own transaction.
create or replace function public.add_group_creator_as_owner() returns trigger language plpgsql
security definer set search_path to 'public', 'pg_temp' as $$
begin
  perform set_config('amr.trusted_membership_write', 'on', true);
  insert into public.group_members (group_id, user_id, role, status, invited_by, joined_at)
  values (new.id, new.created_by, 'owner', 'active', new.created_by, now())
  on conflict (group_id, user_id) do update set role = 'owner', status = 'active',
    joined_at = coalesce(public.group_members.joined_at, now()), updated_at = now();
  perform set_config('amr.trusted_membership_write', 'off', true);
  return new;
end; $$;

create or replace function public.accept_my_group_invite(p_invite_id uuid) returns void language plpgsql
security definer set search_path to 'public' as $$
declare
  v_user_id uuid := auth.uid();
  v_email text := lower(coalesce(auth.jwt() ->> 'email', ''));
  v_invite public.group_invites%rowtype;
  v_existing_role text;
begin
  if v_user_id is null then raise exception 'You must be signed in to accept an invitation.'; end if;
  select * into v_invite from public.group_invites where id = p_invite_id and lower(email) = v_email
    and status = 'pending' and expires_at > now() for update;
  if not found then raise exception 'This invitation is unavailable, expired, or belongs to another email address.'; end if;

  -- An invitation must never demote an existing owner of the same team.
  select role into v_existing_role from public.group_members
  where group_id = v_invite.group_id and user_id = v_user_id;
  if v_existing_role = 'owner' then
    raise exception 'You already own this team.';
  end if;

  insert into public.profiles (id, role, email, created_at, updated_at)
  values (v_user_id, case when v_invite.invited_role in ('cleaner', 'team_member', 'maintenance', 'inspector') then 'employee'
    when v_invite.invited_role in ('owner', 'homeowner') then 'owner' else 'employee' end, v_email, now(), now())
  on conflict (id) do update set email = excluded.email, updated_at = now();

  perform set_config('amr.trusted_membership_write', 'on', true);
  insert into public.group_members (group_id, user_id, role, status, invited_by, joined_at, created_at, updated_at)
  values (v_invite.group_id, v_user_id, v_invite.invited_role, 'active', v_invite.invited_by, now(), now(), now())
  on conflict (group_id, user_id) do update set role = excluded.role, status = 'active',
    joined_at = coalesce(public.group_members.joined_at, now()), updated_at = now();
  perform set_config('amr.trusted_membership_write', 'off', true);

  update public.group_invites set status = 'accepted', accepted_at = now(), accepted_by = v_user_id, updated_at = now()
  where id = p_invite_id;
end; $$;

create or replace function public.decline_my_group_invite(p_invite_id uuid) returns void language plpgsql
security definer set search_path to 'public' as $$
declare v_email text := lower(coalesce(auth.jwt() ->> 'email', ''));
begin
  if auth.uid() is null or v_email = '' then
    raise exception 'You must be signed in to decline an invitation.';
  end if;
  update public.group_invites set status = 'declined', updated_at = now()
  where id = p_invite_id and lower(email) = v_email and status = 'pending';
  if not found then raise exception 'This invitation is unavailable or belongs to another email address.'; end if;
end; $$;

-- 4. Assigned team members: status, shared notes, and timeline only -----------------
create or replace function public.enforce_assigned_worker_fields()
returns trigger language plpgsql security definer set search_path to 'public', 'pg_temp' as $$
declare
  v_is_owner boolean;
  v_is_manager boolean := false;
  v_allowed constant text[] := array['status', 'notes', 'timeline', 'updated_at'];
begin
  if public.amr_is_trusted_writer() then return new; end if;

  if tg_table_name = 'reservations' then
    v_is_owner := old.owner_id = auth.uid();
    v_is_manager := old.group_id is not null and public.can_manage_group(old.group_id);
  else -- cleaner_jobs
    v_is_owner := old.cleaner_id = auth.uid();
  end if;

  if v_is_owner or v_is_manager then return new; end if;

  if (to_jsonb(new) - v_allowed) is distinct from (to_jsonb(old) - v_allowed) then
    raise exception 'Assigned team members can only update task status and shared job notes.';
  end if;
  return new;
end; $$;

drop trigger if exists enforce_assigned_worker_fields on public.reservations;
create trigger enforce_assigned_worker_fields before update on public.reservations
  for each row execute function public.enforce_assigned_worker_fields();
drop trigger if exists enforce_assigned_worker_fields on public.cleaner_jobs;
create trigger enforce_assigned_worker_fields before update on public.cleaner_jobs
  for each row execute function public.enforce_assigned_worker_fields();

-- 5. Private business notes (owners and managers only) ------------------------------
-- Shared job notes stay in the existing `notes` columns, visible to whoever is
-- assigned. Private notes live here and are never visible to assigned staff.
create table if not exists public.private_business_notes (
  id uuid primary key default gen_random_uuid(),
  entity_type text not null check (entity_type in ('property', 'reservation', 'cleaner_job')),
  entity_id uuid not null,
  group_id uuid,
  owner_id uuid not null default auth.uid(),
  body text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (entity_type, entity_id)
);
alter table public.private_business_notes enable row level security;
revoke all on public.private_business_notes from anon;
grant select, insert, update, delete on public.private_business_notes to authenticated;

create policy "Owners and managers read private notes" on public.private_business_notes
  for select to authenticated using (owner_id = auth.uid() or (group_id is not null and public.can_manage_group(group_id)));
create policy "Owners and managers add private notes" on public.private_business_notes
  for insert to authenticated with check (owner_id = auth.uid() and (group_id is null or public.can_manage_group(group_id)));
create policy "Owners and managers edit private notes" on public.private_business_notes
  for update to authenticated using (owner_id = auth.uid() or (group_id is not null and public.can_manage_group(group_id)))
  with check (owner_id = auth.uid() or (group_id is not null and public.can_manage_group(group_id)));
create policy "Owners and managers delete private notes" on public.private_business_notes
  for delete to authenticated using (owner_id = auth.uid() or (group_id is not null and public.can_manage_group(group_id)));

drop trigger if exists set_private_business_notes_updated_at on public.private_business_notes;
create trigger set_private_business_notes_updated_at before update on public.private_business_notes
  for each row execute function public.set_amr_updated_at();

-- 6. Function access ------------------------------------------------------------------
-- Signed-in flows keep working; signed-out (anon) callers lose access.
revoke execute on function public.accept_my_group_invite(uuid) from public, anon;
revoke execute on function public.decline_my_group_invite(uuid) from public, anon;
revoke execute on function public.get_my_pending_group_invites() from public, anon;
revoke execute on function public.create_my_business_workspace(text) from public, anon;
revoke execute on function public.can_manage_group(uuid) from public, anon;
revoke execute on function public.has_group_role(uuid, text[]) from public, anon;
revoke execute on function public.is_group_member(uuid) from public, anon;
revoke execute on function public.my_group_role(uuid) from public, anon;
grant execute on function public.accept_my_group_invite(uuid), public.decline_my_group_invite(uuid),
  public.get_my_pending_group_invites(), public.create_my_business_workspace(text),
  public.can_manage_group(uuid), public.has_group_role(uuid, text[]), public.is_group_member(uuid),
  public.my_group_role(uuid) to authenticated;

-- Trigger-only functions: nobody needs to call these directly. (Triggers still run;
-- PostgreSQL checks EXECUTE only when a trigger is created.)
revoke execute on function public.add_group_creator_as_owner() from public, anon, authenticated;
revoke execute on function public.link_group_contact_to_active_member() from public, anon, authenticated;
revoke execute on function public.enforce_group_member_hierarchy() from public, anon, authenticated;
revoke execute on function public.enforce_group_invite_hierarchy() from public, anon, authenticated;
revoke execute on function public.enforce_assigned_worker_fields() from public, anon, authenticated;

commit;
